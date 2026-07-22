import { format } from "date-fns";
import { supabase } from "@/lib/supabase";

export const SEMI_PRODUCTION_TABLE = "semi_production";
export const SEMI_JOB_CARD_TABLE = "semi_job_card";
export const SEMI_ACTUAL_TABLE = "semi_actual";
export const MASTER_TABLE = "master";

const toNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toDateInput = (value: unknown): string => {
  if (!value) return "";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  if (typeof value === "string") {
    const ddmmyy = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
    if (ddmmyy) {
      const [, dd, mm, yy] = ddmmyy;
      const year = yy.length === 2 ? `20${yy}` : yy;
      return `${year}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
    }
  }
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? String(value) : format(date, "yyyy-MM-dd");
};

export const toDisplayDate = (value: unknown): string => {
  if (!value) return "";
  if (typeof value === "string" && value.includes("/")) return value;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? String(value) : format(date, "dd/MM/yy");
};

export const toDisplayTimestamp = (value: unknown): string => {
  if (!value) return "";
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? String(value) : format(date, "dd/MM/yy HH:mm:ss");
};

export const mapSemiProduction = (row: any) => ({
  _rowIndex: Number(row.id || 0),
  timestamp: toDisplayTimestamp(row["Timestamp"]),
  sfSrNo: String(row["SF-Sr No."] || ""),
  nameOfSemiFinished: String(row["Name Of Semi Finished Good"] || ""),
  qty: toNumber(row["Qty"]),
  notes: String(row["Notes"] || ""),
  totalPlanned: toNumber(row["Total Planned"]),
  totalMade: toNumber(row["Total Made"]),
  pending: row["Pending"] === null || row["Pending"] === undefined ? toNumber(row["Qty"]) : toNumber(row["Pending"]),
  cancelOrder: row["Cancel Order"] === null || row["Cancel Order"] === undefined || row["Cancel Order"] === false ? "0" : String(row["Cancel Order"]),
  status: String(row["Status"] || ""),
  planned: toDisplayDate(row["Planned"]),
  actual: toDisplayDate(row["Actual"]),
  firmName: String(row["Firm name"] || ""),
  reason: String(row["Reason"] || ""),
});

export const mapSemiJobCard = (row: any) => ({
  _rowIndex: Number(row.id || 0),
  timestamp: toDisplayTimestamp(row["Timestamp"]),
  sjcSrNo: String(row["SJC-Sr No."] || ""),
  sfSrNo: String(row["Semi Finished Production No."] || ""),
  supervisorName: String(row["Supervisor Name"] || ""),
  productName: String(row["Product Name"] || ""),
  qty: toNumber(row["Qty"]),
  dateOfProduction: toDisplayDate(row["Date Of Production"]),
  planned: toDisplayDate(row["Planned"]),
  actual: toDisplayDate(row["Actual"]),
  actualMade: toNumber(row["Actual Made"]),
  pending: toNumber(row["Pending"]),
  status: String(row["Status"] || ""),
});

export const mapSemiActual = (row: any) => ({
  _rowIndex: Number(row.id || 0),
  timestamp: toDisplayTimestamp(row["Timestamp"]),
  semiFinishedJobCardNo: String(row["Semi Finished Job Card No."] || ""),
  supervisorName: String(row["Supervisor Name"] || ""),
  dateOfProduction: toDisplayDate(row["Date Of Production"]),
  productName: String(row["Product Name"] || ""),
  qtyOfSemiFinishedGood: toNumber(row["Qty Of Semi Finished Good"]),
  rawMaterial1Name: String(row["Raw Material Name 1"] || ""),
  rawMaterial1Qty: toNumber(row["Quantity Of Raw Material 1"]),
  rawMaterial1Rate: toNumber(row["Processing Cost 1"]),
  rawMaterial2Name: String(row["Raw Material Name 2"] || ""),
  rawMaterial2Qty: toNumber(row["Quantity Of Raw Material 2"]),
  rawMaterial2Rate: toNumber(row["Processing Cost 2"]),
  rawMaterial3Name: String(row["Raw Material Name 3"] || ""),
  rawMaterial3Qty: toNumber(row["Quantity Of Raw Material 3"]),
  rawMaterial3Rate: toNumber(row["Processing Cost 3"]),
  rawMaterial4Name: String(row["Raw Material Name 4"] || ""),
  rawMaterial4Qty: toNumber(row["Quantity Of Raw Material 4"]),
  rawMaterial4Rate: toNumber(row["Processing Cost 4"]),
  rawMaterial5Name: String(row["Raw Material Name 5"] || ""),
  rawMaterial5Qty: toNumber(row["Quantity Of Raw Material 5"]),
  rawMaterial5Rate: toNumber(row["Processing Cost 5"]),
  isAnyEndProduct: row["Is Any End Product"] ? "Yes" : "No",
  endProductRawMaterialName: String(row["End Product Name"] || ""),
  endProductQty: toNumber(row["End Product Qty"]),
  productRate: toNumber(row["Product Rate"]),
  narration: String(row["Narration"] || ""),
  sNo: String(row["S No."] || ""),
  serialNo: String(row["S No."] || ""),
  startingReading: toNumber(row["Starting Reading"]),
  startingReadingPhoto: String(row["Starting Reading Photo"] || ""),
  endingReading: toNumber(row["Ending Reading"]),
  endingReadingPhoto: String(row["Ending Reading Photo"] || ""),
  machineRunningHour: toNumber(row["Machine Running hour"]),
  machineRunning: toNumber(row["Machine Running"]),
  sfProductionNo: String(row["Semi Finished Production No."] || ""),
  semiFinishedProductionNo: String(row["Semi Finished Production No."] || ""),
  planned1: toDisplayDate(row["Planned1"]),
  actual1: toDisplayDate(row["Actual1"]),
  timeDelay1: String(row["Time Delay1"] || ""),
  status: String(row["Status"] || ""),
  actualQty1: toNumber(row["Actual Qty1"]),
  planned2: toDisplayDate(row["Planned2"]),
  actual2: toDisplayDate(row["Actual2"]),
  timeDelay2: String(row["Time Delay2"] || ""),
  actualQty2: toNumber(row["Final Qty"]),
  finalQty: toNumber(row["Final Qty"]),
});

export const fetchSemiProductionRows = async () => {
  const { data, error } = await supabase
    .from(SEMI_PRODUCTION_TABLE)
    .select("*")
    .order("id", { ascending: true });
  if (error) throw error;
  return (data || []).map(mapSemiProduction);
};

export const fetchSemiJobCardRows = async () => {
  const { data, error } = await supabase
    .from(SEMI_JOB_CARD_TABLE)
    .select("*")
    .order("id", { ascending: true });
  if (error) throw error;
  return (data || []).map(mapSemiJobCard);
};

export const fetchSemiActualRows = async () => {
  const { data, error } = await supabase
    .from(SEMI_ACTUAL_TABLE)
    .select("*")
    .order("id", { ascending: true });
  if (error) throw error;
  return (data || []).map(mapSemiActual);
};

export const fetchMasterRows = async () => {
  const { data, error } = await supabase.from(MASTER_TABLE).select("*");
  if (error) throw error;
  return data || [];
};

export const getMasterValue = (row: any, keys: string[]): string => {
  for (const key of keys) {
    const value = row[key];
    if (value !== null && value !== undefined && String(value).trim()) return String(value).trim();
  }
  return "";
};

export const toSupabaseDate = toDateInput;
