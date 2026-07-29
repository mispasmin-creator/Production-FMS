const { createClient } = require("@supabase/supabase-js");

const purchaseUrl = "https://jcgmyvxcamstnhuwmemc.supabase.co";
const purchaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpjZ215dnhjYW1zdG5odXdtZW1jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwMDgyODAsImV4cCI6MjA4NTU4NDI4MH0.wMKYEcXGOgrRwy7DKBlBz-a_mWhAuZaknG_iXYvKLLo";

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

function getReceiptTime(row) {
  const d = row["Date Of Receiving"] || row["ACTUAL RECEIPT DATE"] || row["Date Of Bill"] || row["DATE OF BILL"] || row["Timestamp"];
  return d ? new Date(d).getTime() : 0;
}

async function testReceiptDateSorting() {
  const { data: rawData } = await purchaseSupabase.from("LIFT-ACCOUNTS").select("*");

  // Sort by Actual Receipt Date / Bill Date descending
  const sorted = (rawData || []).slice().sort((a, b) => getReceiptTime(b) - getReceiptTime(a));

  const rklPyro = sorted.find(r => normFirm(r["Firm Name"]) === "rkl" && normProd(r["Raw Material Name"] || r["Product Name"]) === "pyro fines");

  console.log("=== LATEST RKL PYRO FINES BY ACTUAL RECEIPT DATE ===");
  if (rklPyro) {
    const baseRate = parseFloat(rklPyro["Rate"] || 0);
    let transportRate = (rklPyro["Transporting Rate"] != null && !isNaN(Number(rklPyro["Transporting Rate"]))) ? parseFloat(rklPyro["Transporting Rate"]) : 0;
    const rateType = String(rklPyro["Type Of Transporting Rate"] || "").trim().toLowerCase();
    if ((transportRate === 0 || isNaN(transportRate)) && rateType === "fixed") {
      const totalTransportAmount = Number(rklPyro["Transporter Rate"] || 0);
      const billingQty = Number(rklPyro["Lifting Qty"] || rklPyro["Total Bill Quantity"] || rklPyro["Actual Quantity"] || rklPyro["Qty"] || 0);
      if (totalTransportAmount > 0 && billingQty > 0) transportRate = totalTransportAmount / billingQty;
    }
    console.log(`Lift No: ${rklPyro["Lift No"]}`);
    console.log(`Actual Receipt Date: ${rklPyro["Date Of Receiving"]}`);
    console.log(`Bill Date: ${rklPyro["Date Of Bill"]}`);
    console.log(`Base Rate: ₹${baseRate}`);
    console.log(`Transport Rate: ₹${transportRate}`);
    console.log(`Total Calculated Price: ₹${baseRate + transportRate}`);
  }
}

testReceiptDateSorting();
