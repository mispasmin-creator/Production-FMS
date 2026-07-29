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

async function testImpactOnAllProducts() {
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

  // Calculate under Option B (Current: Date Comparison)
  const mapB = new Map();
  for (const row of rawData || []) {
    const firmName = String(row["Firm Name"] || "").trim();
    const productName = String(row["Raw Material Name"] || row["Product Name"] || "").trim();
    if (!firmName || !productName) continue;
    const key = `${normFirm(firmName)}___${normProd(productName)}`;
    if (!mapB.has(key)) {
      const baseRate = parseFloat(row["Rate"] || 0);
      const tRate = parseFloat(row["Transporting Rate"] || 0);
      mapB.set(key, { firmName, productName, price: baseRate + tRate, timestamp: row["Timestamp"] });
    }
  }

  // Calculate under Option A (Direct Purchase Priority for Fines)
  // Under Option A: If a direct purchase bill for fines exists, it takes precedence ONLY IF it's a direct fine purchase.
  // Wait, let's see which products differ between Option A and Option B!

  console.log("=== COMPARING OPTION B (Current Date Comparison) VS OPTION A Across ALL PRODUCTS ===");

  const changedProducts = [];
  mapB.forEach((v, k) => {
    if (k.includes("fines") || k.includes("fine")) {
      const firm = v.firmName;
      const prod = v.productName;
      // Check if there is a production entry for this fine
      const semi = (semiActualData || []).find(r => {
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
        return normFirm(tracedFirm) === normFirm(firm) && normProd(pName) === normProd(prod);
      });

      if (semi && Number(semi["Processing Cost"] || 0) > 0) {
        const semiDate = new Date(semi["Date Of Production"] || semi["Timestamp"]).getTime();
        const purcDate = new Date(v.timestamp).getTime();
        if (semiDate >= purcDate) {
          changedProducts.push({ firm, product: prod, directPurchaseRate: v.price, currentOptionBRate: "Grain + ProcCost" });
        }
      }
    }
  });

  console.log(`Products affected if Option A is enabled (${changedProducts.length} items):`);
  changedProducts.forEach(p => {
    console.log(` - Firm: ${p.firm}, Product: "${p.product}", Direct Bill Rate: ₹${p.directPurchaseRate}`);
  });
}

testImpactOnAllProducts();
