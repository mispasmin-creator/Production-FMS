const { createClient } = require("@supabase/supabase-js");

const purchaseUrl = "https://jcgmyvxcamstnhuwmemc.supabase.co";
const purchaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpjZ215dnhjYW1zdG5odXdtZW1jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwMDgyODAsImV4cCI6MjA4NTU4NDI4MH0.wMKYEcXGOgrRwy7DKBlBz-a_mWhAuZaknG_iXYvKLLo";

const purchaseSupabase = createClient(purchaseUrl, purchaseAnonKey);

async function inspectColumns() {
  const { data: rawData } = await purchaseSupabase.from("LIFT-ACCOUNTS").select("*");

  const lf802 = (rawData || []).find(r => String(r["LIFT NUMBER"] || r["Lift Number"] || r["LIFT NO"] || "").includes("802"));
  const lf801 = (rawData || []).find(r => String(r["LIFT NUMBER"] || r["Lift Number"] || r["LIFT NO"] || "").includes("801"));

  console.log("=== LF-802 EXACT VALUES ===");
  if (lf802) {
    Object.keys(lf802).forEach(k => {
      if (lf802[k] !== null && lf802[k] !== undefined) {
        console.log(`  ${k}: ${JSON.stringify(lf802[k])}`);
      }
    });
  }

  console.log("\n=== LF-801 EXACT VALUES ===");
  if (lf801) {
    Object.keys(lf801).forEach(k => {
      if (lf801[k] !== null && lf801[k] !== undefined) {
        console.log(`  ${k}: ${JSON.stringify(lf801[k])}`);
      }
    });
  }
}

inspectColumns();
