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

async function inspectDates() {
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

  console.log("=== PMMPL DIRECT PURCHASE BILLS FOR GBXT 74 FINES ===");
  (rawData || []).forEach(row => {
    const fName = String(row["Firm Name"] || "").trim();
    const pName = String(row["Raw Material Name"] || row["Product Name"] || "").trim();
    if (normFirm(fName) === "pmmpl" && normProd(pName) === "gbxt 74 fines") {
      console.log(`Product: "${pName}", Rate: ₹${row["Rate"]}, Transport: ₹${row["Transporting Rate"] || 0}, Timestamp: ${row["Timestamp"]}`);
    }
  });

  console.log("\n=== PMMPL PRODUCTION ENTRIES FOR GBXT 74 FINES ===");
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
    const pName = String(row["Product Name"] || "").trim();
    const tracedFirm = String(
      row["Firm name"] || 
      row["Firm Name"] || 
      sjcFirmMap.get(`${sjcNo}::${normProd(pName)}`) || 
      sjcFirmMap.get(sjcNo) || 
      sfFirmMap.get(`${sfNo}::${normProd(pName)}`) || 
      sfFirmMap.get(sfNo) || 
      ""
    ).trim();
    if (normFirm(tracedFirm) === "pmmpl" && normProd(pName) === "gbxt 74 fines") {
      console.log(`ID: #${row.id}, Product: "${pName}", Cost: ₹${row["Processing Cost"]}, Production Date: ${row["Date Of Production"] || row["Timestamp"]}`);
    }
  });
}

inspectDates();
