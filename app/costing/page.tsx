"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { Loader2, AlertTriangle, DollarSign, History, Settings, Package, Building, User, Calendar, Clock, Hash, FileText, CheckCircle, Search, Eye } from "lucide-react"
import { format } from "date-fns"
// Shadcn UI components
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Separator } from "@/components/ui/separator"
import { Toaster } from "@/components/ui/toaster"
import { supabase, dispatchSupabase, purchaseSupabase, inventorySupabase } from "@/lib/supabase"

// --- Configuration ---
const ACTUAL_PRODUCTION_TABLE = "actual_production"
const JOBCARDS_TABLE = "jobcards"
const COSTING_RESPONSE_TABLE = "costing_response"

// --- Type Definitions ---
interface RawMaterial {
  name: string
  quantity: string | number
}

interface CompleteProductionDetails {
  // Basic Info
  timestamp: string
  jobCardNo: string
  firmName: string
  dateOfProduction: string
  nameOfSupervisor: string
  productName: string
  quantityOfFG: number
  serialNumber: string
  
  // Raw Materials
  rawMaterials: RawMaterial[]
  
  // Additional Fields
  machineRunningHour: string
  remarks1: string
  ppBagUsed: string
  ppBagToBeUsed: string
  partyName: string
  ppBagSmall: string
  costingAmount: number
  colorCondition: string
  orderNo: string
  planned1: string
  actual1: string
  status: string
  actualQty1: string
  planned2: string
  actual2: string
  timeDelay2: string
  remarks: string
  planned3: string
  actual3: string
  costingAmount2: string
  planned4: string
  actual4: string
  remarks1_2: string
  planned5: string
  actual5: string
  remarks2: string
  planned6: string
  actual6: string
  remarks3: string
}

interface CostingResponseRecord {
    orderNo: string;
    variableCost: string;
    manufacturingCost: string;
    interestDays: string;
    interestCost: string;
    transporting: string;
    sellingPrice: string;
}

interface PendingCostingItem {
  id: number
  jobCardNo: string
  deliveryOrderNo: string
  productName: string
  firmName: string
  partyName: string
  quantityOfFG: number
  planned3: string
  completeDetails?: CompleteProductionDetails
}

interface HistoryCostingItem {
  id: number
  jobCardNo: string
  deliveryOrderNo: string
  productName: string
  firmName: string
  partyName: string
  quantityOfFG: number
  costingAmount: number
  costingDate: string
  completeDetails?: CompleteProductionDetails
}

// --- Column Definitions ---
const PENDING_COLUMNS_META = [
  { header: "Action", dataKey: "actionColumn", alwaysVisible: true },
  { header: "Job Card No.", dataKey: "jobCardNo", alwaysVisible: true },
  { header: "Delivery Order No.", dataKey: "deliveryOrderNo", toggleable: true },
  { header: "Product Name", dataKey: "productName", toggleable: true },
  { header: "Quantity", dataKey: "quantityOfFG", toggleable: true },
  { header: "Firm Name", dataKey: "firmName", toggleable: true },
  { header: "Party Name", dataKey: "partyName", toggleable: true },
  { header: "Planned 3", dataKey: "planned3", toggleable: true },
]

const HISTORY_COLUMNS_META = [
  { header: "Job Card No.", dataKey: "jobCardNo", alwaysVisible: true },
  { header: "Delivery Order No.", dataKey: "deliveryOrderNo", toggleable: true },
  { header: "Product Name", dataKey: "productName", toggleable: true },
  { header: "Quantity", dataKey: "quantityOfFG", toggleable: true },
  { header: "Firm Name", dataKey: "firmName", toggleable: true },
  { header: "Party Name", dataKey: "partyName", toggleable: true },
  { header: "Costing Amount", dataKey: "costingAmount", toggleable: true },
  { header: "Costing Date", dataKey: "costingDate", toggleable: true },
  { header: "Cost Report", dataKey: "costReport", alwaysVisible: true },
]

function hasValue(value: any): boolean {
  return value !== null && value !== undefined && String(value).trim() !== "" && String(value).trim().toLowerCase() !== "null"
}

// Helper function to format date values in dd/mm/yy format
function formatDateValue(value: any): string {
  if (!value) return "N/A"
  const date = new Date(value)
  return isNaN(date.getTime()) ? String(value) : format(date, "dd/MM/yy")
}

// Helper function to format datetime values in dd/mm/yy HH:mm format
function formatDateTimeValue(value: any): string {
  if (!value) return "N/A"
  const date = new Date(value)
  return isNaN(date.getTime()) ? String(value) : format(date, "dd/MM/yy HH:mm")
}

const initialFormState = {
  costingAmount: "",
}

