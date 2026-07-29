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

async function inspectAllFirmsP14() {
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

  console.log("=== P14 FINES BREAKDOWN FOR ALL 3 FIRMS ===");

  ["Purab", "PMMPL", "RKL"].forEach(firm => {
    console.log(`\nFIRM: ${firm}`);

    // Check Purchase entries for this firm
    const pMatches = (rawData || []).filter(r => normFirm(r["Firm Name"]) === normFirm(firm) && normProd(r["Raw Material Name"] || r["Product Name"]).includes("p14"));
    console.log(`  Purchase Entries in LIFT-ACCOUNTS for ${firm}: ${pMatches.length}`);
    pMatches.forEach(m => console.log(`    - Product: "${m["Raw Material Name"] || m["Product Name"]}", Rate: ₹${m["Rate"]}, Freight: ₹${m["Transporting Rate"] || 0}, Date: ${m["Timestamp"]}`));

    // Check semi_actual entries traced to this firm
    const sMatches = (semiActualData || []).filter(r => {
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
      return normFirm(tracedFirm) === normFirm(firm) && normProd(pName).includes("p14 fines");
    });

    console.log(`  Production Entries in semi_actual traced to ${firm}: ${sMatches.length}`);
    sMatches.forEach(m => console.log(`    - ID: ${m.id}, Product: "${m["Product Name"]}", Cost: ₹${m["Processing Cost"]}, Date: ${m["Date Of Production"] || m["Timestamp"]}`));
  });
}

inspectAllFirmsP14();
