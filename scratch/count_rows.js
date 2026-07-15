const { createClient } = require('@supabase/supabase-js');

const dbUrl2 = "https://bfgdazpqeyvfxbvglstu.supabase.co";
const dbKey2 = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmZ2RhenBxZXl2Znhidmdsc3R1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzNjkwMDcsImV4cCI6MjA4NTk0NTAwN30.__nHiPVvir6Ux8pF9JEVVASo6XYhlWZnMRRsqLS2dr8";
const dispatchSupabase = createClient(dbUrl2, dbKey2);

async function main() {
  console.log("Counting total rows with 'For Production Planning'...");
  const { count, error: countErr } = await dispatchSupabase
    .from("ORDER RECEIPT")
    .select("*", { count: 'exact', head: true })
    .eq("check_delivery_in_stock_or_not", "For Production Planning");

  if (countErr) {
    console.error("Count error:", countErr);
    return;
  }
  console.log(`Total rows in database with 'For Production Planning': ${count}`);

  console.log("\nQuerying for Jai Balaji on DB level...");
  const { data: balaji, error: e1 } = await dispatchSupabase
    .from("ORDER RECEIPT")
    .select("*")
    .eq("check_delivery_in_stock_or_not", "For Production Planning")
    .ilike('"Party Names"', "%Jai Balaji%");

  console.log(`Jai Balaji count: ${balaji ? balaji.length : 0}`);
  balaji?.forEach(r => {
    console.log({
      id: r.id,
      timestamp: r.Timestamp,
      doNo: r["DO-Delivery Order No."],
      product: r["Product Name"],
      qty: r.Quantity,
      expectedDeliveryDate: r["Expected Delivery Date"],
      rateOfMaterial: r["Rate Of Material"]
    });
  });

  console.log("\nQuerying for Shri Bajrang on DB level...");
  const { data: bajrang, error: e2 } = await dispatchSupabase
    .from("ORDER RECEIPT")
    .select("*")
    .eq("check_delivery_in_stock_or_not", "For Production Planning")
    .ilike('"Party Names"', "%Bajrang%");

  console.log(`Shri Bajrang count: ${bajrang ? bajrang.length : 0}`);
  bajrang?.forEach(r => {
    console.log({
      id: r.id,
      timestamp: r.Timestamp,
      doNo: r["DO-Delivery Order No."],
      product: r["Product Name"],
      qty: r.Quantity,
      expectedDeliveryDate: r["Expected Delivery Date"],
      rateOfMaterial: r["Rate Of Material"]
    });
  });

  console.log("\nQuerying for Eastern Equipments on DB level...");
  const { data: eastern, error: e3 } = await dispatchSupabase
    .from("ORDER RECEIPT")
    .select("*")
    .eq("check_delivery_in_stock_or_not", "For Production Planning")
    .ilike('"Party Names"', "%Eastern%");

  console.log(`Eastern count: ${eastern ? eastern.length : 0}`);
  eastern?.forEach(r => {
    console.log({
      id: r.id,
      timestamp: r.Timestamp,
      doNo: r["DO-Delivery Order No."],
      product: r["Product Name"],
      qty: r.Quantity,
      expectedDeliveryDate: r["Expected Delivery Date"],
      rateOfMaterial: r["Rate Of Material"]
    });
  });
}

main().catch(console.error);
