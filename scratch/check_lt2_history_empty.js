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

    const has = (val) => val !== null && val !== undefined && String(val).trim() !== "" && String(val).trim().toLowerCase() !== "null";

    // Let's filter out entries that don't have a valid Job Card No.
    const validRows = rows.filter(r => r["Job Card No."] && String(r["Job Card No."]).trim() !== "");

    console.log("\nSearching for entries related to Lab Test 2...");

    // We want to find entries where:
    // - Lab Test 1 is completed (has Actual1 or Status2 is complete or whatever)
    // - Lab Test 2 data might be empty or filled
    // User mentions: "Lab Test 2 page ke history tab me jo 30 entry tha jiska data empty tha woh kaha abhi kyu ki abhi pendung tab me show nhi ho rha hai"
    // Let's list any rows that have Status3 (Status 3) or Actual2 (Actual 2) but have empty test values.
    
    const lt2HistoryCandidates = validRows.filter(r => {
      // Let's check if Status3 (or Status 3) is filled, or if Actual2 is filled.
      const status3Val = r["Status3"] || r["Status 3"];
      const actual2Val = r["Actual2"] || r["Actual 2"];
      
      const testFields = [
        r["BDAt110C"] || r["BD At 110C"],
        r["CCSAt100C"] || r["CCS At 100C"],
        r["BDAt1100C"] || r["BD At 1100C"],
        r["CCSAt1100C"] || r["CCS At 1100C"],
        r["PLCAt1100C"] || r["PLC At 1100C"]
      ];
      
      const allTestFieldsEmpty = testFields.every(field => !has(field));
      
      return (has(status3Val) || has(actual2Val)) && allTestFieldsEmpty;
    });

    console.log(`\nFound ${lt2HistoryCandidates.length} rows where Status3/Actual2 is set but all Lab Test 2 metrics (BD, CCS, PLC) are empty:`);
    
    lt2HistoryCandidates.forEach((r, idx) => {
      console.log(`${idx + 1}. ID: ${r.id} | JC: ${r["Job Card No."]} | Order: ${r["Order No."]} | Product: ${r["Product Name"]} | Status2: ${r["Status2"]} | Status3: ${r["Status3"]} | Actual1: ${r["Actual1"]} | Actual2: ${r["Actual2"]} | Remarks2: ${r["Remarks2"]}`);
    });

    console.log("\nLet's also look for rows where Lab Test 1 is completed (Actual1 has value) but Status3 is NOT filled (should be pending for Lab Test 2):");
    const lt1CompletedPendingLt2 = validRows.filter(r => {
      const actual1Val = r["Actual1"] || r["Actual 1"];
      const status3Val = r["Status3"] || r["Status 3"];
      return has(actual1Val) && !has(status3Val);
    });

    console.log(`Found ${lt1CompletedPendingLt2.length} rows where Actual1 has value but Status3 is empty.`);
    lt1CompletedPendingLt2.slice(0, 10).forEach((r, idx) => {
      console.log(` - ID: ${r.id} | JC: ${r["Job Card No."]} | Actual1: ${r["Actual1"]} | Status3: ${r["Status3"]}`);
    });

    console.log("\nLet's look for rows where both Actual1 is empty/null AND Actual2 is empty/null:");
    const bothEmpty = validRows.filter(r => !has(r["Actual1"] || r["Actual 1"]) && !has(r["Actual2"] || r["Actual 2"]));
    console.log(`Found ${bothEmpty.length} rows where both Actual1 and Actual2 are empty.`);

  } catch (err) {
    console.error("Error running script:", err);
  }
}

run();
