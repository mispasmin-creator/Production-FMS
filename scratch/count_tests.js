const supabaseUrl = "https://bliuwvkdtvxmteyzuzds.supabase.co";
const supabaseKey = "sb_publishable_-YlHrBy4MBZpCnHCZl4sXg_u3buvMYp";

async function run() {
  try {
    const urlAP = `${supabaseUrl}/rest/v1/actual_production?select=*`;
    console.log("Fetching actual_production table data...");
    const resAP = await fetch(urlAP, {
      headers: {
        "apikey": supabaseKey,
        "Authorization": `Bearer ${supabaseKey}`
      }
    });
    const rows = await resAP.json();
    console.log(`Successfully fetched ${rows.length} rows.`);

    // Let's filter out entries that don't have a valid Job Card No. (just in case)
    const validRows = rows.filter(r => r["Job Card No."] && String(r["Job Card No."]).trim() !== "");
    console.log(`Total valid entries with Job Card No: ${validRows.length}`);

    // Analyze the status of tests for these entries
    let counts = {
      total: validRows.length,
      
      // Stage 1: Lab Test 1
      lt1_pending: 0,
      lt1_done: 0,

      // Stage 2: Lab Test 2
      lt2_pending: 0,
      lt2_done: 0,

      // Stage 3: Chemical Test
      ct_pending: 0,
      ct_done: 0,

      // Stage 4: Check Anand / Check Devshree / Management Approval / Tally
      anand_pending: 0,
      anand_done: 0,
      jitendra_pending: 0,
      jitendra_done: 0,
      devshree_pending: 0,
      devshree_done: 0,
      management_pending: 0,
      management_done: 0,
      tally_pending: 0,
      tally_done: 0,
    };

    validRows.forEach(row => {
      // Helpers to check if column has value
      const has = (val) => val !== null && val !== undefined && String(val).trim() !== "" && String(val).trim().toLowerCase() !== "null";

      // 1. Lab Test 1
      if (has(row["Planned1"]) && !has(row["Actual1"])) {
        counts.lt1_pending++;
      } else if (has(row["Actual1"])) {
        counts.lt1_done++;
      }

      // 2. Lab Test 2
      if (has(row["Planned2"]) && !has(row["Actual2"])) {
        counts.lt2_pending++;
      } else if (has(row["Actual2"])) {
        counts.lt2_done++;
      }

      // 3. Chemical Test
      if (has(row["Planned3"]) && !has(row["Actual3"])) {
        counts.ct_pending++;
      } else if (has(row["Actual3"])) {
        counts.ct_done++;
      }

      // 4. Anand Check
      if (has(row["Planned4"]) && !has(row["Actual4"])) {
        counts.anand_pending++;
      } else if (has(row["Actual4"])) {
        counts.anand_done++;
      }

      // 5. Jitendra Check
      if (has(row["Planned5"]) && !has(row["Actual5"])) {
        counts.jitendra_pending++;
      } else if (has(row["Actual5"])) {
        counts.jitendra_done++;
      }

      // 6. Devshree Check
      if (has(row["Planned6"]) && !has(row["Actual6"])) {
        counts.devshree_pending++;
      } else if (has(row["Actual6"])) {
        counts.devshree_done++;
      }

      // 7. Management Approval
      if (has(row["Planned7"]) && !has(row["Actual7"])) {
        counts.management_pending++;
      } else if (has(row["Actual7"])) {
        counts.management_done++;
      }

      // 8. Tally
      if (has(row["Planned8"]) && !has(row["Actual8"])) {
        counts.tally_pending++;
      } else if (has(row["Actual8"])) {
        counts.tally_done++;
      }
    });

    console.log("\n--- Breakdown of Stages ---");
    console.log(JSON.stringify(counts, null, 2));

  } catch (err) {
    console.error("Error analyzing:", err);
  }
}

run();
