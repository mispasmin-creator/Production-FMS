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

async function testFirmTracing() {
  const [
    { data: sfProdData },
    { data: sjcData },
    { data: semiActualData }
  ] = await Promise.all([
    prodSupabase.from("semi_finished_production").select("*"),
    prodSupabase.from("semi_job_card").select("*"),
    prodSupabase.from("semi_actual").select("*")
  ]);

  // Map SF Production No -> Firm
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

  // Map SJC No -> Firm
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

  console.log("=== TRACED FIRM FOR EVERY ROW IN semi_actual ===");
  (semiActualData || []).forEach(row => {
    const sjcNo = String(row["Semi Finished Job Card No."] || "").trim();
    const sfNo = String(row["Semi Finished Production No."] || "").trim();
    const prodName = String(row["Product Name"] || "").trim();
    const procCost = Number(row["Processing Cost"] || 0);

    const directFirm = normFirm(row["Firm name"] || row["Firm Name"]);
    const tracedFirm = directFirm ||
      sjcFirmMap.get(`${sjcNo}::${normProd(prodName)}`) ||
      sjcFirmMap.get(sjcNo) ||
      sfFirmMap.get(`${sfNo}::${normProd(prodName)}`) ||
      sfFirmMap.get(sfNo) || "";

    if (prodName) {
      console.log(`ID: ${row.id}, SJC: "${sjcNo}", SF: "${sfNo}", Product: "${prodName}", ProcCost: ${procCost} -> TracedFirm: "${tracedFirm}"`);
    }
  });
}

testFirmTracing();
