"use client";

import type React from "react";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Loader2,
  AlertTriangle,
  CheckCircle,
  Settings,
  Plus,
  X,
  Eye,
  Edit,
  Zap,
} from "lucide-react";
import { format } from "date-fns";
import { supabase, dispatchSupabase } from "@/lib/supabase";
import { useAuth, FIRM_MAP } from "@/lib/auth";
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/components/ui/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";

// --- Type Definitions ---
interface ProductionItem {
  id: number;
  productionId?: number | string;
  timestamp: string;
  firmName: string;
  deliveryOrderNo: string;
  partyName: string;
  productName: string;
  orderQuantity: number;
  expectedDeliveryDate: string;
  priority: string;
  note: string;
  plannedDate?: string;
  status: string;
  crmName?: string;
  quantityDelivered?: string;
  productionPending?: string;
  productRate?: string;
  uploadSo?: string;
}

interface KycProduct {
  id: number; // Added id
  productName: string;
  alumina: number;
  iron: number;
  bd: number;
  ap: number;
  price: number; // Added price
  firmName: string; // Added firm name
}

interface KittingFormRow {
  id: number;
  productName: string;
  percentage: string;
  baseAlumina: number;
  baseIron: number;
  baseBd: number;
  baseAp: number;
  basePrice: number; // Added base price
  al: number;
  fe: number;
  bd: number;
  ap: number;
  cost: number; // Added calculated cost
}

// Expected Values table — one row per property (single product at a time)
interface ExpectedValueRow {
  property: string;
  unit: string;
  value: string; // expected value for the selected product
}

interface CostingHistoryItem {
  id: number;
  productionId?: number | string;
  timestamp: string;
  compositionNo: string;
  orderNo: string;
  productName: string;
  alumina: number;
  iron: number;
  bd: number;
  ap: number;
  rawMaterials: string[]; // RM1..RM20
  rawMaterialQtys: string[]; // QTY1..QTY20
  rawMaterialCosts: number[]; // COST1..COST20
  plannedDate?: string;
  expectedDeliveryDate?: string;
  priority?: string;
  status?: string;
  firmName: string;
}

// --- Constants ---
const PRODUCTION_TABLE = "production";
const KYC_TABLE = "kyc";
const COSTING_RESPONSE_TABLE = "costing_response";

const DEFAULT_EXPECTED_PROPERTIES: ExpectedValueRow[] = [
  { property: "W/C (%)", unit: "%", value: "" },
  { property: "Sticky / Flow", unit: "", value: "" },
  { property: "IST (min)", unit: "min", value: "" },
  { property: "FST (min)", unit: "min", value: "" },
  { property: "BD at 110°C (g/cc)", unit: "g/cc", value: "" },
  { property: "BD at 1100°C (g/cc)", unit: "g/cc", value: "" },
  { property: "CCS at 110°C (kg/cm²)", unit: "kg/cm²", value: "" },
  { property: "CCS at 1100°C (kg/cm²)", unit: "kg/cm²", value: "" },
  { property: "PLC at 1100°C (%)", unit: "%", value: "" },
];

const PENDING_COLUMNS_META = [
  {
    header: "Action",
    dataKey: "actionColumn",
    alwaysVisible: true,
    toggleable: false,
  },
  { header: "Timestamp", dataKey: "timestamp", toggleable: true },
  { header: "ID", dataKey: "productionId", toggleable: true },
  { header: "Firm Name", dataKey: "firmName", toggleable: true },
  {
    header: "Delivery Order No.",
    dataKey: "deliveryOrderNo",
    toggleable: true,
  },
  { header: "Party Name", dataKey: "partyName", toggleable: true },
  { header: "Product Name", dataKey: "productName", toggleable: true },
  { header: "Order Qty", dataKey: "orderQuantity", toggleable: true },
  { header: "Planned Date", dataKey: "plannedDate", toggleable: true },
  {
    header: "Exp. Delivery",
    dataKey: "expectedDeliveryDate",
    toggleable: true,
  },
  { header: "Priority", dataKey: "priority", toggleable: true },
  { header: "Status", dataKey: "status", toggleable: true },
  { header: "CRM Name", dataKey: "crmName", toggleable: true },
  { header: "Qty Del.", dataKey: "quantityDelivered", toggleable: true },
  { header: "Prod Pend.", dataKey: "productionPending", toggleable: true },
  { header: "Notes", dataKey: "note", toggleable: true },
  { header: "Selling Price", dataKey: "productRate", toggleable: true },
];

const HISTORY_COLUMNS_META = [
  {
    header: "Action",
    dataKey: "actionColumn",
    alwaysVisible: true,
    toggleable: false,
  },
  { header: "Timestamp", dataKey: "timestamp", toggleable: true },
  { header: "ID", dataKey: "productionId", toggleable: true },
  { header: "Composition No.", dataKey: "compositionNo", toggleable: true },
  { header: "Order No.", dataKey: "orderNo", toggleable: true },
  { header: "Product Name", dataKey: "productName", toggleable: true },
  { header: "Total AL", dataKey: "alumina", toggleable: true },
  { header: "Total FE", dataKey: "iron", toggleable: true },
  { header: "Total BD", dataKey: "bd", toggleable: true },
  { header: "Total AP", dataKey: "ap", toggleable: true },
  { header: "Raw Materials", dataKey: "rawMaterials", toggleable: true },
];

