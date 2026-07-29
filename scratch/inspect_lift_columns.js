const { createClient } = require("@supabase/supabase-js");

const purchaseUrl = "https://jcgmyvxcamstnhuwmemc.supabase.co";
const purchaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpjZ215dnhjYW1zdG5odXdtZW1jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwMDgyODAsImV4cCI6MjA4NTU4NDI4MH0.wMKYEcXGOgrRwy7DKBlBz-a_mWhAuZaknG_iXYvKLLo";

const purchaseSupabase = createClient(purchaseUrl, purchaseAnonKey);

async function inspectLiftColumns() {
  const { data } = await purchaseSupabase.from("LIFT-ACCOUNTS").select("*").limit(1);
  if (data && data[0]) {
    console.log("Columns in LIFT-ACCOUNTS:");
    console.log(Object.keys(data[0]));
  }
}

inspectLiftColumns();
