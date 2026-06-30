"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Calendar as CalendarIcon,
  Loader2,
  FileText,
  Plus,
  Settings,
  Eye,
  XCircle,
  Clock,
  CheckCircle,
  Package,
  TrendingUp,
  Filter,
  Building,
  User,
  Hash,
  DollarSign,
  AlertCircle,
  Search,
} from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { supabase, dispatchSupabase } from "@/lib/supabase";
import { useAuth, FIRM_MAP } from "@/lib/auth";

// Type for Production items
interface ProductionItem {
  id: number;
  productionId?: number | string;
  timestamp: string;
  deliveryOrderNo: string;
  firmName: string;
  partyName: string;
  productName: string;
  orderQuantity: string;
  expectedDeliveryDate: string;
  priority: string;
  note: string;
  crmName: string;
  orderCancel: boolean;
  actualProductionPlanned: string;
  actualProductionDone: string;
  stockTransferred: string;
  quantityDelivered: string;
  quantityInStock: string;
  planningPending: string;
  productionPending: string;
  status: string;
  dateOfCompletePlanning: string;
  cancelReason: string;
  product_rate: string;
}

// Column Definitions for Job Cards Table
const JOBCARD_COLUMNS_META = [
  { header: "Timestamp", dataKey: "timestamp", toggleable: true },
  { header: "ID", dataKey: "productionId", toggleable: true },
  { header: "DO No.", dataKey: "deliveryOrderNo", toggleable: true },
  { header: "Firm Name", dataKey: "firmName", toggleable: true },
  { header: "Party Name", dataKey: "partyName", toggleable: true },
  { header: "Product", dataKey: "productName", toggleable: true },
  { header: "Qty", dataKey: "orderQuantity", toggleable: true },
  {
    header: "Exp. Delivery",
    dataKey: "expectedDeliveryDate",
    toggleable: true,
  },
  { header: "Priority", dataKey: "priority", toggleable: true },
  { header: "Status", dataKey: "status", toggleable: true },
  { header: "CRM Name", dataKey: "crmName", toggleable: true },
  { header: "Cancel Qty", dataKey: "orderCancel", toggleable: true },
  { header: "Qty Del.", dataKey: "quantityDelivered", toggleable: true },
  { header: "Prod Pend.", dataKey: "productionPending", toggleable: true },
  {
    header: "Complete Plan",
    dataKey: "dateOfCompletePlanning",
    toggleable: true,
  },
  { header: "Notes", dataKey: "note", toggleable: true },
  { header: "Selling Price", dataKey: "product_rate", toggleable: true },
];

