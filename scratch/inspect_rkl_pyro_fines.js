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

async function debugRklPyroFines() {
  const [
    { data: rawData },
    { data: semiActualData },
    { data: crushingActualData },
    { data: masterKycData }
  ] = await Promise.all([
    purchaseSupabase.from("LIFT-ACCOUNTS").select("*").order("Timestamp", { ascending: false }),
    prodSupabase.from("semi_actual").select("*").order("id", { ascending: false }),
    prodSupabase.from("crushing_actual").select("*").order("id", { ascending: false }),
    prodSupabase.from("kyc").select("*")
  ]);

  console.log("=== 1. RKL ENTRIES IN LIFT-ACCOUNTS FOR PYRO PRODUCTS ===");
  (rawData || []).forEach(row => {
    const fName = String(row["Firm Name"] || "").trim();
    const pName = String(row["Raw Material Name"] || row["Product Name"] || "").trim();
    if (normFirm(fName) === "rkl" && normProd(pName).includes("pyro")) {
      const baseRate = parseFloat(row["Rate"] || 0);
      let transportRate = (row["Transporting Rate"] != null && !isNaN(Number(row["Transporting Rate"]))) ? parseFloat(row["Transporting Rate"]) : 0;
      const rateType = String(row["Type Of Transporting Rate"] || "").trim().toLowerCase();
      if ((transportRate === 0 || isNaN(transportRate)) && rateType === "fixed") {
        const totalTransportAmount = Number(row["Transporter Rate"] || 0);
        const billingQty = Number(row["Lifting Qty"] || row["Total Bill Quantity"] || row["Actual Quantity"] || row["Qty"] || 0);
        if (totalTransportAmount > 0 && billingQty > 0) transportRate = totalTransportAmount / billingQty;
      }
      console.log(`Product: "${pName}", Rate: ₹${baseRate}, Transport: ₹${transportRate}, Total: ₹${baseRate + transportRate}, Date: ${row["Timestamp"]}`);
    }
  });

  console.log("\n=== 2. MASTER KYC TABLE ENTRIES FOR RKL & PYRO ===");
  (masterKycData || []).forEach(row => {
    const fName = String(row["Firm Name"] || "").trim();
    const pName = String(row["Product name"] || "").trim();
    if (normFirm(fName) === "rkl" && normProd(pName).includes("pyro")) {
      console.log(`Product: "${pName}", Firm: "${fName}", Price: ₹${row["Price"]}`);
    }
  });

  console.log("\n=== 3. ALL ENTRIES IN LIFT-ACCOUNTS WHERE PRICE ~ 16586 OR RATE ~ 16586 OR TRANSPORT + RATE ~ 16586 ===");
  (rawData || []).forEach(row => {
    const fName = String(row["Firm Name"] || "").trim();
    const pName = String(row["Raw Material Name"] || row["Product Name"] || "").trim();
    const baseRate = parseFloat(row["Rate"] || 0);
    let transportRate = (row["Transporting Rate"] != null && !isNaN(Number(row["Transporting Rate"]))) ? parseFloat(row["Transporting Rate"]) : 0;
    const rateType = String(row["Type Of Transporting Rate"] || "").trim().toLowerCase();
    if ((transportRate === 0 || isNaN(transportRate)) && rateType === "fixed") {
      const totalTransportAmount = Number(row["Transporter Rate"] || 0);
      const billingQty = Number(row["Lifting Qty"] || row["Total Bill Quantity"] || row["Actual Quantity"] || row["Qty"] || 0);
      if (totalTransportAmount > 0 && billingQty > 0) transportRate = totalTransportAmount / billingQty;
    }
    const totalPrice = baseRate + transportRate;
    if (Math.abs(totalPrice - 16586.463) < 10 || Math.abs(baseRate - 16586.463) < 10) {
      console.log(`MATCH FOUND! Firm: "${fName}", Product: "${pName}", BaseRate: ₹${baseRate}, Transport: ₹${transportRate}, Total: ₹${totalPrice}, Date: ${row["Timestamp"]}`);
    }
  });
}

debugRklPyroFines();