export default function CostingPage() {
  const [pendingCosting, setPendingCosting] = useState<PendingCostingItem[]>([])
  const [historyCosting, setHistoryCosting] = useState<HistoryCostingItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedCosting, setSelectedCosting] = useState<PendingCostingItem | null>(null)
  const [formData, setFormData] = useState(initialFormState)
  const [costingResponses, setCostingResponses] = useState<CostingResponseRecord[]>([])
  const [formErrors, setFormErrors] = useState<Record<string, string | null>>({})
  const [activeTab, setActiveTab] = useState("pending")
  const [visiblePendingColumns, setVisiblePendingColumns] = useState<Record<string, boolean>>({})
  const [visibleHistoryColumns, setVisibleHistoryColumns] = useState<Record<string, boolean>>({})
  const [searchQuery, setSearchQuery] = useState("")
  const [loadingRates, setLoadingRates] = useState(false)
  const [liftRates, setLiftRates] = useState<Record<string, { rate: number; type: string; transportRate: number; totalBagsQty: number; billingQty: number }>>({})
  const [editedRates, setEditedRates] = useState<Record<string, { rate: string; transportRate: string }>>({})
  const [orderRates, setOrderRates] = useState<Record<string, number>>({})

  const getActualOrderRate = useCallback((item: PendingCostingItem | null): number => {
    if (!item) return 0
    const doNo = String(item.deliveryOrderNo || "").trim()
    const firmName = String(item.firmName || "").trim().toLowerCase()
    const productName = String(item.productName || "").trim().toLowerCase()

    // 1. Try DO No. + Product Name + Firm Name
    const key1 = `${doNo}_${productName}_${firmName}`.toLowerCase()
    if (orderRates[key1] !== undefined) return orderRates[key1]

    // 2. Try DO No. + Product Name
    const key2 = `${doNo}_${productName}`.toLowerCase()
    if (orderRates[key2] !== undefined) return orderRates[key2]

    // 3. Try DO No. + Firm Name
    const key3 = `${doNo}_${firmName}`.toLowerCase()
    if (orderRates[key3] !== undefined) return orderRates[key3]

    // 4. Try DO No. only (fallback)
    return orderRates[doNo] || orderRates[doNo.toLowerCase()] || 0
  }, [orderRates])

  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")
  const [selectedFirm, setSelectedFirm] = useState("ALL")

  const parseDateToTimestamp = useCallback((dateVal: any): number | null => {
    if (!dateVal) return null
    const str = String(dateVal).trim()
    if (!str || str === "N/A") return null 

    if (str.includes("/")) {
      const parts = str.split(" ")
      const dParts = parts[0].split("/")
      if (dParts.length === 3) {
        const day = parseInt(dParts[0], 10)
        const month = parseInt(dParts[1], 10) - 1
        let year = parseInt(dParts[2], 10)
        if (year < 100) year += 2000

        let hours = 0, minutes = 0
        if (parts[1] && parts[1].includes(":")) {
          const tParts = parts[1].split(":")
          hours = parseInt(tParts[0], 10) || 0
          minutes = parseInt(tParts[1], 10) || 0
        }
        const dt = new Date(year, month, day, hours, minutes)
        if (!isNaN(dt.getTime())) return dt.getTime()
      }
    }

    const d = new Date(str)
    return isNaN(d.getTime()) ? null : d.getTime()
  }, [])

  const isDateInRange = useCallback(
    (itemDateStr: any, fromDateStr: string, toDateStr: string, fallbackDateStr?: any): boolean => {
      if (!fromDateStr && !toDateStr) return true

      let itemTime = parseDateToTimestamp(itemDateStr)
      if (!itemTime && fallbackDateStr) {
        itemTime = parseDateToTimestamp(fallbackDateStr)
      }

      if (!itemTime) return true

      if (fromDateStr) {
        const fromTime = new Date(`${fromDateStr}T00:00:00`).getTime()
        if (!isNaN(fromTime) && itemTime < fromTime) return false
      }

      if (toDateStr) {
        const toTime = new Date(`${toDateStr}T23:59:59.999`).getTime()
        if (!isNaN(toTime) && itemTime > toTime) return false
      }

      return true
    },
    [parseDateToTimestamp]
  )

  const matchFirm = useCallback((itemFirm: string, firmFilter: string) => {
    if (!firmFilter || firmFilter === "ALL") return true
    const f1 = (itemFirm || "").toLowerCase().trim()
    const f2 = firmFilter.toLowerCase().trim()
    return f1.includes(f2) || f2.includes(f1)
  }, [])

  const uniqueFirms = useMemo(() => {
    const set = new Set<string>()
    pendingCosting.forEach((item) => {
      if (item.firmName) set.add(item.firmName.trim())
    })
    historyCosting.forEach((item) => {
      if (item.firmName) set.add(item.firmName.trim())
    })
    return Array.from(set).filter(Boolean).sort()
  }, [pendingCosting, historyCosting])

  const filteredPending = useMemo(() => {
    return pendingCosting.filter((item) => {
      const q = searchQuery.toLowerCase().trim()
      if (q) {
        const matchesSearch =
          (item.jobCardNo || "").toLowerCase().includes(q) ||
          (item.deliveryOrderNo || "").toLowerCase().includes(q) ||
          (item.productName || "").toLowerCase().includes(q) ||
          (item.partyName || "").toLowerCase().includes(q) ||
          (item.firmName || "").toLowerCase().includes(q)
        if (!matchesSearch) return false
      }

      if (!matchFirm(item.firmName, selectedFirm)) return false

      if (
        !isDateInRange(
          item.planned3,
          fromDate,
          toDate,
          item.completeDetails?.dateOfProduction || item.completeDetails?.timestamp
        )
      ) {
        return false
      }

      return true
    })
  }, [pendingCosting, searchQuery, selectedFirm, fromDate, toDate, matchFirm, isDateInRange])

  const filteredHistory = useMemo(() => {
    return historyCosting.filter((item) => {
      const q = searchQuery.toLowerCase().trim()
      if (q) {
        const matchesSearch =
          (item.jobCardNo || "").toLowerCase().includes(q) ||
          (item.deliveryOrderNo || "").toLowerCase().includes(q) ||
          (item.productName || "").toLowerCase().includes(q) ||
          (item.partyName || "").toLowerCase().includes(q) ||
          (item.firmName || "").toLowerCase().includes(q)
        if (!matchesSearch) return false
      }

      if (!matchFirm(item.firmName, selectedFirm)) return false

      if (
        !isDateInRange(
          item.costingDate,
          fromDate,
          toDate,
          item.completeDetails?.dateOfProduction || item.completeDetails?.timestamp
        )
      ) {
        return false
      }

      return true
    })
  }, [historyCosting, searchQuery, selectedFirm, fromDate, toDate, matchFirm, isDateInRange])

  const totalHistoryCostingAmount = useMemo(() => {
    return filteredHistory.reduce((sum, item) => sum + (Number(item.costingAmount) || 0), 0)
  }, [filteredHistory])

  const totalPendingCostingAmount = useMemo(() => {
    return filteredPending.reduce((sum, item) => {
      const amt = Number(item.completeDetails?.costingAmount) || 0
      return sum + amt
    }, 0)
  }, [filteredPending])

  useEffect(() => {
    const initializeVisibility = (columnsMeta: any[]) => {
      const visibility: Record<string, boolean> = {}
      columnsMeta.forEach((col) => {
        visibility[col.dataKey] = col.alwaysVisible || col.toggleable
      })
      return visibility
    }
    setVisiblePendingColumns(initializeVisibility(PENDING_COLUMNS_META))
    setVisibleHistoryColumns(initializeVisibility(HISTORY_COLUMNS_META))
  }, [])

  const processCompleteDetails = (row: any): CompleteProductionDetails => {
    const rawMaterials = []
    for (let i = 1; i <= 20; i++) {
      const rawMaterialName = row[`Raw Material Name ${i}`]
      const rawMaterialQty = row[`Quantity Of Raw Material ${i}`]

      if (rawMaterialName && String(rawMaterialName).trim() !== "") {
        rawMaterials.push({
          name: String(rawMaterialName || ""),
          quantity: rawMaterialQty || 0
        })
      }
    }

    return {
      // Basic Info
      timestamp: formatDateTimeValue(row["Timestamp"]),
      jobCardNo: String(row["Job Card No."] || ""),
      firmName: String(row["FIRM Name"] || ""),
      dateOfProduction: formatDateValue(row["Date Of Production"]),
      nameOfSupervisor: String(row["Name Of Supervisor"] || ""),
      productName: String(row["Product Name"] || ""),
      quantityOfFG: Number(row["Quantity Of FG"] || 0),
      serialNumber: String(row["Serial Number"] || ""),
      
      // Raw Materials
      rawMaterials,
      
      // Additional Fields
      machineRunningHour: String(row["Machine Running hour"] || ""),
      remarks1: String(row["Remarks1"] || ""),
      ppBagUsed: String(row["PP BAG USED"] || ""),
      ppBagToBeUsed: String(row["PP BAG TO BE USED"] || ""),
      partyName: String(row["Party Name"] || ""),
      ppBagSmall: String(row["PP Bag (Small)"] || ""),
      costingAmount: Number(row["Costing Amount"] || 0),
      colorCondition: String(row["Color Condition"] || ""),
      orderNo: String(row["Order No."] || ""),
      planned1: formatDateValue(row["Planned1"]),
      actual1: formatDateTimeValue(row["Actual1"]),
      status: String(row["Status"] || ""),
      actualQty1: String(row["Qty"] || ""),
      planned2: formatDateValue(row["Planned2"]),
      actual2: formatDateTimeValue(row["Actual2"]),
      timeDelay2: String(row["Time Delay2"] || ""),
      remarks: String(row["Remarks"] || ""),
      planned3: formatDateValue(row["Planned3"]),
      actual3: formatDateTimeValue(row["Actual3"]),
      costingAmount2: String(row["Costing Amount"] || ""),
      planned4: formatDateValue(row["Planned4"]),
      actual4: formatDateTimeValue(row["Actual4"]),
      remarks1_2: String(row["Remarks2"] || ""),
      planned5: formatDateValue(row["Planned5"]),
      actual5: formatDateTimeValue(row["Actual5"]),
      remarks2: String(row["Remarks3"] || ""),
      planned6: formatDateValue(row["Planned6"]),
      actual6: formatDateTimeValue(row["Actual6"]),
      remarks3: String(row["Remarks4"] || ""),
    }
  }

  const loadAllData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [
        { data: actualProductionRows, error: actualErr },
        { data: jobCardsRows, error: jobCardsErr },
        { data: costingResponseRows, error: costingErr },
        orderReceiptRes,
      ] = await Promise.all([
        supabase.from(ACTUAL_PRODUCTION_TABLE).select("*"),
        supabase.from(JOBCARDS_TABLE).select("*"),
        supabase.from(COSTING_RESPONSE_TABLE).select("*"),
        Promise.resolve(
          dispatchSupabase.from("ORDER RECEIPT").select('"DO-Delivery Order No.", "Rate Of Material", "Product Name", "Firm Name"')
        ).catch((err: any) => ({ data: null, error: err })),
      ])

      if (actualErr) throw actualErr
      if (jobCardsErr) throw jobCardsErr
      if (costingErr) throw costingErr

      // The same job card number is reused across several DOs, so a lookup on
      // the number alone resolves to whichever row happened to be last and
      // pulls in another order's party/firm. Key on DO + product as well.
      const normalizeKey = (value: any) => String(value ?? "").trim().toLowerCase()
      const jobCardsByNo = new Map<string, any>()
      ;(jobCardsRows || []).forEach((jc: any) => {
        const jcNo = String(jc["JC-Job Card Number"] || "").trim()
        if (!jcNo) return
        const doNo = normalizeKey(jc["Delivery Order No."])
        const product = normalizeKey(jc["Product Name"])
        jobCardsByNo.set(`${jcNo}::${doNo}::${product}`, jc)
        jobCardsByNo.set(`${jcNo}::${doNo}`, jc)
        jobCardsByNo.set(jcNo, jc)
      })

      const buildItem = (row: any) => {
        const jobCardNo = String(row["Job Card No."] || "").trim()
        const rowDoNo = normalizeKey(row["Order No."])
        const rowProduct = normalizeKey(row["Product Name"])
        // Most specific match first; falls back to the plain number so job
        // cards that appear only once behave exactly as before.
        const jobCard =
          jobCardsByNo.get(`${jobCardNo}::${rowDoNo}::${rowProduct}`) ||
          jobCardsByNo.get(`${jobCardNo}::${rowDoNo}`) ||
          jobCardsByNo.get(jobCardNo)

        return {
          id: row.id,
          jobCardNo,
          deliveryOrderNo: String(row["Order No."] || jobCard?.["Delivery Order No."] || ""),
          productName: String(row["Product Name"] || jobCard?.["Product Name"] || ""),
          firmName: String(row["FIRM Name"] || jobCard?.["Firm Name"] || ""),
          partyName: String(row["Party Name"] || jobCard?.["Party Name"] || ""),
          quantityOfFG: Number(row["Quantity Of FG"] || jobCard?.["Quantity"] || 0),
          planned3: formatDateValue(row["Planned8"]),
          completeDetails: processCompleteDetails(row),
        }
      }

      const pendingData: PendingCostingItem[] = (actualProductionRows || [])
        .filter((row: any) => hasValue(row["Job Card No."]) && hasValue(row["Planned8"]) && !hasValue(row["Actual8"]))
        .map(buildItem)

      const historyData: HistoryCostingItem[] = (actualProductionRows || [])
        .filter((row: any) => hasValue(row["Job Card No."]) && hasValue(row["Planned8"]) && hasValue(row["Actual8"]))
        .map((row: any) => ({
          ...buildItem(row),
          costingAmount: Number(row["Costing Amount"] || 0),
          costingDate: formatDateTimeValue(row["Actual8"]),
        }))
        .sort((a: any, b: any) => new Date(b.costingDate).getTime() - new Date(a.costingDate).getTime())

      const responses: CostingResponseRecord[] = (costingResponseRows || [])
        .map((row: any) => ({
          orderNo: String(row["Order No."] || ""),
          variableCost: String(row["VARIABLE COST"] || ""),
          manufacturingCost: String(row["Manufacturing Cost"] || ""),
          interestDays: String(row["Interest (days)"] || ""),
          interestCost: String(row["Interest Cost"] || ""),
          transporting: String(row["Transporting (FOR)"] || ""),
          sellingPrice: String(row["SELLING PRICE"] || ""),
        }))
        .filter((r: any) => r.orderNo)

      const rates: Record<string, number> = {}
      if (orderReceiptRes && orderReceiptRes.data) {
        orderReceiptRes.data.forEach((row: any) => {
          const doNo = String(row["DO-Delivery Order No."] || "").trim()
          const rate = Number(row["Rate Of Material"] || 0)
          const firmName = String(row["Firm Name"] || "").trim()
          const productName = String(row["Product Name"] || "").trim()

          if (doNo) {
            // 1. Map by DO + Product + Firm
            if (productName && firmName) {
              rates[`${doNo}_${productName}_${firmName}`.toLowerCase()] = rate
            }
            // 2. Map by DO + Product
            if (productName) {
              rates[`${doNo}_${productName}`.toLowerCase()] = rate
            }
            // 3. Map by DO + Firm
            if (firmName) {
              rates[`${doNo}_${firmName}`.toLowerCase()] = rate
            }
            // 4. Legacy/fallback map by DO only
            rates[doNo] = rate
            rates[doNo.toLowerCase()] = rate
          }
        })
      }
      setOrderRates(rates)

      setPendingCosting(pendingData)
      setHistoryCosting(historyData)
      setCostingResponses(responses)
    } catch (err: any) {
      setError(`Failed to load data: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadAllData()
  }, [loadAllData])

  const handleFormChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const validateForm = () => {
    const errors: Record<string, string> = {}
    if (!formData.costingAmount || Number(formData.costingAmount) <= 0) {
      errors.costingAmount = "Valid costing amount is required."
    }
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const fetchMaterialRates = async (item: PendingCostingItem) => {
    if (!item?.completeDetails?.rawMaterials) return
    setLoadingRates(true)
    const ratesMap: Record<string, { rate: number; type: string; transportRate: number; totalBagsQty: number; billingQty: number }> = {}
    
    // Clean firm name (e.g. "RKL ORDER" -> "Rkl") to match LIFT-ACCOUNTS table
    const rawFirmName = item.completeDetails.firmName || item.firmName || ""
    const cleanFirmName = (firm: string): string => {
      const f = String(firm || "").trim().toLowerCase();
      if (f.includes("purab")) return "Purab";
      if (f.includes("pmmpl")) return "Pmmpl";
      if (f.includes("rkl")) return "Rkl";
      return firm;
    };
    const firmName = cleanFirmName(rawFirmName)

    try {
      await Promise.all(
        item.completeDetails.rawMaterials.map(async (rm) => {
          const rmName = rm.name ? rm.name.trim() : ""
          if (!rmName) return

          const { data, error } = await purchaseSupabase
            .from("LIFT-ACCOUNTS")
            .select('"Rate", "Type Of Transporting Rate", "Transporter Rate", "Lifting Qty", "Total Bags Qty"')
            .ilike("Firm Name", firmName)
            .ilike("Raw Material Name", rmName)
            .order("Timestamp", { ascending: false })
            .limit(1)

          if (!error && data && data.length > 0) {
            const row = data[0]
            const rawRate = Number(row["Transporter Rate"] || 0)
            const liftQty = Number(row["Lifting Qty"] || 0)
            const rateType = String(row["Type Of Transporting Rate"] || "").trim().toLowerCase()
            
            // Calculate Per MT Transportation Rate dynamically
            let calculatedTransportRate = 0
            if ((rateType === "per mt" || rateType === "fixed") && liftQty > 0) {
              calculatedTransportRate = rawRate / liftQty
            }

            let totalBagsQty = row["Total Bags Qty"] !== null && row["Total Bags Qty"] !== undefined ? Number(row["Total Bags Qty"]) : 0

            // If the latest row doesn't have Total Bags Qty, fetch the latest one that does
            if (totalBagsQty === 0) {
              const { data: bagsData, error: bagsErr } = await purchaseSupabase
                .from("LIFT-ACCOUNTS")
                .select('"Total Bags Qty"')
                .ilike("Firm Name", firmName)
                .ilike("Raw Material Name", rmName)
                .not("Total Bags Qty", "is", null)
                .order("Timestamp", { ascending: false })
                .limit(1)

              if (!bagsErr && bagsData && bagsData.length > 0) {
                totalBagsQty = Number(bagsData[0]["Total Bags Qty"] || 0)
              }
            }

            let finalRate = Number(row["Rate"] || 0)
            const isSpecialPPBag = (name: string) => {
              const n = name.trim().replace(/\s+/g, ' ').toLowerCase();
              return (
                n === "pp bag (25 kgs)" ||
                n === "pp bag (50 kgs)" ||
                n === "pp bags 25 kg" ||
                n === "pp bag r - 25" ||
                n === "pp bag b - 25"
              );
            }

            if (isSpecialPPBag(rmName) && totalBagsQty > 0) {
              const oldRate = finalRate
              finalRate = (liftQty * finalRate) / totalBagsQty
              console.log(`[PP BAG CALC MATCH] ${rmName}: (${liftQty} * ${oldRate}) / ${totalBagsQty} = ${finalRate}`)
            } else {
              console.log(`[PP BAG CALC SKIP] ${rmName}: isSpecial=${isSpecialPPBag(rmName)}, totalBagsQty=${totalBagsQty}, rate=${finalRate}`)
            }

            ratesMap[rmName] = {
              rate: finalRate,
              type: String(row["Type Of Transporting Rate"] || "").trim(),
              transportRate: calculatedTransportRate,
              totalBagsQty,
              billingQty: liftQty,
            }
          } else {
            ratesMap[rmName] = { rate: 0, type: "", transportRate: 0, totalBagsQty: 0, billingQty: 0 }
          }

          // Fallback to inventory_master_history if rate is 0
          if (!ratesMap[rmName] || ratesMap[rmName].rate === 0) {
            try {
              const { data: invData } = await inventorySupabase
                .from("inventory_master_history")
                .select("product_rate")
                .ilike("firm_name", firmName)
                .ilike("item_name", rmName)
                .not("product_rate", "is", null)
                .order("snapshot_date", { ascending: false })
                .limit(1)

              if (invData && invData.length > 0 && Number(invData[0].product_rate) > 0) {
                const invRate = Number(invData[0].product_rate)
                ratesMap[rmName] = {
                  rate: invRate,
                  type: "",
                  transportRate: ratesMap[rmName]?.transportRate || 0,
                  totalBagsQty: 0,
                  billingQty: 0,
                }
              }
            } catch (e) {}
          }
        })
      )
      setLiftRates(ratesMap)

      // Initialize editedRates
      const initialEditedRates: Record<string, { rate: string; transportRate: string }> = {}
      item.completeDetails.rawMaterials.forEach((rm) => {
        const rmName = rm.name ? rm.name.trim() : ""
        const rateInfo = ratesMap[rmName]
        if (rateInfo) {
          initialEditedRates[rmName] = {
            rate: rateInfo.rate > 0 ? String(rateInfo.rate) : "",
            transportRate: rateInfo.transportRate > 0 ? String(rateInfo.transportRate) : "",
          }
        } else {
          initialEditedRates[rmName] = { rate: "", transportRate: "" }
        }
      })
      setEditedRates(initialEditedRates)

      // Calculate total material cost (including raw material cost + transport cost)
      let totalMaterialCost = 0
      item.completeDetails.rawMaterials.forEach((rm) => {
        const rmName = rm.name ? rm.name.trim() : ""
        const rateInfo = ratesMap[rmName]
        if (rateInfo) {
          const qty = Number(rm.quantity || 0)
          const matCost = qty * rateInfo.rate
          const transCost = qty * rateInfo.transportRate
          totalMaterialCost += (matCost + transCost)
        }
      })

      // Calculate Per MT FG Cost based on FG Quantity
      const fgQty = Number(item.completeDetails.quantityOfFG || item.quantityOfFG || 0)
      const perMtCost = fgQty > 0 ? totalMaterialCost / fgQty : 0

      // Get Manufacturing Cost from costingResponses
      const response = costingResponses.find(r => r.orderNo === item.deliveryOrderNo)
      const manufacturingCost = response ? parseFloat(response.manufacturingCost) || 0 : 0
      const totalProductionCost = perMtCost + manufacturingCost

      // Pre-fill the costingAmount input box with Total Production Cost
      setFormData({
        costingAmount: totalProductionCost > 0 ? totalProductionCost.toFixed(2) : "",
      })
    } catch (err) {
      console.error("Error fetching material rates:", err)
    } finally {
      setLoadingRates(false)
    }
  }

  const handleRateChange = (rmName: string, field: 'rate' | 'transportRate', value: string) => {
    setEditedRates((prev) => {
      const updatedEdited = {
        ...prev,
        [rmName]: {
          ...prev[rmName],
          [field]: value,
        },
      }

      const numValue = parseFloat(value) || 0
      setLiftRates((prevLift) => {
        const prevInfo = prevLift[rmName] || { rate: 0, type: "", transportRate: 0, totalBagsQty: 0, billingQty: 0 }
        const updatedLift = {
          ...prevLift,
          [rmName]: {
            ...prevInfo,
            [field]: numValue,
          },
        }

        // Recalculate costingAmount in formData
        if (selectedCosting?.completeDetails?.rawMaterials) {
          let totalMaterialCost = 0
          selectedCosting.completeDetails.rawMaterials.forEach((rm) => {
            const name = rm.name ? rm.name.trim() : ""
            const rateInfo = updatedLift[name]
            if (rateInfo) {
              const qty = Number(rm.quantity || 0)
              totalMaterialCost += qty * (rateInfo.rate + rateInfo.transportRate)
            }
          })
          const fgQty = Number(selectedCosting.completeDetails.quantityOfFG || selectedCosting.quantityOfFG || 0)
          const perMtCost = fgQty > 0 ? totalMaterialCost / fgQty : 0
          const response = costingResponses.find(r => r.orderNo === selectedCosting.deliveryOrderNo)
          const manufacturingCost = response ? parseFloat(response.manufacturingCost) || 0 : 0
          const totalProductionCost = perMtCost + manufacturingCost

          setFormData((prevForm) => ({
            ...prevForm,
            costingAmount: totalProductionCost > 0 ? totalProductionCost.toFixed(2) : "",
          }))
        }

        return updatedLift
      })

      return updatedEdited
    })
  }

  const [isViewOnlyModal, setIsViewOnlyModal] = useState(false)

  const handleCosting = (item: PendingCostingItem) => {
    setSelectedCosting(item)
    setFormData(initialFormState)
    setFormErrors({})
    setIsViewOnlyModal(false)
    setIsDialogOpen(true)
    fetchMaterialRates(item)
  }

  const handleViewCostReport = (item: HistoryCostingItem) => {
    const pendingItem: PendingCostingItem = {
      id: item.id,
      jobCardNo: item.jobCardNo,
      deliveryOrderNo: item.deliveryOrderNo,
      productName: item.productName,
      firmName: item.firmName,
      partyName: item.partyName,
      quantityOfFG: item.quantityOfFG,
      planned3: item.completeDetails?.planned3 || "",
      completeDetails: item.completeDetails,
    }
    setSelectedCosting(pendingItem)
    setFormData({
      costingAmount: item.costingAmount ? String(item.costingAmount) : "",
    })
    setFormErrors({})
    setIsViewOnlyModal(true)
    setIsDialogOpen(true)
    fetchMaterialRates(pendingItem)
  }

  const handleSaveCosting = async () => {
    if (!validateForm() || !selectedCosting) return
    setIsSubmitting(true)
    try {
      const { error: updateErr } = await supabase
        .from(ACTUAL_PRODUCTION_TABLE)
        .update({
          "Actual8": format(new Date(), "yyyy-MM-dd"),
          "Costing Amount": Number(formData.costingAmount),
        })
        .eq("id", selectedCosting.id)

      if (updateErr) throw updateErr

      alert("Costing completed successfully!")
      setIsDialogOpen(false)
      await loadAllData()
    } catch (err: any) {
      setError(err instanceof Error ? err.message : "An unknown error occurred")
      alert(`Error: ${err instanceof Error ? err.message : "An unknown error occurred"}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleToggleColumn = (tab: string, dataKey: string, checked: boolean) => {
    const setter = tab === "pending" ? setVisiblePendingColumns : setVisibleHistoryColumns
    setter((prev) => ({ ...prev, [dataKey]: checked }))
  }

  const handleSelectAllColumns = (tab: string, columnsMeta: any[], checked: boolean) => {
    const newVisibility: Record<string, boolean> = {}
    columnsMeta.forEach((col) => {
      if (col.toggleable) newVisibility[col.dataKey] = checked
    })
    const setter = tab === "pending" ? setVisiblePendingColumns : setVisibleHistoryColumns
    setter((prev) => ({ ...prev, ...newVisibility }))
  }

  const visiblePendingColumnsMeta = useMemo(
    () => PENDING_COLUMNS_META.filter((col) => visiblePendingColumns[col.dataKey]),
    [visiblePendingColumns],
  )

  const visibleHistoryColumnsMeta = useMemo(
    () => HISTORY_COLUMNS_META.filter((col) => visibleHistoryColumns[col.dataKey]),
    [visibleHistoryColumns],
  )

  const ColumnToggler = ({ tab, columnsMeta }: { tab: string; columnsMeta: any[] }) => (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 text-xs bg-transparent ml-auto">
          <Settings className="mr-1.5 h-3.5 w-3.5" />
          View Columns
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[220px] p-3">
        <div className="grid gap-2">
          <p className="text-sm font-medium">Toggle Columns</p>
          <div className="flex items-center justify-between mt-1 mb-2">
            <Button
              variant="link"
              size="sm"
              className="p-0 h-auto text-xs"
              onClick={() => handleSelectAllColumns(tab, columnsMeta, true)}
            >
              Select All
            </Button>
            <span className="text-gray-300 mx-1">|</span>
            <Button
              variant="link"
              size="sm"
              className="p-0 h-auto text-xs"
              onClick={() => handleSelectAllColumns(tab, columnsMeta, false)}
            >
              Deselect All
            </Button>
          </div>
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {columnsMeta
              .filter((col) => col.toggleable)
              .map((col) => (
                <div key={`toggle-${tab}-${col.dataKey}`} className="flex items-center space-x-2">
                  <Checkbox
                    id={`toggle-${tab}-${col.dataKey}`}
                    checked={
                      tab === "pending" ? !!visiblePendingColumns[col.dataKey] : !!visibleHistoryColumns[col.dataKey]
                    }
                    onCheckedChange={(checked) => handleToggleColumn(tab, col.dataKey, Boolean(checked))}
                  />
                  <Label htmlFor={`toggle-${tab}-${col.dataKey}`} className="text-xs font-normal cursor-pointer">
                    {col.header}
                  </Label>
                </div>
              ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )

  if (loading)
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-olive-600" />
        <p className="ml-4 text-lg">Loading Costing Data...</p>
      </div>
    )

  if (error)
    return (
      <div className="p-8 text-center text-red-600 bg-red-50 rounded-md">
        <AlertTriangle className="h-12 w-12 mx-auto mb-4" />
        <p className="text-lg font-semibold">Error Loading Data</p>
        <p>{error}</p>
        <Button onClick={loadAllData} className="mt-4">
          Retry
        </Button>
      </div>
    )

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-screen max-w-full overflow-x-hidden">
      <Toaster />

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <DollarSign className="h-6 w-6 text-olive-600" />
            Costing
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Add costing amounts for production items that have completed planning.</p>
        </div>
      </div>
      <Card className="border-none shadow-sm bg-white">
        <CardContent className="p-4 sm:p-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
              <TabsList className="grid w-full sm:w-[450px] grid-cols-2 mb-0 p-1 bg-slate-100 rounded-xl">
                <TabsTrigger value="pending" className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-olive-700 data-[state=active]:shadow-sm transition-all">
                  <DollarSign className="h-4 w-4 mr-2" /> Pending Costing
                  <Badge variant="secondary" className="ml-1.5 px-1.5 py-0.5 text-xs">
                    {filteredPending.length}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="history" className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-olive-700 data-[state=active]:shadow-sm transition-all">
                  <History className="h-4 w-4 mr-2" /> Costing History
                  <Badge variant="secondary" className="ml-1.5 px-1.5 py-0.5 text-xs">
                    {filteredHistory.length}
                  </Badge>
                </TabsTrigger>
              </TabsList>
              <div className="relative w-full sm:w-[300px]">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search costing..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 focus-visible:ring-olive-500"
                />
              </div>
            </div>

            {/* Filter Toolbar & Total Costing Amount Summary */}
            <div className="bg-slate-100/90 p-3.5 rounded-xl border border-slate-200/80 mb-6 flex flex-wrap items-center justify-between gap-3 shadow-xs">
              <div className="flex flex-wrap items-center gap-3">
                {/* Firm Name Filter */}
                <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-2xs">
                  <Building className="h-4 w-4 text-olive-600" />
                  <span className="text-xs font-semibold text-slate-600">Firm:</span>
                  <select
                    value={selectedFirm}
                    onChange={(e) => setSelectedFirm(e.target.value)}
                    className="text-xs bg-transparent font-medium text-slate-800 focus:outline-none cursor-pointer pr-1"
                  >
                    <option value="ALL">All Firms</option>
                    {uniqueFirms.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                </div>

                {/* From Date Filter */}
                <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-2xs">
                  <Calendar className="h-4 w-4 text-olive-600" />
                  <span className="text-xs font-semibold text-slate-600">From:</span>
                  <input
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="text-xs bg-transparent font-medium text-slate-800 focus:outline-none cursor-pointer"
                  />
                </div>

                {/* To Date Filter */}
                <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-2xs">
                  <Calendar className="h-4 w-4 text-olive-600" />
                  <span className="text-xs font-semibold text-slate-600">To:</span>
                  <input
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="text-xs bg-transparent font-medium text-slate-800 focus:outline-none cursor-pointer"
                  />
                </div>

                {/* Reset Filters Button */}
                {(fromDate || toDate || selectedFirm !== "ALL" || searchQuery) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setFromDate("")
                      setToDate("")
                      setSelectedFirm("ALL")
                      setSearchQuery("")
                    }}
                    className="h-8 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2.5 font-medium"
                  >
                    Reset Filters
                  </Button>
                )}
              </div>

              {/* Total Costing Amount Display */}
              <div className="flex items-center gap-2 bg-white border border-slate-200 shadow-2xs px-4 py-1.5 rounded-lg text-slate-700 font-medium text-sm ml-auto">
              
                <span>
                  Total Costing Amount:{" "}
                  <strong className="text-base text-emerald-700 font-bold ml-1">
                    ₹
                    {(activeTab === "pending"
                      ? totalPendingCostingAmount
                      : totalHistoryCostingAmount
                    ).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </strong>
                </span>
              </div>
            </div>

            <TabsContent value="pending">
              <Card className="shadow-sm border border-border">
                <CardHeader className="py-3 px-4 bg-olive-50/70 rounded-t-lg">
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-md font-semibold text-foreground">
                      <DollarSign className="h-5 w-5 text-olive-700 mr-2" />
                      Pending Items ({filteredPending.length})
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
                            <TableHead key={col.dataKey}>{col.header}</TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredPending.length > 0 ? (
                          filteredPending.map((item, index) => (
                            <TableRow key={`${item.jobCardNo}-${index}`} className="hover:bg-olive-50/50">
                              {visiblePendingColumnsMeta.map((col) => (
                                <TableCell key={col.dataKey} className="whitespace-nowrap text-sm">
                                  {col.dataKey === "actionColumn" ? (
                                    <Button
                                      size="sm"
                                      onClick={() => handleCosting(item)}
                                      className="bg-green-600 text-white hover:bg-green-700"
                                    >
                                      <DollarSign className="mr-2 h-4 w-4" />
                                      Add Costing
                                    </Button>
                                  ) : (
                                    (item as any)[col.dataKey] || "-"
                                  )}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={visiblePendingColumnsMeta.length} className="h-48">
                              <div className="flex flex-col items-center justify-center text-center border-2 border-dashed border-olive-200/50 bg-olive-50/50 rounded-lg mx-4 my-4 flex-1">
                                <DollarSign className="h-12 w-12 text-olive-500 mb-3" />
                                <p className="font-medium text-foreground">No Pending Costing Items</p>
                                <p className="text-sm text-muted-foreground">
                                  All production items have been costed.
                                </p>
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

            <TabsContent value="history">
              <Card className="shadow-sm border border-border">
                <CardHeader className="py-3 px-4 bg-olive-50/70 rounded-t-lg">
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-md font-semibold text-foreground">
                      <History className="h-5 w-5 text-olive-700 mr-2" />
                      History Items ({filteredHistory.length})
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
                            <TableHead key={col.dataKey}>{col.header}</TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredHistory.length > 0 ? (
                          filteredHistory.map((item, index) => (
                            <TableRow key={`${item.jobCardNo}-${index}`} className="hover:bg-olive-50/50">
                              {visibleHistoryColumnsMeta.map((col) => (
                                <TableCell key={col.dataKey} className="whitespace-nowrap text-sm">
                                  {col.dataKey === "costingAmount" ? (
                                    <span className="font-medium text-green-600">
                                      ₹{Number(item.costingAmount).toLocaleString('en-IN')}
                                    </span>
                                  ) : col.dataKey === "costReport" ? (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleViewCostReport(item)}
                                      className="h-8 text-xs gap-1.5 border-slate-300 text-slate-700 hover:bg-slate-100 font-medium px-2.5"
                                    >
                                      <Eye className="h-3.5 w-3.5 text-slate-500" />
                                      View
                                    </Button>
                                  ) : (
                                    (item as any)[col.dataKey] || "-"
                                  )}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={visibleHistoryColumnsMeta.length} className="h-48">
                              <div className="flex flex-col items-center justify-center text-center border-2 border-dashed border-olive-200/50 bg-olive-50/50 rounded-lg mx-4 my-4 flex-1">
                                <History className="h-12 w-12 text-olive-500 mb-3" />
                                <p className="font-medium text-foreground">No Costing History</p>
                                <p className="text-sm text-muted-foreground">
                                  Completed costing records will appear here.
                                </p>
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

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl border-b pb-2">
              <Package className="h-5 w-5 text-green-600" />
              Complete Production Details - Job Card: {selectedCosting?.jobCardNo}
            </DialogTitle>
            <DialogDescription>
              All information from the actual production record for this job card
            </DialogDescription>
          </DialogHeader>
          
          {selectedCosting?.completeDetails && (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                handleSaveCosting()
              }}
              className="space-y-6 pt-2"
            >
              {/* Section 1: Basic Information */}
              <div className="space-y-3">
                <h3 className="text-md font-semibold flex items-center gap-2 text-green-700 bg-green-50 p-2 rounded">
                  <Building className="h-4 w-4" /> Basic Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4 border rounded-lg">
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500 flex items-center gap-1">
                      <Hash className="h-3 w-3" /> Job Card Number
                    </Label>
                    <p className="text-sm font-medium bg-gray-50 p-2 rounded">{selectedCosting.completeDetails.jobCardNo || "N/A"}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500 flex items-center gap-1">
                      <Building className="h-3 w-3" /> Firm Name
                    </Label>
                    <p className="text-sm font-medium bg-gray-50 p-2 rounded">{selectedCosting.completeDetails.firmName || "N/A"}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500 flex items-center gap-1">
                      <Calendar className="h-3 w-3" /> Date of Production
                    </Label>
                    <p className="text-sm font-medium bg-gray-50 p-2 rounded">{selectedCosting.completeDetails.dateOfProduction || "N/A"}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500 flex items-center gap-1">
                      <User className="h-3 w-3" /> Name of Supervisor
                    </Label>
                    <p className="text-sm font-medium bg-gray-50 p-2 rounded">{selectedCosting.completeDetails.nameOfSupervisor || "N/A"}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500 flex items-center gap-1">
                      <Package className="h-3 w-3" /> Product Name
                    </Label>
                    <p className="text-sm font-medium bg-gray-50 p-2 rounded">{selectedCosting.completeDetails.productName || "N/A"}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500 flex items-center gap-1">
                      <Package className="h-3 w-3" /> Quantity of FG
                    </Label>
                    <p className="text-sm font-medium bg-gray-50 p-2 rounded">{selectedCosting.completeDetails.quantityOfFG || "N/A"}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500 flex items-center gap-1">
                      <Hash className="h-3 w-3" /> Serial Number
                    </Label>
                    <p className="text-sm font-medium bg-gray-50 p-2 rounded">{selectedCosting.completeDetails.serialNumber || "N/A"}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500 flex items-center gap-1">
                      <Clock className="h-3 w-3" /> Machine Running Hour
                    </Label>
                    <p className="text-sm font-medium bg-gray-50 p-2 rounded">{selectedCosting.completeDetails.machineRunningHour || "N/A"}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500 flex items-center gap-1">
                      <FileText className="h-3 w-3" /> Delivery Order No.
                    </Label>
                    <p className="text-sm font-medium bg-gray-50 p-2 rounded">{selectedCosting.deliveryOrderNo || "N/A"}</p>
                  </div>
                </div>
              </div>

              {/* Section 2: Raw Materials */}
              {selectedCosting.completeDetails.rawMaterials.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-md font-semibold flex items-center gap-2 text-blue-700 bg-blue-50 p-2 rounded">
                    <Package className="h-4 w-4" /> Raw Materials & Live Rates (LIFT-ACCOUNTS)
                  </h3>
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader className="bg-blue-50">
                        <TableRow>
                          <TableHead className="w-12">#</TableHead>
                          <TableHead>Raw Material Name</TableHead>
                          <TableHead className="text-right">Quantity</TableHead>
                          <TableHead className="text-right">
                            {isViewOnlyModal ? "Rate (₹/MT)" : "Live Rate (₹/MT)"}
                          </TableHead>
                          <TableHead className="text-right">Trans. Rate (₹/MT)</TableHead>
                          <TableHead className="text-right">Total Cost (₹)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedCosting.completeDetails.rawMaterials.map((material, idx) => {
                          const rateInfo = liftRates[material.name ? material.name.trim() : ""]
                          const rate = rateInfo?.rate || 0
                          const transRate = rateInfo?.transportRate || 0
                          const qty = Number(material.quantity || 0)
                          const totalCost = qty * (rate + transRate)

                          return (
                            <TableRow key={idx}>
                              <TableCell className="font-medium">{idx + 1}</TableCell>
                              <TableCell>{material.name}</TableCell>
                              <TableCell className="text-right">{material.quantity}</TableCell>
                              <TableCell className="text-right text-olive-700 font-semibold">
                                {loadingRates ? (
                                  <span className="text-slate-400">Loading...</span>
                                ) : (
                                  <div className="flex items-center justify-end gap-1">
                                    <span className="text-gray-400">₹</span>
                                    <Input
                                      type="number"
                                      step="0.01"
                                      min="0"
                                      className="w-24 text-right h-8 text-xs font-semibold text-olive-700 bg-white"
                                      value={editedRates[material.name ? material.name.trim() : ""]?.rate ?? ""}
                                      onChange={(e) => handleRateChange(material.name ? material.name.trim() : "", 'rate', e.target.value)}
                                    />
                                  </div>
                                )}
                              </TableCell>
                              <TableCell className="text-right text-blue-700 font-semibold">
                                {loadingRates ? (
                                  <span className="text-slate-400">Loading...</span>
                                ) : (
                                  <div className="flex items-center justify-end gap-1">
                                    <span className="text-gray-400">₹</span>
                                    <Input
                                      type="number"
                                      step="0.01"
                                      min="0"
                                      className="w-24 text-right h-8 text-xs font-semibold text-blue-700 bg-white"
                                      value={editedRates[material.name ? material.name.trim() : ""]?.transportRate ?? ""}
                                      onChange={(e) => handleRateChange(material.name ? material.name.trim() : "", 'transportRate', e.target.value)}
                                    />
                                  </div>
                                )}
                              </TableCell>
                              <TableCell className="text-right text-emerald-700 font-bold">
                                {loadingRates ? (
                                  <span className="text-slate-400">Calculating...</span>
                                ) : totalCost > 0 ? (
                                  `₹${totalCost.toFixed(2)}`
                                ) : (
                                  "₹0.00"
                                )}
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                      <TableFooter className="bg-slate-50 font-bold">
                        {(() => {
                          let totalMaterialCost = 0
                          selectedCosting.completeDetails.rawMaterials.forEach((rm) => {
                            const rmName = rm.name ? rm.name.trim() : ""
                            const rateInfo = liftRates[rmName]
                            if (rateInfo) {
                              const qty = Number(rm.quantity || 0)
                              totalMaterialCost += qty * (rateInfo.rate + rateInfo.transportRate)
                            }
                          })

                          const fgQty = Number(selectedCosting.completeDetails.quantityOfFG || 0)
                          const perMtCost = fgQty > 0 ? totalMaterialCost / fgQty : 0

                          const response = costingResponses.find(r => r.orderNo === selectedCosting?.deliveryOrderNo)
                          const manufacturingCost = response ? parseFloat(response.manufacturingCost) || 0 : 0
                          const totalProductionCost = perMtCost + manufacturingCost

                          return (
                            <>
                              <TableRow>
                                <TableCell colSpan={5} className="text-right text-slate-600">
                                  Total Material Cost:
                                </TableCell>
                                <TableCell className="text-right text-emerald-700 text-sm">
                                  ₹{totalMaterialCost.toFixed(2)}
                                </TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell colSpan={5} className="text-right text-slate-600">
                                  FG Quantity:
                                </TableCell>
                                <TableCell className="text-right text-slate-700 text-sm">
                                  {fgQty} MT
                                </TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell colSpan={5} className="text-right text-slate-600">
                                  Calculated Per MT Cost:
                                </TableCell>
                                <TableCell className="text-right text-olive-700 text-sm">
                                  ₹{perMtCost.toFixed(2)} / MT
                                </TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell colSpan={5} className="text-right text-slate-600">
                                  Manufacturing Cost:
                                </TableCell>
                                <TableCell className="text-right text-slate-700 text-sm">
                                  ₹{manufacturingCost.toFixed(2)} / MT
                                </TableCell>
                              </TableRow>
                              <TableRow className="bg-olive-50">
                                <TableCell colSpan={5} className="text-right text-olive-800 font-extrabold text-sm">
                                  Total Production Cost / MT:
                                </TableCell>
                                <TableCell className="text-right text-olive-800 font-extrabold text-md">
                                  ₹{totalProductionCost.toFixed(2)} / MT
                                </TableCell>
                              </TableRow>
                            </>
                          )
                        })()}
                      </TableFooter>
                    </Table>
                  </div>
                </div>
              )}


              {/* Section 3: Costing response data */}
              {(() => {
                const response = costingResponses.find(r => r.orderNo === selectedCosting?.deliveryOrderNo);
                if (response) {
                  return (
                    <div className="space-y-3">
                      <h3 className="text-md font-semibold flex items-center gap-2 text-violet-700 bg-violet-50 p-2 rounded">
                        <DollarSign className="h-4 w-4" /> Costing Details from Analysis
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border border-violet-100 rounded-lg">
                        <div className="space-y-1 text-blue-700">
                          <Label className="text-xs text-blue-700 font-bold">ACTUAL ORDER RATE</Label>
                          <p className="text-lg font-black">
                            {getActualOrderRate(selectedCosting) > 0 
                              ? `₹${getActualOrderRate(selectedCosting).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` 
                              : "-"}
                          </p>
                        </div>
                        <div className="space-y-1 text-blue-700">
                          <Label className="text-xs text-blue-700 font-bold">PRODUCTION COST %</Label>
                          <p className="text-lg font-black">
                            {(() => {
                              const actualOrderRate = getActualOrderRate(selectedCosting);
                              
                              let totalMaterialCost = 0;
                              if (selectedCosting?.completeDetails?.rawMaterials) {
                                selectedCosting.completeDetails.rawMaterials.forEach((rm) => {
                                  const rmName = rm.name ? rm.name.trim() : "";
                                  const rateInfo = liftRates[rmName];
                                  if (rateInfo) {
                                    const qty = Number(rm.quantity || 0); 
                                    totalMaterialCost += qty * (rateInfo.rate + rateInfo.transportRate);
                                  }
                                });
                              }
                              const fgQty = Number(selectedCosting?.completeDetails?.quantityOfFG || 0);
                              const perMtCost = fgQty > 0 ? totalMaterialCost / fgQty : 0;
                              const manufacturingCost = response ? parseFloat(response.manufacturingCost) || 0 : 0;
                              const productionCost = perMtCost + manufacturingCost;

                              if (actualOrderRate > 0) {
                                return ((productionCost / actualOrderRate) * 100).toFixed(2) + "%";
                              }
                              return "-";
                            })()}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                }
                return null;
              })()}



              <Separator />

              {/* Costing Amount Input Section */}
              {!isViewOnlyModal && (
                <div className="space-y-4">
                  <h3 className="text-md font-semibold flex items-center gap-2 text-green-700">
                    <DollarSign className="h-4 w-4" /> Costing Amount
                  </h3>
                  <div className="space-y-2">
                    <Label htmlFor="costingAmount">Costing Amount (₹) *</Label>
                    <Input
                      id="costingAmount"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="Enter costing amount"
                      value={formData.costingAmount}
                      onChange={(e) => handleFormChange("costingAmount", e.target.value)}
                      className={formErrors.costingAmount ? "border-red-500" : ""}
                    />
                    {formErrors.costingAmount && <p className="text-xs text-red-600 mt-1">{formErrors.costingAmount}</p>}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t">
                {isViewOnlyModal ? (
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Close
                  </Button>
                ) : (
                  <>
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSubmitting}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={isSubmitting} className="bg-olive-600 hover:bg-olive-700">
                      {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Save Costing Amount
                    </Button>
                  </>
                )}
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
