const { createClient } = require("@supabase/supabase-js");
const purchaseUrl = "https://jcgmyvxcamstnhuwmemc.supabase.co";
const purchaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpjZ215dnhjYW1zdG5odXdtZW1jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwMDgyODAsImV4cCI6MjA4NTU4NDI4MH0.wMKYEcXGOgrRwy7DKBlBz-a_mWhAuZaknG_iXYvKLLo";
const supabase = createClient(purchaseUrl, purchaseAnonKey);

async function checkCols() {
  const { data, error } = await supabase.from("LIFT-ACCOUNTS").select("*").limit(5);
  if (error) console.error(error);
  else {
    data.forEach((row, i) => {
      console.log(`Row ${i}:`);
      console.log(`  Type Of Transporting Rate: "${row["Type Of Transporting Rate"]}"`);
      console.log(`  Transporting Rate: ${row["Transporting Rate"]}`);
      console.log(`  Transporter Rate: ${row["Transporter Rate"]}`);
      console.log(`  Lifting Qty: ${row["Lifting Qty"]}`);
      console.log(`  Qty: ${row["Qty"]}`);
      console.log(`  Total Bill Quantity: ${row["Total Bill Quantity"]}`);
      console.log(`  Actual Quantity: ${row["Actual Quantity"]}`);
    });
  }
}
checkCols();
