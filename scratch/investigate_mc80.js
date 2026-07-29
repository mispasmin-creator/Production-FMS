const { createClient } = require("@supabase/supabase-js");

const prodUrl = "https://bliuwvkdtvxmteyzuzds.supabase.co";
const prodAnonKey = "sb_publishable_-YlHrBy4MBZpCnHCZl4sXg_u3buvMYp";
const purchaseUrl = "https://jcgmyvxcamstnhuwmemc.supabase.co";
const purchaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpjZ215dnhjYW1zdG5odXdtZW1jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwMDgyODAsImV4cCI6MjA4NTU4NDI4MH0.wMKYEcXGOgrRwy7DKBlBz-a_mWhAuZaknG_iXYvKLLo";

const prodSupabase = createClient(prodUrl, prodAnonKey);
const purchaseSupabase = createClient(purchaseUrl, purchaseAnonKey);

async function checkMC80() {
  const [
    { data: liftData },
    { data: crushingData }
  ] = await Promise.all([
    purchaseSupabase.from("LIFT-ACCOUNTS").select("*").order("Timestamp", { ascending: false }),
    prodSupabase.from("crushing_actual").select("*").order("id", { ascending: false })
  ]);

  console.log("=== Searching LIFT-ACCOUNTS for 'MC' or '80' ===");
  const liftMC = (liftData || []).filter(r => {
    const pName = String(r["Raw Material Name"] || r["Product Name"] || "").toLowerCase();
    return pName.includes("mc") || pName.includes("80");
  });

  console.log(`Found ${liftMC.length} rows in LIFT-ACCOUNTS:`);
  liftMC.forEach(r => {
    console.log(`LIFT-ACCOUNT: Firm="${r["Firm Name"]}", Material="${r["Raw Material Name"]}", Rate=${r["Rate"]}`);
  });

  console.log("\n=== Searching crushing_actual for 'MC' or '80' ===");
  const crushMC = (crushingData || []).filter(r => {
    const pName = String(r["Crushing Product Name"] || "").toLowerCase();
    const fg1 = String(r["Finished Goods Name 1"] || "").toLowerCase();
    const fg2 = String(r["Finished Goods Name 2"] || "").toLowerCase();
    const fg3 = String(r["Finished Goods Name 3"] || "").toLowerCase();
    return pName.includes("mc") || fg1.includes("mc") || fg2.includes("mc") || fg3.includes("mc");
  });

  console.log(`Found ${crushMC.length} rows in crushing_actual:`);
  crushMC.forEach(r => {
    console.log(`CRUSHING: ID=${r.id}, Firm="${r["Firm Name"]}", Input="${r["Crushing Product Name"]}"`);
    for (let i = 1; i <= 4; i++) {
      if (r[`Finished Goods Name ${i}`]) {
        console.log(`   FG ${i}: "${r[`Finished Goods Name ${i}`]}" -> Cost ${i}: ${r[`Processing Cost ${i}`]}`);
      }
    }
  });
}

checkMC80();
