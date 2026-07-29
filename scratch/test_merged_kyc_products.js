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

async function testMergedKyc() {
  const [
    { data: rawData },
    { data: semiActualData },
    { data: masterKycData }
  ] = await Promise.all([
    purchaseSupabase.from("LIFT-ACCOUNTS").select("*").order("Timestamp", { ascending: false }),
    prodSupabase.from("semi_actual").select("*").order("id", { ascending: false }),
    prodSupabase.from("kyc").select("*")
  ]);

  const recordMap = new Map();
  let idxCounter = 1;

  for (const row of rawData || []) {
    const firmName = String(row["Firm Name"] || "N/A").trim();
    const productName = String(row["Raw Material Name"] || row["Product Name"] || "N/A").trim();
    if (!firmName || !productName) continue;
    const key = `${normFirm(firmName)}___${normProd(productName)}`;
    if (!recordMap.has(key)) {
      recordMap.set(key, { id: idxCounter++, firmName, productName, source: "LIFT-ACCOUNTS" });
    }
  }

  const activeBeforeMaster = recordMap.size;
  console.log(`Active KYC Products before Supabase master 'kyc' merge: ${activeBeforeMaster}`);

  let addedFromMaster = 0;
  for (const row of masterKycData || []) {
    const pName = String(row["Product name"] || "").trim();
    const fName = String(row["Firm Name"] || "N/A").trim();
    if (!pName) continue;
    const key = `${normFirm(fName)}___${normProd(pName)}`;

    // ONLY ADD IF NOT ALREADY IN ACTIVE KYC PRODUCTS
    if (!recordMap.has(key)) {
      recordMap.set(key, {
        id: idxCounter++,
        firmName: fName,
        productName: pName,
        alumina: Number(row["Alumina"]) || 0,
        iron: Number(row["Iron"]) || 0,
        bd: Number(row["Bd"]) || 0,
        ap: Number(row["Ap"]) || 0,
        price: Number(row["Price"]) || 0,
        source: "Supabase Master KYC (Missing Fallback)"
      });
      addedFromMaster++;
    }
  }

  console.log(`Added ${addedFromMaster} MISSING products from Supabase 'kyc' master table!`);
  console.log(`Total Products available in Select Material dropdown: ${recordMap.size}`);
}

testMergedKyc();