export default function CheckPage() {
  const { user } = useAuth();
  const [pendingChecks, setPendingChecks] = useState<ProductionItem[]>([]);
  const [historyChecks, setHistoryChecks] = useState<CostingHistoryItem[]>([]);
  const [kycProducts, setKycProducts] = useState<KycProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  // Dialog state
  const [isKittingDialogOpen, setIsKittingDialogOpen] = useState(false);
  const [selectedCheck, setSelectedCheck] = useState<ProductionItem | null>(
    null,
  );
  const [selectedHistoryItem, setSelectedHistoryItem] =
    useState<CostingHistoryItem | null>(null);
  const [kittingFormRows, setKittingFormRows] = useState<KittingFormRow[]>([]);

  // Expected Values state
  const [expectedValues, setExpectedValues] = useState<ExpectedValueRow[]>(
    DEFAULT_EXPECTED_PROPERTIES,
  );

  // Admin firm filter
  const [adminFirmFilter, setAdminFirmFilter] = useState<string>("");

  // Search and Firm filters for listing
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [firmFilter, setFirmFilter] = useState<string>("all");

  // Extract unique firm names dynamically from pending and history items
  const uniqueFirms = useMemo(() => {
    const firms = new Set<string>();
    pendingChecks.forEach((item) => {
      if (item.firmName) firms.add(item.firmName);
    });
    historyChecks.forEach((item) => {
      if (item.firmName) firms.add(item.firmName);
    });
    return Array.from(firms).sort();
  }, [pendingChecks, historyChecks]);

  const filteredPendingChecks = useMemo(() => {
    return pendingChecks.filter((item) => {
      if (firmFilter !== "all") {
        if (!item.firmName || item.firmName.toLowerCase() !== firmFilter.toLowerCase()) {
          return false;
        }
      }
      if (searchTerm.trim() !== "") {
        const term = searchTerm.toLowerCase();
        return (
          (item.deliveryOrderNo || "").toLowerCase().includes(term) ||
          (item.partyName || "").toLowerCase().includes(term) ||
          (item.productName || "").toLowerCase().includes(term) ||
          (item.firmName || "").toLowerCase().includes(term) ||
          (item.priority || "").toLowerCase().includes(term) ||
          (item.note || "").toLowerCase().includes(term) ||
          (item.crmName || "").toLowerCase().includes(term) ||
          (item.status || "").toLowerCase().includes(term)
        );
      }
      return true;
    });
  }, [pendingChecks, firmFilter, searchTerm]);

  const filteredHistoryChecks = useMemo(() => {
    return historyChecks.filter((item) => {
      if (firmFilter !== "all") {
        if (!item.firmName || item.firmName.toLowerCase() !== firmFilter.toLowerCase()) {
          return false;
        }
      }
      if (searchTerm.trim() !== "") {
        const term = searchTerm.toLowerCase();
        return (
          (item.orderNo || "").toLowerCase().includes(term) ||
          (item.compositionNo || "").toLowerCase().includes(term) ||
          (item.productName || "").toLowerCase().includes(term) ||
          (item.firmName || "").toLowerCase().includes(term) ||
          (item.status || "").toLowerCase().includes(term) ||
          (item.priority || "").toLowerCase().includes(term)
        );
      }
      return true;
    });
  }, [historyChecks, firmFilter, searchTerm]);

  // Derived: filter kyc products by login firm (or admin selection)
  const filteredKycProducts = useMemo(() => {
    const isAdmin = user?.role?.toLowerCase() === "admin";
    if (isAdmin) {
      if (!adminFirmFilter) return kycProducts;
      return kycProducts.filter((p) => p.firmName === adminFirmFilter);
    }
    if (!user?.firm) return kycProducts;
    const userFirms = user.firm.split(',').map(f => f.trim()).filter(Boolean);
    return kycProducts.filter((p) => {
      const fName = (p.firmName || "").toLowerCase();
      return userFirms.some(uf => {
        const mappedFirm = (FIRM_MAP[uf] || uf).toLowerCase();
        const firmSearch = uf.toLowerCase();
        return fName.includes(firmSearch) || fName.includes(mappedFirm);
      });
    });
  }, [kycProducts, user?.firm, user?.role, adminFirmFilter]);

  // Raw Materials view dialog
  const [viewingMaterials, setViewingMaterials] = useState<{
    names: string[];
    qtys: string[];
  } | null>(null);

  const [activeTab, setActiveTab] = useState("pending");
  const [visiblePendingColumns, setVisiblePendingColumns] = useState<
    Record<string, boolean>
  >({});
  const [visibleHistoryColumns, setVisibleHistoryColumns] = useState<
    Record<string, boolean>
  >({});

  // Initialize column visibility
  useEffect(() => {
    const init = (meta: any[]) =>
      meta.reduce(
        (acc, col) => ({ ...acc, [col.dataKey]: col.alwaysVisible !== false }),
        {},
      );
    setVisiblePendingColumns(init(PENDING_COLUMNS_META));
    setVisibleHistoryColumns(init(HISTORY_COLUMNS_META));
  }, [user]);

  // ---------- DATA LOADING ----------
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [
        { data: orderReceiptData, error: orderReceiptErr },
        { data: kycData, error: kycErr },
        { data: costData, error: costErr },
        { data: allProdData, error: allProdErr },
      ] = await Promise.all([
        dispatchSupabase
          .from("ORDER RECEIPT")
          .select("*")
          .eq("check_delivery_in_stock_or_not", "For Production Planning"),
        supabase.from(KYC_TABLE).select("*").order("id", { ascending: true }),
        supabase
          .from(COSTING_RESPONSE_TABLE)
          .select("*")
          .order("id", { ascending: false }),
        supabase.from(PRODUCTION_TABLE).select("*"),
      ]);

      if (orderReceiptErr) throw orderReceiptErr;
      if (kycErr) throw kycErr;
      if (costErr) throw costErr;
      if (allProdErr) throw allProdErr;

      // Build a map of orderNo → production data (for enriching history)
      const normalize = (value: any) =>
        String(value || "")
          .trim()
          .toLowerCase();
      const makeOrderProductKey = (orderNo: any, productName: any) =>
        `${normalize(orderNo)}::${normalize(productName)}`;
      const pick = (row: any, keys: string[]) => {
        for (const key of keys) {
          const value = row?.[key];
          if (
            value !== null &&
            value !== undefined &&
            String(value).trim() !== ""
          )
            return value;
        }
        return "";
      };
      const buildOrderMeta = (row: any) => ({
        firmName: String(pick(row, ["Firm Name"])),
        partyName: String(pick(row, ["Party Names", "Party Name"])),
        productName: String(pick(row, ["Product Name"])).trim(),
        orderQuantity: Number(pick(row, ["Quantity", "Order Quantity"]) || 0),
        expectedDeliveryDate: pick(row, ["Expected Delivery Date"]),
        note: String(pick(row, ["Specific Concern", "Note"])),
        plannedDate: pick(row, ["check_delivery_actual", "Planned 1"]),
        status: String(pick(row, ["Status"])),
        crmName: String(pick(row, ["Crm For The Customer", "CRM Name"])),
        quantityDelivered: String(
          pick(row, ["Delivered", "Quantity Delivered"]),
        ),
        productionPending: String(
          pick(row, ["Pending Qty", "Production Pending"]),
        ),
        productRate: String(
          pick(row, ["Rate Of Material", "Product Rate", "Selling Price"]),
        ),
        uploadSo: String(pick(row, ["Upload SO"]) || ""),
      });

      const prodMap = new Map<
        string,
        {
          plannedDate: string;
          expectedDeliveryDate: string;
          priority: string;
          firmName: string;
          productionId?: number | string;
          uploadSo?: string;
        }
      >();
      const productionKeys = new Set<string>();
      (allProdData || []).forEach((row: any) => {
        const doNo = String(row["Delivery Order No."] || "").trim();
        const productName = String(row["Product Name"] || "").trim();
        if (doNo) {
          const prodInfo = {
            plannedDate: row["Planned 1"] || "",
            expectedDeliveryDate: row["Expected Delivery Date"] || "",
            priority: row["Priority"] || "",
            firmName: row["Firm Name"] || "",
            productionId: row.id,
            uploadSo: row["Upload SO"] || "",
          };
          if (!prodMap.has(doNo)) prodMap.set(doNo, prodInfo);
          prodMap.set(makeOrderProductKey(doNo, productName), prodInfo);
          productionKeys.add(makeOrderProductKey(doNo, productName));
        }
      });

      // Build metadata map from orderReceiptData
      const orderMetaMap = new Map<string, ReturnType<typeof buildOrderMeta>>();
      (orderReceiptData || []).forEach((row: any) => {
        const doNo = String(row["DO-Delivery Order No."] || "").trim();
        const meta = buildOrderMeta(row);
        const productName = meta.productName;
        if (doNo) {
          if (!orderMetaMap.has(doNo)) orderMetaMap.set(doNo, meta);
          orderMetaMap.set(makeOrderProductKey(doNo, productName), meta);
        }
      });

      // Build set of verified DO numbers
      const verifiedKeys = new Set<string>();
      const verifiedDosWithoutProduct = new Set<string>();
      (costData || []).forEach((row: any) => {
        const orderNo = String(row["Order No."] || "").trim();
        const productName = String(row["product name"] || "").trim();
        if (orderNo) {
          if (productName) {
            verifiedKeys.add(makeOrderProductKey(orderNo, productName));
          } else {
            verifiedDosWithoutProduct.add(normalize(orderNo));
          }
        }
      });

      const formatDate = (val: any) => {
        if (!val) return "";
        const d = new Date(val);
        if (!isNaN(d.getTime())) {
          const pad = (num: number) => String(num).padStart(2, "0");
          return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
        }
        return String(val);
      };

      const isVerified = (orderNo: any, productName: any) => {
        const key = makeOrderProductKey(orderNo, productName);
        return (
          verifiedKeys.has(key) ||
          (verifiedDosWithoutProduct.has(normalize(orderNo)) &&
            !normalize(productName))
        );
      };

      const pendingMap = new Map<string, ProductionItem>();
      (allProdData || []).forEach((row: any) => {
        const doNo = String(row["Delivery Order No."] || "").trim();
        const productName = String(row["Product Name"] || "").trim();
        if (!doNo) return;

        if (row["Actual 1"] || row["Order Cancel"]) return;
        if (isVerified(doNo, productName)) return;

        const key = makeOrderProductKey(doNo, productName);
        const meta = orderMetaMap.get(key) || orderMetaMap.get(doNo);

        pendingMap.set(key, {
          id: row.id,
          productionId: row.id,
          timestamp: row["Timestamp"] || "",
          firmName: row["Firm Name"] || meta?.firmName || "",
          deliveryOrderNo: doNo,
          partyName: row["Party Name"] || meta?.partyName || "",
          productName,
          orderQuantity: Number(
            row["Order Quantity"] || meta?.orderQuantity || 0,
          ),
          expectedDeliveryDate: formatDate(
            row["Expected Delivery Date"] || meta?.expectedDeliveryDate,
          ),
          priority: row["Priority"] || "",
          note: row["Note"] || meta?.note || "",
          plannedDate: formatDate(row["Planned 1"] || meta?.plannedDate),
          status: row["Status"] || meta?.status || "",
          crmName: meta?.crmName || "",
          quantityDelivered: meta?.quantityDelivered || "",
          productionPending: meta?.productionPending || "",
          productRate: meta?.productRate || "",
          uploadSo: row["Upload SO"] || meta?.uploadSo || "",
        });
      });
      (orderReceiptData || []).forEach((row: any) => {
        const doNo = String(row["DO-Delivery Order No."] || "").trim();
        const productName = String(row["Product Name"] || "").trim();
        const key = makeOrderProductKey(doNo, productName);
        if (
          !doNo ||
          pendingMap.has(key) ||
          productionKeys.has(key) ||
          isVerified(doNo, productName)
        )
          return;

        const enriched = prodMap.get(key) ||
          prodMap.get(doNo) || {
            plannedDate: "",
            expectedDeliveryDate: "",
            priority: "",
            firmName: "",
            productionId: "",
            uploadSo: "",
          };

        pendingMap.set(key, {
          id: row.id,
          productionId: enriched.productionId || "",
          timestamp: row["Timestamp"] || "",
          firmName: enriched.firmName || row["Firm Name"] || "",
          deliveryOrderNo: doNo,
          partyName: row["Party Names"] || "",
          productName,
          orderQuantity: Number(row["Quantity"] || 0),
          expectedDeliveryDate: formatDate(
            enriched.expectedDeliveryDate || row["Expected Delivery Date"],
          ),
          priority: enriched.priority || "",
          note: row["Specific Concern"] || "",
          plannedDate: formatDate(
            row["check_delivery_actual"] || enriched.plannedDate,
          ),
          status: row["Status"] || "",
          crmName: String(row["Crm For The Customer"] || ""),
          quantityDelivered: String(row["Delivered"] ?? ""),
          productionPending: String(row["Pending Qty"] ?? ""),
          productRate: String(row["Rate Of Material"] ?? ""),
          uploadSo: row["Upload SO"] || enriched.uploadSo || "",
        });
      });

      const pending = Array.from(pendingMap.values());

      const products: KycProduct[] = (kycData || [])
        .filter((row: any) => row["Product name"])
        .map((row: any) => ({
          id: row.id,
          productName: row["Product name"] || "",
          alumina: Number(row["Alumina"] || 0),
          iron: Number(row["Iron"] || 0),
          bd: Number(row["Bd"] || 0),
          ap: Number(row["Ap"] || 0),
          price: Number(row["Price"] || 0),
          firmName: row["Firm Name"] || "",
        }));

      const history: CostingHistoryItem[] = (costData || []).map((row: any) => {
        const rawMaterials: string[] = [];
        const rawMaterialQtys: string[] = [];
        const rawMaterialCosts: number[] = [];
        for (let i = 1; i <= 20; i++) {
          const rm = row[`RM${i}`];
          const qty = row[`QTY${i}`];
          const cost = row[`COST${i}`];
          if (rm && String(rm).trim()) rawMaterials.push(String(rm));
          if (qty !== null && qty !== undefined && String(qty).trim())
            rawMaterialQtys.push(String(qty));
          rawMaterialCosts.push(Number(cost || 0));
        }
        const orderNo = String(row["Order No."] || "").trim();
        const productName = String(row["product name"] || "").trim();
        const meta =
          orderMetaMap.get(makeOrderProductKey(orderNo, productName)) ||
          orderMetaMap.get(orderNo);
        const enriched = prodMap.get(
          makeOrderProductKey(orderNo, productName),
        ) ||
          prodMap.get(orderNo) || {
            plannedDate: "",
            expectedDeliveryDate: "",
            priority: "",
            firmName: "",
            productionId: "",
          };
        return {
          id: row.id,
          productionId: enriched.productionId || "",
          firmName: meta?.firmName || enriched.firmName || "",
          timestamp: row["TIMESTAMP"]
            ? format(new Date(row["TIMESTAMP"]), "dd/MM/yyyy HH:mm:ss")
            : "",
          compositionNo: row["Composition No."] || "",
          orderNo,
          productName,
          alumina: Number(row["alumina"] || 0),
          iron: Number(row["iron"] || 0),
          bd: Number(row["BD"] || 0),
          ap: Number(row["AP"] || 0),
          rawMaterials,
          rawMaterialQtys,
          rawMaterialCosts,
          plannedDate: enriched.plannedDate,
          expectedDeliveryDate: enriched.expectedDeliveryDate,
          priority: enriched.priority,
          status: row["Status"] || "",
        };
      });

      const userFirms = user?.firm ? user.firm.split(',').map(f => f.trim().toLowerCase()).filter(Boolean) : [];
      const isAdmin = user?.role?.toLowerCase() === "admin";
      const filterByFirm = (list: any[]) => {
        if (isAdmin || userFirms.length === 0) return list;
        return list.filter((item) => {
          const fName = (item.firmName || "").toLowerCase();
          return userFirms.some(uf => fName.includes(uf));
        });
      };

      setPendingChecks(filterByFirm(pending));
      setHistoryChecks(filterByFirm(history));
      setKycProducts(products);
    } catch (err: any) {
      setError(`Failed to load data: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ---------- FORM LOGIC ----------
  const normalizeLookupValue = (value: any) =>
    String(value || "")
      .trim()
      .toLowerCase();

  const findKycProduct = useCallback(
    (productName: string, firmName?: string) => {
      const normalizedProductName = normalizeLookupValue(productName);
      const normalizedFirmName = normalizeLookupValue(firmName);

      if (!normalizedProductName) return null;

      const firmMatch = normalizedFirmName
        ? kycProducts.find(
            (p) =>
              normalizeLookupValue(p.productName) === normalizedProductName &&
              normalizeLookupValue(p.firmName) === normalizedFirmName,
          )
        : null;

      return (
        firmMatch ||
        kycProducts.find(
          (p) => normalizeLookupValue(p.productName) === normalizedProductName,
        ) ||
        null
      );
    },
    [kycProducts],
  );

  const getActiveKycFirm = useCallback(
    (firmOverride?: string) => {
      if (firmOverride !== undefined) return firmOverride;
      if (user?.role?.toLowerCase() === "admin")
        return adminFirmFilter || selectedCheck?.firmName || "";
      if (!user?.firm) return selectedCheck?.firmName || "";
      const userFirms = user.firm.split(',').map(f => f.trim()).filter(Boolean);
      if (selectedCheck?.firmName) {
        const itemFirmLower = selectedCheck.firmName.toLowerCase();
        const matched = userFirms.find(uf => itemFirmLower.includes(uf.toLowerCase()) || (FIRM_MAP[uf] || uf).toLowerCase().includes(itemFirmLower));
        if (matched) return FIRM_MAP[matched] || matched;
      }
      return userFirms[0] ? (FIRM_MAP[userFirms[0]] || userFirms[0]) : "";
    },
    [adminFirmFilter, selectedCheck?.firmName, user?.firm, user?.role],
  );

  const refreshKittingRowsForFirm = useCallback(
    (firmName: string) => {
      setKittingFormRows((prev) =>
        prev.map((row) => {
          if (!row.productName) return row;

          const productData = findKycProduct(row.productName, firmName);
          if (!productData) {
            return {
              ...row,
              baseAlumina: 0,
              baseIron: 0,
              baseBd: 0,
              baseAp: 0,
              basePrice: 0,
              al: 0,
              fe: 0,
              bd: 0,
              ap: 0,
              cost: 0,
            };
          }

          const pct = Number.parseFloat(row.percentage) || 0;
          return {
            ...row,
            baseAlumina: productData.alumina,
            baseIron: productData.iron,
            baseBd: productData.bd,
            baseAp: productData.ap,
            basePrice: productData.price,
            al: (productData.alumina * pct) / 100,
            fe: (productData.iron * pct) / 100,
            bd: (productData.bd * pct) / 100,
            ap: (productData.ap * pct) / 100,
            cost: (productData.price * pct) / 100,
          };
        }),
      );
    },
    [findKycProduct],
  );

  const resetKittingForm = () => {
    setKittingFormRows([
      {
        id: 1,
        productName: "",
        percentage: "",
        baseAlumina: 0,
        baseIron: 0,
        baseBd: 0,
        baseAp: 0,
        basePrice: 0,
        al: 0,
        fe: 0,
        bd: 0,
        ap: 0,
        cost: 0,
      },
    ]);
    setExpectedValues(
      DEFAULT_EXPECTED_PROPERTIES.map((r) => ({ ...r, value: "" })),
    );
  };

  const handleOpenKittingForm = (item: ProductionItem) => {
    setSelectedCheck(item);
    setSelectedHistoryItem(null);
    setAdminFirmFilter("");
    resetKittingForm();
    setIsKittingDialogOpen(true);
  };

  const handleAdminFirmFilterChange = (value: string) => {
    const firmName = value === "all" ? "" : value;
    setAdminFirmFilter(firmName);
    refreshKittingRowsForFirm(getActiveKycFirm(firmName));
  };

  const loadHistoryItemForRevision = (item: CostingHistoryItem) => {
    setSelectedHistoryItem(item);
    // Find the matching production item or build a mock
    const prodItem = pendingChecks.find(
      (p) => p.deliveryOrderNo === item.orderNo,
    ) || {
      id: 0,
      timestamp: "",
      firmName: "",
      deliveryOrderNo: item.orderNo,
      partyName: "",
      productName: item.productName,
      orderQuantity: 0,
      expectedDeliveryDate: item.expectedDeliveryDate || "",
      priority: item.priority || "",
      note: "",
      plannedDate: item.plannedDate,
      status: "",
      uploadSo: "",
    };
    setSelectedCheck(prodItem);

    const rows: KittingFormRow[] = item.rawMaterials.map((mat, idx) => {
      const qty = item.rawMaterialQtys[idx] || "0";
      const productData = findKycProduct(
        mat,
        getActiveKycFirm(item.firmName || prodItem.firmName || ""),
      ) || { alumina: 0, iron: 0, bd: 0, ap: 0, price: 0 };
      const pct = Number.parseFloat(qty) || 0;
      return {
        id: idx + 1,
        productName: mat,
        percentage: qty,
        baseAlumina: productData.alumina,
        baseIron: productData.iron,
        baseBd: productData.bd,
        baseAp: productData.ap,
        basePrice: productData.price,
        al: (productData.alumina * pct) / 100,
        fe: (productData.iron * pct) / 100,
        bd: (productData.bd * pct) / 100,
        ap: (productData.ap * pct) / 100,
        cost: (productData.price * pct) / 100,
      };
    });

    setKittingFormRows(rows);
    setExpectedValues(
      DEFAULT_EXPECTED_PROPERTIES.map((r) => ({ ...r, value: "" })),
    );
    setIsKittingDialogOpen(true);
  };

  const addKittingFormRow = () => {
    if (kittingFormRows.length < 20) {
      setKittingFormRows((prev) => [
        ...prev,
        {
          id: (prev[prev.length - 1]?.id || 0) + 1,
          productName: "",
          percentage: "",
          baseAlumina: 0,
          baseIron: 0,
          baseBd: 0,
          baseAp: 0,
          basePrice: 0,
          al: 0,
          fe: 0,
          bd: 0,
          ap: 0,
          cost: 0,
        },
      ]);
    }
  };

  const removeKittingFormRow = (id: number) => {
    if (kittingFormRows.length > 1) {
      setKittingFormRows((prev) => prev.filter((r) => r.id !== id));
    }
  };

  const handleKittingRowChange = (
    id: number,
    field: keyof KittingFormRow,
    value: any,
  ) => {
    setKittingFormRows((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row;
        const updated = { ...row, [field]: value };

        // If user directly edits calculated fields, just set the value, don't recalculate
        if (
          field === "al" ||
          field === "fe" ||
          field === "bd" ||
          field === "ap" ||
          field === "cost"
        ) {
          return updated;
        }

        if (field === "productName") {
          const p = findKycProduct(value, getActiveKycFirm());
          if (p) {
            updated.baseAlumina = p.alumina;
            updated.baseIron = p.iron;
            updated.baseBd = p.bd;
            updated.baseAp = p.ap;
            updated.basePrice = p.price;
          }
        }
        const pct = Number.parseFloat(updated.percentage) || 0;
        updated.al = (updated.baseAlumina * pct) / 100;
        updated.fe = (updated.baseIron * pct) / 100;
        updated.bd = (updated.baseBd * pct) / 100;
        updated.ap = (updated.baseAp * pct) / 100;
        updated.cost = (updated.basePrice * pct) / 100;
        return updated;
      }),
    );
  };

  // Expected Values — simple single-value per property
  const handleExpectedValueChange = (propIdx: number, value: string) => {
    setExpectedValues((prev) => {
      const updated = [...prev];
      updated[propIdx] = { ...updated[propIdx], value };
      return updated;
    });
  };

  const kittingTotals = useMemo(
    () =>
      kittingFormRows.reduce(
        (acc, row) => {
          acc.al += row.al;
          acc.fe += row.fe;
          acc.bd += row.bd;
          acc.ap += row.ap;
          acc.variableCost += row.cost;
          acc.percentage += Number.parseFloat(row.percentage) || 0;
          return acc;
        },
        { al: 0, fe: 0, bd: 0, ap: 0, percentage: 0, variableCost: 0 },
      ),
    [kittingFormRows],
  );

  // ---------- GENERATE COMPOSITION NUMBER ----------
  const generateCompositionNumber = async (): Promise<string> => {
    const { data, error } = await supabase
      .from(COSTING_RESPONSE_TABLE)
      .select('"Composition No."')
      .order("id", { ascending: false })
      .limit(100);

    if (error) throw error;

    let maxNumber = 0;
    (data || []).forEach((row: any) => {
      const cn = row["Composition No."];
      if (cn && typeof cn === "string" && cn.startsWith("CN-")) {
        const num = Number.parseInt(cn.substring(3));
        if (!isNaN(num) && num > maxNumber) maxNumber = num;
      }
    });
    return `CN-${String(maxNumber + 1).padStart(3, "0")}`;
  };

  // ---------- AUTOFILL DUMMY DATA (DEV ONLY) ----------
  const autofillDummyData = () => {
    if (kycProducts.length < 2) {
      toast({
        title: "Dev Tool",
        description: "Not enough products in KYC to autofill.",
        variant: "destructive",
      });
      return;
    }

    // Pick 3 random materials
    const selected: KycProduct[] = [];
    const available = [...kycProducts];
    for (let i = 0; i < 3; i++) {
      if (available.length === 0) break;
      const idx = Math.floor(Math.random() * available.length);
      selected.push(available.splice(idx, 1)[0]);
    }

    // Assign percentages (e.g., 50, 30, 20)
    const pcts = [50, 30, 20];
    const rows: KittingFormRow[] = selected.map((p, i) => {
      const pct = pcts[i] || 0;
      return {
        id: i + 1,
        productName: p.productName,
        percentage: String(pct),
        baseAlumina: p.alumina,
        baseIron: p.iron,
        baseBd: p.bd,
        baseAp: p.ap,
        basePrice: p.price,
        al: (p.alumina * pct) / 100,
        fe: (p.iron * pct) / 100,
        bd: (p.bd * pct) / 100,
        ap: (p.ap * pct) / 100,
        cost: (p.price * pct) / 100,
      };
    });
    setKittingFormRows(rows);

    // Fill expected values with realistic dummy data
    const dummyExpected = [
      "12-14",
      "Sticky",
      "45",
      "120",
      "2.10",
      "2.05",
      "450",
      "400",
      "0.2",
    ];
    setExpectedValues((prev) =>
      prev.map((r, i) => ({ ...r, value: dummyExpected[i] || "" })),
    );

    toast({
      title: "Dev Tool",
      description: "Dummy data autofilled successfully.",
    });
  };

  // ---------- SAVE ----------
  const handleSaveKittingForm = async () => {
    if (!selectedCheck) return;
    setIsSubmitting(true);
    try {
      const compositionNumber = await generateCompositionNumber();

      // Build RM1..RM20 / QTY1..QTY20 fields
      const rmFields: Record<string, any> = {};
      for (let i = 1; i <= 20; i++) {
        const row = kittingFormRows[i - 1];
        rmFields[`RM${i}`] = row?.productName || null;
        rmFields[`QTY${i}`] = row?.percentage ? Number(row.percentage) : null;
        rmFields[`COST${i}`] = row?.cost ? Number(row.cost) : null;
      }

      const insertPayload = {
        "Composition No.": compositionNumber,
        "Order No.": selectedCheck.deliveryOrderNo,
        "product name": selectedCheck.productName,
        alumina: kittingTotals.al,
        iron: kittingTotals.fe,
        BD: kittingTotals.bd,
        AP: kittingTotals.ap,
        "VARIABLE COST": kittingTotals.variableCost,
        "SELLING PRICE": kittingTotals.variableCost, // Defaulting selling price to variable cost for now
        ...rmFields,
        // Expected Values (mapped by index to DB columns)
        "Expected WC %": expectedValues[0]?.value || null,
        "Expected Sticky Flow": expectedValues[1]?.value || null,
        "Expected IST": expectedValues[2]?.value || null,
        "Expected FST": expectedValues[3]?.value || null,
        "Expected BD 110C": expectedValues[4]?.value || null,
        "Expected BD 1100C": expectedValues[5]?.value || null,
        "Expected CCS 110C": expectedValues[6]?.value || null,
        "Expected CCS 1100C": expectedValues[7]?.value || null,
        "Expected PLC 1100C": expectedValues[8]?.value || null,
      };

      const { error: insertErr } = await supabase
        .from(COSTING_RESPONSE_TABLE)
        .insert([insertPayload]);

      if (insertErr) throw insertErr;

      // Update or create the production record for this exact order/product.
      if (selectedCheck?.deliveryOrderNo) {
        const completedAt = new Date().toISOString().slice(0, 10);
        const toNumberOrNull = (value: any) => {
          if (
            value === null ||
            value === undefined ||
            String(value).trim() === ""
          )
            return null;
          const parsed = Number(value);
          return Number.isNaN(parsed) ? null : parsed;
        };
        const toDateOrNull = (value: any) => {
          if (!value || String(value).trim() === "-") return null;
          const text = String(value).trim();
          if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;

          const ddmmyyyy = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
          if (ddmmyyyy) {
            const [, dd, mm, yy] = ddmmyyyy;
            const yyyy = yy.length === 2 ? `20${yy}` : yy;
            return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
          }

          const parsed = new Date(text);
          return Number.isNaN(parsed.getTime())
            ? null
            : parsed.toISOString().slice(0, 10);
        };
        const productionPayload = {
          "Delivery Order No.": selectedCheck.deliveryOrderNo,
          "Firm Name": selectedCheck.firmName || null,
          "Party Name": selectedCheck.partyName || null,
          "Product Name": selectedCheck.productName || null,
          "Order Quantity": toNumberOrNull(selectedCheck.orderQuantity),
          "Expected Delivery Date": toDateOrNull(
            selectedCheck.expectedDeliveryDate,
          ),
          Priority: selectedCheck.priority || null,
          Note: selectedCheck.note || null,
          "Crm Name": selectedCheck.crmName || null,
          "Quantity Delivered": toNumberOrNull(selectedCheck.quantityDelivered),
          "Production Pending": toNumberOrNull(selectedCheck.productionPending),
          Status: selectedCheck.status || null,
          "Planned 1": toDateOrNull(selectedCheck.plannedDate),
          "Actual 1": completedAt,
          product_rate: toNumberOrNull(selectedCheck.productRate),
          "Upload SO": selectedCheck.uploadSo || null,
        };

        let updateQuery = supabase
          .from(PRODUCTION_TABLE)
          .update(productionPayload)
          .eq('"Delivery Order No."', selectedCheck.deliveryOrderNo)
          .eq("Product Name", selectedCheck.productName);

        if (selectedCheck.firmName) {
          updateQuery = updateQuery.eq("Firm Name", selectedCheck.firmName);
        }

        const { data: updatedRows, error: updateErr } =
          await updateQuery.select("id");
        if (updateErr) throw updateErr;

        if (!updatedRows || updatedRows.length === 0) {
          const { error: insertProdErr } = await supabase
            .from(PRODUCTION_TABLE)
            .insert([productionPayload]);

          if (insertProdErr) throw insertProdErr;
        }
      }

      setIsKittingDialogOpen(false);
      setSelectedCheck(null);
      setSelectedHistoryItem(null);
      await loadData();
      toast({
        title: "Success!",
        description: "Full Kitting data submitted successfully.",
        duration: 2000,
      });
    } catch (err: any) {
      toast({
        title: "Error!",
        description: err.message,
        variant: "destructive",
        duration: 3000,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // ---------- COLUMN TOGGLING ----------
  const handleToggleColumn = (
    tab: "pending" | "history",
    dataKey: string,
    checked: boolean,
  ) => {
    const setter =
      tab === "pending" ? setVisiblePendingColumns : setVisibleHistoryColumns;
    setter((prev) => ({ ...prev, [dataKey]: checked }));
  };

  const handleSelectAllColumns = (
    tab: "pending" | "history",
    meta: any[],
    checked: boolean,
  ) => {
    const setter =
      tab === "pending" ? setVisiblePendingColumns : setVisibleHistoryColumns;
    setter((prev) => ({
      ...prev,
      ...meta.reduce(
        (acc, col) => {
          if (col.toggleable) acc[col.dataKey] = checked;
          return acc;
        },
        {} as Record<string, boolean>,
      ),
    }));
  };

  const visiblePendingMeta = useMemo(
    () => PENDING_COLUMNS_META.filter((c) => visiblePendingColumns[c.dataKey]),
    [visiblePendingColumns],
  );
  const visibleHistoryMeta = useMemo(
    () => HISTORY_COLUMNS_META.filter((c) => visibleHistoryColumns[c.dataKey]),
    [visibleHistoryColumns],
  );

  // ---------- RENDER ----------
  if (loading)
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-olive-600" />
      </div>
    );

  if (error)
    return (
      <div className="p-8 text-center text-red-600 bg-red-50 rounded-md">
        <AlertTriangle className="h-12 w-12 mx-auto mb-4" />
        <p className="text-lg font-semibold">Error Loading Data</p>
        <p>{error}</p>
        <Button
          onClick={loadData}
          className="mt-4 bg-olive-600 text-white hover:bg-olive-700"
        >
          Retry
        </Button>
      </div>
    );

  return (
    <div className="space-y-6 p-4 md:p-6 bg-white min-h-screen">
      <Toaster />

      <Card className="shadow-md border-none">
        <CardHeader className="bg-gradient-to-r from-olive-50 to-olive-100 rounded-t-lg">
          <CardTitle className="flex items-center gap-2 text-gray-800">
            <CheckCircle className="h-6 w-6 text-olive-600" />
            Full Kitting Verification
          </CardTitle>
          <CardDescription>
            Verify items after the full kitting process.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <div className="flex flex-col lg:flex-row gap-4 mb-6 lg:items-center lg:justify-between">
              <TabsList className="grid w-full lg:w-[320px] grid-cols-2">
                <TabsTrigger value="pending" className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" /> Pending
                  <Badge
                    variant="secondary"
                    className="ml-1 px-1.5 py-0.5 text-xs"
                  >
                    {filteredPendingChecks.length}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="history" className="flex items-center gap-2">
                  <Eye className="h-4 w-4" /> History
                  <Badge
                    variant="secondary"
                    className="ml-1 px-1.5 py-0.5 text-xs"
                  >
                    {filteredHistoryChecks.length}
                  </Badge>
                </TabsTrigger>
              </TabsList>

              <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto items-center">
                {/* Search Input */}
                <div className="relative w-full sm:w-64">
                  <Input
                    placeholder="Search orders, products, parties..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8 pr-8 py-2 text-sm h-9 border-slate-200 focus:border-olive-500 focus:ring-olive-500 rounded-md"
                  />
                  <div className="absolute left-2.5 top-2.5 text-gray-400">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                      stroke="currentColor"
                      className="w-4 h-4"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.602 10.602z"
                      />
                    </svg>
                  </div>
                  {searchTerm && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setSearchTerm("")}
                      className="absolute right-1 top-1 h-7 w-7 text-gray-400 hover:text-gray-600 hover:bg-transparent"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                {/* Firm Dropdown Filter */}
                <div className="w-full sm:w-48">
                  <Select value={firmFilter} onValueChange={setFirmFilter}>
                    <SelectTrigger className="h-9 text-sm border-slate-200">
                      <SelectValue placeholder="All Firms" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Firms</SelectItem>
                      {uniqueFirms.map((firm) => (
                        <SelectItem key={firm} value={firm}>
                          {firm}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* ──── PENDING ──── */}
            <TabsContent value="pending">
              <Card>
                <CardHeader className="py-3 px-4 bg-muted/30">
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-base">Pending Items</CardTitle>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs"
                        >
                          <Settings className="mr-2 h-4 w-4" /> Columns
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent align="end" className="w-56">
                        <h4 className="font-medium text-sm mb-2">
                          Toggle Columns
                        </h4>
                        <div className="flex justify-between mb-2">
                          <Button
                            variant="link"
                            size="sm"
                            className="p-0 h-auto text-xs"
                            onClick={() =>
                              handleSelectAllColumns(
                                "pending",
                                PENDING_COLUMNS_META,
                                true,
                              )
                            }
                          >
                            Select All
                          </Button>
                          <Button
                            variant="link"
                            size="sm"
                            className="p-0 h-auto text-xs"
                            onClick={() =>
                              handleSelectAllColumns(
                                "pending",
                                PENDING_COLUMNS_META,
                                false,
                              )
                            }
                          >
                            Deselect All
                          </Button>
                        </div>
                        <hr className="mb-2" />
                        {PENDING_COLUMNS_META.filter((c) => c.toggleable).map(
                          (col) => (
                            <div
                              key={col.dataKey}
                              className="flex items-center space-x-2 my-1"
                            >
                              <Checkbox
                                id={`p-${col.dataKey}`}
                                checked={!!visiblePendingColumns[col.dataKey]}
                                onCheckedChange={(v) =>
                                  handleToggleColumn(
                                    "pending",
                                    col.dataKey,
                                    !!v,
                                  )
                                }
                              />
                              <Label
                                htmlFor={`p-${col.dataKey}`}
                                className="font-normal text-sm"
                              >
                                {col.header}
                              </Label>
                            </div>
                          ),
                        )}
                      </PopoverContent>
                    </Popover>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="relative max-h-[600px] overflow-auto rounded-lg border">
                    <Table>
                      <TableHeader className="sticky top-0 z-10 bg-slate-100">
                        <TableRow>
                          {visiblePendingMeta.map((c) => (
                            <TableHead key={c.dataKey}>{c.header}</TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredPendingChecks.length > 0 ? (
                          filteredPendingChecks.map((item) => (
                            <TableRow key={item.id}>
                              {visiblePendingMeta.map((col) => (
                                <TableCell key={col.dataKey}>
                                  {col.dataKey === "actionColumn" ? (
                                    <Button
                                      size="sm"
                                      onClick={() =>
                                        handleOpenKittingForm(item)
                                      }
                                      className="bg-olive-600 text-white hover:bg-olive-700"
                                    >
                                      <CheckCircle className="mr-2 h-4 w-4" />{" "}
                                      Verify
                                    </Button>
                                  ) : col.dataKey === "priority" ? (
                                    <Badge
                                      className={
                                        item.priority === "Urgent"
                                          ? "bg-red-100 text-red-800"
                                          : "bg-green-100 text-green-800"
                                      }
                                    >
                                      {item.priority || "-"}
                                    </Badge>
                                  ) : (
                                    String((item as any)[col.dataKey] ?? "-")
                                  )}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell
                              colSpan={visiblePendingMeta.length}
                              className="h-24 text-center text-gray-400"
                            >
                              No pending items.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ──── HISTORY ──── */}
            <TabsContent value="history">
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-base">
                      Costing Response History
                    </CardTitle>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm">
                          <Settings className="mr-2 h-4 w-4" /> Columns
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent align="end" className="w-56">
                        <h4 className="font-medium text-sm mb-2">
                          Toggle Columns
                        </h4>
                        <div className="flex justify-between mb-2">
                          <Button
                            variant="link"
                            size="sm"
                            className="p-0 h-auto text-xs"
                            onClick={() =>
                              handleSelectAllColumns(
                                "history",
                                HISTORY_COLUMNS_META,
                                true,
                              )
                            }
                          >
                            Select All
                          </Button>
                          <Button
                            variant="link"
                            size="sm"
                            className="p-0 h-auto text-xs"
                            onClick={() =>
                              handleSelectAllColumns(
                                "history",
                                HISTORY_COLUMNS_META,
                                false,
                              )
                            }
                          >
                            Deselect All
                          </Button>
                        </div>
                        <hr className="mb-2" />
                        {HISTORY_COLUMNS_META.filter((c) => c.toggleable).map(
                          (col) => (
                            <div
                              key={col.dataKey}
                              className="flex items-center space-x-2 my-1"
                            >
                              <Checkbox
                                id={`h-${col.dataKey}`}
                                checked={!!visibleHistoryColumns[col.dataKey]}
                                onCheckedChange={(v) =>
                                  handleToggleColumn(
                                    "history",
                                    col.dataKey,
                                    !!v,
                                  )
                                }
                              />
                              <Label
                                htmlFor={`h-${col.dataKey}`}
                                className="font-normal text-sm"
                              >
                                {col.header}
                              </Label>
                            </div>
                          ),
                        )}
                      </PopoverContent>
                    </Popover>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="relative max-h-[600px] overflow-auto rounded-lg border">
                    <Table>
                      <TableHeader className="sticky top-0 z-10 bg-slate-100">
                        <TableRow>
                          {visibleHistoryMeta.map((c) => (
                            <TableHead key={c.dataKey}>{c.header}</TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredHistoryChecks.length > 0 ? (
                          filteredHistoryChecks.map((item) => (
                            <TableRow key={item.id}>
                              {visibleHistoryMeta.map((col) => (
                                <TableCell key={col.dataKey}>
                                  {col.dataKey === "actionColumn" ? (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() =>
                                        loadHistoryItemForRevision(item)
                                      }
                                      className="h-8"
                                    >
                                      <Edit className="h-4 w-4 mr-1" /> Revise
                                    </Button>
                                  ) : col.dataKey === "rawMaterials" ? (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() =>
                                        setViewingMaterials({
                                          names: item.rawMaterials,
                                          qtys: item.rawMaterialQtys,
                                        })
                                      }
                                      className="h-7 text-xs"
                                    >
                                      <Eye className="h-3.5 w-3.5 mr-1" /> View
                                      ({item.rawMaterials.length})
                                    </Button>
                                  ) : col.dataKey === "alumina" ? (
                                    item.alumina.toFixed(4)
                                  ) : col.dataKey === "iron" ? (
                                    item.iron.toFixed(4)
                                  ) : col.dataKey === "bd" ? (
                                    item.bd.toFixed(4)
                                  ) : col.dataKey === "ap" ? (
                                    item.ap.toFixed(4)
                                  ) : (
                                    String((item as any)[col.dataKey] ?? "-")
                                  )}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell
                              colSpan={visibleHistoryMeta.length}
                              className="h-24 text-center text-gray-400"
                            >
                              No history items found.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* ──── Raw Materials Dialog ──── */}
      <Dialog
        open={!!viewingMaterials}
        onOpenChange={() => setViewingMaterials(null)}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Raw Materials Used</DialogTitle>
            <DialogDescription>
              Detailed list of raw materials and their percentages.
            </DialogDescription>
          </DialogHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Material</TableHead>
                <TableHead>Quantity (%)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {viewingMaterials?.names.map((name, i) => (
                <TableRow key={i}>
                  <TableCell>{name}</TableCell>
                  <TableCell>{viewingMaterials.qtys[i] || "0"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DialogContent>
      </Dialog>

      {/* ──── Full Kitting Dialog ──── */}
      <Dialog open={isKittingDialogOpen} onOpenChange={setIsKittingDialogOpen}>
        <DialogContent className="max-w-7xl w-full max-h-[95vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>
              Full Kitting Details{" "}
              {selectedHistoryItem
                ? `— Revising ${selectedHistoryItem.compositionNo}`
                : ""}
            </DialogTitle>
            <DialogDescription>
              Review and verify the raw material composition and expected
              values.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-6 p-1 pr-2">
            {/* Order Info */}
            <div className="grid grid-cols-3 gap-4 px-1">
              <div>
                <Label className="text-xs text-gray-500">
                  Delivery Order No.
                </Label>
                <Input
                  value={selectedCheck?.deliveryOrderNo || ""}
                  readOnly
                  className="bg-gray-50 mt-1"
                />
              </div>
              <div>
                <Label className="text-xs text-gray-500">Product Name</Label>
                <Input
                  value={selectedCheck?.productName || ""}
                  readOnly
                  className="bg-gray-50 mt-1"
                />
              </div>
              <div>
                <Label className="text-xs text-gray-500">Planned Date</Label>
                <Input
                  value={selectedCheck?.plannedDate || "-"}
                  readOnly
                  className="bg-gray-50 mt-1"
                />
              </div>
            </div>

            {/* Admin Firm Filter */}
            {user?.role?.toLowerCase() === "admin" && (
              <div className="flex items-center gap-3 px-1">
                <Label className="text-xs font-semibold text-gray-600 whitespace-nowrap">
                  Filter by Firm:
                </Label>
                <Select
                  value={adminFirmFilter}
                  onValueChange={handleAdminFirmFilterChange}
                >
                  <SelectTrigger className="h-8 w-56 text-xs">
                    <SelectValue placeholder="All Firms" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Firms</SelectItem>
                    {[
                      ...new Set(
                        kycProducts.map((p) => p.firmName).filter(Boolean),
                      ),
                    ].map((f) => (
                      <SelectItem key={f} value={f}>
                        {f}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Raw Materials Composition Table */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-semibold text-sm text-gray-700">
                  Raw Materials Composition
                </h3>
                <div className="flex gap-2">
                  {process.env.NODE_ENV === "development" && (
                    <Button
                      onClick={autofillDummyData}
                      size="sm"
                      variant="outline"
                      className="text-amber-600 border-amber-200 hover:bg-amber-50"
                    >
                      <Zap className="h-4 w-4 mr-1" /> Autofill (Dev)
                    </Button>
                  )}
                  <Button
                    onClick={addKittingFormRow}
                    disabled={kittingFormRows.length >= 20}
                    size="sm"
                    className="bg-olive-600 text-white hover:bg-olive-700"
                  >
                    <Plus className="h-4 w-4 mr-1" /> Add Row
                  </Button>
                </div>
              </div>
              <div className="overflow-x-auto border rounded-lg">
                <Table>
                  <TableHeader className="bg-slate-100">
                    <TableRow>
                      <TableHead className="w-10 p-2">#</TableHead>
                      <TableHead className="min-w-[180px] p-2">
                        Material
                      </TableHead>
                      <TableHead className="p-2">AL</TableHead>
                      <TableHead className="p-2">FE</TableHead>
                      <TableHead className="p-2">BD</TableHead>
                      <TableHead className="p-2">AP</TableHead>
                      <TableHead className="bg-yellow-100 min-w-[110px] p-2">
                        % (Input)
                      </TableHead>
                      <TableHead className="p-2">AL (Calc)</TableHead>
                      <TableHead className="p-2">FE (Calc)</TableHead>
                      <TableHead className="p-2">BD (Calc)</TableHead>
                      <TableHead className="p-2">AP (Calc)</TableHead>
                      <TableHead className="bg-green-50 min-w-[110px] p-2">
                        Cost (₹)
                      </TableHead>
                      <TableHead className="p-2">Del</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {kittingFormRows.map((row, idx) => (
                      <TableRow key={row.id}>
                        <TableCell className="p-2 text-sm">{idx + 1}</TableCell>
                        <TableCell className="p-2">
                          <Select
                            value={row.productName}
                            onValueChange={(v) =>
                              handleKittingRowChange(row.id, "productName", v)
                            }
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="Select material" />
                            </SelectTrigger>
                            <SelectContent>
                              {filteredKycProducts
                                .filter(
                                  (p) =>
                                    adminFirmFilter ||
                                    !selectedCheck?.firmName ||
                                    p.firmName === selectedCheck.firmName,
                                )
                                .map((p) => (
                                  <SelectItem
                                    key={`${p.id}-${p.productName}`}
                                    value={p.productName}
                                  >
                                    {p.productName}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="p-2 text-xs">
                          {row.baseAlumina.toFixed(2)}
                        </TableCell>
                        <TableCell className="p-2 text-xs">
                          {row.baseIron.toFixed(2)}
                        </TableCell>
                        <TableCell className="p-2 text-xs">
                          {row.baseBd.toFixed(2)}
                        </TableCell>
                        <TableCell className="p-2 text-xs">
                          {row.baseAp.toFixed(2)}
                        </TableCell>
                        <TableCell className="bg-yellow-50 p-2">
                          <Input
                            type="number"
                            value={row.percentage}
                            onChange={(e) =>
                              handleKittingRowChange(
                                row.id,
                                "percentage",
                                e.target.value,
                              )
                            }
                            placeholder="e.g. 30"
                            className="h-8 text-xs"
                          />
                        </TableCell>
                        <TableCell className="p-2">
                          <Input
                            type="number"
                            value={row.al}
                            onChange={(e) =>
                              handleKittingRowChange(
                                row.id,
                                "al",
                                Number(e.target.value),
                              )
                            }
                            className="h-8 text-xs"
                          />
                        </TableCell>
                        <TableCell className="p-2">
                          <Input
                            type="number"
                            value={row.fe}
                            onChange={(e) =>
                              handleKittingRowChange(
                                row.id,
                                "fe",
                                Number(e.target.value),
                              )
                            }
                            className="h-8 text-xs"
                          />
                        </TableCell>
                        <TableCell className="p-2">
                          <Input
                            type="number"
                            value={row.bd}
                            onChange={(e) =>
                              handleKittingRowChange(
                                row.id,
                                "bd",
                                Number(e.target.value),
                              )
                            }
                            className="h-8 text-xs"
                          />
                        </TableCell>
                        <TableCell className="p-2">
                          <Input
                            type="number"
                            value={row.ap}
                            onChange={(e) =>
                              handleKittingRowChange(
                                row.id,
                                "ap",
                                Number(e.target.value),
                              )
                            }
                            className="h-8 text-xs"
                          />
                        </TableCell>
                        <TableCell className="bg-green-50 p-2">
                          <Input
                            type="number"
                            value={row.cost}
                            onChange={(e) =>
                              handleKittingRowChange(
                                row.id,
                                "cost",
                                Number(e.target.value),
                              )
                            }
                            className="h-8 text-xs font-semibold"
                          />
                        </TableCell>
                        <TableCell className="p-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeKittingFormRow(row.id)}
                          >
                            <X className="h-4 w-4 text-red-500" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter>
                    <TableRow className="bg-slate-50 font-bold text-sm">
                      <TableCell colSpan={6} className="text-right p-2">
                        Total
                      </TableCell>
                      <TableCell className="bg-yellow-100 p-2">
                        {kittingTotals.percentage.toFixed(2)}%
                      </TableCell>
                      <TableCell className="p-2">
                        {kittingTotals.al.toFixed(4)}
                      </TableCell>
                      <TableCell className="p-2">
                        {kittingTotals.fe.toFixed(4)}
                      </TableCell>
                      <TableCell className="p-2">
                        {kittingTotals.bd.toFixed(4)}
                      </TableCell>
                      <TableCell className="p-2">
                        {kittingTotals.ap.toFixed(4)}
                      </TableCell>
                      <TableCell className="bg-green-50 p-2">
                        {kittingTotals.variableCost.toFixed(2)}
                      </TableCell>
                      <TableCell className="p-2" />
                    </TableRow>
                  </TableFooter>
                </Table>
              </div>
            </div>

            {/* Expected Values Table */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-sm text-gray-700">
                  Expected Values
                </h3>
                <span className="text-xs text-gray-500 bg-olive-50 border border-olive-200 rounded px-2 py-0.5">
                  Product: <strong>{selectedCheck?.productName || "—"}</strong>
                </span>
              </div>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-olive-50">
                      <th className="border border-gray-200 p-2.5 text-left font-semibold text-gray-700 w-[65%]">
                        Property / Parameter
                      </th>
                      <th className="border border-gray-200 p-2.5 text-center font-semibold text-olive-700 w-[35%]">
                        Expected Value
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {expectedValues.map((evRow, rowIdx) => (
                      <tr
                        key={evRow.property}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        <td className="border border-gray-200 p-2 font-medium text-gray-700">
                          {evRow.property}
                        </td>
                        <td className="border border-gray-200 p-1">
                          <Input
                            value={evRow.value}
                            onChange={(e) =>
                              handleExpectedValueChange(rowIdx, e.target.value)
                            }
                            placeholder="e.g. 10–12"
                            className="h-8 text-xs text-center border-dashed border-gray-300 focus:border-olive-400 bg-white"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                💡 Supports ranges (e.g.{" "}
                <code className="bg-gray-100 px-1 rounded">10–12</code>) and
                exact values (e.g.{" "}
                <code className="bg-gray-100 px-1 rounded">0.5</code>)
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-2 p-4 border-t bg-white">
            <Button
              variant="outline"
              onClick={() => setIsKittingDialogOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveKittingForm}
              disabled={isSubmitting}
              className="bg-olive-600 text-white hover:bg-olive-700"
            >
              {isSubmitting && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
