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

async function debugGBXT74Fines() {
  const [
    { data: rawData },
    { data: semiActualData },
    { data: crushingActualData },
    { data: sfProdData },
    { data: sjcData }
  ] = await Promise.all([
    purchaseSupabase.from("LIFT-ACCOUNTS").select("*").order("Timestamp", { ascending: false }),
    prodSupabase.from("semi_actual").select("*").order("id", { ascending: false }),
    prodSupabase.from("crushing_actual").select("*").order("id", { ascending: false }),
    prodSupabase.from("semi_production").select("*"),
    prodSupabase.from("semi_job_card").select("*")
  ]);

  console.log("=== 1. PURCHASE FMS (LIFT-ACCOUNTS) FOR GBXT 74 PRODUCTS ===");
  (rawData || []).forEach(row => {
    const fName = String(row["Firm Name"] || "").trim();
    const pName = String(row["Raw Material Name"] || row["Product Name"] || "").trim();
    if (normProd(pName).includes("gbxt 74") || normProd(pName).includes("gbxt74")) {
      console.log(`Firm: "${fName}", Product: "${pName}", Rate: ₹${row["Rate"]}, Transport: ₹${row["Transporting Rate"] || 0}, Date: ${row["Timestamp"]}`);
    }
  });

  const sfFirmMap = new Map();
  (sfProdData || []).forEach(row => {
    const sfNo = String(row["SF-Sr No."] || "").trim();
    const pName = normProd(row["Name Of Semi Finished Good"]);
    const firm = String(row["Firm name"] || row["Firm Name"] || "").trim();
    if (sfNo && firm) {
      sfFirmMap.set(sfNo, firm);
      if (pName) sfFirmMap.set(`${sfNo}::${pName}`, firm);
    }
  });

  const sjcFirmMap = new Map();
  (sjcData || []).forEach(row => {
    const sjcNo = String(row["SJC-Sr No."] || "").trim();
    const sfNo = String(row["Semi Finished Production No."] || "").trim();
    const pName = normProd(row["Product Name"]);
    const firm = String(row["Firm Name"] || row["Firm name"] || "").trim() || sfFirmMap.get(`${sfNo}::${pName}`) || sfFirmMap.get(sfNo) || "";
    if (sjcNo && firm) {
      sjcFirmMap.set(sjcNo, firm);
      if (pName) sjcFirmMap.set(`${sjcNo}::${pName}`, firm);
    }
  });

  console.log("\n=== 2. SEMI_ACTUAL PRODUCTION ENTRIES FOR GBXT 74 FINES ===");
  (semiActualData || []).forEach(row => {
    const sjcNo = String(row["Semi Finished Job Card No."] || "").trim();
    const sfNo = String(row["Semi Finished Production No."] || "").trim();
    const prodName = String(row["Product Name"] || "").trim();
    if (normProd(prodName).includes("gbxt 74 fines") || normProd(prodName).includes("gbxt74 fines")) {
      const tracedFirm = String(
        row["Firm name"] || 
        row["Firm Name"] || 
        sjcFirmMap.get(`${sjcNo}::${normProd(prodName)}`) || 
        sjcFirmMap.get(sjcNo) || 
        sfFirmMap.get(`${sfNo}::${normProd(prodName)}`) || 
        sfFirmMap.get(sfNo) || 
        ""
      ).trim();
      console.log(`ID: ${row.id}, Product: "${prodName}", Cost: ₹${row["Processing Cost"]}, Traced Firm: "${tracedFirm}", Date: ${row["Date Of Production"] || row["Timestamp"]}`);
    }
  });
}

debugGBXT74Fines();
