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

async function testClinkerFix() {
  const [
    { data: rawData },
    { data: semiActualData },
    { data: crushingActualData }
  ] = await Promise.all([
    purchaseSupabase.from("LIFT-ACCOUNTS").select("*").order("Timestamp", { ascending: false }),
    prodSupabase.from("semi_actual").select("*").order("id", { ascending: false }),
    prodSupabase.from("crushing_actual").select("*").order("id", { ascending: false })
  ]);

  const recordMap = new Map();

  for (const row of rawData || []) {
    const firmName = String(row["Firm Name"] || "N/A").trim();
    const productName = String(row["Raw Material Name"] || row["Product Name"] || "N/A").trim();
    if (!firmName || !productName) continue;

    const key = `${firmName.toLowerCase()}___${productName.toLowerCase()}`;
    if (!recordMap.has(key)) {
      recordMap.set(key, {
        firmName,
        productName,
        price: null,
        baseRate: null,
        transportRate: null,
        procCost: 0,
        timestamp: row["Timestamp"],
      });
    }

    const rec = recordMap.get(key);
    if (rec.price === null && row["Rate"] != null && !isNaN(Number(row["Rate"]))) {
      const baseRate = parseFloat(row["Rate"]);
      let transportRate = (row["Transporting Rate"] != null && !isNaN(Number(row["Transporting Rate"]))) ? parseFloat(row["Transporting Rate"]) : 0;
      const rateType = String(row["Type Of Transporting Rate"] || "").trim().toLowerCase();
      if ((transportRate === 0 || isNaN(transportRate)) && rateType === "fixed") {
        const totalTransportAmount = Number(row["Transporter Rate"] || 0);
        const billingQty = Number(row["Lifting Qty"] || row["Total Bill Quantity"] || row["Actual Quantity"] || row["Qty"] || 0);
        if (totalTransportAmount > 0 && billingQty > 0) transportRate = totalTransportAmount / billingQty;
      }
      rec.baseRate = baseRate;
      rec.transportRate = transportRate;
      rec.price = baseRate + transportRate;
    }
  }

  function findGrainRateForFines(targetFirm, finesProdName) {
    const normF = normFirm(targetFirm);
    if (!normF) return null;
    const cleanBase = normProd(finesProdName).replace("fines", "").replace("fine", "").replace(/\s+/g, "");

    for (const [k, v] of recordMap.entries()) {
      if (k.startsWith(`${normF}___`)) {
        const pNameInMap = k.split("___")[1];
        const cleanedP = pNameInMap.replace(/\s+/g, "");
        const isGrain = cleanedP.includes("(0-1)") || 
                        cleanedP.includes("(1-3)") || 
                        cleanedP.includes("(3-5)") || 
                        cleanedP.includes("clinker") || 
                        cleanedP.includes("lumps") || 
                        cleanedP.includes("slag");

        if (cleanedP.startsWith(cleanBase) && isGrain) {
          if (v.price && v.price > 0) return v;
        }
      }
    }
    return null;
  }

  console.log("=== TESTING P14 FINES MATCHING FOR PURAB AND PMMPL ===");
  const purabGrain = findGrainRateForFines("Purab", "P14 Fines");
  console.log("Purab Grain Matched for P14 Fines:", purabGrain);
  if (purabGrain) {
    const finalPrice = (purabGrain.baseRate || 0) + (purabGrain.transportRate || 0) + 1500;
    console.log(`=> Purab P14 Fines Calculated Price: ₹${finalPrice} (Base: ₹${purabGrain.baseRate}, Freight: ₹${purabGrain.transportRate}, ProcCost: ₹1500)`);
  }

  const pmmplGrain = findGrainRateForFines("Pmmpl", "P14 Fines");
  console.log("\nPmmpl Grain Matched for P14 Fines:", pmmplGrain);
  if (pmmplGrain) {
    const finalPrice = (pmmplGrain.baseRate || 0) + (pmmplGrain.transportRate || 0) + 1500;
    console.log(`=> Pmmpl P14 Fines Calculated Price: ₹${finalPrice} (Base: ₹${pmmplGrain.baseRate}, Freight: ₹${pmmplGrain.transportRate}, ProcCost: ₹1500)`);
  }
}

testClinkerFix();
