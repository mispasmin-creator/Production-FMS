const supabaseUrl = "https://bliuwvkdtvxmteyzuzds.supabase.co";
const supabaseKey = "sb_publishable_-YlHrBy4MBZpCnHCZl4sXg_u3buvMYp";

async function run() {
  try {
    const urlAP = `${supabaseUrl}/rest/v1/actual_production?select=*`;
    const resAP = await fetch(urlAP, {
      headers: {
        "apikey": supabaseKey,
        "Authorization": `Bearer ${supabaseKey}`
      }
    });
    const apRows = await apRowsJson(resAP);

    const urlJC = `${supabaseUrl}/rest/v1/jobcards?select=*`;
    const resJC = await fetch(urlJC, {
      headers: {
        "apikey": supabaseKey,
        "Authorization": `Bearer ${supabaseKey}`
      }
    });
    const jcRows = await resJC.json();

    const has = (val) => val !== null && val !== undefined && String(val).trim() !== "" && String(val).trim().toLowerCase() !== "null";

    // Find entries where Actual1 is NULL but Actual2 is NOT NULL
    const targetRows = apRows.filter(r => r["Job Card No."] && !has(r["Actual1"]) && has(r["Actual2"]));

    console.log(`Found ${targetRows.length} rows with Actual1 (LT1) NULL but Actual2 (LT2) NOT NULL.\n`);

    // Let's print the first 3 samples
    const samples = targetRows.slice(0, 3);
    samples.forEach((row, index) => {
      console.log(`--- Sample ${index + 1} ---`);
      console.log("Job Card No:", row["Job Card No."]);
      console.log("Product Name:", row["Product Name"]);
      console.log("Firm Name:", row["FIRM Name"]);
      console.log("actual_production row dates:");
      console.log(` - Planned1: ${row["Planned1"]} | Actual1: ${row["Actual1"]}`);
      console.log(` - Planned2: ${row["Planned2"]} | Actual2: ${row["Actual2"]}`);
      console.log(` - Planned3: ${row["Planned3"]} | Actual3: ${row["Actual3"]}`);
      console.log(` - Planned4: ${row["Planned4"]} | Actual4: ${row["Actual4"]}`);
      console.log(` - Status2 (LT1 Status): ${row["Status2"]}`);
      console.log(` - Status3 (LT2 Status): ${row["Status3"]}`);

      // Find matching jobcard
      const matchJc = jcRows.find(jc => String(jc["JC-Job Card Number"]).trim() === String(row["Job Card No."]).trim() && String(jc["Product Name"]).trim() === String(row["Product Name"]).trim());
      if (matchJc) {
        console.log("Matching jobcard row dates:");
        console.log(` - Actual 1 (Production): ${matchJc["Actual 1"]}`);
        console.log(` - Actual 2 (Physical 1): ${matchJc["Actual 2"]}`);
        console.log(` - Actual 3 (Physical 2): ${matchJc["Actual 3"]}`);
        console.log(` - Actual 4 (Chemical):   ${matchJc["Actual 4"]}`);
        console.log(` - Status 2 (Physical 1 Status): ${matchJc["Status 2"]}`);
        console.log(` - Status 3 (Physical 2 Status): ${matchJc["Status 3"]}`);
        console.log(` - Status 4 (Chemical Status):   ${matchJc["Status 4"]}`);
      } else {
        console.log("No matching jobcard found by number and product.");
      }
      console.log("\n");
    });

  } catch (err) {
    console.error(err);
  }
}

async function apRowsJson(res) {
  return await res.json();
}

run();
