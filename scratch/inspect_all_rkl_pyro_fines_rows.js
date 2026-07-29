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

async function inspectRklRows() {
  const { data: rawData } = await purchaseSupabase.from("LIFT-ACCOUNTS").select("*");

  console.log("=== ALL RKL PYRO FINES ROWS IN LIFT-ACCOUNTS ===");
  const rklRows = (rawData || []).filter(r => normFirm(r["Firm Name"]) === "rkl" && normProd(r["Raw Material Name"] || r["Product Name"]).includes("pyro fines"));

  rklRows.forEach((r, i) => {
    console.log(`\nRow #${i+1}:`);
    console.log(`  Lift Number: "${r["LIFT NUMBER"] || r["Lift Number"] || r["Lift No"] || r["LIFT NO"]}"`);
    console.log(`  Planned Date (Col U): "${r["PLANNED"] || r["Planned"] || r["Timestamp"]}"`);
    console.log(`  Actual Receipt Date: "${r["ACTUAL RECEIPT DATE"] || r["Actual Receipt Date"]}"`);
    console.log(`  Date of Bill: "${r["DATE OF BILL"] || r["Date Of Bill"]}"`);
    console.log(`  Timestamp (col U): "${r["Timestamp"]}"`);
    console.log(`  Rate: ₹${r["Rate"]}`);
    console.log(`  Transporting Rate: ₹${r["Transporting Rate"]}`);
    console.log(`  Transporter Rate: ₹${r["Transporter Rate"]}`);
    console.log(`  Type Of Transporting Rate: "${r["Type Of Transporting Rate"]}"`);
  });
}

inspectRklRows();
