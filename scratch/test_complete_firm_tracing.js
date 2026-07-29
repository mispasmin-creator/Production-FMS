const { createClient } = require("@supabase/supabase-js");

const prodUrl = "https://bliuwvkdtvxmteyzuzds.supabase.co";
const prodAnonKey = "sb_publishable_-YlHrBy4MBZpCnHCZl4sXg_u3buvMYp";
const prodSupabase = createClient(prodUrl, prodAnonKey);

function normFirm(name) {
  const str = String(name || "").toLowerCase().trim();
  if (str.includes("purab")) return "Purab";
  if (str.includes("pmmpl")) return "Pmmpl";
  if (str.includes("rkl")) return "Rkl";
  return "";
}

function normProd(name) {
  return String(name || "").toLowerCase().trim();
}

async function traceCompleteFirms() {
  const [
    { data: sfProdData },
    { data: sjcData },
    { data: semiActualData }
  ] = await Promise.all([
    prodSupabase.from("semi_production").select("*"),
    prodSupabase.from("semi_job_card").select("*"),
    prodSupabase.from("semi_actual").select("*")
  ]);

  const sfFirmMap = new Map();
  (sfProdData || []).forEach(row => {
    const sfNo = String(row["SF-Sr No."] || "").trim();
    const pName = normProd(row["Name Of Semi Finished Good"]);
    const firm = normFirm(row["Firm name"] || row["Firm Name"]);
    if (sfNo && firm) {
      if (pName) sfFirmMap.set(`${sfNo}::${pName}`, firm);
      sfFirmMap.set(sfNo, firm);
    }
  });

  const sjcFirmMap = new Map();
  (sjcData || []).forEach(row => {
    const sjcNo = String(row["SJC-Sr No."] || "").trim();
    const sfNo = String(row["Semi Finished Production No."] || "").trim();
    const pName = normProd(row["Product Name"]);
    const firm = normFirm(row["Firm Name"] || row["Firm name"]) || sfFirmMap.get(`${sfNo}::${pName}`) || sfFirmMap.get(sfNo) || "";
    if (sjcNo && firm) {
      if (pName) sjcFirmMap.set(`${sjcNo}::${pName}`, firm);
      sjcFirmMap.set(sjcNo, firm);
    }
  });

  console.log("=== TRACED FIRM FOR EVERY SINGLE PRODUCT IN semi_actual ===");
  const finesByFirm = new Map(); // key -> { firm, productName, procCost }

  (semiActualData || []).forEach(row => {
    const sjcNo = String(row["Semi Finished Job Card No."] || "").trim();
    const sfNo = String(row["Semi Finished Production No."] || "").trim();
    const prodName = String(row["Product Name"] || "").trim();
    const procCost = Number(row["Processing Cost"] || 0);

    const fName = normFirm(
      row["Firm name"] || 
      row["Firm Name"] || 
      sjcFirmMap.get(`${sjcNo}::${normProd(prodName)}`) || 
      sjcFirmMap.get(sjcNo) || 
      sfFirmMap.get(`${sfNo}::${normProd(prodName)}`) || 
      sfFirmMap.get(sfNo)
    );

    if (prodName) {
      console.log(`ID: ${row.id}, Product: "${prodName}", Cost: ${procCost}, SJC: "${sjcNo}", SF: "${sfNo}" => Traced Firm: "${fName}"`);
      const key = `${fName}___${prodName}`;
      if (!finesByFirm.has(key)) {
        finesByFirm.set(key, { firm: fName, productName: prodName, procCost });
      }
    }
  });

  console.log("\n=== UNIQUE PRODUCT-FIRM PAIRS TRACED FROM semi_actual ===");
  for (const item of finesByFirm.values()) {
    console.log(`Firm: "${item.firm || 'UNASSIGNED'}", Product: "${item.productName}", Cost: ₹${item.procCost}`);
  }
}

traceCompleteFirms();
