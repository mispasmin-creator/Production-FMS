const { createClient } = require('@supabase/supabase-js');

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

async function testStrictFirmMatch() {
  const [
    { data: liftData },
    { data: semiActualData },
    { data: sjcData },
    { data: sfProdData }
  ] = await Promise.all([
    purchaseSupabase.from("LIFT-ACCOUNTS").select("*").order("Timestamp", { ascending: false }),
    prodSupabase.from("semi_actual").select("*").order("id", { ascending: false }),
    prodSupabase.from("semi_job_card").select("*"),
    prodSupabase.from("semi_production").select("*")
  ]);

  const sfFirmMap = new Map();
  (sfProdData || []).forEach(row => {
    if (row["SF-Sr No."]) sfFirmMap.set(row["SF-Sr No."], normFirm(row["Firm name"]));
  });

  const sjcFirmMap = new Map();
  (sjcData || []).forEach(row => {
    const sfNo = row["Semi Finished Production No."];
    const sjcNo = row["SJC-Sr No."];
    const firm = sfFirmMap.get(sfNo) || "";
    if (sjcNo && firm) sjcFirmMap.set(sjcNo, firm);
  });

  const procCostMap = new Map();

  (semiActualData || []).forEach((row) => {
    const sjcNo = row["Semi Finished Job Card No."];
    const sfNo = row["Semi Finished Production No."];
    let fName = normFirm(row["Firm name"] || row["Firm Name"] || sjcFirmMap.get(sjcNo) || sfFirmMap.get(sfNo));
    
    const prodName = normProd(row["Product Name"]);
    const mainCost = Number(row["Processing Cost"] || 0);

    if (prodName && mainCost > 0 && fName) {
      const key = `${fName}___${prodName}`;
      if (!procCostMap.has(key)) procCostMap.set(key, mainCost);
    }

    for (let i = 1; i <= 5; i++) {
      const rmName = normProd(row[`Raw Material Name ${i}`]);
      const cost = Number(row[`Processing Cost ${i}`] || 0);
      if (rmName && cost > 0 && fName) {
        const key = `${fName}___${rmName}`;
        if (!procCostMap.has(key)) procCostMap.set(key, cost);
      }
    }
  });

  console.log("=== STRICT FIRM MATCHING RESULTS FOR GBXT 74 FINES ===");
  ["purab", "rkl", "pmmpl"].forEach(f => {
    const key = `${f}___gbxt 74 fines`;
    console.log(`Firm: "${f}" -> Key "${key}" -> Processing Cost: ₹${procCostMap.get(key) || 0}`);
  });
}

testStrictFirmMatch();