export default function OrdersPage() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [date, setDate] = useState<Date | undefined>();
  const [priority, setPriority] = useState("");
  const [priorityOptions] = useState(["Normal", "Urgent"]);
  const [loading, setLoading] = useState(false);
  const [fetchingData, setFetchingData] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ProductionItem | null>(null);
  const [cancelQuantity, setCancelQuantity] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [firmFilter, setFirmFilter] = useState("all");
  const [isSubmittingCancel, setIsSubmittingCancel] = useState(false);

  // Column visibility state
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(
    {},
  );

  // Central state to hold all production data
  const [productionData, setProductionData] = useState<ProductionItem[]>([]);

  // State for dropdown options
  const [firmOptions, setFirmOptions] = useState<string[]>([]);
  const [orderNoOptions, setOrderNoOptions] = useState<{ orderNo: string; partyName: string }[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<any[]>([]);
  const [gpOverrides, setGpOverrides] = useState<{ [key: number]: string }>({});
  const [gpOverrideRows, setGpOverrideRows] = useState<Set<number>>(new Set());

  // State for order details from Orders sheet
  const [allOrdersData, setAllOrdersData] = useState<any[]>([]);

  const formatDateTime = (value: any) => {
    if (!value) return "-";
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      const pad = (n: number) => n.toString().padStart(2, "0");
      return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date
        .getFullYear()
        .toString()
        .slice(-2)} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
    }
    return value;
  };

  // State for form data
  const [formData, setFormData] = useState({
    firmName: "",
    deliveryOrderNo: "",
    partyName: "",
    productName: "",
    orderQuantity: "",
    product_rate: "",
    note: "",
    gpPercentage: "",
  });

  const [fetchingOptions, setFetchingOptions] = useState(true);

  const PRODUCTION_TABLE = "production";
  const ORDERS_TABLE = "orders";
  const MASTER_TABLE = "master";

  // Initialize column visibility
  useEffect(() => {
    const visibility: Record<string, boolean> = {
      timestamp: true,
      productionId: true,
      deliveryOrderNo: true,
      firmName: true,
      partyName: true,
      productName: true,
      orderQuantity: true,
      expectedDeliveryDate: true,
      status: true,
      quantityDelivered: true,
      productionPending: true,
      product_rate: true,
      orderCancel: true,
      priority: false,
      crmName: false,
      dateOfCompletePlanning: false,
      note: false,
    };
    setVisibleColumns(visibility);
  }, []);

  // Unified Fetch Data
  const fetchProductionData = async () => {
    setFetchingData(true);
    try {
      // 1. Fetch from ORDER RECEIPT
      const { data: allOrders, error: ordersError } = await dispatchSupabase
        .from("ORDER RECEIPT")
        .select("*")
        .eq("check_delivery_in_stock_or_not", "For Production Planning");

      if (ordersError) throw ordersError;

      // 2. Fetch from production
      const { data: allProduction, error: prodError } = await supabase
        .from(PRODUCTION_TABLE)
        .select("*");

      if (prodError) throw prodError;

      if (allOrders) {
        const userFirms = user?.firm ? user.firm.split(',').map(f => f.trim().toLowerCase()).filter(Boolean) : [];
        const isAdmin = user?.role?.toLowerCase() === 'admin';
        
        // 3. Process firm options and order dropdown data
        const uniqueFirms = [
          ...new Set(
            allOrders
              .map((m: any) => String(m["Firm Name"] || "").trim())
              .filter(f => !f || isAdmin || userFirms.length === 0 || userFirms.some(uf => f.toLowerCase().includes(uf))),
          ),
        ] as string[];
        setFirmOptions(uniqueFirms);

        const orderRows = allOrders
          .filter((m: any) => !String(m["Firm Name"]) || isAdmin || userFirms.length === 0 || userFirms.some(uf => String(m["Firm Name"]).toLowerCase().includes(uf)))
          .map((row: any) => ({
            firmName: row["Firm Name"],
            partyName: row["Party Names"],
            orderNo: row["DO-Delivery Order No."],
            productName: row["Product Name"],
            quantity: row["Quantity"],
            rate: row["Rate Of Material"],
            expectedDeliveryDate: row["Expected Delivery Date"],
            gpPercentage: row["GP%"],
          }));
        setAllOrdersData(orderRows);

        // 4. Map ORDER RECEIPT rows using production status
        const productionRows: ProductionItem[] = allOrders
          .filter((m: any) => isAdmin || userFirms.length === 0 || userFirms.some(uf => String(m["Firm Name"] || "").toLowerCase().includes(uf)))
          .map((row: any) => {
            // Find match in production table
            const matchingProd = allProduction?.find((p: any) => {
              const pDO = String(p["Delivery Order No."] || "").trim().toLowerCase();
              const oDO = String(row["DO-Delivery Order No."] || "").trim().toLowerCase();
              const pProduct = String(p["Product Name"] || "").trim().toLowerCase();
              const oProduct = String(row["Product Name"] || "").trim().toLowerCase();
              const pFirm = String(p["Firm Name"] || "").trim().toLowerCase();
              const oFirm = String(row["Firm Name"] || "").trim().toLowerCase();
              return pDO === oDO && pProduct === oProduct && (!oFirm || pFirm === oFirm);
            });

            const isCancel = matchingProd ? !!matchingProd["Order Cancel"] : false;
            const isComplete = matchingProd 
              ? ["completed", "complete", "done"].includes(String(matchingProd["Status"] || "").toLowerCase())
              : false;

            return {
              id: matchingProd ? matchingProd.id : row.id,
              productionId: matchingProd?.id ?? "",
              timestamp: row["Timestamp"] || "",
              deliveryOrderNo: row["DO-Delivery Order No."] || "",
              firmName: row["Firm Name"] || "",
              partyName: row["Party Names"] || "",
              productName: row["Product Name"] || "",
              orderQuantity: String(row["Quantity"] ?? ""),
              expectedDeliveryDate: row["Expected Delivery Date"] || "",
              priority: matchingProd ? (matchingProd["Priority"] || "") : "",
              note: row["Specific Concern"] || "",
              crmName: row["Crm For The Customer"] || "",
              orderCancel: isCancel,
              actualProductionPlanned: matchingProd ? String(matchingProd["Actual Production Planned"] ?? "") : "",
              actualProductionDone: matchingProd ? String(matchingProd["Actual Production Done"] ?? "") : "",
              stockTransferred: String(row["Qty Transferred"] ?? ""),
              quantityDelivered: String(row["Delivered"] ?? ""),
              quantityInStock: row["In Stock Or Not"] || "",
              planningPending: matchingProd ? String(matchingProd["Planning Pending"] ?? "") : "",
              productionPending: String(row["Pending Qty"] ?? ""),
              status: isCancel ? "Cancelled" : (isComplete ? "Completed" : "Pending"),
              dateOfCompletePlanning: row["Complete Date"] || "",
              cancelReason: matchingProd ? (matchingProd["Reason"] || "") : "",
              product_rate: String(row["Rate Of Material"] ?? ""),
            };
          });

        setProductionData(productionRows);
      }
    } catch (error: any) {
      console.error("Failed to fetch data:", error.message || error);
    } finally {
      setFetchingData(false);
      setFetchingOptions(false);
    }
  };

  useEffect(() => {
    fetchProductionData();
  }, [user]);

  const handleFirmChange = (selectedFirm: string) => {
    const unprocessedOrders = allOrdersData.filter((order) => {
      if (order.firmName !== selectedFirm) return false;

      // Check if this specific product/order combo is already in productionData
      const isAlreadyInitiated = productionData.some(
        (p) =>
          p.firmName === order.firmName &&
          p.deliveryOrderNo === order.orderNo &&
          p.partyName === order.partyName &&
          p.productName === order.productName,
      );

      return !isAlreadyInitiated;
    });

    const uniqueOrderOptions: { orderNo: string; partyName: string }[] = Array.from(
      unprocessedOrders.reduce((map: Map<string, { orderNo: string; partyName: string }>, order: any) => {
        if (order.orderNo && !map.has(order.orderNo)) {
          map.set(order.orderNo, { 
            orderNo: order.orderNo, 
            partyName: order.partyName || "" 
          });
        }
        return map;
      }, new Map<string, { orderNo: string; partyName: string }>()).values()
    ).sort((a, b) =>
      a.orderNo.localeCompare(b.orderNo, undefined, { numeric: true, sensitivity: "base" }),
    );

    setOrderNoOptions(uniqueOrderOptions);

    setFormData({
      ...formData,
      firmName: selectedFirm,
      deliveryOrderNo: "",
      partyName: "",
      productName: "",
      gpPercentage: "",
    });
    setFilteredProducts([]);
  };

  const handleOrderNoChange = (selectedOrderNo: string) => {
    const matches = allOrdersData.filter((order) => {
      const isMatch =
        order.firmName === formData.firmName &&
        order.orderNo === selectedOrderNo;

      if (!isMatch) return false;

      // Check if already initiated in productionData
      const isAlreadyInitiated = productionData.some(
        (p) =>
          p.firmName === order.firmName &&
          p.deliveryOrderNo === order.orderNo &&
          p.partyName === order.partyName &&
          p.productName === order.productName,
      );

      return !isAlreadyInitiated;
    });

    setFilteredProducts(matches);

    if (matches.length > 0) {
      const first = matches[0];
      setFormData({
        ...formData,
        deliveryOrderNo: selectedOrderNo,
        partyName: first.partyName || "",
        productName: first.productName || "",
        orderQuantity: first.quantity || "",
        product_rate: first.rate || "",
        gpPercentage: first.gpPercentage || "",
      });
      if (first.expectedDeliveryDate) {
        setDate(new Date(first.expectedDeliveryDate));
      } else {
        setDate(undefined);
      }
    } else {
      setFormData({
        ...formData,
        deliveryOrderNo: selectedOrderNo,
        partyName: "",
        productName: "",
      });
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { id, value } = e.target;
    let finalValue = value;
    if (id === "orderQuantity" || id === "product_rate") {
      if (value !== "" && Number(value) < 0) finalValue = "0";
    }
    setFormData((prev) => ({ ...prev, [id]: finalValue }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!formData.firmName.trim() || !formData.deliveryOrderNo.trim()) {
      alert("Please select a Firm Name and a Delivery Order No.");
      return;
    }
    setLoading(true);
    try {
      const insertData = filteredProducts.map((product, idx) => {
        return {
          "Delivery Order No.": formData.deliveryOrderNo.trim(),
          "Firm Name": formData.firmName.trim(),
          "Party Name": (product.partyName || "").trim(),
          "Product Name": (product.productName || "").trim(),
          "Order Quantity": Number(product.quantity) || 0,
          "Expected Delivery Date": product.expectedDeliveryDate
            ? format(new Date(product.expectedDeliveryDate), "yyyy-MM-dd")
            : null,
          Priority: priority,
          Note: formData.note.trim(),
          Status: "pending",
          product_rate: product.rate ? Number(product.rate) : null,
        };
      });

      if (insertData.length === 0) {
        alert("No products to initiate.");
        setLoading(false);
        return;
      }

      const { error: insertError } = await supabase
        .from(PRODUCTION_TABLE)
        .insert(insertData);

      if (insertError) throw insertError;
      alert(`${insertData.length} Job Card(s) created successfully!`);
      setFormData({
        firmName: "",
        deliveryOrderNo: "",
        partyName: "",
        productName: "",
        orderQuantity: "",
        product_rate: "",
        note: "",
        gpPercentage: "",
      });
      setDate(undefined);
      setPriority("");
      setFilteredProducts([]);
      setGpOverrides({});
      setGpOverrideRows(new Set());
      await fetchProductionData();
      setIsFormOpen(false);
    } catch (error: any) {
      console.error("Submission failed:", error.message || error);
      alert("Failed to create job cards. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleCancelOrder = (item: ProductionItem) => {
    setSelectedItem(item);
    setCancelQuantity("");
    setCancelReason("");
    setIsCancelDialogOpen(true);
  };

  const submitCancelOrder = async () => {
    if (!selectedItem) return;
    if (!cancelQuantity || Number(cancelQuantity) <= 0) {
      alert("Please enter a valid cancel quantity");
      return;
    }
    if (!cancelReason.trim()) {
      alert("Please enter a reason for cancellation");
      return;
    }
    setIsSubmittingCancel(true);
    try {
      const { error: updateError } = await supabase
        .from(PRODUCTION_TABLE)
        .update({
          "Order Cancel": true,
          Reason: `Qty: ${cancelQuantity} - ${cancelReason}`,
        })
        .eq("id", selectedItem.id);

      if (updateError) throw updateError;
      alert("Order cancelled successfully!");
      setIsCancelDialogOpen(false);
      setCancelQuantity("");
      setCancelReason("");
      await fetchProductionData();
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : "Cancel failed");
    } finally {
      setIsSubmittingCancel(false);
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case "urgent":
        return (
          <Badge className="bg-red-100 text-red-800 border-red-200">
            Urgent
          </Badge>
        );
      case "high":
        return (
          <Badge className="bg-orange-100 text-orange-800 border-orange-200">
            High
          </Badge>
        );
      case "normal":
        return (
          <Badge className="bg-green-100 text-green-800 border-green-200">
            Normal
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-gray-500">
            {priority || "-"}
          </Badge>
        );
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case "pending":
        return (
          <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">
            Pending
          </Badge>
        );
      case "completed":
        return (
          <Badge className="bg-green-100 text-green-800 border-green-200">
            Completed
          </Badge>
        );
      case "cancelled":
        return (
          <Badge className="bg-gray-100 text-gray-800 border-gray-200">
            Cancelled
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-gray-500">
            {status || "-"}
          </Badge>
        );
    }
  };

  const uniqueFirmsForFilter = useMemo(() => {
    const firms = productionData
      .map((item) => item.firmName)
      .filter((name): name is string => typeof name === "string" && name.trim() !== "");
    return Array.from(new Set(firms)).sort();
  }, [productionData]);

  const filteredData = useMemo(() => {
    // 1. Filter by Firm first
    let baseData = productionData;
    if (user?.firm && user?.role?.toLowerCase() !== 'admin') {
      const userFirms = user.firm.split(',').map(f => f.trim()).filter(Boolean);
      baseData = productionData.filter(item => {
        const fName = String(item.firmName || "").toLowerCase();
        return !fName || userFirms.some(uf => {
          const firmSearch = uf.toLowerCase();
          const mappedFirmLower = (FIRM_MAP[uf] || uf).toLowerCase();
          return fName.includes(firmSearch) || fName.includes(mappedFirmLower);
        });
      });
    }

    // Filter by selected firm filter
    if (firmFilter !== "all") {
      baseData = baseData.filter(
        (item) => String(item.firmName || "").toLowerCase() === firmFilter.toLowerCase()
      );
    }

    // 2. Filter by search query
    if (searchQuery.trim() !== "") {
      const q = searchQuery.toLowerCase().trim();
      baseData = baseData.filter((item) => {
        return [
          item.deliveryOrderNo,
          item.firmName,
          item.partyName,
          item.productName,
          item.crmName,
          item.note,
          item.status
        ].some(val => String(val || "").toLowerCase().includes(q));
      });
    }

    // 3. Then filter by Tab
    if (activeTab === "all") return baseData;
    if (activeTab === "pending")
      return baseData.filter(
        (item) => item.status?.toLowerCase() === "pending" && !item.orderCancel,
      );
    if (activeTab === "completed")
      return baseData.filter((item) =>
        ["completed", "complete", "done"].includes(item.status?.toLowerCase()),
      );
    if (activeTab === "cancelled")
      return baseData.filter((item) => item.orderCancel);
    return baseData;
  }, [productionData, activeTab, user, searchQuery, firmFilter]);

  const visibleColumnsMeta = useMemo(
    () => JOBCARD_COLUMNS_META.filter((col) => visibleColumns[col.dataKey]),
    [visibleColumns],
  );

  const handleToggleColumn = (dataKey: string, checked: boolean) => {
    setVisibleColumns((prev) => ({ ...prev, [dataKey]: checked }));
  };

  const handleSelectAllColumns = (checked: boolean) => {
    const newVisibility: Record<string, boolean> = {};
    JOBCARD_COLUMNS_META.forEach((col) => {
      if (col.toggleable !== false) newVisibility[col.dataKey] = checked;
    });
    setVisibleColumns(newVisibility);
  };

  const ColumnToggler = () => (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-9 px-3 text-xs border-olive-200 hover:bg-olive-50 hover:text-olive-700 transition-colors"
        >
          <Settings className="mr-2 h-4 w-4" />
          Columns
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[240px] p-4 shadow-xl border-olive-100"
        align="end"
      >
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-sm text-olive-900 uppercase tracking-wider">
              Display Columns
            </h4>
          </div>
          <div className="flex gap-2 pb-2 border-b border-olive-50">
            <Button
              variant="link"
              size="sm"
              className="p-0 h-auto text-xs text-olive-600"
              onClick={() => handleSelectAllColumns(true)}
            >
              All
            </Button>
            <span className="text-gray-300">|</span>
            <Button
              variant="link"
              size="sm"
              className="p-0 h-auto text-xs text-olive-600"
              onClick={() => handleSelectAllColumns(false)}
            >
              None
            </Button>
          </div>
          <div className="grid grid-cols-1 gap-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
            {JOBCARD_COLUMNS_META.filter((col) => col.toggleable !== false).map(
              (col) => (
                <div
                  key={`toggle-${col.dataKey}`}
                  className="flex items-center space-x-2 p-1 hover:bg-olive-50 rounded transition-colors group"
                >
                  <Checkbox
                    id={`toggle-${col.dataKey}`}
                    checked={!!visibleColumns[col.dataKey]}
                    onCheckedChange={(checked) =>
                      handleToggleColumn(col.dataKey, Boolean(checked))
                    }
                    className="data-[state=checked]:bg-olive-600 data-[state=checked]:border-olive-600"
                  />
                  <Label
                    htmlFor={`toggle-${col.dataKey}`}
                    className="text-xs font-medium cursor-pointer flex-1 group-hover:text-olive-700"
                  >
                    {col.header}
                  </Label>
                </div>
              ),
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );

  const StatCard = ({
    title,
    value,
    icon: Icon,
    colorClass,
    borderClass,
  }: any) => (
    <Card
      className={cn(
        "overflow-hidden transition-all hover:shadow-md border",
        borderClass,
      )}
    >
      <CardContent className="p-5 flex items-center justify-between">
        <div>
          <p
            className={cn(
              "text-xs font-bold uppercase tracking-widest mb-1",
              colorClass,
            )}
          >
            {title}
          </p>
          <p className="text-2xl font-black text-gray-900">{value}</p>
        </div>
        <div
          className={cn(
            "p-3 rounded-2xl bg-opacity-10",
            colorClass.replace("text-", "bg-"),
          )}
        >
          <Icon className={cn("h-6 w-6", colorClass)} />
        </div>
      </CardContent>
    </Card>
  );

  if (fetchingData && productionData.length === 0) {
    return (
      <div className="flex flex-col justify-center items-center h-screen bg-white">
        <Loader2 className="h-12 w-12 animate-spin text-olive-600 mb-4" />
        <p className="text-olive-800 font-medium animate-pulse tracking-widest uppercase text-xs">
          Initializing Management System...
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-screen max-w-full overflow-x-hidden">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Package className="h-6 w-6 text-olive-600" />
            Order Management
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage and track production orders across different firms.</p>
        </div>


      </div>

      {/* Analytics Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Orders"
          value={productionData.length}
          icon={Package}
          colorClass="text-olive-600"
          borderClass="border-olive-100"
        />
        <StatCard
          title="Pending"
          value={
            productionData.filter(
              (item) =>
                item.status?.toLowerCase() === "pending" && !item.orderCancel,
            ).length
          }
          icon={Clock}
          colorClass="text-yellow-600"
          borderClass="border-yellow-100"
        />
        <StatCard
          title="Completed"
          value={
            productionData.filter((item) =>
              ["completed", "complete", "done"].includes(
                item.status?.toLowerCase(),
              ),
            ).length
          }
          icon={CheckCircle}
          colorClass="text-green-600"
          borderClass="border-green-100"
        />
        <StatCard
          title="Cancelled"
          value={productionData.filter((item) => item.orderCancel).length}
          icon={XCircle}
          colorClass="text-red-600"
          borderClass="border-red-100"
        />
      </div>

      {/* Data Table Section */}
      <Card className="border-none shadow-2xl shadow-gray-200/50 rounded-3xl overflow-hidden bg-white">
        <CardHeader className="border-b border-gray-100 bg-white/50 backdrop-blur-sm sticky top-0 z-10 px-6 py-5">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              className="w-full lg:w-auto"
            >
              <TabsList className="bg-slate-100 p-1 rounded-xl h-12 w-full lg:w-[480px] grid grid-cols-4">
                <TabsTrigger
                  value="all"
                  className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-olive-700 data-[state=active]:shadow-sm transition-all font-semibold text-xs"
                >
                  All
                </TabsTrigger>
                <TabsTrigger
                  value="pending"
                  className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-olive-700 data-[state=active]:shadow-sm transition-all font-semibold text-xs"
                >
                  Pending
                </TabsTrigger>
                <TabsTrigger
                  value="completed"
                  className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-olive-700 data-[state=active]:shadow-sm transition-all font-semibold text-xs"
                >
                  Done
                </TabsTrigger>
                <TabsTrigger
                  value="cancelled"
                  className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-olive-700 data-[state=active]:shadow-sm transition-all font-semibold text-xs"
                >
                  Canceled
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="flex items-center gap-3 w-full lg:w-auto">
              <div className="w-48">
                <Select
                  value={firmFilter}
                  onValueChange={setFirmFilter}
                >
                  <SelectTrigger className="h-10 rounded-xl border-gray-200 focus:ring-olive-500/20 focus:border-olive-500">
                    <SelectValue placeholder="All Firms" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="all">All Firms</SelectItem>
                    {uniqueFirmsForFilter.map((firm) => (
                      <SelectItem key={firm} value={firm}>
                        {firm}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="relative flex-1 lg:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search orders..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 h-10 rounded-xl border-gray-200 focus:ring-olive-500/20 focus:border-olive-500"
                />
              </div>
              <ColumnToggler />
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto overflow-y-auto max-h-[650px] custom-scrollbar">
            <Table>
              <TableHeader className="bg-gray-50/50">
                <TableRow className="border-b border-gray-100">
                  {visibleColumnsMeta.map((col) => (
                    <TableHead
                      key={col.dataKey}
                      className="sticky top-0 z-20 bg-gray-50 h-14 px-6 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 whitespace-nowrap align-middle"
                    >
                      {col.header}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.length > 0 ? (
                  filteredData.map((item, index) => (
                    <TableRow
                      key={index}
                      className="group hover:bg-olive-50/30 transition-colors border-b border-gray-50 last:border-0"
                    >
                      {visibleColumnsMeta.map((col) => (
                        <TableCell
                          key={col.dataKey}
                          className="px-6 py-4 text-xs font-semibold text-gray-700 whitespace-nowrap"
                        >
                          {col.dataKey === "action" ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleCancelOrder(item)}
                              disabled={item.orderCancel}
                              className={cn(
                                "h-8 w-8 p-0 rounded-lg transition-all",
                                item.orderCancel
                                  ? "text-gray-300"
                                  : "text-red-400 hover:text-red-600 hover:bg-red-50",
                              )}
                              title={
                                item.orderCancel
                                  ? "Already Cancelled"
                                  : "Cancel Order"
                              }
                            >
                              <XCircle className="h-5 w-5" />
                            </Button>
                          ) : col.dataKey === "priority" ? (
                            getPriorityBadge(item.priority)
                          ) : col.dataKey === "status" ? (
                            getStatusBadge(
                              item.orderCancel ? "Cancelled" : item.status,
                            )
                          ) : col.dataKey === "product_rate" ? (
                            item.product_rate ? (
                              <div className="flex items-center gap-1 text-olive-700 font-bold">
                                <span>₹</span>
                                {Number(item.product_rate).toLocaleString(
                                  "en-IN",
                                  { minimumFractionDigits: 2 },
                                )}
                              </div>
                            ) : (
                              "-"
                            )
                          ) : col.dataKey === "timestamp" ||
                            col.dataKey === "expectedDeliveryDate" ? (
                            <div className="flex items-center gap-2">
                              <CalendarIcon className="h-3 w-3 text-gray-400" />
                              {formatDateTime(
                                item[col.dataKey as keyof ProductionItem],
                              )}
                            </div>
                          ) : (
                            <span
                              className={cn(
                                "block",
                                col.dataKey === "deliveryOrderNo" &&
                                  "text-olive-700 font-bold",
                                col.dataKey === "note" &&
                                  "max-w-[150px] truncate italic text-gray-400",
                              )}
                            >
                              {String(
                                item[col.dataKey as keyof ProductionItem] ??
                                  "-",
                              )}
                            </span>
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={visibleColumnsMeta.length}
                      className="h-64"
                    >
                      <div className="flex flex-col items-center justify-center text-center p-12 space-y-4">
                        <div className="p-4 bg-gray-50 rounded-full">
                          <AlertCircle className="h-10 w-10 text-gray-300" />
                        </div>
                        <div className="space-y-1">
                          <p className="text-lg font-bold text-gray-900 uppercase tracking-widest">
                            No Matches Found
                          </p>
                          <p className="text-sm text-gray-500 max-w-xs">
                            Adjust your filters or create a new job card to get
                            started.
                          </p>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Modals Section */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-2xl rounded-3xl p-0 overflow-hidden border-none shadow-2xl">
          <div className="bg-olive-600 px-8 py-6 text-white">
            <DialogTitle className="text-2xl font-black tracking-tight uppercase">
              New Job Card
            </DialogTitle>
            <DialogDescription className="text-olive-100 text-sm font-medium mt-1">
              Initialize a production lifecycle by providing order details.
            </DialogDescription>
          </div>

          <form onSubmit={handleSubmit} className="p-8 space-y-8 bg-white">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-gray-400 flex items-center gap-1.5">
                  <Building className="h-3 w-3" /> Firm Name{" "}
                  <span className="text-red-400">*</span>
                </Label>
                <Select
                  value={formData.firmName}
                  onValueChange={handleFirmChange}
                  required
                  disabled={fetchingOptions}
                >
                  <SelectTrigger className="h-12 rounded-xl border-gray-200 focus:ring-olive-500/20">
                    <SelectValue
                      placeholder={
                        fetchingOptions ? "Loading..." : "Select Firm"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {firmOptions.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-gray-400 flex items-center gap-1.5">
                  <Hash className="h-3 w-3" /> DO Number{" "}
                  <span className="text-red-400">*</span>
                </Label>
                <Select
                  value={formData.deliveryOrderNo}
                  onValueChange={handleOrderNoChange}
                  required
                  disabled={!formData.firmName}
                >
                  <SelectTrigger className="h-12 rounded-xl border-gray-200 focus:ring-olive-500/20">
                    <SelectValue placeholder="Select Order No" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {orderNoOptions.map((option) => (
                      <SelectItem key={option.orderNo} value={option.orderNo}>
                        {option.orderNo} {option.partyName ? `(${option.partyName})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {filteredProducts.length > 0 && (
              <div className="border rounded-2xl bg-gray-50/50 shadow-inner overflow-x-auto custom-scrollbar">
                <Table className="min-w-[600px]">
                  <TableHeader className="bg-gray-100/80">
                    <TableRow>
                      <TableHead className="text-[10px] font-black uppercase tracking-widest text-gray-500 py-3">
                        Product Name
                      </TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-widest text-gray-500 py-3 text-right">
                        Quantity
                      </TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-widest text-gray-500 py-3 text-right">
                        Rate
                      </TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-widest text-gray-500 py-3 text-right">
                        Exp. Date
                      </TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-widest text-gray-500 py-3 text-right">
                        GP%
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProducts.map((product, idx) => (
                      <TableRow
                        key={idx}
                        className={cn(
                          "cursor-pointer transition-colors hover:bg-olive-50/50",
                          formData.productName === product.productName &&
                            "bg-olive-100/30 border-l-4 border-l-olive-600",
                        )}
                        onClick={() => {
                          const currentGp = gpOverrideRows.has(idx) 
                            ? (gpOverrides[idx] || product.gpPercentage) 
                            : product.gpPercentage;
                          
                          setFormData({
                            ...formData,
                            partyName: product.partyName || "",
                            productName: product.productName || "",
                            orderQuantity: product.quantity || "",
                            product_rate: product.rate || "",
                            gpPercentage: currentGp,
                          });
                          if (product.expectedDeliveryDate) {
                            setDate(new Date(product.expectedDeliveryDate));
                          } else {
                            setDate(undefined);
                          }
                        }}
                      >
                        <TableCell className="font-bold text-xs text-gray-700">
                          {product.productName}
                        </TableCell>
                        <TableCell className="text-right font-medium text-xs text-gray-600">
                          {product.quantity || "-"}
                        </TableCell>
                        <TableCell className="text-right font-medium text-xs text-gray-600">
                          {product.rate ? `₹${product.rate}` : "-"}
                        </TableCell>
                        <TableCell className="text-right font-medium text-xs text-gray-600">
                          {product.expectedDeliveryDate
                            ? format(
                                new Date(product.expectedDeliveryDate),
                                "dd/MM/yy",
                              )
                            : "-"}
                        </TableCell>
                        <TableCell className="text-right font-bold text-xs text-olive-700">
                          {gpOverrideRows.has(idx) ? (
                            <Input
                              value={gpOverrides[idx] !== undefined ? gpOverrides[idx] : (product.gpPercentage || "")}
                              onChange={(e) => {
                                setGpOverrides({
                                  ...gpOverrides,
                                  [idx]: e.target.value,
                                });
                                // Also update formData if this is the currently selected row
                                if (formData.productName === product.productName) {
                                  setFormData(prev => ({ ...prev, gpPercentage: e.target.value }));
                                }
                              }}
                              onClick={(e) => e.stopPropagation()}
                              className="h-8 w-20 text-right text-xs bg-white border-olive-200 focus:ring-olive-500/20"
                            />
                          ) : (
                            product.gpPercentage ? `${product.gpPercentage}%` : "-"
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}


            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                Production Notes
              </Label>
              <Textarea
                id="note"
                rows={3}
                value={formData.note}
                onChange={handleInputChange}
                placeholder="Enter any specific requirements or notes..."
                className="rounded-2xl border-gray-200 focus:ring-olive-500/20"
              />
            </div>

            <div className="flex gap-4 pt-4">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsFormOpen(false)}
                className="flex-1 h-14 rounded-2xl font-bold uppercase tracking-widest text-gray-400 hover:text-gray-600"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="flex-[2] h-14 rounded-2xl bg-olive-600 hover:bg-olive-700 text-white font-black uppercase tracking-widest shadow-xl shadow-olive-600/20 transition-all hover:scale-[1.01]"
              >
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  "Initiate Job Card"
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isCancelDialogOpen} onOpenChange={setIsCancelDialogOpen}>
        <DialogContent className="max-w-md rounded-3xl p-0 overflow-hidden border-none shadow-2xl">
          <div className="bg-red-600 px-8 py-6 text-white">
            <DialogTitle className="text-2xl font-black tracking-tight uppercase">
              Cancel Order
            </DialogTitle>
          </div>

          <div className="p-8 space-y-6">
            {selectedItem && (
              <div className="p-4 bg-red-50 rounded-2xl space-y-2 border border-red-100">
                <div className="flex justify-between text-xs font-bold uppercase tracking-widest text-red-400">
                  <span>DO: {selectedItem.deliveryOrderNo}</span>
                  <span>Qty: {selectedItem.orderQuantity}</span>
                </div>
                <p className="text-sm font-bold text-red-900">
                  {selectedItem.productName}
                </p>
              </div>
            )}

            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                  Qty to Cancel
                </Label>
                <Input
                  type="number"
                  min="1"
                  value={cancelQuantity}
                  onChange={(e) => setCancelQuantity(e.target.value)}
                  className="h-12 rounded-xl border-gray-200"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                  Reason
                </Label>
                <Textarea
                  rows={3}
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Why is this order being cancelled?"
                  className="rounded-2xl border-gray-200"
                />
              </div>
            </div>

            <div className="flex gap-4">
              <Button
                variant="ghost"
                onClick={() => setIsCancelDialogOpen(false)}
                className="flex-1 h-12 rounded-xl font-bold uppercase tracking-widest text-gray-400"
              >
                Back
              </Button>
              <Button
                onClick={submitCancelOrder}
                disabled={isSubmittingCancel}
                className="flex-[2] h-12 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold uppercase tracking-widest"
              >
                {isSubmittingCancel ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  "Confirm Cancel"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
