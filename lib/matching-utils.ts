import { FIRM_MAP } from "@/lib/auth";

/**
 * Normalizes a string by converting it to lowercase and removing all spaces and hyphens.
 * This ensures that strings like "DO-306", "DO 306", and "do306" all match perfectly.
 */
export const normalizeKey = (key: any): string => {
  return String(key || "").toLowerCase().replace(/[\s-]/g, "");
};

/**
 * Extracts only the numerical digits from a DO string.
 * This handles typos like "D0-306" (with a zero) instead of "DO-306" (with an O).
 * e.g., "D0-306" -> 306, "DO-306" -> 306, "306" -> 306
 */
export const getNumericDo = (doStr: any): number | null => {
  const numStr = String(doStr || "").replace(/\D/g, "");
  return numStr ? Number(numStr) : null;
};

/**
 * Generates an array of all possible matching string variations for a user's assigned firm(s).
 * It splits comma-separated firms and resolves them against the FIRM_MAP.
 */
export const getFirmMatchValues = (firm?: string): string[] => {
  const firms = String(firm || "").split(",").map((f) => f.trim()).filter(Boolean);
  return firms.flatMap((rawFirm) => {
    const mappedFirm = Object.entries(FIRM_MAP).find(
      ([key, value]) =>
        key.toLowerCase() === rawFirm.toLowerCase() ||
        value.toLowerCase() === rawFirm.toLowerCase()
    )?.[1] || "";
    return [rawFirm, mappedFirm]
      .map((v) => (v || "").toLowerCase().trim())
      .filter(Boolean);
  });
};

/**
 * Filters a list of data items based on the user's assigned firm(s).
 * Uses a bidirectional includes check to allow abbreviations (e.g., "PM" matches "Pmmpl").
 * @param data The array of items to filter.
 * @param user The logged-in user object.
 * @param getFirmName A callback function that extracts the firm name from a data item.
 */
export const filterDataByFirm = <T>(
  data: T[],
  user: any,
  getFirmName: (item: T) => string
): T[] => {
  if (!user?.firm || user?.role?.toLowerCase() === "admin") return data;

  const firmSearchValues = getFirmMatchValues(user.firm);
  
  return data.filter((item) => {
    const fName = String(getFirmName(item) || "").toLowerCase().trim();
    return firmSearchValues.some(
      (firmSearch) => fName.includes(firmSearch) || firmSearch.includes(fName)
    );
  });
};

/**
 * Generates a unified, normalized key for a given order number and product name.
 */
export const makeOrderProductKey = (orderNo: any, productName: any): string => {
  return `${normalizeKey(orderNo)}::${normalizeKey(productName)}`;
};

/**
 * Generic resilient matching logic to find a row across tables.
 * Falls back gracefully: DO+Product+Party -> DO+Product -> DO string -> DO numeric.
 */
export const findMatchingRow = <T>(
  items: T[],
  deliveryOrderNo: string,
  productName: string,
  getDo: (item: T) => string,
  getProduct: (item: T) => string,
  partyName?: string,
  getParty?: (item: T) => string
): T | undefined => {
  const normalizedDo = normalizeKey(deliveryOrderNo);
  const normalizedProduct = normalizeKey(productName);
  const normalizedParty = partyName ? normalizeKey(partyName) : null;
  const numericDo = getNumericDo(deliveryOrderNo);

  // Fallback 1: DO + Product + Party (if party is provided)
  if (normalizedParty && getParty) {
    const match = items.find(
      (p) =>
        normalizeKey(getDo(p)) === normalizedDo &&
        normalizeKey(getProduct(p)) === normalizedProduct &&
        normalizeKey(getParty(p)) === normalizedParty
    );
    if (match) return match;
  }

  // Fallback 2: DO + Product
  let match = items.find(
    (p) =>
      normalizeKey(getDo(p)) === normalizedDo &&
      normalizeKey(getProduct(p)) === normalizedProduct
  );
  if (match) return match;

  // Fallback 3: DO only (exact normalized string)
  match = items.find((p) => normalizeKey(getDo(p)) === normalizedDo);
  if (match) return match;

  // Fallback 4: DO only (numeric extraction)
  match = items.find((p) => {
    const pNum = getNumericDo(getDo(p));
    return numericDo !== null && pNum !== null && numericDo === pNum;
  });

  return match;
};
