const { createClient } = require("@supabase/supabase-js");

const prodUrl = "https://bliuwvkdtvxmteyzuzds.supabase.co";
const prodAnonKey = "sb_publishable_-YlHrBy4MBZpCnHCZl4sXg_u3buvMYp";
const purchaseUrl = "https://jcgmyvxcamstnhuwmemc.supabase.co";
const purchaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpjZ215dnhjYW1zdG5odXdtZW1jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwMDgyODAsImV4cCI6MjA4NTU4NDI4MH0.wMKYEcXGOgrRwy7DKBlBz-a_mWhAuZaknG_iXYvKLLo";

const prodSupabase = createClient(prodUrl, prodAnonKey);
const purchaseSupabase = createClient(purchaseUrl, purchaseAnonKey);

async function inspectPyro() {
  const [
    { data: semiRows },
    { data: crushRows },
    { data: purchaseRows }
  ] = await Promise.all([
    prodSupabase.from("semi_actual").select("*"),
    prodSupabase.from("crushing_actual").select("*"),
    purchaseSupabase.from("LIFT-ACCOUNTS").select("*")
  ]);

  console.log("=== semi_actual rows with Pyro or Fines ===");
  (semiRows || []).forEach(r => {
    const pName = String(r["Product Name"] || "");
    if (pName.toLowerCase().includes("pyro") || pName.toLowerCase().includes("fines")) {
      console.log(`ID: ${r.id}, Firm: "${r['Firm name'] || r['Firm Name']}", Product: "${pName}", ProcCost: ${r['Processing Cost']}`);
    }
  });

  console.log("\n=== crushing_actual rows with Pyro ===");
  (crushRows || []).forEach(r => {
    const cProd = String(r["Crushing Product Name"] || "");
    const fg1 = String(r["Finished Goods Name 1"] || "");
    const fg2 = String(r["Finished Goods Name 2"] || "");
    const fg3 = String(r["Finished Goods Name 3"] || "");
    if (cProd.toLowerCase().includes("pyro") || fg1.toLowerCase().includes("pyro") || fg2.toLowerCase().includes("pyro")) {
      console.log(`ID: ${r.id}, Firm: "${r['Firm Name']}", CrushingProd: "${cProd}", FG1: "${fg1}", FG2: "${fg2}", FG3: "${fg3}", Cost1: ${r['Processing Cost 1']}`);
    }
  });

  console.log("\n=== LIFT-ACCOUNTS rows with Pyro ===");
  (purchaseRows || []).forEach(r => {
    const rawP = String(r["Raw Material Name"] || r["Product Name"] || "");
    if (rawP.toLowerCase().includes("pyro")) {
      console.log(`Firm: "${r['Firm Name']}", RawMat: "${rawP}", Rate: ${r['Rate']}, TransportRate: ${r['Transporting Rate']}`);
    }
  });
}

inspectPyro();
