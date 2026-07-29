const { createClient } = require("@supabase/supabase-js");

const prodUrl = "https://bliuwvkdtvxmteyzuzds.supabase.co";
const prodAnonKey = "sb_publishable_-YlHrBy4MBZpCnHCZl4sXg_u3buvMYp";
const purchaseUrl = "https://jcgmyvxcamstnhuwmemc.supabase.co";
const purchaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpjZ215dnhjYW1zdG5odXdtZW1jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwMDgyODAsImV4cCI6MjA4NTU4NDI4MH0.wMKYEcXGOgrRwy7DKBlBz-a_mWhAuZaknG_iXYvKLLo";

const prodSupabase = createClient(prodUrl, prodAnonKey);
const purchaseSupabase = createClient(purchaseUrl, purchaseAnonKey);

function normFirm(name) {
  const str = String(name || "").toLowerCase().trim();
  if (str.includes("purab")) return "purab";
  if (str.includes("pmmpl")) return "pmmpl";
  if (str.includes("rkl")) return "rkl";
  return str;
}

function normProd(name) {
  return String(name || "").toLowerCase().trim();
}

async function testFallbackLogic() {
  const [
    { data: rawData },
    { data: semiActualData },
    { data: crushingActualData }
  ] = await Promise.all([
    purchaseSupabase.from("LIFT-ACCOUNTS").select("*").order("Timestamp", { ascending: false }),
    prodSupabase.from("semi_actual").select("*").order("id", { ascending: false }),
    prodSupabase.from("crushing_actual").select("*").order("id", { ascending: false })
  ]);

  const recordMap = new Map();

  // 1. Populate direct purchase entries from LIFT-ACCOUNTS
  for (const row of rawData || []) {
    const firmName = String(row["Firm Name"] || "N/A").trim();
    const productName = String(row["Raw Material Name"] || row["Product Name"] || "N/A").trim();
    if (!firmName || !productName) continue;

    const key = `${firmName.toLowerCase()}___${productName.toLowerCase()}`;
    if (!recordMap.has(key)) {
      recordMap.set(key, {
        firmName,
        productName,
        alumina: null,
        iron: null,
        price: null,
        baseRate: null,
        transportRate: null,
        procCost: 0,
        procCostSource: undefined,
        bd: null,
        ap: null,
        timestamp: row["Timestamp"],
      });
    }

    const rec = recordMap.get(key);
    if (rec.alumina === null && row["Alumina Percent Age %"] != null && !isNaN(Number(row["Alumina Percent Age %"]))) rec.alumina = parseFloat(row["Alumina Percent Age %"]);
    if (rec.iron === null && row["Iron Percent Age %"] != null && !isNaN(Number(row["Iron Percent Age %"]))) rec.iron = parseFloat(row["Iron Percent Age %"]);
    if (rec.bd === null && row["BD Percent Age %"] != null && !isNaN(Number(row["BD Percent Age %"]))) rec.bd = parseFloat(row["BD Percent Age %"]);
    if (rec.ap === null && row["AP Percent Age %"] != null && !isNaN(Number(row["AP Percent Age %"]))) rec.ap = parseFloat(row["AP Percent Age %"]);

    if (rec.price === null && row["Rate"] != null && !isNaN(Number(row["Rate"]))) {
      const baseRate = parseFloat(row["Rate"]);
      let transportRate = (row["Transporting Rate"] != null && !isNaN(Number(row["Transporting Rate"]))) ? parseFloat(row["Transporting Rate"]) : 0;
      const rateType = String(row["Type Of Transporting Rate"] || "").trim().toLowerCase();
      if ((transportRate === 0 || isNaN(transportRate)) && rateType === "fixed") {
        const totalTransportAmount = Number(row["Transporter Rate"] || 0);
        const billingQty = Number(row["Lifting Qty"] || row["Total Bill Quantity"] || row["Actual Quantity"] || row["Qty"] || 0);
        if (totalTransportAmount > 0 && billingQty > 0) transportRate = totalTransportAmount / billingQty;
      }
      rec.baseRate = baseRate;
      rec.transportRate = transportRate;
      rec.price = baseRate + transportRate;
    }
  }

  // 2. Synthesize crushed grains
  function findParentRecord(firmName, parentName, fgName) {
    const normF = normFirm(firmName);
    const normP = normProd(parentName);
    const normFg = normProd(fgName);

    const cleanP = normP.replace(/\s+/g, "").replace("lumps", "").replace("slag", "");
    const fgBase = normFg.split("(")[0].trim().replace(/\s+/g, "");

    let parentRec = recordMap.get(`${normF}___${normP}`);
    if (parentRec) return parentRec;

    for (const [k, v] of recordMap.entries()) {
      if (k.startsWith(`${normF}___`)) {
        const pNameInMap = k.split("___")[1].replace(/\s+/g, "").replace("lumps", "").replace("slag", "");
        if (pNameInMap === cleanP || pNameInMap === fgBase) return v;
      }
    }

    for (const [k, v] of recordMap.entries()) {
      const pNameInMap = k.split("___")[1].replace(/\s+/g, "").replace("lumps", "").replace("slag", "");
      if (pNameInMap === cleanP || pNameInMap === fgBase) return v;
    }
    return null;
  }

  (crushingActualData || []).forEach(row => {
    const firmName = String(row["Firm Name"] || row["Firm name"] || "").trim();
    const parentProdName = String(row["Crushing Product Name"] || "").trim();
    if (!firmName) return;

    for (let i = 1; i <= 4; i++) {
      const fgName = String(row[`Finished Goods Name ${i}`] || "").trim();
      const fgCost = Number(row[`Processing Cost ${i}`] || 0);
      if (!fgName) continue;

      const grainKey = `${firmName.toLowerCase()}___${fgName.toLowerCase()}`;
      if (!recordMap.has(grainKey)) {
        const parentRec = findParentRecord(firmName, parentProdName, fgName);
        const bRate = parentRec ? parentRec.baseRate : null;
        const tRate = parentRec ? parentRec.transportRate : null;
        const calcPrice = (bRate || 0) + (tRate || 0) + fgCost;

        recordMap.set(grainKey, {
          firmName,
          productName: fgName,
          alumina: parentRec ? parentRec.alumina : null,
          iron: parentRec ? parentRec.iron : null,
          price: calcPrice > 0 ? calcPrice : null,
          baseRate: bRate,
          transportRate: tRate,
          procCost: fgCost,
          procCostSource: "crushing",
          bd: parentRec ? parentRec.bd : null,
          ap: parentRec ? parentRec.ap : null,
        });
      }
    }
  });

  const knownFirms = Array.from(new Set(Array.from(recordMap.values()).map(r => r.firmName).filter(Boolean)));

  function findGrainRateForFines(targetFirm, finesProdName) {
    const normF = normFirm(targetFirm);
    const cleanBase = normProd(finesProdName).replace("fines", "").replace("fine", "").replace(/\s+/g, "");

    for (const [k, v] of recordMap.entries()) {
      if (normF && k.startsWith(`${normF}___`)) {
        const pNameInMap = k.split("___")[1];
        const cleanedP = pNameInMap.replace(/\s+/g, "");
        if (cleanedP.startsWith(cleanBase) && (cleanedP.includes("(0-1)") || cleanedP.includes("(1-3)") || cleanedP.includes("(3-5)"))) {
          if (v.price && v.price > 0) return v;
        }
      }
    }

    for (const [k, v] of recordMap.entries()) {
      const pNameInMap = k.split("___")[1];
      const cleanedP = pNameInMap.replace(/\s+/g, "");
      if (cleanedP.startsWith(cleanBase) && (cleanedP.includes("(0-1)") || cleanedP.includes("(1-3)") || cleanedP.includes("(3-5)"))) {
        if (v.price && v.price > 0) return v;
      }
    }

    return null;
  }

  // 3. Process semi_actual fines products with processing cost > 0
  const semiFinesList = [];
  const processedFinesSet = new Set();
  (semiActualData || []).forEach((row) => {
    const prodName = String(row["Product Name"] || "").trim();
    const procCost = Number(row["Processing Cost"] || 0);
    const rawFirm = String(row["Firm name"] || row["Firm Name"] || "").trim();

    if (prodName && procCost > 0 && !processedFinesSet.has(normProd(prodName))) {
      processedFinesSet.add(normProd(prodName));
      semiFinesList.push({ productName: prodName, procCost, rawFirm });
    }
  });

  semiFinesList.forEach((item) => {
    const targetFirms = item.rawFirm ? [item.rawFirm] : knownFirms;

    targetFirms.forEach((fName) => {
      const grainRec = findGrainRateForFines(fName, item.productName);
      const displayFirm = fName || (grainRec ? grainRec.firmName : "N/A");
      const grainKey = `${normFirm(displayFirm)}___${item.productName.toLowerCase()}`;

      if (grainRec) {
        // Grain rate available -> Grain BaseRate + Freight + Fines Processing Cost
        const bRate = grainRec.baseRate ?? null;
        const tRate = grainRec.transportRate ?? null;
        const grainTotalPrice = (bRate || 0) + (tRate || 0);
        const finalPrice = grainTotalPrice + item.procCost;

        recordMap.set(grainKey, {
          firmName: displayFirm,
          productName: item.productName,
          alumina: grainRec.alumina,
          iron: grainRec.iron,
          price: finalPrice > 0 ? finalPrice : null,
          baseRate: bRate,
          transportRate: tRate,
          procCost: item.procCost,
          procCostSource: "semi",
          bd: grainRec.bd,
          ap: grainRec.ap,
          timestamp: grainRec.timestamp,
        });
      } else if (recordMap.has(grainKey)) {
        // No grain rate available, BUT product exists in purchase (LIFT-ACCOUNTS)
        // Fallback: Use Purchase Base Rate + Transport Rate + Production Entry Processing Cost
        const existingPurchase = recordMap.get(grainKey);
        const bRate = existingPurchase.baseRate ?? 0;
        const tRate = existingPurchase.transportRate ?? 0;
        const finalPrice = bRate + tRate + item.procCost;

        existingPurchase.procCost = item.procCost;
        existingPurchase.procCostSource = "semi";
        existingPurchase.price = finalPrice > 0 ? finalPrice : null;
      }
    });
  });

  console.log("=== Fallback Logic Verification ===");
  console.log("1. MC - 80 Lumps (No semi_actual proc cost, direct purchase):");
  console.log(recordMap.get("pmmpl___mc - 80 lumps"));

  console.log("\n2. Pyro Fines (Pmmpl - Grain match found -> Grain Rate + Proc Cost):");
  console.log(recordMap.get("pmmpl___pyro fines"));

  console.log("\n3. MC - 75 Fines (No grain match found -> Fallback to Purchase Rate + Proc Cost):");
  console.log(recordMap.get("rkl___mc- 75 fines") || recordMap.get("purab___mc- 75 fines") || recordMap.get("pmmpl___mc- 75 fines"));
}

testFallbackLogic();
