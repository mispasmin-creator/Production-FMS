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
    const rows = await resAP.json();
    const validRows = rows.filter(r => r["Job Card No."] && String(r["Job Card No."]).trim() !== "");

    const has = (val) => val !== null && val !== undefined && String(val).trim() !== "" && String(val).trim().toLowerCase() !== "null";

    // Filter to the 152 entries that do NOT have Actual1 (Lab Test 1 Done)
    const lt1PendingRows = validRows.filter(r => !has(r["Actual1"]));

    console.log(`Analyzing the ${lt1PendingRows.length} entries where Lab Test 1 is NOT completed:\n`);

    let stats = {
      only_planned_no_tests: 0,
      has_lt2_done: 0,
      has_ct_done: 0,
      has_anand_done: 0,
      has_jitendra_done: 0,
      has_devshree_done: 0,
      has_management_done: 0,
    };

    lt1PendingRows.forEach(row => {
      let testsDone = [];
      if (has(row["Actual2"])) { testsDone.push("Lab Test 2"); stats.has_lt2_done++; }
      if (has(row["Actual3"])) { testsDone.push("Chemical Test"); stats.has_ct_done++; }
      if (has(row["Actual4"])) { testsDone.push("Anand Check"); stats.has_anand_done++; }
      if (has(row["Actual5"])) { testsDone.push("Jitendra Check"); stats.has_jitendra_done++; }
      if (has(row["Actual6"])) { testsDone.push("Devshree Check"); stats.has_devshree_done++; }
      if (has(row["Actual7"])) { testsDone.push("Management Approval"); stats.has_management_done++; }

      if (testsDone.length === 0) {
        stats.only_planned_no_tests++;
      } else {
        console.log(`JC: ${row["Job Card No."]} (${row["Product Name"]}) has no Lab Test 1 but has done: ${testsDone.join(", ")}`);
      }
    });

    console.log("\nSummary of Lab Test 1 Pending Rows:");
    console.log(JSON.stringify(stats, null, 2));

  } catch (err) {
    console.error(err);
  }
}

run();
