const { createClient } = require("@supabase/supabase-js");
const purchaseUrl = "https://jcgmyvxcamstnhuwmemc.supabase.co";
const purchaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpjZ215dnhjYW1zdG5odXdtZW1jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwMDgyODAsImV4cCI6MjA4NTU4NDI4MH0.wMKYEcXGOgrRwy7DKBlBz-a_mWhAuZaknG_iXYvKLLo";
const supabase = createClient(purchaseUrl, purchaseAnonKey);

async function analyzeAll() {
  const { data, error } = await supabase.from("LIFT-ACCOUNTS").select("*").not("Transporter Rate", "is", null).limit(20);
  if (error) console.error(error);
  else {
    data.forEach((row, i) => {
      console.log(`[Row ${i}] Type: "${row["Type Of Transporting Rate"]}", Transporter Rate: ${row["Transporter Rate"]}, Lifting Qty: ${row["Lifting Qty"]}, Transporting Rate col: ${row["Transporting Rate"]}`);
    });
  }
}
analyzeAll();
