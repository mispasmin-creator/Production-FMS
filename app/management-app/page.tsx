"use client";

import React from "react";
import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Loader2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  History,
  Eye,
  Settings,
  ChevronDown,
  ChevronUp,
  LayoutDashboard,
  Search,
} from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/use-toast";
import { Toaster } from "@/components/ui/toaster";
import { cn } from "@/lib/utils";

// ──────────────── Constants ────────────────
const COSTING_RESPONSE_TABLE = "costing_response";
const KYC_TABLE = "kyc";
const PRODUCTION_TABLE = "production";

const normalizeKey = (value: any) => String(value || "").trim().toLowerCase();
const makeOrderProductKey = (orderNo: any, productName: any) =>
  `${normalizeKey(orderNo)}::${normalizeKey(productName)}`;

const EXPECTED_LABELS: { key: string; label: string }[] = [
  { key: "Expected WC %", label: "W/C (%)" },
  { key: "Expected Sticky Flow", label: "Sticky / Flow" },
  { key: "Expected IST", label: "IST (min)" },
  { key: "Expected FST", label: "FST (min)" },
  { key: "Expected BD 110C", label: "BD at 110°C (g/cc)" },
  { key: "Expected BD 1100C", label: "BD at 1100°C (g/cc)" },
  { key: "Expected CCS 110C", label: "CCS at 110°C (kg/cm²)" },
  { key: "Expected CCS 1100C", label: "CCS at 1100°C (kg/cm²)" },
  { key: "Expected PLC 1100C", label: "PLC at 1100°C (%)" },
];

// ──────────────── Types ────────────────
interface LabItem {
  id: number;
  productionId?: number | string;
  compositionNo: string;
  orderNo: string;
  partyName: string;
  productName: string;
  orderQuantity: number;
  sellingPrice: number;     // from costing_response (spec/reference)
  productRate: number;      // from production table (actual selling price)
  gpPercentage: number;
  alumina: number;
  iron: number;
  bd: number;
  ap: number;
  variableCost: number;
  // lab results
  aluminaActual: string;
  ironActual: string;
  // timestamps
  planned1: string | null;
  actual2: string | null;
  // PI approval
  piApprovalStatus: string;
  piRemarks: string;
  piApprovedAt: string | null;
  // Management approval
  managementApprovalStatus: string;
  managementRemarks: string;
  managementApprovedAt: string | null;
  firmName: string;
  // expected values
  expectedValues: Record<string, string>;
  // composition
  rmValues: { rm: string; qty: number; cost: number; al: number; fe: number; bd: number; ap: number }[];
  // actual costs from PI
  materialCostActual: number; // This represents Total Cost
  manufacturingCost: number;
  gpActual: number;
}

const PENDING_COLUMNS_META = [
  { header: "Action", dataKey: "actionColumn", alwaysVisible: true, toggleable: false },
  { header: "ID", dataKey: "productionId", toggleable: true },
  { header: "Composition No.", dataKey: "compositionNo", toggleable: true },
  { header: "Order No.", dataKey: "orderNo", toggleable: true },
  { header: "Party Name", dataKey: "partyName", toggleable: true },
  { header: "Product Name", dataKey: "productName", toggleable: true },
  { header: "Qty", dataKey: "orderQuantity", toggleable: true },
  { header: "PI Approved At", dataKey: "piApprovedAt", toggleable: true },
  { header: "PI Remarks", dataKey: "piRemarks", toggleable: true },
  { header: "GP% Actual", dataKey: "gpActual", toggleable: true },
  { header: "Total Cost", dataKey: "materialCostActual", toggleable: true },
  { header: "Variable Cost", dataKey: "variableCost", toggleable: true },
  { header: "Selling Price", dataKey: "sellingPrice", toggleable: true },
];

const HISTORY_COLUMNS_META = [
  { header: "Action", dataKey: "actionColumn", alwaysVisible: true, toggleable: false },
  { header: "ID", dataKey: "productionId", toggleable: true },
  { header: "Decision", dataKey: "managementApprovalStatus", toggleable: true },
  { header: "Composition No.", dataKey: "compositionNo", toggleable: true },
  { header: "Order No.", dataKey: "orderNo", toggleable: true },
  { header: "Party Name", dataKey: "partyName", toggleable: true },
  { header: "Product Name", dataKey: "productName", toggleable: true },
  { header: "Qty", dataKey: "orderQuantity", toggleable: true },
  { header: "GP% Actual", dataKey: "gpActual", toggleable: true },
  { header: "Total Cost", dataKey: "materialCostActual", toggleable: true },
  { header: "Approved At", dataKey: "managementApprovedAt", toggleable: true },
  { header: "Management Remarks", dataKey: "managementRemarks", toggleable: true },
];

