const { createClient } = require("@supabase/supabase-js");

const prodUrl = "https://bliuwvkdtvxmteyzuzds.supabase.co";
const prodAnonKey = "sb_publishable_-YlHrBy4MBZpCnHCZl4sXg_u3buvMYp";
const supabase = createClient(prodUrl, prodAnonKey);

async function summary() {
  const { data } = await supabase.from("crushing_actual").select("*");
  const uniqueFG = new Set();
  const summaryMap = {};

  (data || []).forEach(row => {
    const rawName = String(row["Crushing Product Name"] || "").trim();
    if (rawName.toLowerCase().includes("insulator")) {
      if (!summaryMap[rawName]) summaryMap[rawName] = new Set();
      for (let i = 1; i <= 4; i++) {
        const fg = String(row[`Finished Goods Name ${i}`] || "").trim();
        if (fg) {
          uniqueFG.add(fg);
          summaryMap[rawName].add(fg);
        }
      }
    }
  });

  console.log("Summary of Raw Material vs Output Grains for Insulator:");
  Object.keys(summaryMap).forEach(key => {
    console.log(`Input Material: "${key}" -> Output Grains:`, Array.from(summaryMap[key]));
  });
}
summary();
