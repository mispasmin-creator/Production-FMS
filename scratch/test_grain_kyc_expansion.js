const { createClient } = require("@supabase/supabase-js");

const prodUrl = "https://bliuwvkdtvxmteyzuzds.supabase.co";
const prodAnonKey = "sb_publishable_-YlHrBy4MBZpCnHCZl4sXg_u3buvMYp";
const purchaseUrl = "https://jcgmyvxcamstnhuwmemc.supabase.co";
const purchaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpjZ215dnhjYW1zdG5odXdtZW1jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwMDgyODAsImV4cCI6MjA4NTU4NDI4MH0.wMKYEcXGOgrRwy7DKBlBz-a_mWhAuZaknG_iXYvKLLo";

const prodSupabase = createClient(prodUrl, prodAnonKey);
const purchaseSupabase = createClient(purchaseUrl, purchaseAnonKey);

async function testExpansion() {
  const [
    { data: liftData },
    { data: crushingData }
  ] = await Promise.all([
    purchaseSupabase.from("LIFT-ACCOUNTS").select("*").order("Timestamp", { ascending: false }),
    prodSupabase.from("crushing_actual").select("*").order("id", { ascending: false })
  ]);

  console.log("Unique Crushing Product Names in crushing_actual:");
  const crushInputs = new Set((crushingData || []).map(r => r["Crushing Product Name"]));
  console.log(Array.from(crushInputs));

  // Map parent raw material -> grains
  const parentGrainMap = new Map();
  (crushingData || []).forEach(r => {
    const parent = String(r["Crushing Product Name"] || "").trim().toLowerCase();
    const firm = String(r["Firm Name"] || "").trim().toLowerCase();
    if (!parent) return;
    for (let i = 1; i <= 4; i++) {
      const fg = String(r[`Finished Goods Name ${i}`] || "").trim();
      const cost = Number(r[`Processing Cost ${i}`] || 0);
      if (fg) {
        const key = `${firm}___${parent}`;
        if (!parentGrainMap.has(key)) parentGrainMap.set(key, []);
        parentGrainMap.get(key).push({ fg, cost });
      }
    }
  });

  console.log("\nParent to Grains Mapping:");
  for (const [key, list] of parentGrainMap.entries()) {
    console.log(`Key ${key} -> Grains:`, list);
  }
}

testExpansion();
