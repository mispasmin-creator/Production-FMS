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

const isSpecialPPBag = (name) => {
  const n = name.trim().replace(/\s+/g, ' ').toLowerCase();
  return (
    n === "pp bag (25 kgs)" ||
    n === "pp bag (50 kgs)" ||
    n === "pp bags 25 kg" ||
    n === "pp bag r - 25" ||
    n === "pp bag b - 25"
  );
}

async function run() {
  try {
    const rawFirmName = "PMMPL ORDER";
    const firmName = cleanFirmName(rawFirmName);
    const rmName = "Pp Bag (50 kgs)";

    const { data, error } = await purchaseSupabase
      .from("LIFT-ACCOUNTS")
      .select('"Rate", "Type Of Transporting Rate", "Transporter Rate", "Lifting Qty", "Total Bags Qty"')
      .ilike("Firm Name", firmName)
      .ilike("Raw Material Name", rmName)
      .order("Timestamp", { ascending: false })
      .limit(1);

    if (error) throw error;

    console.log("data matched in DB:", data);
    
    if (data && data.length > 0) {
      const row = data[0];
      const rawRate = Number(row["Transporter Rate"] || 0);
      const liftQty = Number(row["Lifting Qty"] || 0);
      const rateType = String(row["Type Of Transporting Rate"] || "").trim().toLowerCase();
      
      let calculatedTransportRate = 0;
      if ((rateType === "per mt" || rateType === "fixed") && liftQty > 0) {
        calculatedTransportRate = rawRate / liftQty;
      }

      let totalBagsQty = row["Total Bags Qty"] !== null && row["Total Bags Qty"] !== undefined ? Number(row["Total Bags Qty"]) : 0;

      if (totalBagsQty === 0) {
        const { data: bagsData, error: bagsErr } = await purchaseSupabase
          .from("LIFT-ACCOUNTS")
          .select('"Total Bags Qty"')
          .ilike("Firm Name", firmName)
          .ilike("Raw Material Name", rmName)
          .not("Total Bags Qty", "is", null)
          .order("Timestamp", { ascending: false })
          .limit(1);

        if (!bagsErr && bagsData && bagsData.length > 0) {
          totalBagsQty = Number(bagsData[0]["Total Bags Qty"] || 0);
        }
      }

      let finalRate = Number(row["Rate"] || 0);
      
      console.log("Values before custom check:");
      console.log(`  rmName: ${rmName}`);
      console.log(`  isSpecialPPBag(rmName): ${isSpecialPPBag(rmName)}`);
      console.log(`  liftQty: ${liftQty}`);
      console.log(`  finalRate: ${finalRate}`);
      console.log(`  totalBagsQty: ${totalBagsQty}`);

      if (isSpecialPPBag(rmName) && totalBagsQty > 0) {
        finalRate = (liftQty * finalRate) / totalBagsQty;
      }

      console.log("Calculated finalRate:", finalRate);
    }

  } catch (err) {
    console.error("Error:", err);
  }
}

run();
