const supabaseUrl = "https://bliuwvkdtvxmteyzuzds.supabase.co";
const supabaseKey = "sb_publishable_-YlHrBy4MBZpCnHCZl4sXg_u3buvMYp";

const hasValue = (value) => {
  if (value === null || value === undefined) return false;
  const normalized = String(value).trim().toLowerCase();
  return normalized !== "" && normalized !== "-" && normalized !== "null" && normalized !== "undefined";
};

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
    const actualProductionData = await resAP.json();
    console.log(`Successfully fetched ${actualProductionData.length} rows.`);

    const buildActualProductionInfo = (row) => {
      const jobCardNo = String(row["Job Card No."] || "").trim();
      return {
        id: row.id,
        jobCardNo,
        actual1: row["Actual1"] || row["Actual 1"],
        status3: row["Status3"] || row["Status 3"],
      };
    };

    // Filter pending tests (mimicking the new filter in page.tsx)
    const pendingData = (actualProductionData || [])
      .map((row) => buildActualProductionInfo(row))
      .filter((row) => row.jobCardNo && hasValue(row.actual1) && !hasValue(row.status3));

    // Filter history tests
    const historyData = (actualProductionData || [])
      .map((row) => buildActualProductionInfo(row))
      .filter((row) => row.jobCardNo && hasValue(row.status3));

    console.log(`\nPending Tests Count: ${pendingData.length}`);
    console.log(`History Tests Count: ${historyData.length}`);

    console.log("\nSample Pending Tests:");
    pendingData.slice(0, 10).forEach(r => console.log(` - ID: ${r.id} | JC: ${r.jobCardNo} | Actual1: ${r.actual1} | Status3: ${r.status3}`));

  } catch (err) {
    console.error("Error running script:", err);
  }
}

run();