// ──────────────── Page ────────────────
export default function ManagementApp() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [pendingItems, setPendingItems] = useState<LabItem[]>([]);
  const [historyItems, setHistoryItems] = useState<LabItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("pending");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredPending = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return pendingItems;
    return pendingItems.filter(item =>
      (item.compositionNo || "").toLowerCase().includes(q) ||
      (item.orderNo || "").toLowerCase().includes(q) ||
      (item.partyName || "").toLowerCase().includes(q) ||
      (item.productName || "").toLowerCase().includes(q)
    );
  }, [pendingItems, searchQuery]);

  const filteredHistory = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return historyItems;
    return historyItems.filter(item =>
      (item.compositionNo || "").toLowerCase().includes(q) ||
      (item.orderNo || "").toLowerCase().includes(q) ||
      (item.partyName || "").toLowerCase().includes(q) ||
      (item.productName || "").toLowerCase().includes(q) ||
      (item.managementApprovalStatus || "").toLowerCase().includes(q)
    );
  }, [historyItems, searchQuery]);

  // Detail / Action dialog
  const [selectedItem, setSelectedItem] = useState<LabItem | null>(null);
  const [actionMode, setActionMode] = useState<"review" | "view" | null>(null);
  const [remarks, setRemarks] = useState("");
  const [remarksError, setRemarksError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [approvalType, setApprovalType] = useState<"OK" | "Make a sample Test">("OK");
  
  // Manual calculation fields (Synced with PI Approval)
  const [manualMaterialCost, setManualMaterialCost] = useState<number>(0);
  const [manualGP, setManualGP] = useState<number>(0);
  const [totalProfit, setTotalProfit] = useState<number>(0);

  // Column visibility
  const [visiblePendingColumns, setVisiblePendingColumns] = useState<Record<string, boolean>>(
    PENDING_COLUMNS_META.reduce((acc, col) => ({ ...acc, [col.dataKey]: true }), {})
  );
  const [visibleHistoryColumns, setVisibleHistoryColumns] = useState<Record<string, boolean>>(
    HISTORY_COLUMNS_META.reduce((acc, col) => ({ ...acc, [col.dataKey]: true }), {})
  );

  // ── Data Loading ──
  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const [
        { data: kycData, error: kycErr },
        { data: prodData, error: prodErr }
      ] = await Promise.all([
        supabase.from(KYC_TABLE).select("*"),
        supabase.from(PRODUCTION_TABLE).select('id, "Delivery Order No.", "Product Name", product_rate, "Firm Name", "Party Name", "Order Quantity"'),
      ]);
      
      if (kycErr) throw kycErr;
      if (prodErr) throw prodErr;
      
      const kycMap = new Map();
      (kycData || []).forEach(k => {
        kycMap.set(String(k["Product name"] || "").trim().toLowerCase(), k);
      });

      const productionMetaMap = new Map<
        string,
        { productionId?: number | string; productRate: number; firmName: string; partyName: string; orderQuantity: number }
      >();
      (prodData || []).forEach((p: any) => {
        const orderNo = String(p["Delivery Order No."] || "").trim();
        const productName = String(p["Product Name"] || "").trim();
        if (orderNo) {
          const meta = {
            productionId: p.id,
            productRate: Number(p.product_rate || 0),
            firmName: String(p["Firm Name"] || ""),
            partyName: String(p["Party Name"] || ""),
            orderQuantity: Number(p["Order Quantity"] || 0),
          };
          productionMetaMap.set(makeOrderProductKey(orderNo, productName), meta);
          if (!productionMetaMap.has(normalizeKey(orderNo))) {
            productionMetaMap.set(normalizeKey(orderNo), meta);
          }
        }
      });

      // 3. Fetch Costing data (PI Approved only)
      const { data, error: dbErr } = await supabase
        .from(COSTING_RESPONSE_TABLE)
        .select("*")
        .eq("PI Approval Status", "Approved")
        .order("id", { ascending: false });

      if (dbErr) throw dbErr;

      const mapped: LabItem[] = (data || []).map((row) => {
        const rmValues: LabItem["rmValues"] = [];
        for (let i = 1; i <= 20; i++) {
          const rm = row[`RM${i}`];
          const qty = row[`QTY${i}`];
          const cost = row[`COST${i}`];
          if (rm && String(rm).trim()) {
            const rmKey = String(rm).trim().toLowerCase();
            const kycInfo = kycMap.get(rmKey);
            rmValues.push({ 
              rm: String(rm), 
              qty: Number(qty || 0),
              cost: Number(cost || 0),
              al: kycInfo ? Number(kycInfo.Alumina || 0) : 0,
              fe: kycInfo ? Number(kycInfo.Iron || 0) : 0,
              bd: kycInfo ? Number(kycInfo.Bd || 0) : 0,
              ap: kycInfo ? Number(kycInfo.Ap || 0) : 0,
            });
          }
        }
        const expectedValues: Record<string, string> = {};
        EXPECTED_LABELS.forEach(({ key }) => {
          expectedValues[key] = row[key] ? String(row[key]) : "";
        });

        const orderNo = row["Order No."] || "";
        const productName = row["product name"] || "";
        const productionMeta =
          productionMetaMap.get(makeOrderProductKey(orderNo, productName)) ||
          productionMetaMap.get(normalizeKey(orderNo));
        const productRate = productionMeta?.productRate || 0;

        return {
          id: row.id,
          productionId: productionMeta?.productionId || "",
          compositionNo: row["Composition No."] || "",
          orderNo,
          partyName: productionMeta?.partyName || "",
          productName,
          orderQuantity: productionMeta?.orderQuantity || 0,
          sellingPrice: Number(row["SELLING PRICE"] || 0),
          productRate,
          gpPercentage: Number(row["GP %AGE"] || 0),
          gpActual: Number(row["GP %AGE Actual"] || 0),
          alumina: Number(row["alumina"] || 0),
          iron: Number(row["iron"] || 0),
          bd: Number(row["BD"] || 0),
          ap: Number(row["AP"] || 0),
          variableCost: Number(row["VARIABLE COST"] || 0),
          aluminaActual: row["Alumina Percentage %"] ? String(row["Alumina Percentage %"]) : "",
          ironActual: row["Iron Percentage %"] ? String(row["Iron Percentage %"]) : "",
          planned1: row["Planned 1"] ? format(new Date(row["Planned 1"]), "dd/MM/yy") : null,
          actual2: row["Actual 2"] ? format(new Date(row["Actual 2"]), "dd/MM/yy HH:mm") : null,
          piApprovalStatus: row["PI Approval Status"] || "",
          piRemarks: row["PI Remarks"] || "",
          piApprovedAt: row["PI Approved At"]
            ? format(new Date(row["PI Approved At"]), "dd/MM/yy HH:mm")
            : null,
          managementApprovalStatus: row["Management Approval Status"] || "",
          managementRemarks: row["Management Remarks"] || "",
          managementApprovedAt: row["Management Approved At"]
            ? format(new Date(row["Management Approved At"]), "dd/MM/yy HH:mm")
            : null,
          expectedValues,
          rmValues,
          materialCostActual: Number(row["Material Cost Actual"] || 0),
          manufacturingCost: Number(row["Manufacturing Cost"] || 0),
          firmName: productionMeta?.firmName || "",
        };
      });

      const firmSearch = user?.firm?.toLowerCase() || "";
      const isAdmin = user?.role?.toLowerCase() === "admin";
      const filtered = mapped.filter((r) => {
        if (isAdmin) return true;
        if (!firmSearch) return true;
        return r.firmName.toLowerCase().includes(firmSearch);
      });

      setPendingItems(filtered.filter((i) => !i.managementApprovalStatus));
      setHistoryItems(filtered.filter((i) => !!i.managementApprovalStatus));
    } catch (err: any) {
      setError(`Failed to load data: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ── Actions ──
  const openAction = (item: LabItem, mode: "review" | "view") => {
    setSelectedItem(item);
    setActionMode(mode);
    setRemarks("");
    setRemarksError("");
    setApprovalType("OK");

    const totalRmCost = item.rmValues.reduce((sum, rm) => sum + rm.cost, 0);
    // Use product_rate (job card selling price) for profit calculation
    const rate = item.productRate || item.sellingPrice;
    // Use stored values if they exist, otherwise fallback to calculation
    const totalCost = item.materialCostActual > 0 ? item.materialCostActual : totalRmCost;
    const gp = item.gpActual > 0
      ? item.gpActual
      : (rate > 0 ? ((rate - totalCost) / rate) * 100 : 0);

    setManualMaterialCost(totalCost);
    setManualGP(gp);
    // profit = selling_price - (total_cost + manufacturing_cost)
    setTotalProfit(rate - totalCost);
  };


  const handleSubmitDecision = async (decision: "Approved" | "Rejected") => {
    if (!selectedItem) return;
    if (!remarks.trim()) {
      setRemarksError("Remarks are mandatory.");
      return;
    }
    setIsSubmitting(true);
    try {
      const updateData: Record<string, any> = {
        "Management Approval Status": decision,
        "Management Remarks": remarks.trim(),
        "Management Approved At": new Date().toISOString(),
        "GP %AGE Actual": (manualGP !== null && manualGP !== undefined) ? Number(manualGP.toFixed(2)) : null,
        "Material Cost Actual": (manualMaterialCost !== null && manualMaterialCost !== undefined) ? Number(manualMaterialCost.toFixed(2)) : null,
      };

      if (decision === "Approved") {
        updateData["Status"] = approvalType === "OK" ? "Management Approved" : "Sample Test Pending";
        updateData["Management Approval Type"] = approvalType;
      } else {
        updateData["Status"] = "Rejected by Management";
        updateData["Management Approval Type"] = null;
      }

      const { error: updateErr } = await supabase
        .from(COSTING_RESPONSE_TABLE)
        .update(updateData)
        .eq("id", selectedItem.id);

      if (updateErr) throw updateErr;

      toast({
        title: decision === "Approved" ? "✅ Management Approved" : "🔴 Management Rejected",
        description:
          decision === "Approved"
            ? "Entry finalized and closed."
            : "Entry marked as rejected and sent to history.",
      });

      setActionMode(null);
      setSelectedItem(null);
      await loadData();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Column toggling helpers ──
  const handleToggleColumn = (tab: string, dataKey: string, checked: boolean) => {
    const setter = tab === "pending" ? setVisiblePendingColumns : setVisibleHistoryColumns;
    setter((prev) => ({ ...prev, [dataKey]: checked }));
  };

  const handleSelectAllColumns = (tab: string, columnsMeta: typeof PENDING_COLUMNS_META, checked: boolean) => {
    const nv: Record<string, boolean> = {};
    columnsMeta.forEach((col) => { if (col.toggleable) nv[col.dataKey] = checked; });
    const setter = tab === "pending" ? setVisiblePendingColumns : setVisibleHistoryColumns;
    setter((prev) => ({ ...prev, ...nv }));
  };

  const visiblePendingColumnsMeta = useMemo(
    () => PENDING_COLUMNS_META.filter((col) => visiblePendingColumns[col.dataKey]),
    [visiblePendingColumns]
  );
  const visibleHistoryColumnsMeta = useMemo(
    () => HISTORY_COLUMNS_META.filter((col) => visibleHistoryColumns[col.dataKey]),
    [visibleHistoryColumns]
  );

  // ── ColumnToggler component ──
  const ColumnToggler = ({ tab, columnsMeta }: { tab: string; columnsMeta: typeof PENDING_COLUMNS_META }) => (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 text-xs bg-transparent ml-auto">
          <Settings className="mr-1.5 h-3.5 w-3.5" /> View Columns
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[220px] p-3">
        <div className="grid gap-2">
          <p className="text-sm font-medium">Toggle Columns</p>
          <div className="flex items-center justify-between mt-1 mb-2">
            <Button variant="link" size="sm" className="p-0 h-auto text-xs" onClick={() => handleSelectAllColumns(tab, columnsMeta, true)}>Select All</Button>
            <span className="text-gray-300 mx-1">|</span>
            <Button variant="link" size="sm" className="p-0 h-auto text-xs" onClick={() => handleSelectAllColumns(tab, columnsMeta, false)}>Deselect All</Button>
          </div>
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {columnsMeta.filter((col) => col.toggleable).map((col) => (
              <div key={`toggle-${tab}-${col.dataKey}`} className="flex items-center space-x-2">
                <Checkbox
                  id={`toggle-${tab}-${col.dataKey}`}
                  checked={tab === "pending" ? !!visiblePendingColumns[col.dataKey] : !!visibleHistoryColumns[col.dataKey]}
                  onCheckedChange={(checked) => handleToggleColumn(tab, col.dataKey, Boolean(checked))}
                />
                <Label htmlFor={`toggle-${tab}-${col.dataKey}`} className="text-xs font-normal cursor-pointer">{col.header}</Label>
              </div>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );

  // ── StatusBadge ──
  const StatusBadge = ({ status }: { status: string }) => {
    if (status === "Approved") return <Badge className="bg-emerald-100 text-emerald-700 border border-emerald-200">✅ Approved</Badge>;
    if (status === "Rejected") return <Badge className="bg-red-100 text-red-700 border border-red-200">🔴 Rejected</Badge>;
    return <Badge variant="secondary">{status}</Badge>;
  };

  // ── Loading / Error ──
  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen gap-3 text-olive-600">
        <Loader2 className="h-10 w-10 animate-spin" />
        <p className="text-lg font-medium">Loading Management App…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center text-red-600 bg-red-50 rounded-md">
        <AlertTriangle className="h-12 w-12 mx-auto mb-4" />
        <p className="text-lg font-semibold">Error Loading Data</p>
        <p className="text-sm mb-4">{error}</p>
        <Button onClick={loadData}>Retry</Button>
      </div>
    );
  }

  // ── Render ──
  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-screen max-w-full overflow-x-hidden">
      <Toaster />

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-olive-600" />
            Management App
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Final review and approval of product entries.</p>
        </div>
      </div>

      <Card className="border-none shadow-sm bg-white">
        <CardContent className="p-4 sm:p-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
              <TabsList className="grid w-full sm:w-[400px] grid-cols-2 p-1 bg-slate-100 rounded-xl mb-0">
                <TabsTrigger value="pending" className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-olive-700 data-[state=active]:shadow-sm transition-all">
                  <ShieldCheck className="h-4 w-4 mr-2" /> Pending Review
                  <Badge variant="secondary" className="ml-1.5 px-1.5 py-0.5 text-xs">
                    {filteredPending.length}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="history" className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-olive-700 data-[state=active]:shadow-sm transition-all">
                  <History className="h-4 w-4 mr-2" /> Decision History
                  <Badge variant="secondary" className="ml-1.5 px-1.5 py-0.5 text-xs">
                    {filteredHistory.length}
                  </Badge>
                </TabsTrigger>
              </TabsList>
              <div className="relative w-full sm:w-[300px]">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search decisions..."
                  value={searchQuery}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                  className="pl-9 focus-visible:ring-olive-500"
                />
              </div>
            </div>

            {/* ── PENDING TAB ──────────────────────────────── */}
            <TabsContent value="pending">
              <Card className="shadow-sm border border-border">
                <CardHeader className="py-3 px-4 bg-olive-50/70 rounded-t-lg">
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-md font-semibold flex items-center gap-2">
                      <ShieldCheck className="h-5 w-5 text-olive-600" />
                      Awaiting Management Decision ({filteredPending.length})
                    </CardTitle>
                    <ColumnToggler tab="pending" columnsMeta={PENDING_COLUMNS_META} />
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-muted/50">
                        <TableRow>
                          {visiblePendingColumnsMeta.map((col) => (
                            <TableHead key={col.dataKey} className="whitespace-nowrap">{col.header}</TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredPending.length > 0 ? (
                          filteredPending.map((item) => (
                            <TableRow key={item.id} className="hover:bg-olive-50/40">
                              {visiblePendingColumnsMeta.map((col) => (
                                <TableCell key={col.dataKey} className="whitespace-nowrap text-sm py-2 px-3">
                                  {col.dataKey === "actionColumn" ? (
                                    <div className="flex gap-2">
                                      <Button
                                        size="sm"
                                        className="bg-olive-600 hover:bg-olive-700 text-white h-8"
                                        onClick={() => openAction(item, "review")}
                                      >
                                        <Settings className="h-3.5 w-3.5 mr-1" /> Review & Action
                                      </Button>
                                    </div>
                                  ) : (
                                    String(item[col.dataKey as keyof LabItem] ?? "-")
                                  )}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={visiblePendingColumnsMeta.length} className="h-48">
                              <div className="flex flex-col items-center justify-center text-center border-2 border-dashed border-olive-200/50 bg-olive-50/50 rounded-lg mx-4 my-4">
                                <CheckCircle2 className="h-12 w-12 text-olive-300 mb-3" />
                                <p className="font-medium text-foreground">No Pending Reviews</p>
                                <p className="text-sm text-muted-foreground">All PI approved items have been finalized.</p>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── HISTORY TAB ──────────────────────────────── */}
            <TabsContent value="history">
              <Card className="shadow-sm border border-border">
                <CardHeader className="py-3 px-4 bg-olive-50/70 rounded-t-lg">
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-md font-semibold flex items-center gap-2">
                      <History className="h-5 w-5 text-olive-600" />
                      Decision History ({filteredHistory.length})
                    </CardTitle>
                    <ColumnToggler tab="history" columnsMeta={HISTORY_COLUMNS_META} />
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-muted/50">
                        <TableRow>
                          {visibleHistoryColumnsMeta.map((col) => (
                            <TableHead key={col.dataKey} className="whitespace-nowrap">{col.header}</TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredHistory.length > 0 ? (
                          filteredHistory.map((item) => (
                            <TableRow key={item.id} className="hover:bg-slate-50/50">
                              {visibleHistoryColumnsMeta.map((col) => (
                                <TableCell key={col.dataKey} className="whitespace-nowrap text-sm py-2 px-3">
                                  {col.dataKey === "actionColumn" ? (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-8 border-slate-300 text-slate-700 hover:bg-slate-50"
                                      onClick={() => openAction(item, "view")}
                                    >
                                      <Eye className="h-3.5 w-3.5 mr-1" /> View
                                    </Button>
                                  ) : col.dataKey === "managementApprovalStatus" ? (
                                    <StatusBadge status={item.managementApprovalStatus} />
                                  ) : (
                                    String(item[col.dataKey as keyof LabItem] ?? "-")
                                  )}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={visibleHistoryColumnsMeta.length} className="h-48">
                              <div className="flex flex-col items-center justify-center text-center border-2 border-dashed border-slate-200/50 bg-slate-50/50 rounded-lg mx-4 my-4">
                                <History className="h-12 w-12 text-slate-300 mb-3" />
                                <p className="font-medium text-foreground">No Decision History Yet</p>
                                <p className="text-sm text-muted-foreground">Decisions made by Management will appear here.</p>
                              </div>
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

      {/* ── ACTION / VIEW DIALOG ─────────────────────── */}
      <Dialog open={!!actionMode} onOpenChange={() => { setActionMode(null); setSelectedItem(null); }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className={cn("flex items-center gap-2 text-xl", {
              "text-olive-700": actionMode === "review" || actionMode === "view",
            })}>
              {actionMode === "review" && <><Settings className="h-5 w-5" /> Review Entry</>}
              {actionMode === "view" && <><Eye className="h-5 w-5" /> Full Entry Details</>}
            </DialogTitle>
            <DialogDescription>
              {actionMode === "review" && "Management review and final decision process."}
              {actionMode === "view" && "Full visibility of all production and costing data."}
            </DialogDescription>
          </DialogHeader>

          {selectedItem && (
            <div className="space-y-6 pt-4">
              <Section title="Basic Information">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: "Composition No.", value: selectedItem.compositionNo },
                    { label: "Order No.", value: selectedItem.orderNo },
                    { label: "Party Name", value: selectedItem.partyName },
                    { label: "Product Name", value: selectedItem.productName },
                    { label: "Qty", value: selectedItem.orderQuantity ? selectedItem.orderQuantity.toLocaleString("en-IN") : "—" },
                    { label: "Planned Date", value: selectedItem.planned1 },
                  ].map(({ label, value }) => (
                    <InfoCard key={label} label={label} value={value} />
                  ))}
                </div>
              </Section>

              {/* ── Rate ── */}
              <Section title="Rate">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {[
                    { label: "Selling Price (Job Card)", value: selectedItem.productRate ? `₹${selectedItem.productRate.toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : "—" },
                    { label: "Selling Price (Costing Spec)", value: String(selectedItem.sellingPrice || "-") },
                    { label: "GP %AGE (Expected)", value: String(selectedItem.gpPercentage || "-") },
                    { label: "Alumina (Spec)", value: String(selectedItem.alumina || "-") },
                    { label: "Iron (Spec)", value: String(selectedItem.iron || "-") },
                    { label: "BD (Spec)", value: String(selectedItem.bd || "-") },
                    { label: "AP (Spec)", value: String(selectedItem.ap || "-") },
                  ].map(({ label, value }) => (
                    <InfoCard key={label} label={label} value={value} accent="amber" />
                  ))}
                </div>
              </Section>

              {/* ── Composition & Costing (Sketch Redesign) ── */}
              <Section title="Composition & Costing">
                <div className="space-y-4">
                  <div className="border rounded-lg overflow-hidden shadow-sm">
                    <Table>
                      <TableHeader className="bg-slate-50">
                        <TableRow>
                          <TableHead className="font-bold text-slate-700">Material</TableHead>
                          <TableHead className="font-bold text-slate-700 text-right">Qty (%)</TableHead>
                          <TableHead className="font-bold text-slate-700 text-right">AL (Calc)</TableHead>
                          <TableHead className="font-bold text-slate-700 text-right">FE (Calc)</TableHead>
                          <TableHead className="font-bold text-slate-700 text-right">BD (Calc)</TableHead>
                          <TableHead className="font-bold text-slate-700 text-right">AP (Calc)</TableHead>
                          <TableHead className="font-bold text-slate-700 text-right">Cost (₹)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedItem.rmValues.length > 0 ? (
                          selectedItem.rmValues.map((pair, idx) => (
                            <TableRow key={idx} className="hover:bg-slate-50/50 h-10">
                              <TableCell className="py-2 font-medium text-slate-600 text-xs">{pair.rm}</TableCell>
                              <TableCell className="py-2 text-right text-xs">{pair.qty}%</TableCell>
                              <TableCell className="py-2 text-right text-xs">{((pair.al * pair.qty) / 100).toFixed(2)}</TableCell>
                              <TableCell className="py-2 text-right text-xs">{((pair.fe * pair.qty) / 100).toFixed(2)}</TableCell>
                              <TableCell className="py-2 text-right text-xs">{((pair.bd * pair.qty) / 100).toFixed(2)}</TableCell>
                              <TableCell className="py-2 text-right text-xs">{((pair.ap * pair.qty) / 100).toFixed(2)}</TableCell>
                              <TableCell className="py-2 text-right font-semibold text-slate-900 text-xs">
                                {pair.cost.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                              </TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center text-slate-400 italic py-4 text-xs">No composition data</TableCell>
                          </TableRow>
                        )}
                        <TableRow className="bg-slate-50/50 font-bold border-t border-slate-200">
                          <TableCell colSpan={1} className="text-slate-700 text-xs py-1 px-3">Total Composition %</TableCell>
                          <TableCell className="text-right text-slate-700 text-xs py-1 px-3">
                            {selectedItem.rmValues.reduce((sum, rm) => sum + rm.qty, 0).toFixed(2)}%
                          </TableCell>
                          <TableCell colSpan={5} />
                        </TableRow>
                        <TableRow className="bg-indigo-50/50 font-bold border-t-2 border-indigo-100">
                          <TableCell colSpan={6} className="text-indigo-800 text-xs py-2 px-3">Total RM Cost</TableCell>
                          <TableCell className="text-right text-indigo-800 text-xs py-2 px-3">
                            ₹{selectedItem.rmValues.reduce((sum, rm) => sum + rm.cost, 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 bg-slate-50 p-6 rounded-xl border border-slate-200 shadow-inner">
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Selling Price</p>
                      <p className="text-lg font-bold text-slate-900">
                        ₹{(selectedItem.productRate || selectedItem.sellingPrice).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </p>
                      <p className="text-[9px] text-slate-400 italic">From Job Card</p>
                    </div>

                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total RM Cost</p>
                      <p className="text-lg font-bold text-slate-700">
                        ₹{selectedItem.rmValues.reduce((sum, rm) => sum + rm.cost, 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </p>
                      <p className="text-[9px] text-slate-400 italic">Sum of ingredients</p>
                    </div>

                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Manufacturing Cost</p>
                      <div className="flex items-baseline gap-1">
                        <span className="text-sm font-semibold text-emerald-600">₹</span>
                        <p className="text-xl font-black text-emerald-700">
                          {selectedItem.manufacturingCost.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                      <p className="text-[9px] text-emerald-500/70 font-medium">Finalized by PI</p>
                    </div>

                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">Total Cost</p>
                      <div className="flex items-baseline gap-1">
                        <span className="text-sm font-semibold text-indigo-600">₹</span>
                        <p className="text-xl font-black text-indigo-700">
                          {manualMaterialCost.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                      <p className="text-[9px] text-indigo-500/70 font-medium">RM + Mfg Cost</p>
                    </div>

                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">Total Profit</p>
                      <div className="flex items-baseline gap-1">
                        <span className="text-sm font-semibold text-amber-600">₹</span>
                        <p className={cn("text-xl font-black", totalProfit >= 0 ? "text-emerald-700" : "text-red-600")}>
                          {totalProfit.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                      <p className="text-[9px] text-amber-500/70 font-medium">Price − (RM + Mfg)</p>
                    </div>
                  </div>
                </div>
              </Section>


              {/* ── Expected Values Table (Synced) ── */}
              {EXPECTED_LABELS.some(({ key }) => selectedItem.expectedValues[key]) && (
                <Section title="Expected Values Table">
                  <div className="border rounded-lg overflow-hidden shadow-sm bg-white">
                    <Table>
                      <TableHeader className="bg-slate-50">
                        <TableRow>
                          <TableHead className="font-bold text-slate-700">Parameter</TableHead>
                          <TableHead className="font-bold text-slate-700">Expected Value</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {EXPECTED_LABELS.map(({ key, label }) => (
                          <TableRow key={key} className="hover:bg-slate-50/30 h-10">
                            <TableCell className="text-sm font-medium text-slate-600 py-2">{label}</TableCell>
                            <TableCell className="text-sm text-slate-900 py-2 font-semibold">
                              {selectedItem.expectedValues[key] || <span className="text-slate-400 font-normal italic">—</span>}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </Section>
              )}

              {/* ── Feedback & History (Management Specific) ── */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Section title="PI Feedback">
                  <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 space-y-3">
                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div>
                        <p className="text-[10px] font-bold text-indigo-400 uppercase">PI Decision</p>
                        <Badge className="bg-indigo-100 text-indigo-700 border-indigo-200 mt-0.5">Approved</Badge>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-indigo-400 uppercase">Decision At</p>
                        <p className="font-semibold text-indigo-900 mt-0.5">{selectedItem.piApprovedAt}</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-indigo-400 uppercase">PI Remarks</p>
                      <p className="text-sm text-indigo-900 font-medium italic mt-1">"{selectedItem.piRemarks || "No remarks"}"</p>
                    </div>
                  </div>
                </Section>

                {selectedItem.managementApprovalStatus && (
                  <Section title="Previous Decision">
                    <div className="bg-white border rounded-xl p-4 shadow-sm space-y-3">
                      <div className="grid grid-cols-2 gap-4 text-xs">
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase">Decision</p>
                          <StatusBadge status={selectedItem.managementApprovalStatus} />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase">Decision At</p>
                          <p className="font-semibold text-slate-900 mt-0.5">{selectedItem.managementApprovedAt}</p>
                        </div>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Remarks</p>
                        <p className="text-sm text-slate-800 font-medium mt-1">{selectedItem.managementRemarks || "No remarks"}</p>
                      </div>
                    </div>
                  </Section>
                )}
              </div>

              {/* ── Workflow Choice (Management Specific) ── */}
              {actionMode === "review" && (
                <div className="rounded-xl p-4 border bg-amber-50 border-amber-200 shadow-sm">
                  <Label className="font-bold text-sm mb-3 block text-amber-800">Approval Workflow Choice</Label>
                  <RadioGroup 
                    value={approvalType} 
                    onValueChange={(v: any) => setApprovalType(v)}
                    className="flex flex-col sm:flex-row gap-4"
                  >
                    <div className="flex items-center space-x-2 bg-white px-3 py-2 rounded-lg border border-amber-100 flex-1">
                      <RadioGroupItem value="OK" id="ok" />
                      <Label htmlFor="ok" className="font-semibold cursor-pointer flex-1 py-1 text-sm text-emerald-800">✅ Approve & Finalize</Label>
                    </div>
                    <div className="flex items-center space-x-2 bg-white px-3 py-2 rounded-lg border border-amber-100 flex-1">
                      <RadioGroupItem value="Make a sample Test" id="sample" />
                      <Label htmlFor="sample" className="font-semibold cursor-pointer flex-1 py-1 text-sm text-amber-800">🧪 Move to Sample Test</Label>
                    </div>
                  </RadioGroup>
                </div>
              )}

              {/* ── Remarks field for Review (Synced) ── */}
              {actionMode === "review" && (
                <div className="rounded-xl p-4 border bg-emerald-50/30 border-emerald-100">
                  <Label htmlFor="management-remarks" className="font-bold text-sm mb-2 block text-slate-700">
                    Management Remarks <span className="text-red-500">*</span>
                  </Label>
                  <Textarea
                    id="management-remarks"
                    value={remarks}
                    onChange={(e) => { setRemarks(e.target.value); if (e.target.value.trim()) setRemarksError(""); }}
                    placeholder="Enter final decision remarks here…"
                    rows={3}
                    className={cn("bg-white text-base", { "border-red-400 focus-visible:ring-red-400": !!remarksError })}
                  />
                  {remarksError && <p className="text-sm text-red-600 mt-1.5 flex items-center gap-1.5 font-medium"><AlertTriangle className="h-3.5 w-3.5" />{remarksError}</p>}
                </div>
              )}
            </div>
          )}

          <DialogFooter className="pt-6 border-t gap-3">
            <Button variant="outline" onClick={() => { setActionMode(null); setSelectedItem(null); }} disabled={isSubmitting} className="px-6 h-11">
              Close
            </Button>
            {actionMode === "review" && (
              <>
                <Button
                  variant="destructive"
                  className="h-11 px-8 shadow-lg shadow-red-100"
                  onClick={() => handleSubmitDecision("Rejected")}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <XCircle className="h-5 w-5 mr-2" />}
                  Reject Entry
                </Button>
                <Button
                  className="bg-emerald-600 hover:bg-emerald-700 text-white h-11 px-8 shadow-lg shadow-emerald-100"
                  onClick={() => handleSubmitDecision("Approved")}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <ShieldCheck className="h-5 w-5 mr-2" />}
                  Final Approval
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ──────────────── Helper Components ────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 border-b border-slate-100 pb-1">{title}</h3>
      {children}
    </div>
  );
}

function InfoCard({ label, value, accent }: { label: string; value?: string | null; accent?: "blue" | "amber" }) {
  const bg = accent === "blue" ? "bg-blue-50 border-blue-100" : accent === "amber" ? "bg-amber-50 border-amber-100" : "bg-slate-50 border-slate-100";
  return (
    <div className={cn("rounded-lg p-3 border", bg)}>
      <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-0.5">{label}</p>
      <p className="text-sm font-semibold text-gray-800">{value || "—"}</p>
    </div>
  );
}
