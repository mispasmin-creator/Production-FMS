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

async function testOptionAImplementation() {
  const [
    { data: rawData },
    { data: semiActualData },
    { data: sfProdData },
    { data: sjcData }
  ] = await Promise.all([
    purchaseSupabase.from("LIFT-ACCOUNTS").select("*").order("Timestamp", { ascending: false }),
    prodSupabase.from("semi_actual").select("*").order("id", { ascending: false }),
    prodSupabase.from("semi_production").select("*"),
    prodSupabase.from("semi_job_card").select("*")
  ]);

  const recordMap = new Map();

  for (const row of rawData || []) {
    const firmName = String(row["Firm Name"] || "N/A").trim();
    const productName = String(row["Raw Material Name"] || row["Product Name"] || "N/A").trim();
    if (!firmName || !productName) continue;

    const key = `${normFirm(firmName)}___${normProd(productName)}`;
    if (!recordMap.has(key)) {
      const baseRate = row["Rate"] != null && !isNaN(Number(row["Rate"])) ? parseFloat(row["Rate"]) : 0;
      let transportRate = (row["Transporting Rate"] != null && !isNaN(Number(row["Transporting Rate"]))) ? parseFloat(row["Transporting Rate"]) : 0;
      recordMap.set(key, {
        firmName,
        productName,
        price: baseRate + transportRate,
        baseRate,
        transportRate,
        procCost: 0,
        isDirectPurchase: true,
        timestamp: row["Timestamp"],
      });
    }
  }

  function findGrainRateForFines(targetFirm, finesProdName) {
    const normF = normFirm(targetFirm);
    if (!normF) return null;
    const cleanBase = normProd(finesProdName).replace("fines", "").replace("fine", "").replace(/\s+/g, "");

    for (const [k, v] of recordMap.entries()) {
      if (k.startsWith(`${normF}___`)) {
        const pNameInMap = k.split("___")[1];
        const cleanedP = pNameInMap.replace(/\s+/g, "");
        const isGrain = cleanedP.includes("(0-1)") || 
                        cleanedP.includes("(1-3)") || 
                        cleanedP.includes("(3-5)") || 
                        cleanedP.includes("clinker") || 
                        cleanedP.includes("lumps") || 
                        cleanedP.includes("slag");

        if (cleanedP.startsWith(cleanBase) && isGrain) {
          if (v.price && v.price > 0) return v;
        }
      }
    }
    return null;
  }

  const sfFirmMap = new Map();
  (sfProdData || []).forEach(row => {
    const sfNo = String(row["SF-Sr No."] || "").trim();
    const pName = normProd(row["Name Of Semi Finished Good"]);
    const fName = String(row["Firm name"] || row["Firm Name"] || "").trim();
    if (sfNo && fName) {
      sfFirmMap.set(sfNo, fName);
      if (pName) sfFirmMap.set(`${sfNo}::${pName}`, fName);
    }
  });

  const sjcFirmMap = new Map();
  (sjcData || []).forEach(row => {
    const sjcNo = String(row["SJC-Sr No."] || "").trim();
    const sfNo = String(row["Semi Finished Production No."] || "").trim();
    const pName = normProd(row["Product Name"]);
    const fName = String(row["Firm Name"] || row["Firm name"] || "").trim() || sfFirmMap.get(`${sfNo}::${pName}`) || sfFirmMap.get(sfNo) || "";
    if (sjcNo && fName) {
      sjcFirmMap.set(sjcNo, fName);
      if (pName) sjcFirmMap.set(`${sjcNo}::${pName}`, fName);
    }
  });

  (semiActualData || []).forEach(row => {
    const sjcNo = String(row["Semi Finished Job Card No."] || "").trim();
    const sfNo = String(row["Semi Finished Production No."] || "").trim();
    const prodName = String(row["Product Name"] || "").trim();
    const procCost = Number(row["Processing Cost"] || 0);

    if (!prodName) return;

    const tracedFirmRaw = String(
      row["Firm name"] || 
      row["Firm Name"] || 
      sjcFirmMap.get(`${sjcNo}::${normProd(prodName)}`) || 
      sjcFirmMap.get(sjcNo) || 
      sfFirmMap.get(`${sfNo}::${normProd(prodName)}`) || 
      sfFirmMap.get(sfNo) || 
      ""
    ).trim();

    const targetFirms = tracedFirmRaw ? [tracedFirmRaw] : ["Pmmpl", "Purab", "Rkl"];

    targetFirms.forEach((fName) => {
      const displayFirm = fName || "Pmmpl";
      const grainKey = `${normFirm(displayFirm)}___${prodName.toLowerCase()}`;

      // OPTION A RULE: Only synthesize / apply processing cost if there is NO direct purchase bill for this product!
      if (!recordMap.has(grainKey)) {
        const grainRec = findGrainRateForFines(displayFirm, prodName);
        const bRate = grainRec ? grainRec.baseRate : null;
        const tRate = grainRec ? grainRec.transportRate : null;
        const calcPrice = (bRate || 0) + (tRate || 0) + procCost;

        recordMap.set(grainKey, {
          firmName: displayFirm,
          productName: prodName,
          price: calcPrice > 0 ? calcPrice : (procCost > 0 ? procCost : null),
          baseRate: bRate,
          transportRate: tRate,
          procCost,
        });
      }
    });
  });

  console.log("=== OPTION A TEST RESULTS ===");
  ["PMMPL", "Purab", "RKL"].forEach(firm => {
    const p1 = recordMap.get(`${normFirm(firm)}___gbxt 74 fines`);
    const p2 = recordMap.get(`${normFirm(firm)}___pyro fines`);
    const p3 = recordMap.get(`${normFirm(firm)}___p14 fines`);
    console.log(`\nFirm: ${firm}`);
    console.log(`  GBXT 74 Fines:`, p1 ? `Price: ₹${p1.price} (isDirect: ${!!p1.isDirectPurchase})` : "None");
    console.log(`  Pyro Fines:`, p2 ? `Price: ₹${p2.price} (isDirect: ${!!p2.isDirectPurchase})` : "None");
    console.log(`  P14 Fines:`, p3 ? `Price: ₹${p3.price} (isDirect: ${!!p3.isDirectPurchase})` : "None");
  });
}

testOptionAImplementation();
