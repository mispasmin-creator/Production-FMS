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

    // Filter to the 130 entries that have Actual1 (Lab Test 1 Completed)
    const lt1CompletedRows = validRows.filter(r => has(r["Actual1"]));

    console.log(`Analyzing the ${lt1CompletedRows.length} entries where Lab Test 1 IS completed:\n`);

    let stats = {
      only_lt1_done: 0,
      lt2_done: 0,
      ct_done: 0,
      anand_done: 0,
      jitendra_done: 0,
      devshree_done: 0,
      management_done: 0,
      tally_done: 0,
    };

    lt1CompletedRows.forEach(row => {
      let stagesDone = ["Lab Test 1"];
      if (has(row["Actual2"])) { stagesDone.push("Lab Test 2"); stats.lt2_done++; }
      if (has(row["Actual3"])) { stagesDone.push("Chemical Test"); stats.ct_done++; }
      if (has(row["Actual4"])) { stagesDone.push("Anand Check"); stats.anand_done++; }
      if (has(row["Actual5"])) { stagesDone.push("Jitendra Check"); stats.jitendra_done++; }
      if (has(row["Actual6"])) { stagesDone.push("Devshree Check"); stats.devshree_done++; }
      if (has(row["Actual7"])) { stagesDone.push("Management Approval"); stats.management_done++; }
      if (has(row["Actual8"])) { stagesDone.push("Tally"); stats.tally_done++; }

      if (stagesDone.length === 1) {
        stats.only_lt1_done++;
      }
    });

    console.log("Summary of Lab Test 1 Completed Rows progress:");
    console.log(JSON.stringify(stats, null, 2));

  } catch (err) {
    console.error(err);
  }
}

run();
