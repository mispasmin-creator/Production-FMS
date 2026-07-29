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

async function testProductFallback() {
  const [
    { data: rawData },
    { data: crushingActualData }
  ] = await Promise.all([
    purchaseSupabase.from("LIFT-ACCOUNTS").select("*").order("Timestamp", { ascending: false }),
    prodSupabase.from("crushing_actual").select("*").order("id", { ascending: false })
  ]);

  const procCostMap = new Map();

  (crushingActualData || []).forEach((row) => {
    const fName = normFirm(row["Firm Name"] || row["Firm name"]);
    const mainCost = Number(row["Processing Cost"] || 0);

    const crushProdName = normProd(row["Crushing Product Name"]);
    if (crushProdName && mainCost > 0) {
      if (fName && !procCostMap.has(`${fName}___${crushProdName}`)) {
        procCostMap.set(`${fName}___${crushProdName}`, mainCost);
      }
      if (!procCostMap.has(crushProdName)) {
        procCostMap.set(crushProdName, mainCost);
      }
    }

    for (let i = 1; i <= 4; i++) {
      const fgName = normProd(row[`Finished Goods Name ${i}`]);
      const cost = Number(row[`Processing Cost ${i}`] || 0);
      if (fgName && cost > 0) {
        if (fName && !procCostMap.has(`${fName}___${fgName}`)) {
          procCostMap.set(`${fName}___${fgName}`, cost);
        }
        if (!procCostMap.has(fgName)) {
          procCostMap.set(fgName, cost);
        }
      }
    }
  });

  console.log("\nKYC Table records with product fallback:");
  (rawData || []).forEach(row => {
    const firmName = String(row["Firm Name"] || "").trim();
    const productName = String(row["Raw Material Name"] || row["Product Name"] || "").trim();
    if (productName.toLowerCase().includes("ferro chrome (1-3)")) {
      const fKey = `${normFirm(firmName)}___${normProd(productName)}`;
      const pKey = normProd(productName);
      const pCost = procCostMap.get(fKey) || procCostMap.get(pKey) || 0;
      console.log(`LIFT-ACCOUNT Row: Firm="${firmName}", Product="${productName}", Rate=${row["Rate"]}, procCost=₹${pCost}`);
    }
  });
}

testProductFallback();
