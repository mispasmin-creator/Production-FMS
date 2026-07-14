const supabaseUrl = "https://bliuwvkdtvxmteyzuzds.supabase.co";
const supabaseKey = "sb_publishable_-YlHrBy4MBZpCnHCZl4sXg_u3buvMYp";

const { createClient } = require("@supabase/supabase-js");
const purchaseSupabase = createClient(
  "https://jcgmyvxcamstnhuwmemc.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpjZ215dnhjYW1zdG5odXdtZW1jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwMDgyODAsImV4cCI6MjA4NTU4NDI4MH0.wMKYEcXGOgrRwy7DKBlBz-a_mWhAuZaknG_iXYvKLLo"
);

const cleanFirmName = (firm) => {
  const f = String(firm || "").trim().toLowerCase();
  if (f.includes("purab")) return "Purab";
  if (f.includes("pmmpl")) return "Pmmpl";
  if (f.includes("rkl")) return "Rkl";
  return firm;
};

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
    
    // Find pending costing items (Planned8 is not null, Actual8 is null)
    const pending = rows.filter(r => r["Job Card No."] && r["Planned8"] && !r["Actual8"]);
    console.log(`Found ${pending.length} pending costing items.`);

    for (const item of pending.slice(0, 3)) {
      const rawFirmName = item["FIRM Name"] || "";
      const firmName = cleanFirmName(rawFirmName);
      console.log(`\nJob Card: ${item["Job Card No."]} | Firm: ${rawFirmName} (${firmName})`);

      for (let i = 1; i <= 20; i++) {
        const rmName = item[`Raw Material Name ${i}`];
        if (rmName) {
          const nameTrimmed = String(rmName).trim();
          
          // Query LIFT-ACCOUNTS
          const { data, error } = await purchaseSupabase
            .from("LIFT-ACCOUNTS")
            .select('"Rate", "Type Of Transporting Rate", "Transporter Rate", "Lifting Qty", "Total Bags Qty"')
            .ilike("Firm Name", firmName)
            .ilike("Raw Material Name", nameTrimmed)
            .order("Timestamp", { ascending: false })
            .limit(1);

          if (error) {
            console.log(`  - ${nameTrimmed}: Error: ${error.message}`);
          } else if (data && data.length > 0) {
            console.log(`  - ${nameTrimmed}: Rate: ${data[0]["Rate"]} | Transport Rate: ${data[0]["Transporter Rate"]} | Total Bags Qty: ${data[0]["Total Bags Qty"]}`);
          } else {
            console.log(`  - ${nameTrimmed}: No match in LIFT-ACCOUNTS for Firm: ${firmName}`);
          }
        }
      }
    }

  } catch (err) {
    console.error("Error:", err);
  }
}

run();
