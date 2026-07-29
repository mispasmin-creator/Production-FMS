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

async function testDateComparison() {
  const [
    { data: rawData },
    { data: semiActualData }
  ] = await Promise.all([
    purchaseSupabase.from("LIFT-ACCOUNTS").select("*").order("Timestamp", { ascending: false }),
    prodSupabase.from("semi_actual").select("*").order("id", { ascending: false })
  ]);

  console.log("=== COMPARING TIMESTAMPS: LIFT-ACCOUNTS vs semi_actual ===");

  (semiActualData || []).forEach(semiRow => {
    const prodName = String(semiRow["Product Name"] || "").trim();
    const procCost = Number(semiRow["Processing Cost"] || 0);
    const semiDate = semiRow["Date Of Production"] || semiRow["Timestamp"];
    const semiTs = new Date(semiDate).getTime();

    if (!prodName || procCost <= 0) return;

    // Find matching purchase entries in LIFT-ACCOUNTS
    const matchingPurchases = (rawData || []).filter(pRow => {
      const pProd = String(pRow["Raw Material Name"] || pRow["Product Name"] || "").trim();
      return normProd(pProd) === normProd(prodName);
    });

    if (matchingPurchases.length > 0) {
      const latestPurchase = matchingPurchases[0];
      const purchaseTs = new Date(latestPurchase["Timestamp"]).getTime();
      const isSemiNewer = semiTs >= purchaseTs;

      console.log(`Product: "${prodName}"`);
      console.log(`  - Semi Production Date: ${semiDate} (ms: ${semiTs})`);
      console.log(`  - Purchase Timestamp:   ${latestPurchase["Timestamp"]} (ms: ${purchaseTs})`);
      console.log(`  => Is Production Entry Newer/Same? ${isSemiNewer ? 'YES (Apply Proc Cost)' : 'NO (Use Purchase Rate Only)'}\n`);
    }
  });
}

testDateComparison();
