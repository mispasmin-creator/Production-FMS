const supabaseUrl = "https://bliuwvkdtvxmteyzuzds.supabase.co";
const supabaseKey = "sb_publishable_-YlHrBy4MBZpCnHCZl4sXg_u3buvMYp";

const { createClient } = require("@supabase/supabase-js");
const purchaseSupabase = createClient(
  "https://jcgmyvxcamstnhuwmemc.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpjZ215dnhjYW1zdG5odXdtZW1jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwMDgyODAsImV4cCI6MjA4NTU4NDI4MH0.wMKYEcXGOgrRwy7DKBlBz-a_mWhAuZaknG_iXYvKLLo"
);

async function run() {
  try {
    const urlAP = `${supabaseUrl}/rest/v1/actual_production?select=*`;
    const resAP = await fetch(urlAP, {
      headers: {
        "apikey": supabaseKey,
        "Authorization": `Bearer ${supabaseKey}`
      }
    });
    const rows = await resAP.json();
    console.log(`Fetched ${rows.length} rows.`);

    // Find a few rows that have raw materials and print them
    const rowsWithMaterials = rows.filter(r => {
      for(let i=1; i<=20; i++) {
        if(r[`Raw Material Name ${i}`]) return true;
      }
      return false;
    });

    console.log(`\nFound ${rowsWithMaterials.length} rows with raw materials.`);
    
    // Print unique raw material names found in actual_production
    const uniqueProductionMaterials = new Set();
    rowsWithMaterials.forEach(r => {
      for(let i=1; i<=20; i++) {
        const name = r[`Raw Material Name ${i}`];
        if(name) uniqueProductionMaterials.add(String(name).trim());
      }
    });
    console.log("\nUnique Raw Material Names in Production:", Array.from(uniqueProductionMaterials));

    // For each unique raw material name, let's query LIFT-ACCOUNTS to see if we get a match
    console.log("\nQuerying LIFT-ACCOUNTS for these raw material names:");
    for(const rmName of Array.from(uniqueProductionMaterials)) {
      const { data, error } = await purchaseSupabase
        .from("LIFT-ACCOUNTS")
        .select('"Raw Material Name", "Total Bags Qty", "Rate"')
        .ilike("Raw Material Name", rmName)
        .order("Timestamp", { ascending: false })
        .limit(1);

      if (error) {
        console.log(` - ${rmName}: Error: ${error.message}`);
      } else if (data && data.length > 0) {
        console.log(` - ${rmName}: MATCH FOUND! DB Name: ${data[0]["Raw Material Name"]} | Rate: ${data[0]["Rate"]} | Total Bags Qty: ${data[0]["Total Bags Qty"]}`);
      } else {
        console.log(` - ${rmName}: NO MATCH`);
      }
    }

  } catch (err) {
    console.error("Error:", err);
  }
}

run();
