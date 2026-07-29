const { createClient } = require("@supabase/supabase-js");

const purchaseUrl = "https://jcgmyvxcamstnhuwmemc.supabase.co";
const purchaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpjZ215dnhjYW1zdG5odXdtZW1jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwMDgyODAsImV4cCI6MjA4NTU4NDI4MH0.wMKYEcXGOgrRwy7DKBlBz-a_mWhAuZaknG_iXYvKLLo";

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

async function testClinkerMatching() {
  const { data: rawData } = await purchaseSupabase.from("LIFT-ACCOUNTS").select("*").order("Timestamp", { ascending: false });

  console.log("=== CHECKING P14 CLINKER RATES IN LIFT-ACCOUNTS ===");
  (rawData || []).forEach(row => {
    const fName = String(row["Firm Name"] || "").trim();
    const pName = String(row["Raw Material Name"] || row["Product Name"] || "").trim();
    if (normProd(pName).includes("p14 clinker") || normProd(pName).includes("p-14 clinker")) {
      console.log(`Firm: "${fName}", Product: "${pName}", Rate: ₹${row["Rate"]}, Freight: ₹${row["Transporting Rate"] || 0}, Date: ${row["Timestamp"]}`);
    }
  });
}

testClinkerMatching();
