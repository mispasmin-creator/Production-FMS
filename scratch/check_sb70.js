const { createClient } = require("@supabase/supabase-js");
const purchaseUrl = "https://jcgmyvxcamstnhuwmemc.supabase.co";
const purchaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpjZ215dnhjYW1zdG5odXdtZW1jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwMDgyODAsImV4cCI6MjA4NTU4NDI4MH0.wMKYEcXGOgrRwy7DKBlBz-a_mWhAuZaknG_iXYvKLLo";
const supabase = createClient(purchaseUrl, purchaseAnonKey);

async function checkSB() {
  const { data } = await supabase.from("LIFT-ACCOUNTS").select("Firm Name, Raw Material Name, Rate");
  const sbRows = (data || []).filter(r => String(r["Raw Material Name"]).toLowerCase().includes("sb"));
  console.log("SB rows in LIFT-ACCOUNTS:", sbRows);
}
checkSB();
