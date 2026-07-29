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

async function inspectGBXT74ByFirm() {
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

  ["PMMPL", "Purab", "RKL"].forEach(firm => {
    console.log(`\n========================================`);
    console.log(`FIRM: ${firm} (GBXT 74 Fines)`);
    console.log(`========================================`);

    const matchedGrain = findGrainRateForFines(firm, "GBXT 74 Fines");
    console.log(`Grain Matched for ${firm}:`, matchedGrain ? `"${matchedGrain.productName}" (Rate: ₹${matchedGrain.price}, Date: ${matchedGrain.timestamp})` : "None");

    // Check semi_actual entries for this firm & GBXT 74 Fines
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

    const latestSemi = (semiActualData || []).find(r => {
      const sjcNo = String(r["Semi Finished Job Card No."] || "").trim();
      const sfNo = String(r["Semi Finished Production No."] || "").trim();
      const pName = String(r["Product Name"] || "").trim();
      const tracedFirm = String(
        r["Firm name"] || 
        r["Firm Name"] || 
        sjcFirmMap.get(`${sjcNo}::${normProd(pName)}`) || 
        sjcFirmMap.get(sjcNo) || 
        sfFirmMap.get(`${sfNo}::${normProd(pName)}`) || 
        sfFirmMap.get(sfNo) || 
        ""
      ).trim();
      return normFirm(tracedFirm) === normFirm(firm) && normProd(pName).includes("gbxt 74 fines");
    });

    if (latestSemi) {
      console.log(`Latest Production Entry for ${firm}: ID #${latestSemi.id}, Cost: ₹${latestSemi["Processing Cost"]}, Date: ${latestSemi["Date Of Production"] || latestSemi["Timestamp"]}`);
    } else {
      console.log(`No Production Entry found for ${firm}`);
    }

    if (matchedGrain && latestSemi) {
      const grainTime = new Date(matchedGrain.timestamp).getTime();
      const semiTime = new Date(latestSemi["Date Of Production"] || latestSemi["Timestamp"]).getTime();
      const isSemiNewer = semiTime >= grainTime;
      const procCost = isSemiNewer ? Number(latestSemi["Processing Cost"] || 0) : 0;
      const finalPrice = matchedGrain.price + procCost;

      console.log(`\n=> CALCULATED KYC PRICE FOR ${firm}: ₹${finalPrice}`);
      console.log(`   Base Grain Rate (${matchedGrain.productName}): ₹${matchedGrain.price}`);
      console.log(`   Processing Cost: +₹${procCost} (${isSemiNewer ? "Production Date >= Purchase Date" : "Purchase Date > Production Date (ProcCost ignored)"})`);
    } else if (matchedGrain) {
      console.log(`\n=> CALCULATED KYC PRICE FOR ${firm}: ₹${matchedGrain.price} (Direct Grain Rate, No Production Entry)`);
    } else {
      // Check direct purchase
      const key = `${normFirm(firm)}___gbxt 74 fines`;
      const directP = recordMap.get(key);
      if (directP) {
        console.log(`\n=> CALCULATED KYC PRICE FOR ${firm}: ₹${directP.price} (Direct Purchase FMS Rate for GBXT 74 Fines)`);
      } else {
        console.log(`\n=> CALCULATED KYC PRICE FOR ${firm}: N/A (No Purchase or Grain entry found)`);
      }
    }
  });
}

inspectGBXT74ByFirm();
