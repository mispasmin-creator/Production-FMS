const { createClient } = require("@supabase/supabase-js");

const prodUrl = "https://bliuwvkdtvxmteyzuzds.supabase.co";
const prodAnonKey = "sb_publishable_-YlHrBy4MBZpCnHCZl4sXg_u3buvMYp";
const purchaseUrl = "https://jcgmyvxcamstnhuwmemc.supabase.co";
const purchaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpjZ215dnhjYW1zdG5odXdtZW1jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwMDgyODAsImV4cCI6MjA4NTU4NDI4MH0.wMKYEcXGOgrRwy7DKBlBz-a_mWhAuZaknG_iXYvKLLo";

const prodSupabase = createClient(prodUrl, prodAnonKey);
const purchaseSupabase = createClient(purchaseUrl, purchaseAnonKey);

async function checkMatching() {
  const [
    { data: liftData },
    { data: crushingData }
  ] = await Promise.all([
    purchaseSupabase.from("LIFT-ACCOUNTS").select("Firm Name, Raw Material Name, Rate, Transporting Rate, Transporter Rate, Lifting Qty"),
    prodSupabase.from("crushing_actual").select("*")
  ]);

  console.log(`Total LIFT-ACCOUNTS rows: ${liftData ? liftData.length : 0}`);
  console.log(`Total crushing_actual rows: ${crushingData ? crushingData.length : 0}\n`);

  const liftProducts = new Set((liftData || []).map(r => String(r["Raw Material Name"] || "").trim()));
  console.log("Sample Products in LIFT-ACCOUNTS:");
  console.log(Array.from(liftProducts).filter(p => p.toLowerCase().includes("insulator")));

  const grains = new Set();
  (crushingData || []).forEach(r => {
    for (let i = 1; i <= 4; i++) {
      const fg = String(r[`Finished Goods Name ${i}`] || "").trim();
      if (fg) grains.add(fg);
    }
  });

  console.log("\nGrains in crushing_actual:");
  console.log(Array.from(grains));

  console.log("\nWhich grains are in LIFT-ACCOUNTS directly?");
  grains.forEach(g => {
    console.log(`  "${g}": ${liftProducts.has(g) ? "YES in LIFT-ACCOUNTS" : "NO (Only in Crushing)"}`);
  });
}

checkMatching();
