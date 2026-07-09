const supabaseUrl = "https://bliuwvkdtvxmteyzuzds.supabase.co";
const supabaseKey = "sb_publishable_-YlHrBy4MBZpCnHCZl4sXg_u3buvMYp";

async function run() {
  try {
    // 1. Fetch all rows from actual_production
    const urlAP = `${supabaseUrl}/rest/v1/actual_production?select=*`;
    console.log("Fetching all from actual_production...");
    const resAP = await fetch(urlAP, {
      headers: {
        "apikey": supabaseKey,
        "Authorization": `Bearer ${supabaseKey}`
      }
    });
    const dataAP = await resAP.json();
    
    // Filter rows for JC-006
    const matchingRows = dataAP.filter(row => String(row["Job Card No."] || "").trim() === "JC-006");
    console.log("actual_production results for JC-006:", JSON.stringify(matchingRows, null, 2));

  } catch (err) {
    console.error("Error fetching data:", err);
  }
}

run();
