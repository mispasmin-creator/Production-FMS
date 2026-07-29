const { createClient } = require("@supabase/supabase-js");
const purchaseUrl = "https://jcgmyvxcamstnhuwmemc.supabase.co";
const purchaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpjZ215dnhjYW1zdG5odXdtZW1jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwMDgyODAsImV4cCI6MjA4NTU4NDI4MH0.wMKYEcXGOgrRwy7DKBlBz-a_mWhAuZaknG_iXYvKLLo";
const supabase = createClient(purchaseUrl, purchaseAnonKey);

async function checkFixed() {
  const { data, error } = await supabase.from("LIFT-ACCOUNTS").select("*").ilike("Type Of Transporting Rate", "fixed").limit(10);
  if (error) console.error(error);
  else {
    console.log(`Found ${data.length} fixed rows:`);
    data.forEach((row, i) => {
      console.log(`Fixed Row ${i}: Rate=${row["Rate"]}, Transporting Rate=${row["Transporting Rate"]}, Type Of Transporting Rate=${row["Type Of Transporting Rate"]}, Transporter Rate=${row["Transporter Rate"]}, Lifting Qty=${row["Lifting Qty"]}`);
    });
  }
}
checkFixed();
