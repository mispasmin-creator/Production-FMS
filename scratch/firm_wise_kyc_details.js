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

async function firmWiseKycDetails() {
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

  for (const row of rawData || []) {
    const firmName = String(row["Firm Name"] || "N/A").trim();
    const productName = String(row["Raw Material Name"] || row["Product Name"] || "N/A").trim();
    if (!firmName || !productName) continue;

    const key = `${firmName.toLowerCase()}___${productName.toLowerCase()}`;
    if (!recordMap.has(key)) {
      recordMap.set(key, {
        firmName,
        productName,
        price: null,
        baseRate: null,
        transportRate: null,
        procCost: 0,
      });
    }

    const rec = recordMap.get(key);
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
          price: calcPrice > 0 ? calcPrice : null,
          baseRate: bRate,
          transportRate: tRate,
          procCost: fgCost,
          procCostSource: "crushing",
        });
      }
    }
  });

  const knownFirms = Array.from(new Set(Array.from(recordMap.values()).map(r => r.firmName).filter(Boolean)));

  function findGrainRateForFines(targetFirm, finesProdName) {
    const normF = normFirm(targetFirm);
    if (!normF) return null;
    const cleanBase = normProd(finesProdName).replace("fines", "").replace("fine", "").replace(/\s+/g, "");

    for (const [k, v] of recordMap.entries()) {
      if (k.startsWith(`${normF}___`)) {
        const pNameInMap = k.split("___")[1];
        const cleanedP = pNameInMap.replace(/\s+/g, "");
        if (cleanedP.startsWith(cleanBase) && (cleanedP.includes("(0-1)") || cleanedP.includes("(1-3)") || cleanedP.includes("(3-5)"))) {
          if (v.price && v.price > 0) return v;
        }
      }
    }
    return null;
  }

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
      const displayFirm = fName || (grainRec ? grainRec.firmName : "");
      if (!displayFirm) return;

      const grainKey = `${normFirm(displayFirm)}___${item.productName.toLowerCase()}`;

      if (grainRec) {
        const bRate = grainRec.baseRate ?? null;
        const tRate = grainRec.transportRate ?? null;
        const grainTotalPrice = (bRate || 0) + (tRate || 0);
        const finalPrice = grainTotalPrice + item.procCost;

        recordMap.set(grainKey, {
          firmName: displayFirm,
          productName: item.productName,
          price: finalPrice > 0 ? finalPrice : null,
          baseRate: bRate,
          transportRate: tRate,
          procCost: item.procCost,
          procCostSource: "semi",
        });
      } else if (recordMap.has(grainKey)) {
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

  // Extract ALL unique product names from semi_actual history
  const allSemiActualProducts = Array.from(new Set((semiActualData || []).map(r => String(r["Product Name"] || "").trim()).filter(Boolean)));

  const firmList = ["PMMPL", "Purab", "RKL"];

  console.log("=== FIRM-WISE DETAILED BREAKDOWN IN KYC PAGE ===\n");

  firmList.forEach(firm => {
    console.log(`=========================================`);
    console.log(`FIRM: ${firm}`);
    console.log(`=========================================`);

    const showing = [];
    const notShowing = [];

    allSemiActualProducts.forEach(prodName => {
      const key = `${normFirm(firm)}___${normProd(prodName)}`;
      if (recordMap.has(key)) {
        const item = recordMap.get(key);
        showing.push({ name: prodName, price: item.price, procCost: item.procCost, procCostSource: item.procCostSource });
      } else {
        notShowing.push(prodName);
      }
    });

    console.log(`[SHOWING IN KYC PAGE] (${showing.length} products):`);
    if (showing.length === 0) console.log("  - None");
    else showing.forEach((p, i) => console.log(`  ${i + 1}. ${p.name} (Price: ₹${p.price || 0}, ProcCost: ₹${p.procCost || 0}, Source: ${p.procCostSource || 'Direct Purchase'})`));

    console.log(`\n[NOT SHOWING IN KYC PAGE] (${notShowing.length} products):`);
    if (notShowing.length === 0) console.log("  - None");
    else notShowing.forEach((p, i) => console.log(`  ${i + 1}. ${p}`));
    console.log("\n");
  });
}

firmWiseKycDetails();
