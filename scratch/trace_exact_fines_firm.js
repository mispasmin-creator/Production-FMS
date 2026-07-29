const { createClient } = require("@supabase/supabase-js");

const prodUrl = "https://bliuwvkdtvxmteyzuzds.supabase.co";
const prodAnonKey = "sb_publishable_-YlHrBy4MBZpCnHCZl4sXg_u3buvMYp";
const prodSupabase = createClient(prodUrl, prodAnonKey);

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

async function traceFinesFirms() {
  const [
    { data: sfProdData },
    { data: sjcData },
    { data: semiActualData }
  ] = await Promise.all([
    prodSupabase.from("semi_finished_production").select("*"),
    prodSupabase.from("semi_job_card").select("*"),
    prodSupabase.from("semi_actual").select("*")
  ]);

  const sfFirmMap = new Map();
  (sfProdData || []).forEach((row) => {
    const sfNo = String(row["SF-Sr No."] || "").trim();
    const pName = normProd(row["Name Of Semi Finished Good"]);
    const firm = String(row["Firm name"] || row["Firm Name"] || "").trim();
    if (sfNo && firm) {
      if (pName) sfFirmMap.set(`${sfNo}::${pName}`, firm);
      sfFirmMap.set(sfNo, firm);
    }
  });

  const sjcFirmMap = new Map();
  (sjcData || []).forEach((row) => {
    const sjcNo = String(row["SJC-Sr No."] || "").trim();
    const sfNo = String(row["Semi Finished Production No."] || "").trim();
    const pName = normProd(row["Product Name"]);
    const firm = String(row["Firm Name"] || row["Firm name"] || "").trim() || sfFirmMap.get(`${sfNo}::${pName}`) || sfFirmMap.get(sfNo) || "";
    if (sjcNo && firm) {
      if (pName) sjcFirmMap.set(`${sjcNo}::${pName}`, firm);
      sjcFirmMap.set(sjcNo, firm);
    }
  });

  console.log("=== TRACING EXACT FIRMS FOR semi_actual FINES ROWS ===");
  (semiActualData || []).forEach(row => {
    const sjcNo = String(row["Semi Finished Job Card No."] || "").trim();
    const sfNo = String(row["Semi Finished Production No."] || "").trim();
    const prodName = String(row["Product Name"] || "").trim();
    const procCost = Number(row["Processing Cost"] || 0);

    const directFirm = String(row["Firm name"] || row["Firm Name"] || "").trim();
    const resolvedFirm = directFirm || 
      sjcFirmMap.get(`${sjcNo}::${normProd(prodName)}`) || 
      sjcFirmMap.get(sjcNo) || 
      sfFirmMap.get(`${sfNo}::${normProd(prodName)}`) || 
      sfFirmMap.get(sfNo) || "";

    if (procCost > 0) {
      console.log(`ID: ${row.id}, Product: "${prodName}", Cost: ${procCost}`);
      console.log(`   -> DirectFirm: "${directFirm}", SJC: "${sjcNo}" (Firm: "${sjcFirmMap.get(sjcNo)}"), SF: "${sfNo}" (Firm: "${sfFirmMap.get(sfNo)}") => Final Resolved Firm: "${resolvedFirm}"\n`);
    }
  });
}

traceFinesFirms();
