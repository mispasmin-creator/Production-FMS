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

async function debugP14Purab() {
  const [
    { data: rawData },
    { data: semiActualData },
    { data: crushingActualData }
  ] = await Promise.all([
    purchaseSupabase.from("LIFT-ACCOUNTS").select("*").order("Timestamp", { ascending: false }),
    prodSupabase.from("semi_actual").select("*").order("id", { ascending: false }),
    prodSupabase.from("crushing_actual").select("*").order("id", { ascending: false })
  ]);

  console.log("=== 1. PURAB ENTRIES IN LIFT-ACCOUNTS (PURCHASE) FOR P14 PRODUCTS ===");
  (rawData || []).forEach(row => {
    const fName = String(row["Firm Name"] || "").trim();
    const pName = String(row["Raw Material Name"] || row["Product Name"] || "").trim();
    if (normFirm(fName) === "purab" && normProd(pName).includes("p14")) {
      console.log(`Product: "${pName}", Rate: ₹${row["Rate"]}, Transport: ₹${row["Transporting Rate"]}, Timestamp: ${row["Timestamp"]}`);
    }
  });

  console.log("\n=== 2. PURAB ENTRIES IN CRUSHING_ACTUAL FOR P14 PRODUCTS ===");
  (crushingActualData || []).forEach(row => {
    const fName = String(row["Firm Name"] || row["Firm name"] || "").trim();
    const parentProd = String(row["Crushing Product Name"] || "").trim();
    if (normFirm(fName) === "purab" && (normProd(parentProd).includes("p14") || normProd(parentProd).includes("p-14"))) {
      console.log(`Crushing Product: "${parentProd}", FG1: "${row["Finished Goods Name 1"]}" (Cost: ${row["Processing Cost 1"]}), FG2: "${row["Finished Goods Name 2"]}" (Cost: ${row["Processing Cost 2"]})`);
    }
  });

  console.log("\n=== 3. SEMI_ACTUAL ENTRIES FOR P14 FINES ===");
  (semiActualData || []).forEach(row => {
    const prodName = String(row["Product Name"] || "").trim();
    const procCost = Number(row["Processing Cost"] || 0);
    if (normProd(prodName).includes("p14 fines") || normProd(prodName).includes("p-14 fines")) {
      console.log(`ID: ${row.id}, Product: "${prodName}", Cost: ₹${procCost}, Date: ${row["Date Of Production"] || row["Timestamp"]}`);
    }
  });
}

debugP14Purab();
