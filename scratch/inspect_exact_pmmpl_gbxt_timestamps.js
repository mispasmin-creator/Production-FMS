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

async function inspectExactTimestamps() {
  const [
    { data: rawData },
    { data: semiActualData }
  ] = await Promise.all([
    purchaseSupabase.from("LIFT-ACCOUNTS").select("*").order("Timestamp", { ascending: false }),
    prodSupabase.from("semi_actual").select("*").order("id", { ascending: false })
  ]);

  console.log("=== ALL PMMPL ENTRIES IN LIFT-ACCOUNTS FOR GBXT 74 ===");
  (rawData || []).forEach(row => {
    const fName = String(row["Firm Name"] || "").trim();
    const pName = String(row["Raw Material Name"] || row["Product Name"] || "").trim();
    if (normFirm(fName) === "pmmpl" && normProd(pName).includes("gbxt 74")) {
      console.log(`Product: "${pName}", Rate: ₹${row["Rate"]}, Transport: ₹${row["Transporting Rate"] || 0}, Timestamp: ${row["Timestamp"]}`);
    }
  });

  console.log("\n=== ALL PMMPL ENTRIES IN SEMI_ACTUAL FOR GBXT 74 FINES ===");
  (semiActualData || []).forEach(row => {
    const prodName = String(row["Product Name"] || "").trim();
    if (normProd(prodName).includes("gbxt 74 fines")) {
      console.log(`ID: #${row.id}, Product: "${prodName}", Cost: ₹${row["Processing Cost"]}, Production Date: ${row["Date Of Production"] || row["Timestamp"]}`);
    }
  });
}

inspectExactTimestamps();
