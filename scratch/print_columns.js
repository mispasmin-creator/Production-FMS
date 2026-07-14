const supabaseUrl = "https://bliuwvkdtvxmteyzuzds.supabase.co";
const supabaseKey = "sb_publishable_-YlHrBy4MBZpCnHCZl4sXg_u3buvMYp";

async function run() {
  try {
    const urlAP = `${supabaseUrl}/rest/v1/actual_production?select=*&limit=1`;
    const resAP = await fetch(urlAP, {
      headers: {
        "apikey": supabaseKey,
        "Authorization": `Bearer ${supabaseKey}`
      }
    });
    const rows = await resAP.json();
    if (rows && rows.length > 0) {
      console.log("Columns in actual_production:");
      console.log(Object.keys(rows[0]).sort());
    } else {
      console.log("No rows found in actual_production");
    }
  } catch (err) {
    console.error("Error:", err);
  }
}

run();
