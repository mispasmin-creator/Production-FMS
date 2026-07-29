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

async function findRklPyroRows() {
  const { data: rawData } = await purchaseSupabase.from("LIFT-ACCOUNTS").select("*");
  const rklRows = (rawData || []).filter(r => normFirm(r["Firm Name"]) === "rkl" && normProd(r["Raw Material Name"] || r["Product Name"]).includes("pyro fines"));

  console.log(`Found ${rklRows.length} rows for RKL Pyro Fines:`);
  rklRows.forEach((r, i) => {
    console.log(`\n--- Row #${i+1} ---`);
    Object.keys(r).forEach(k => {
      if (r[k] !== null && r[k] !== undefined && String(r[k]).trim() !== "") {
        console.log(`  "${k}": ${JSON.stringify(r[k])}`);
      }
    });
  });
}

findRklPyroRows();
