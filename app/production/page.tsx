"use client"
import { useState, useEffect, useCallback, useMemo } from "react"
import { Loader2, AlertTriangle, Settings, Plus, X, Factory, History, Eye, Search, XCircle } from "lucide-react"
import { format } from "date-fns"
import { supabase } from "@/lib/supabase"
import { useAuth, FIRM_MAP } from "@/lib/auth"

// Shadcn UI components
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Toaster } from "@/components/ui/toaster"
import { Textarea } from "@/components/ui/textarea"

// Type Definitions
interface RawMaterial {
  name: string
  quantity: number | string
}

interface ColumnMeta {
  header: string
  dataKey: string
  alwaysVisible?: boolean
  toggleable?: boolean
}

interface ProductionItem {
  _rowIndex: number
  productionId?: number | string
  jobCardNo: string
  firmName: string

  supervisorName: string
  deliveryOrderNo: string
  partyName: string
  productName: string
  orderQuantity: number
  plannedDate?: string
  dateOfProduction: string
  shift: string
  notes: string
  quantity: number
  expectedDeliveryDate: string
  priority: string
  actualQuantity: number
  totalMade: number
  productRate: number
}

interface HistoryItem extends ProductionItem {
  timestamp?: string
  rawMaterials: RawMaterial[]
  machineHours: string
  remarks?: string
  productionTimestamp?: string
  serialNumber?: string
  quantityFG?: string
  status?: string
}

interface CompositionItem {
  id: number
  compositionNo: string
  orderNo: string
  productName: string
  materials: { name: string; percentage: number }[]
  variableCost: number
  manufacturingCost: number
  sellingPrice: number
}



// Constants
const JOBCARDS_TABLE = "jobcards"
const KYC_TABLE = "kyc"
const ACTUAL_PRODUCTION_TABLE = "actual_production"
const PRODUCTION_TABLE = "production"
const COSTING_RESPONSE_TABLE = "costing_response"

// Add this function after the constants section
const formatMachineHours = (hours: any) => {
  if (!hours || hours === "-") return "-"
  const hoursStr = String(hours)
  
  // If it's already in HH:MM:SS format
  if (/^\d{1,2}:\d{2}:\d{2}$/.test(hoursStr)) return hoursStr
  
  // If it's a numeric value (decimal hours)
  const numHours = Number.parseFloat(hoursStr)
  if (!isNaN(numHours)) {
    const wholeHours = Math.floor(numHours)
    const minutes = Math.floor((numHours - wholeHours) * 60)
    const seconds = Math.floor(((numHours - wholeHours) * 60 - minutes) * 60)
    return `${wholeHours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
  }
  
  // If it's a date string/object
  const date = new Date(hours)
  if (!isNaN(date.getTime())) {
    const h = date.getHours()
    const m = date.getMinutes()
    const s = date.getSeconds()
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
  }

  return hoursStr
}

// Column Definitions
const PENDING_COLUMNS_META = [
  { header: "Action", dataKey: "actionColumn", alwaysVisible: true, toggleable: false },
  { header: "ID", dataKey: "productionId", toggleable: true },
  { header: "Job Card No.", dataKey: "jobCardNo", alwaysVisible: true, toggleable: false },
  { header: "Firm Name", dataKey: "firmName", toggleable: true },
  { header: "Delivery Order No.", dataKey: "deliveryOrderNo", toggleable: true },
  { header: "Party Name", dataKey: "partyName", toggleable: true },
  { header: "Product", dataKey: "productName", toggleable: true },
  { header: "Qty", dataKey: "quantity", toggleable: true },
  { header: "Total Made", dataKey: "totalMade", toggleable: true },
  { header: "Expected Delivery Date", dataKey: "expectedDeliveryDate", toggleable: true },
  { header: "Planned Date", dataKey: "plannedDate", toggleable: true },
  { header: "Priority", dataKey: "priority", toggleable: true },
  { header: "Date of Production", dataKey: "dateOfProduction", toggleable: true },
  { header: "Supervisor Name", dataKey: "supervisorName", toggleable: true },
  { header: "Shift", dataKey: "shift", toggleable: true },
]

const HISTORY_COLUMNS_META = [
  { header: "Timestamp", dataKey: "timestamp", toggleable: true },
  { header: "ID", dataKey: "productionId", toggleable: true },
  { header: "Job Card No.", dataKey: "jobCardNo", alwaysVisible: true, toggleable: false },
  { header: "Firm Name", dataKey: "firmName", toggleable: true },
  { header: "Delivery Order No.", dataKey: "deliveryOrderNo", toggleable: true },
  { header: "Party Name", dataKey: "partyName", toggleable: true },
  { header: "Product", dataKey: "productName", toggleable: true },
  { header: "Qty", dataKey: "quantity", toggleable: true },
  { header: "Actual Quantity", dataKey: "actualQuantity", toggleable: true },
  { header: "Expected Delivery Date", dataKey: "expectedDeliveryDate", toggleable: true },
  { header: "Priority", dataKey: "priority", toggleable: true },
  { header: "Date of Production", dataKey: "dateOfProduction", toggleable: true },
  { header: "Supervisor Name", dataKey: "supervisorName", toggleable: true },
  { header: "Shift", dataKey: "shift", toggleable: true },
  { header: "Raw Materials", dataKey: "rawMaterials", toggleable: true },
  { header: "Machine Hours", dataKey: "machineHours", toggleable: true },
  { header: "Remarks", dataKey: "remarks", toggleable: true }, // Add this
  { header: "Serial No.", dataKey: "serialNumber", toggleable: true }, // Optional
]
const initialFormData = {
  quantityFG: "",
  productionDate: "",
  rawMaterials: [] as RawMaterial[],
  machineRunningHour: "",
  remarks: "",
}

const hasValue = (value: any) => {
  if (value === null || value === undefined) return false
  const normalized = String(value).trim().toLowerCase()
  return normalized !== "" && normalized !== "-" && normalized !== "null" && normalized !== "undefined"
}

const isCancelledStatus = (value: any) => String(value || "").trim().toLowerCase() === "cancelled"

const normalizeKey = (value: any) => String(value || "").trim().toLowerCase()

const hasCompletedProductionFlag = (value: any) => hasValue(value) && normalizeKey(value) !== "0"

const makeProductionRecordKey = (jobCardNo: any, orderNo: any, productName: any) =>
  `${normalizeKey(jobCardNo)}::${normalizeKey(orderNo)}::${normalizeKey(productName)}`

const getFirmMatchValues = (firm?: string) => {
  const firms = String(firm || "").split(',').map(f => f.trim()).filter(Boolean);
  return firms.flatMap(rawFirm => {
    const mappedFirm = Object.entries(FIRM_MAP).find(
      ([key, value]) => normalizeKey(key) === normalizeKey(rawFirm) || normalizeKey(value) === normalizeKey(rawFirm)
    )?.[1] || ""
    return [rawFirm, mappedFirm]
      .map((value) => normalizeKey(value))
      .filter(Boolean)
  });
}

const parseDDMMYYYY = (dateStr: string) => {
  if (!dateStr || dateStr === "-") return null
  const parts = dateStr.split('/')
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10)
    const month = parseInt(parts[1], 10) - 1
    const year = parseInt(parts[2], 10)
    const fullYear = year < 100 ? 2000 + year : year
    return new Date(fullYear, month, day)
  }
  return null
}

export default function ProductionPage() {
  const { user } = useAuth()
  const [pendingProductions, setPendingProductions] = useState<ProductionItem[]>([])
  const [historyProductions, setHistoryProductions] = useState<HistoryItem[]>([])
  const [compositions, setCompositions] = useState<CompositionItem[]>([])
  const [materialsList, setMaterialsList] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedJobCard, setSelectedJobCard] = useState<ProductionItem | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isCancelJcDialogOpen, setIsCancelJcDialogOpen] = useState(false)
  const [cancelJcRemarks, setCancelJcRemarks] = useState("")
  const [cancelJcQty, setCancelJcQty] = useState("")
  const [activeTab, setActiveTab] = useState("pending")
  const [visiblePendingColumns, setVisiblePendingColumns] = useState<Record<string, boolean>>({})
  const [visibleHistoryColumns, setVisibleHistoryColumns] = useState<Record<string, boolean>>({})
  const [formData, setFormData] = useState(initialFormData)
  // RM Summary states
  const [summaryStartDate, setSummaryStartDate] = useState("")
  const [summaryEndDate, setSummaryEndDate] = useState("")
  const [summaryProduct, setSummaryProduct] = useState("all")
  const [summaryMaterial, setSummaryMaterial] = useState("all")
  const [formErrors, setFormErrors] = useState<Record<string, string | null>>({})
  const [viewingMaterials, setViewingMaterials] = useState<{ rowId: number | string; materials: RawMaterial[] } | null>(null)
  const [editedViewingMaterials, setEditedViewingMaterials] = useState<RawMaterial[]>([])
  const [kycPriceMap, setKycPriceMap] = useState<Record<string, number>>({})
  const isAdmin = user?.role?.toLowerCase() === "admin"

  const [searchQuery, setSearchQuery] = useState("")
  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")


  useEffect(() => {
    const initializeVisibility = (columnsMeta: ColumnMeta[]) => {
      const visibility: Record<string, boolean> = {}
      columnsMeta.forEach((col) => {
        visibility[col.dataKey] = col.alwaysVisible !== false
      })
      return visibility
    }

    setVisiblePendingColumns(initializeVisibility(PENDING_COLUMNS_META))
    setVisibleHistoryColumns(initializeVisibility(HISTORY_COLUMNS_META))
  }, [])

  const loadAllData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [
        { data: jobCardsData, error: jobCardsErr },
        { data: kycData, error: kycErr },
        { data: actualProductionData, error: actualProdErr },
        { data: productionData, error: prodErr },
        { data: costingData, error: costingErr }
      ] = await Promise.all([
        supabase.from(JOBCARDS_TABLE).select("*"),
        supabase.from(KYC_TABLE).select("*"),
        supabase.from(ACTUAL_PRODUCTION_TABLE).select("*"),
        supabase.from(PRODUCTION_TABLE).select("*"),
        supabase.from(COSTING_RESPONSE_TABLE).select("*").order("id", { ascending: false })
      ])

      if (jobCardsErr) throw jobCardsErr
      if (kycErr) throw kycErr
      if (actualProdErr) throw actualProdErr
      if (prodErr) throw prodErr

      // 1. Process Actual Production Logs for History
      const actualProductionRecords = (actualProductionData || []).map((row: any) => {
        const materials = []
        for (let i = 1; i <= 20; i++) {
          const name = row[`Raw Material Name ${i}`]
          const quantity = row[`Quantity Of Raw Material ${i}`]
          if (name && String(name).trim() !== "") {
            materials.push({ 
              name: String(name).trim(), 
              quantity: quantity || 0 
            })
          }
        }
        
        return {
          id: row.id,
          jobCardNo: String(row["Job Card No."] || "").trim(),
          timestamp: row["Timestamp"] ? format(new Date(row["Timestamp"]), "dd/MM/yy HH:mm") : "",
          firmName: String(row["FIRM Name"] || "").trim(),
          dateOfProduction: row["Date Of Production"] ? format(new Date(row["Date Of Production"]), "dd/MM/yyyy") : "",
          supervisorName: String(row["Name Of Supervisor"] || "").trim(),
          productName: String(row["Product Name"] || "").trim(),
          orderNo: String(row["Order No."] || "").trim(),
          quantityFG: String(row["Quantity Of FG"] || ""),
          serialNumber: String(row["Serial Number"] || ""),
          machineHours: row["Machine Running hour"] || "-",
          remarks: row["Remarks1"] || "",
          rawMaterials: materials,
          status: String(row["Status"] || "active").toLowerCase(),
        }
      }).filter(r => r.jobCardNo)

      const productionRecordsMap = new Map()
      const productionRecordsByJobCard = new Map()
      actualProductionRecords.forEach(record => {
        productionRecordsMap.set(makeProductionRecordKey(record.jobCardNo, record.orderNo, record.productName), record)
        if (!productionRecordsByJobCard.has(record.jobCardNo)) productionRecordsByJobCard.set(record.jobCardNo, [])
        productionRecordsByJobCard.get(record.jobCardNo).push(record)
      })

      const findActualProductionRecord = (jobCardNo: string, orderNo: string, productName: string) => {
        const exact = productionRecordsMap.get(makeProductionRecordKey(jobCardNo, orderNo, productName))
        if (exact) return exact
        const jobCardRows = productionRecordsByJobCard.get(jobCardNo) || []
        return jobCardRows.find(
          (record: any) => normalizeKey(record.orderNo) === normalizeKey(orderNo) && normalizeKey(record.productName) === normalizeKey(productName)
        ) || jobCardRows.find(
          (record: any) => normalizeKey(record.productName) === normalizeKey(productName)
        ) || (jobCardRows.length === 1 ? jobCardRows[0] : null)
      }

      // 2. Process Pending Job Cards
      // Condition: Actual 1 is NOT null AND Time Delay 1 IS null (as per original logic)
      const findProductionInfo = (deliveryOrderNo: string, productName: string) => {
        const normalizedDo = normalizeKey(deliveryOrderNo)
        const normalizedProduct = normalizeKey(productName)
        const matchingDoRows = (productionData || []).filter(
          (p: any) => normalizeKey(p["Delivery Order No."]) === normalizedDo
        )
        return matchingDoRows.find((p: any) => {
          const pDo = normalizeKey(p["Delivery Order No."])
          const pProduct = normalizeKey(p["Product Name"])
          return pDo === normalizedDo && pProduct === normalizedProduct
        }) || (matchingDoRows.length === 1 ? matchingDoRows[0] : null)
      }

      const pending = (jobCardsData || [])
        .filter(row => {
          if (isCancelledStatus(row["Status"])) return false

          const targetQuantity = Number(row["Quantity"] || 0)
          const totalMade = Number(row["Total Made"] || 0)
          if (targetQuantity > 0) return totalMade < targetQuantity

          return !hasCompletedProductionFlag(row["Time Delay 1"])
        })
        .map((row: any) => {
          const prodInfo = findProductionInfo(
            String(row["Delivery Order No."] || ""),
            String(row["Product Name"] || "")
          )
          return {
            _rowIndex: row.id,
            productionId: prodInfo?.id ?? "",
            jobCardNo: String(row["JC-Job Card Number"] || ""),
            firmName: String(row["Firm Name"] || ""),
            supervisorName: String(row["Supervisor Name"] || ""),
            deliveryOrderNo: String(row["Delivery Order No."] || ""),
            partyName: String(row["Party Name"] || prodInfo?.["Party Name"] || ""),
            productName: String(row["Product Name"] || ""),
            orderQuantity: Number(row["Quantity"] || 0),
            totalMade: Number(row["Total Made"] || 0),
            dateOfProduction: row["Date Of Production"] ? format(new Date(row["Date Of Production"]), "dd/MM/yyyy") : "",
            plannedDate: row["Planned 1"] ? format(new Date(row["Planned 1"]), "dd/MM/yy") : "",
            shift: String(row["Shift"] || ""),
            notes: String(row["Notes"] || ""),
            quantity: Number(row["Quantity"] || 0),
            expectedDeliveryDate: prodInfo?.["Expected Delivery Date"] ? format(new Date(prodInfo["Expected Delivery Date"]), "dd/MM/yyyy") : "",
            priority: prodInfo?.["Priority"] || "",
            actualQuantity: 0,
            productRate: Number(prodInfo?.["product_rate"] || 0),
          }
        })
      const history = actualProductionRecords.map((productionRecord: any) => {
        const jcNo = productionRecord.jobCardNo
        const jobCard = (jobCardsData || []).find(
          (jc: any) =>
            normalizeKey(jc["JC-Job Card Number"]) === normalizeKey(jcNo) &&
            normalizeKey(jc["Firm Name"]) === normalizeKey(productionRecord.firmName) &&
            normalizeKey(jc["Delivery Order No."]) === normalizeKey(productionRecord.orderNo) &&
            normalizeKey(jc["Product Name"]) === normalizeKey(productionRecord.productName)
        ) || (jobCardsData || []).find(
          (jc: any) => normalizeKey(jc["JC-Job Card Number"]) === normalizeKey(jcNo)
        )
        const doNo = productionRecord.orderNo || jobCard?.["Delivery Order No."] || ""
        const prodInfo = findProductionInfo(doNo, productionRecord.productName)

        return {
          _rowIndex: productionRecord.id,
          productionId: prodInfo?.id ?? "",
          timestamp: productionRecord.timestamp || "",
          jobCardNo: jcNo,
          deliveryOrderNo: doNo,
          actualQuantity: Number(productionRecord.quantityFG || 0),
          expectedDeliveryDate: prodInfo?.["Expected Delivery Date"] ? format(new Date(prodInfo["Expected Delivery Date"]), "dd/MM/yyyy") : "",
          priority: prodInfo?.["Priority"] || "",
          dateOfProduction: productionRecord.dateOfProduction || "",
          supervisorName: productionRecord.supervisorName || "",
          shift: jobCard?.["Shift"] || "",
          totalMade: Number(jobCard?.["Total Made"] || 0),
          rawMaterials: productionRecord.rawMaterials as RawMaterial[],
          machineHours: String(productionRecord.machineHours || "-"),
          remarks: productionRecord.remarks || "",
          firmName: productionRecord.firmName || jobCard?.["Firm Name"] || "",
          partyName: jobCard?.["Party Name"] || prodInfo?.["Party Name"] || "",
          productName: productionRecord.productName || "",
          orderQuantity: Number(jobCard?.["Quantity"] || 0),
          quantity: Number(jobCard?.["Quantity"] || 0),
          plannedDate: "",
          notes: "",
          status: productionRecord.status,
          productRate: Number(prodInfo?.["product_rate"] || 0),
        } as HistoryItem
      })

      // Filter by Firm
      const filterByFirm = (data: any[]) => {
        if (!user?.firm || user?.role?.toLowerCase() === 'admin') return data;
        const firmSearchValues = getFirmMatchValues(user.firm);
        return data.filter(item => {
          const fName = normalizeKey(item.firmName);
          return firmSearchValues.some((firmSearch) => fName.includes(firmSearch) || firmSearch.includes(fName));
        });
      };

      setPendingProductions(filterByFirm(pending))
      setHistoryProductions(filterByFirm(history).sort((a, b) => b._rowIndex - a._rowIndex))

      // 4. Process KYC Materials + build price map
      const priceMap: Record<string, number> = {}
      ;(kycData || []).forEach((m: any) => {
        const name = String(m["Product name"] || "").trim()
        if (name) priceMap[name] = Number(m["Price"] || 0)
      })
      setKycPriceMap(priceMap)
      const materials = Object.keys(priceMap)
      setMaterialsList(materials)

      // 5. Process Compositions (with cost fields)
      const processedCompositions = (costingData || []).map((row: any) => {
        const compositionMaterials = []
        for (let i = 1; i <= 20; i++) {
          const name = row[`RM${i}`]
          const percentage = row[`QTY${i}`]
          if (name && String(name).trim() !== "") {
            compositionMaterials.push({
              name: String(name).trim(),
              percentage: Number(percentage || 0)
            })
          }
        }
        return {
          id: row.id,
          compositionNo: row["Composition No."],
          orderNo: row["Order No."] ? String(row["Order No."]).trim() : "",
          productName: row["product name"] ? String(row["product name"]).trim() : "",
          materials: compositionMaterials,
          variableCost: Number(row["VARIABLE COST"] || 0),
          manufacturingCost: Number(row["Manufacturing Cost"] || 0),
          sellingPrice: Number(row["SELLING PRICE"] || 0),
        }
      })
      setCompositions(processedCompositions)

    } catch (err: any) {
      console.error("Error in loadAllData:", err)
      setError(`Failed to load data. Error: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }, [user?.firm, user?.role])

  useEffect(() => {
    loadAllData()
  }, [loadAllData])

  const filteredPending = useMemo(() => {
    return pendingProductions.filter((item) => {
      // 1. Search Query filter
      const matchesSearch = searchQuery.trim() === "" || [
        item.jobCardNo,
        item.partyName,
        item.productName,
        item.deliveryOrderNo,
        item.supervisorName,
        item.firmName
      ].some(val => String(val || "").toLowerCase().includes(searchQuery.toLowerCase().trim()))

      // 2. Date Range filter (on dateOfProduction)
      let matchesDate = true
      if (fromDate || toDate) {
        if (item.dateOfProduction) {
          const itemDate = parseDDMMYYYY(item.dateOfProduction)
          if (itemDate) {
            if (fromDate) {
              const from = new Date(fromDate)
              from.setHours(0, 0, 0, 0)
              if (itemDate < from) matchesDate = false
            }
            if (toDate) {
              const to = new Date(toDate)
              to.setHours(23, 59, 59, 999)
              if (itemDate > to) matchesDate = false
            }
          } else {
            matchesDate = false
          }
        } else {
          matchesDate = false
        }
      }

      return matchesSearch && matchesDate
    })
  }, [pendingProductions, searchQuery, fromDate, toDate])

  const filteredHistory = useMemo(() => {
    return historyProductions.filter((item) => {
      // 1. Search Query filter
      const matchesSearch = searchQuery.trim() === "" || [
        item.jobCardNo,
        item.partyName,
        item.productName,
        item.deliveryOrderNo,
        item.supervisorName,
        item.firmName,
        item.remarks
      ].some(val => String(val || "").toLowerCase().includes(searchQuery.toLowerCase().trim()))

      // 2. Date Range filter (on dateOfProduction)
      let matchesDate = true
      if (fromDate || toDate) {
        if (item.dateOfProduction) {
          const itemDate = parseDDMMYYYY(item.dateOfProduction)
          if (itemDate) {
            if (fromDate) {
              const from = new Date(fromDate)
              from.setHours(0, 0, 0, 0)
              if (itemDate < from) matchesDate = false
            }
            if (toDate) {
              const to = new Date(toDate)
              to.setHours(23, 59, 59, 999)
              if (itemDate > to) matchesDate = false
            }
          } else {
            matchesDate = false
          }
        } else {
          matchesDate = false
        }
      }

      return matchesSearch && matchesDate
    })
  }, [historyProductions, searchQuery, fromDate, toDate])

  const pendingTotalMadeQty = useMemo(
    () => filteredPending.reduce((total, item) => total + (Number(item.totalMade) || 0), 0),
    [filteredPending]
  )

  const historyTotalMadeQty = useMemo(
    () => filteredHistory.reduce((total, item) => total + (Number(item.actualQuantity) || 0), 0),
    [filteredHistory]
  )

  const uniqueProducts = useMemo(() => {
    const products = new Set<string>()
    historyProductions.forEach(p => {
      if (p.status !== "cancelled" && p.productName) products.add(p.productName.trim())
    })
    return Array.from(products).sort()
  }, [historyProductions])

  const uniqueMaterials = useMemo(() => {
    const mats = new Set<string>()
    historyProductions.forEach(p => {
      if (p.status !== "cancelled") {
        p.rawMaterials.forEach(rm => {
          if (rm.name && rm.name.trim() !== "" && Number(rm.quantity) > 0) mats.add(rm.name.trim())
        })
      }
    })
    return Array.from(mats).sort()
  }, [historyProductions])

  const materialSummaryData = useMemo(() => {
    if (!summaryStartDate && !summaryEndDate && !summaryMaterial && !summaryProduct) {
      return { totalQty: 0, matchingRuns: [] }
    }

    let totalQty = 0
    const matchingRuns: any[] = []

    historyProductions.forEach((run) => {
      if (run.status === "cancelled") return

      if (run.dateOfProduction) {
        const itemDate = parseDDMMYYYY(run.dateOfProduction)
        if (itemDate) {
          if (summaryStartDate) {
            const start = new Date(summaryStartDate)
            start.setHours(0, 0, 0, 0)
            if (itemDate < start) return
          }
          if (summaryEndDate) {
            const end = new Date(summaryEndDate)
            end.setHours(23, 59, 59, 999)
            if (itemDate > end) return
          }
        } else {
          return
        }
      } else {
        return
      }

      if (summaryProduct && summaryProduct !== "all") {
        if (normalizeKey(run.productName) !== normalizeKey(summaryProduct)) {
          return
        }
      }

      let materialQtyFound = 0
      let hasMaterial = false

      if (summaryMaterial && summaryMaterial !== "all") {
        const targetMatNormalized = normalizeKey(summaryMaterial)
        const matchedMat = run.rawMaterials.find(rm => normalizeKey(rm.name) === targetMatNormalized)
        if (matchedMat) {
          materialQtyFound = Number(matchedMat.quantity) || 0
          hasMaterial = true
        }
      } else {
        run.rawMaterials.forEach(rm => {
          materialQtyFound += Number(rm.quantity) || 0
        })
        hasMaterial = run.rawMaterials.length > 0
      }

      if (hasMaterial) {
        totalQty += materialQtyFound
        matchingRuns.push({
          ...run,
          specificMaterialQty: materialQtyFound
        })
      }
    })

    return { totalQty, matchingRuns }
  }, [historyProductions, summaryStartDate, summaryEndDate, summaryProduct, summaryMaterial])

  const summaryFGQty = useMemo(() => {
    return materialSummaryData.matchingRuns.reduce((sum, run) => sum + (Number(run.actualQuantity) || 0), 0)
  }, [materialSummaryData])

  const handleOpenDialog = (jobCard: ProductionItem) => {
    setSelectedJobCard(jobCard)
    const parsedProductionDate = jobCard.dateOfProduction
      ? format(new Date(jobCard.dateOfProduction.split('/').reverse().join('-')), "yyyy-MM-dd")
      : format(new Date(), "yyyy-MM-dd")
    setFormData({ ...initialFormData, productionDate: parsedProductionDate })
    setFormErrors({})
    setIsDialogOpen(true)
  }

  const handleRemoveMaterial = (index: number) => {
    setFormData((prev) => ({ ...prev, rawMaterials: prev.rawMaterials.filter((_, i) => i !== index) }))
  }

  const findMatchingComposition = (orderNo?: string, productName?: string) => {
    const normalizedOrderNo = normalizeKey(orderNo)
    const normalizedProductName = normalizeKey(productName)
    const matchingOrderRows = compositions.filter((c) => normalizeKey(c.orderNo) === normalizedOrderNo)
    return matchingOrderRows.find(
      (c) => normalizeKey(c.orderNo) === normalizedOrderNo && normalizeKey(c.productName) === normalizedProductName
    ) || compositions.find(
      (c) => normalizeKey(c.productName) === normalizedProductName
    ) || (matchingOrderRows.length === 1 ? matchingOrderRows[0] : undefined)
  }

  const validateForm = () => {
    const errors: Record<string, string> = {}
    if (!formData.quantityFG || Number(formData.quantityFG) <= 0)
      errors.quantityFG = "Valid Finished Goods quantity is required."
    if (formData.rawMaterials.length === 0) errors.rawMaterials = "At least one raw material is required."
    // const timeRegex = /^(?:2[0-3]|[01]?[0-9]):[0-5]?[0-9]:[0-5]?[0-9]$/
    // if (!formData.machineRunningHour || !timeRegex.test(formData.machineRunningHour)) {
    //   errors.machineRunningHour = "Machine running hour must be in HH:MM:SS format."
    // }
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateForm()) return

    if (!selectedJobCard || !selectedJobCard.jobCardNo) {
      alert("Error: Missing job card details. Please refresh.")
      return
    }

    setIsSubmitting(true)
    try {
      // 1. Get last serial number
      const { data: lastLog, error: logErr } = await supabase
        .from(ACTUAL_PRODUCTION_TABLE)
        .select("Serial Number")
        .order("id", { ascending: false })
        .limit(1)

      if (logErr) throw logErr
      const lastSerialNumber = Number((lastLog as any)?.[0]?.["Serial Number"] || 0)
      const newSerialNumber = lastSerialNumber + 1

      // 2. Compute cost & profit fields
      const fgQtyNum = Number(formData.quantityFG) || 0
      const currentOrderNo = selectedJobCard.deliveryOrderNo?.trim()
      const matchedComp = findMatchingComposition(currentOrderNo, selectedJobCard.productName)

      const expectedRMCost = (matchedComp?.materials || []).reduce((sum, m) => {
        return sum + (fgQtyNum * (m.percentage / 100) * (kycPriceMap[m.name] || 0))
      }, 0)
      const actualRMCost = formData.rawMaterials.reduce((sum, rm) => {
        return sum + ((Number(rm.quantity) || 0) * (kycPriceMap[rm.name] || 0))
      }, 0)
      const mfgCostTotal = (matchedComp?.manufacturingCost || 0) * fgQtyNum
      const sellingPriceTotal = (selectedJobCard.productRate || 0) * fgQtyNum
      const expectedProfit = sellingPriceTotal - (expectedRMCost + mfgCostTotal)
      const actualProfit   = sellingPriceTotal - (actualRMCost  + mfgCostTotal)
      const profitVariance = actualProfit - expectedProfit

      // 3. Prepare actual production record
      const productionRecord: any = {
        "Timestamp": new Date().toISOString(),
        "Job Card No.": selectedJobCard.jobCardNo,
        "FIRM Name": selectedJobCard.firmName,
        "Date Of Production": formData.productionDate || format(new Date(), "yyyy-MM-dd"),
        "Name Of Supervisor": selectedJobCard.supervisorName,
        "Product Name": selectedJobCard.productName,
        "Quantity Of FG": fgQtyNum,
        "Party Name": selectedJobCard.partyName,
        "Serial Number": String(newSerialNumber),
        "Machine Running hour": Number(formData.machineRunningHour) || 0,
        "Remarks1": formData.remarks || "",
        "Order No.": selectedJobCard.deliveryOrderNo,
        "Planned1": format(new Date(), "yyyy-MM-dd"),
        // Cost & profit fields (requires DB columns – see SQL migration)
        "expected_cost": expectedRMCost,
        "actual_cost": actualRMCost,
        "manufacturing_cost_used": mfgCostTotal,
        "selling_price_total": sellingPriceTotal,
        "expected_profit": expectedProfit,
        "actual_profit": actualProfit,
        "profit_variance": profitVariance,
      }

      // Add raw materials (up to 20)
      for (let i = 0; i < 20; i++) {
        if (formData.rawMaterials[i]) {
          productionRecord[`Raw Material Name ${i + 1}`] = formData.rawMaterials[i].name
          productionRecord[`Quantity Of Raw Material ${i + 1}`] = Number(formData.rawMaterials[i].quantity)
        }
      }

      // 3. Insert log
      const { error: insertErr } = await supabase
        .from(ACTUAL_PRODUCTION_TABLE)
        .insert([productionRecord])

      if (insertErr) throw insertErr

      // 4. Update Job Card status to move it to history if fully produced
      const newTotalMade = (selectedJobCard.totalMade || 0) + Number(formData.quantityFG)
      const isFullyProduced = newTotalMade >= (selectedJobCard.quantity || 0)

      const updatePayload: any = {
        "Total Made": newTotalMade,
        "Actual 1": isFullyProduced ? new Date().toISOString() : null,
        "Planned 2": isFullyProduced ? format(new Date(), "yyyy-MM-dd") : null,
        "Time Delay 1": isFullyProduced ? 1 : null
      }

      const { error: updateJCErr } = await supabase
        .from(JOBCARDS_TABLE)
        .update(updatePayload)
        .eq("id", selectedJobCard._rowIndex)

      if (updateJCErr) throw updateJCErr

      // 5. Update Production table (Total Done)
      const { data: currentProdRows } = await supabase
        .from(PRODUCTION_TABLE)
        .select("*")
        .eq('"Delivery Order No."', selectedJobCard.deliveryOrderNo)

      const currentProd = (currentProdRows || []).find(
        (row: any) => normalizeKey(row["Product Name"]) === normalizeKey(selectedJobCard.productName)
      ) || ((currentProdRows || []).length === 1 ? (currentProdRows as any[])[0] : null)
      
      const newTotalDone = Number((currentProd as any)?.["Actual Production Done"] || 0) + Number(formData.quantityFG)
      
      if ((currentProd as any)?.id) {
        await supabase
          .from(PRODUCTION_TABLE)
          .update({ "Actual Production Done": newTotalDone })
          .eq("id", (currentProd as any).id)
      }

      alert("Production data saved successfully!")
      setIsDialogOpen(false)
      await loadAllData()
    } catch (err: any) {
      console.error(err)
      setError(err.message)
      alert(`Error: ${err.message}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  const ColumnToggler = ({ tab, columnsMeta }: { tab: string; columnsMeta: ColumnMeta[] }) => (
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

  const handleToggleColumn = (tab: string, dataKey: string, checked: boolean) => {
    const setter = tab === "pending" ? setVisiblePendingColumns : setVisibleHistoryColumns
    setter((prev) => ({ ...prev, [dataKey]: checked }))
  }

  const handleSelectAllColumns = (tab: string, columnsMeta: ColumnMeta[], checked: boolean) => {
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

  const renderRawMaterials = (item: HistoryItem) => {
    const materials = item.rawMaterials
    if (!materials || materials.length === 0) {
      return "-";
    }
  
    return (
      <Button
        variant="outline"
        size="sm"
        className="h-7 text-xs bg-transparent"
        onClick={(e) => {
          e.stopPropagation();
          setViewingMaterials({ rowId: item._rowIndex, materials });
          setEditedViewingMaterials(materials.map((material) => ({ ...material })));
        }}
      >
        <Eye className="h-3.5 w-3.5 mr-1.5" />
        View ({materials.length})
      </Button>
    );
  };

  const handleSaveViewingMaterials = async () => {
    if (!viewingMaterials || !isAdmin) return
    setIsSubmitting(true)
    try {
      const updatePayload: Record<string, any> = {}
      for (let i = 0; i < 20; i++) {
        const material = editedViewingMaterials[i]
        updatePayload[`Raw Material Name ${i + 1}`] = material?.name ? String(material.name).trim() : null
        updatePayload[`Quantity Of Raw Material ${i + 1}`] = material?.quantity === "" || material?.quantity === undefined
          ? null
          : Number(material.quantity) || 0
      }

      const { error: updateError } = await supabase
        .from(ACTUAL_PRODUCTION_TABLE)
        .update(updatePayload)
        .eq("id", viewingMaterials.rowId)

      if (updateError) throw updateError

      setViewingMaterials(null)
      setEditedViewingMaterials([])
      await loadAllData()
    } catch (err: any) {
      setError(err.message)
      alert(`Error: ${err.message}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleOpenCancelJcFromPending = (item: ProductionItem) => {
    setSelectedJobCard(item)
    setCancelJcRemarks("")
    setCancelJcQty(String((item.quantity || 0) - (item.totalMade || 0)))
    setIsCancelJcDialogOpen(true)
  }

  const handleCancelJcSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedJobCard) return
    if (!cancelJcQty || Number(cancelJcQty) <= 0) {
      alert("Please enter a valid cancel quantity")
      return
    }
    if (!cancelJcRemarks.trim()) {
      alert("Please enter reason for cancellation")
      return
    }

    setIsSubmitting(true)
    try {
      const currentNotes = selectedJobCard.notes || ""
      const updatedNotes = currentNotes 
        ? `${currentNotes}\nCancelled: ${cancelJcRemarks} (Qty: ${cancelJcQty})` 
        : `Cancelled: ${cancelJcRemarks} (Qty: ${cancelJcQty})`

      const { error } = await supabase
        .from(JOBCARDS_TABLE)
        .update({
          Status: "cancelled",
          Notes: updatedNotes
        })
        .eq("id", selectedJobCard._rowIndex)

      if (error) throw error

      alert(`Job Card ${selectedJobCard.jobCardNo} cancelled successfully!`)
      setIsCancelJcDialogOpen(false)
      setIsDialogOpen(false)
      await loadAllData()
    } catch (err: any) {
      console.error("Cancel job card error:", err)
      alert(`Error: ${err.message}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (loading)
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-olive-600" />
        <p className="ml-4 text-lg">Loading Production Data...</p>
      </div>
    )

  if (error)
    return (
      <div className="p-8 text-center text-red-600 bg-red-50 rounded-md">
        <AlertTriangle className="h-12 w-12 mx-auto mb-4" />
        <p className="text-lg font-semibold">Error Loading Data</p>
        <p className="text-sm">{error}</p>
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
            <Factory className="h-6 w-6 text-olive-600" />
            Production Management
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Log production details for ready job cards.</p>
        </div>
      </div>
      <Card className="border-none shadow-sm bg-white">
        <CardContent className="p-2 sm:p-4 lg:p-6">
          {/* Filters Bar */}
          <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row flex-wrap gap-4 items-end mb-6">
            <div className="space-y-1.5 flex-1 min-w-[200px]">
              <Label htmlFor="search" className="text-xs font-bold text-slate-600 uppercase tracking-wider">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  id="search"
                  placeholder="Search JC, DO, Product..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 h-10 rounded-xl border-slate-200 bg-white focus:ring-olive-500/20"
                />
              </div>
            </div>

            <div className="space-y-1.5 w-full sm:w-[150px]">
              <Label htmlFor="fromDate" className="text-xs font-bold text-slate-600 uppercase tracking-wider">From Date</Label>
              <Input
                id="fromDate"
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="h-10 rounded-xl border-slate-200 bg-white focus:ring-olive-500/20"
              />
            </div>

            <div className="space-y-1.5 w-full sm:w-[150px]">
              <Label htmlFor="toDate" className="text-xs font-bold text-slate-600 uppercase tracking-wider">To Date</Label>
              <Input
                id="toDate"
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="h-10 rounded-xl border-slate-200 bg-white focus:ring-olive-500/20"
              />
            </div>

            <div className="w-full sm:w-auto">
              <Button
                variant="outline"
                type="button"
                onClick={() => {
                  setSearchQuery("")
                  setFromDate("")
                  setToDate("")
                }}
                className="h-10 px-4 rounded-xl border-slate-200 hover:bg-slate-50 font-semibold text-sm w-full bg-white whitespace-nowrap"
                disabled={!searchQuery && !fromDate && !toDate}
              >
                Clear Filters
              </Button>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
              <TabsList className="grid w-full sm:w-[600px] grid-cols-3 p-1 bg-slate-100 rounded-xl">
                <TabsTrigger value="pending" className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-olive-700 data-[state=active]:shadow-sm transition-all">
                  <Factory className="h-4 w-4 mr-2" /> Pending
                  <Badge variant="secondary" className="ml-1.5 px-1.5 py-0.5 text-xs">
                    {searchQuery || fromDate || toDate ? `${filteredPending.length} / ${pendingProductions.length}` : pendingProductions.length}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="history" className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-olive-700 data-[state=active]:shadow-sm transition-all">
                  <History className="h-4 w-4 mr-2" /> History
                  <Badge variant="secondary" className="ml-1.5 px-1.5 py-0.5 text-xs">
                    {searchQuery || fromDate || toDate ? `${filteredHistory.length} / ${historyProductions.length}` : historyProductions.length}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="rm-summary" className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-olive-700 data-[state=active]:shadow-sm transition-all">
                  <Search className="h-4 w-4 mr-2" /> RM Summary
                  <Badge variant="secondary" className="ml-1.5 px-1.5 py-0.5 text-xs">
                    {materialSummaryData.matchingRuns.length}
                  </Badge>
                </TabsTrigger>
              </TabsList>
              <div className="text-sm font-semibold text-slate-700 sm:text-right">
                Total Made Qty:{" "}
                <span className="text-olive-700">
                  {(activeTab === "pending"
                    ? pendingTotalMadeQty
                    : activeTab === "history"
                      ? historyTotalMadeQty
                      : summaryFGQty
                  ).toLocaleString()}
                </span>
              </div>
            </div>

            <TabsContent value="pending" className="mt-0">
              <Card className="shadow-sm border-border">
                <CardHeader className="py-2 px-3 bg-olive-50/70 rounded-t-lg">
                  <CardTitle className="text-base font-semibold">Pending Items</CardTitle>
                  <ColumnToggler tab="pending" columnsMeta={PENDING_COLUMNS_META} />
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {visiblePendingColumnsMeta.map((col) => (
                            <TableHead key={col.dataKey}>{col.header}</TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredPending.length > 0 ? (
                          filteredPending.map((jobCard) => (
                            <TableRow key={jobCard._rowIndex} className="hover:bg-olive-50/50 transition-colors">
                              {visiblePendingColumnsMeta.map((col) => (
                                <TableCell key={col.dataKey} className="whitespace-nowrap text-sm py-2 px-3">
                                  {col.dataKey === "actionColumn" ? (
                                    <Button
                                      size="sm"
                                      onClick={() => handleOpenDialog(jobCard)}
                                      className="bg-olive-600 text-white hover:bg-olive-700"
                                    >
                                      <Factory className="mr-2 h-4 w-4" />
                                      Log
                                    </Button>
                                  ) : (
                                    (jobCard as any)[col.dataKey] || "-"
                                  )}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={visiblePendingColumnsMeta.length} className="h-24 text-center">
                              No pending items found.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="history" className="mt-0">
              <Card className="shadow-sm border-border">
                <CardHeader className="py-2 px-3 bg-olive-50/70 rounded-t-lg">
                  <CardTitle className="text-base font-semibold">Production History</CardTitle>
                  <ColumnToggler tab="history" columnsMeta={HISTORY_COLUMNS_META} />
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {visibleHistoryColumnsMeta.map((col) => (
                            <TableHead key={col.dataKey}>{col.header}</TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredHistory.length > 0 ? (
                          filteredHistory.map((item) => (
                            <TableRow key={item._rowIndex} className="hover:bg-olive-50/50 transition-colors">
                              {visibleHistoryColumnsMeta.map((col) => (
                                <TableCell key={col.dataKey} className="whitespace-nowrap text-sm py-2 px-3">
                                  {col.dataKey === "rawMaterials"
                                    ? renderRawMaterials(item)
                                    : col.dataKey === "machineHours"
                                      ? formatMachineHours((item as any)[col.dataKey])
                                      : (item as any)[col.dataKey] || "-"}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={visibleHistoryColumnsMeta.length} className="h-24 text-center">
                              No history found.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="rm-summary" className="mt-0">
              <Card className="shadow-sm border-border bg-white rounded-xl">
                <CardHeader className="py-3 px-4 bg-olive-50/70 rounded-t-lg border-b border-slate-100 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-semibold text-slate-800">Raw Material Consumption Summary</CardTitle>
                    <CardDescription className="text-xs text-slate-500 mt-0.5">Calculate total consumption of raw materials within a date range.</CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                  {/* Filters inside tab */}
                  <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-200 shadow-inner grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    <div className="space-y-1.5">
                      <Label htmlFor="sumFromDate" className="text-xs font-bold text-slate-600 uppercase tracking-wider">Start Date</Label>
                      <Input
                        id="sumFromDate"
                        type="date"
                        value={summaryStartDate}
                        onChange={(e) => setSummaryStartDate(e.target.value)}
                        className="h-10 rounded-xl border-slate-200 bg-white focus:ring-olive-500/20"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="sumToDate" className="text-xs font-bold text-slate-600 uppercase tracking-wider">End Date</Label>
                      <Input
                        id="sumToDate"
                        type="date"
                        value={summaryEndDate}
                        onChange={(e) => setSummaryEndDate(e.target.value)}
                        className="h-10 rounded-xl border-slate-200 bg-white focus:ring-olive-500/20"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Product Name</Label>
                      <Select value={summaryProduct} onValueChange={setSummaryProduct}>
                        <SelectTrigger className="h-10 rounded-xl border-slate-200 bg-white">
                          <SelectValue placeholder="All Products" />
                        </SelectTrigger>
                        <SelectContent className="max-h-60">
                          <SelectItem value="all">All Products</SelectItem>
                          {uniqueProducts.map((p) => (
                            <SelectItem key={p} value={p}>
                              {p}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Raw Material Name</Label>
                      <Select value={summaryMaterial} onValueChange={setSummaryMaterial}>
                        <SelectTrigger className="h-10 rounded-xl border-slate-200 bg-white">
                          <SelectValue placeholder="Select Raw Material" />
                        </SelectTrigger>
                        <SelectContent className="max-h-60">
                          <SelectItem value="all">All Materials</SelectItem>
                          {uniqueMaterials.map((m) => (
                            <SelectItem key={m} value={m}>
                              {m}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex flex-col md:flex-row justify-between gap-4">
                    <div className="w-full md:w-1/3">
                      <div className="bg-gradient-to-r from-olive-50 to-olive-100/50 p-6 rounded-2xl border border-olive-200/60 shadow-sm flex flex-col justify-center items-center text-center h-full min-h-[160px]">
                        <p className="text-xs font-bold text-olive-800 uppercase tracking-widest mb-1">Total Consumption</p>
                        <p className="text-4xl font-black text-olive-900">
                          {materialSummaryData.totalQty.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                        </p>
                        {summaryMaterial && summaryMaterial !== "all" ? (
                          <p className="text-xs text-olive-700 mt-1.5 font-medium">
                            of <span className="font-bold">{summaryMaterial}</span>
                          </p>
                        ) : (
                          <p className="text-xs text-olive-700 mt-1.5 font-medium">of All Raw Materials</p>
                        )}
                        {(summaryStartDate || summaryEndDate) && (
                          <p className="text-[10px] text-slate-400 mt-2">
                            {summaryStartDate ? format(new Date(summaryStartDate), "dd/MM/yyyy") : "Start"} — {summaryEndDate ? format(new Date(summaryEndDate), "dd/MM/yyyy") : "End"}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="w-full md:w-2/3 flex flex-col justify-end">
                      <div className="flex gap-3 justify-end mb-1">
                        <Button
                          variant="outline"
                          type="button"
                          onClick={() => {
                            setSummaryStartDate("")
                            setSummaryEndDate("")
                            setSummaryProduct("all")
                            setSummaryMaterial("all")
                          }}
                          className="h-10 px-4 rounded-xl border-slate-200 hover:bg-slate-50 font-semibold text-sm bg-white"
                          disabled={!summaryStartDate && !summaryEndDate && summaryProduct === "all" && summaryMaterial === "all"}
                        >
                          Reset Summary Filters
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Matching logs table */}
                  <div className="border rounded-xl overflow-hidden shadow-sm">
                    <Table>
                      <TableHeader className="bg-slate-50">
                        <TableRow>
                          {visibleHistoryColumnsMeta.map((col) => (
                            <TableHead key={col.dataKey}>{col.header}</TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {materialSummaryData.matchingRuns.length > 0 ? (
                          materialSummaryData.matchingRuns.map((item) => (
                            <TableRow key={item._rowIndex} className="hover:bg-olive-50/50 transition-colors">
                              {visibleHistoryColumnsMeta.map((col) => (
                                <TableCell key={col.dataKey} className="whitespace-nowrap text-sm py-2 px-3">
                                  {col.dataKey === "rawMaterials"
                                    ? renderRawMaterials(item)
                                    : col.dataKey === "machineHours"
                                      ? formatMachineHours((item as any)[col.dataKey])
                                      : (item as any)[col.dataKey] || "-"}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={visibleHistoryColumnsMeta.length} className="h-32 text-center text-slate-400 italic">
                              No matching production runs found for the selected criteria.
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

      <Dialog open={!!viewingMaterials} onOpenChange={(isOpen) => {
        if (!isOpen) {
          setViewingMaterials(null)
          setEditedViewingMaterials([])
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Raw Materials Used</DialogTitle>
            <DialogDescription>Full list of materials and quantities used for this production run.</DialogDescription>
          </DialogHeader>
          <div className="mt-4 max-h-80 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Material Name</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(isAdmin ? editedViewingMaterials : viewingMaterials?.materials || []).map((material, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      {material.name}
                    </TableCell>
                    <TableCell className="text-right">
                      {isAdmin ? (
                        <Input
                          type="number"
                          step="any"
                          value={material.quantity}
                          onChange={(e) => {
                            const updated = [...editedViewingMaterials]
                            updated[index] = { ...updated[index], quantity: e.target.value }
                            setEditedViewingMaterials(updated)
                          }}
                          className="text-right"
                        />
                      ) : (
                        material.quantity
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {(() => {
            const activeMaterials = isAdmin ? editedViewingMaterials : viewingMaterials?.materials || [];

            const totalQty = activeMaterials.reduce((sum, material) => {
              const nameLower = (material.name || "").trim().toLowerCase();
              if (
                nameLower === "shmp" ||
                nameLower === "ppf" ||
                nameLower === "ssf 304" ||
                nameLower === "ssf 310" ||
                nameLower === "pp bag (25 kgs)" ||
                nameLower === "pp bag (50 kgs)" ||
                nameLower === "ton bag(1 ton)" ||
                nameLower === "pp bag 25kg" ||
                nameLower === "pp bag 25 kg"
              ) {
                return sum;
              }
              return sum + (Number(material.quantity) || 0);
            }, 0);

            const viewedItem = historyProductions.find(item => item._rowIndex === viewingMaterials?.rowId);
            const fgQuantity = viewedItem ? (Number(viewedItem.actualQuantity) || 0) : 0;

            const roundedTotal = Number(totalQty.toFixed(2));
            const roundedFG = Number(fgQuantity.toFixed(2));

            const isExceeded = roundedFG > 0 && roundedTotal > roundedFG;
            const isLow = roundedFG > 0 && roundedTotal > 0 && roundedTotal < roundedFG;



            // Find specific quantities for PP Bags, PPF, SHMP
            const pp25 = activeMaterials.find(m => (m.name || "").trim().toLowerCase() === "pp bag (25 kgs)");
            const pp50 = activeMaterials.find(m => (m.name || "").trim().toLowerCase() === "pp bag (50 kgs)");
            const pp25kg = activeMaterials.find(m => {
              const nameLower = (m.name || "").trim().toLowerCase();
              return nameLower === "pp bag 25kg" || nameLower === "pp bag 25 kg";
            });
            const shmp = activeMaterials.find(m => (m.name || "").trim().toLowerCase() === "shmp");
            const ppf = activeMaterials.find(m => (m.name || "").trim().toLowerCase() === "ppf");

            const pp25Qty = pp25 ? (Number(pp25.quantity) || 0) : 0;
            const pp50Qty = pp50 ? (Number(pp50.quantity) || 0) : 0;
            const pp25kgQty = pp25kg ? (Number(pp25kg.quantity) || 0) : 0;
            const shmpQty = shmp ? (Number(shmp.quantity) || 0) : 0;
            const ppfQty = ppf ? (Number(ppf.quantity) || 0) : 0;

            return (
              <div className="mt-4 pt-4 border-t space-y-2 text-sm font-semibold text-slate-800">
                <div className={`flex justify-between border-b pb-1 ${isExceeded ? "text-red-600 bg-red-50 p-1.5 rounded-lg border border-red-200" : isLow ? "text-orange-600 bg-orange-50 p-1.5 rounded-lg border border-orange-200" : ""}`}>
                  <span>Total Qty :</span>
                  <span>{totalQty.toFixed(2)}</span>
                </div>
                {(pp25Qty > 0 || pp50Qty > 0 || pp25kgQty > 0) && (
                  <div className="space-y-1 pt-1">
                    <div className="text-xs text-slate-400 uppercase tracking-wider font-bold">Packaging Bags</div>
                    {pp25Qty > 0 && (
                      <div className="flex justify-between text-slate-600 font-medium pl-2">
                        <span>PP Bag (25 kgs):</span>
                        <span>{pp25Qty}</span>
                      </div>
                    )}
                    {pp50Qty > 0 && (
                      <div className="flex justify-between text-slate-600 font-medium pl-2">
                        <span>Pp Bag (50 kgs):</span>
                        <span>{pp50Qty}</span>
                      </div>
                    )}
                    {pp25kgQty > 0 && (
                      <div className="flex justify-between text-slate-600 font-medium pl-2">
                        <span>PP BAG 25KG:</span>
                        <span>{pp25kgQty}</span>
                      </div>
                    )}
                  </div>
                )}
                {(shmpQty > 0 || ppfQty > 0) && (
                  <div className="space-y-1 pt-1 border-t border-dashed mt-1">
                    <div className="text-xs text-slate-400 uppercase tracking-wider font-bold">Excluded Additives</div>
                    {shmpQty > 0 && (
                      <div className="flex justify-between text-slate-600 font-medium pl-2">
                        <span>SHMP:</span>
                        <span>{shmpQty}</span>
                      </div>
                    )}
                    {ppfQty > 0 && (
                      <div className="flex justify-between text-slate-600 font-medium pl-2">
                        <span>PPF:</span>
                        <span>{ppfQty}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })()}
          {isAdmin && (
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setViewingMaterials(null)
                  setEditedViewingMaterials([])
                }}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="button" onClick={handleSaveViewingMaterials} disabled={isSubmitting}>
                {isSubmitting ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Log Production for JC: {selectedJobCard?.jobCardNo}</DialogTitle>
            <DialogDescription>Enter the final production details. Fields with * are required.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-6 p-1">
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4 p-4 border rounded-lg bg-muted/50">
              <div>
                <Label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">DO No.</Label>
                <p className="text-sm font-bold text-olive-800">{selectedJobCard?.deliveryOrderNo}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Party Name</Label>
                <p className="text-sm font-medium">{selectedJobCard?.partyName}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Product</Label>
                <p className="text-sm font-medium">{selectedJobCard?.productName}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Supervisor</Label>
                <p className="text-sm font-medium">{selectedJobCard?.supervisorName}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Total Qty</Label>
                <p className="text-sm font-bold text-blue-800">{selectedJobCard?.quantity ?? 0}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Pending Qty</Label>
                <p className="text-sm font-bold text-red-800 border-none bg-transparent">
                  {Math.max(0, (selectedJobCard?.quantity || 0) - (selectedJobCard?.totalMade || 0))}
                </p>
              </div>
            </div>
            
            {/* ── MAJOR INPUT: FG Quantity ── */}
            <div className="bg-indigo-50/50 border-2 border-indigo-100 rounded-2xl p-8 shadow-sm flex flex-col items-center transition-all hover:border-indigo-200">
              <Label 
                htmlFor="qtyFG_major" 
                className="text-sm font-black text-indigo-900 uppercase tracking-widest mb-4 flex items-center gap-2"
              >
                <Factory className="h-4 w-4 text-indigo-600" />
                Finished Goods (FG) Quantity Produced <span className="text-red-500">*</span>
              </Label>
              <div className="relative w-full max-w-[280px]">
                <Input
                  id="qtyFG_major"
                  type="number"
                  min="0"
                  step="0.01"
                  className={`h-20 text-4xl font-black text-center rounded-2xl shadow-xl transition-all ${
                    formErrors.quantityFG 
                      ? "border-red-500 ring-2 ring-red-100 focus-visible:ring-red-500 text-red-700" 
                      : "border-indigo-200 focus-visible:ring-indigo-500 text-indigo-700 bg-white"
                  }`}
                  placeholder="0.00"
                  value={formData.quantityFG}
                  onChange={(e) => setFormData({ ...formData, quantityFG: e.target.value })}
                />
                <div className="absolute -bottom-6 left-0 right-0 text-center">
                  {formErrors.quantityFG ? (
                    <p className="text-[10px] text-red-600 font-bold uppercase tracking-tighter">{formErrors.quantityFG}</p>
                  ) : (
                    <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-tighter">Enter total quantity made in this run</p>
                  )}
                </div>
              </div>
            </div>

            {/* Consumption Comparison Section */}
            {(() => {
              const currentOrderNo = selectedJobCard?.deliveryOrderNo?.trim();
              const comp = findMatchingComposition(currentOrderNo, selectedJobCard?.productName);
              const fgQty = Number(formData.quantityFG) || 0;
              const compMaterials = comp?.materials || [];

              return (
                <div className="space-y-5 pt-2">
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-bold text-gray-800">Consumption Comparison (Expected vs Actual)</Label>
                    <div className="text-[10px] bg-slate-100 px-2 py-1 rounded text-slate-500 font-medium">
                      Calculated based on {formData.quantityFG || "0"} FG
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                    {/* ── EXPECTED (read-only, always pre-filled) ── */}
                    <div className="flex flex-col">
                      <div className="rounded-t-xl px-3 py-2 bg-blue-600 text-white text-xs font-bold tracking-wide text-center">
                        EXPECTED (FROM COMPOSITION)
                      </div>
                      <div className="border border-t-0 rounded-b-xl overflow-hidden shadow-sm bg-white">
                        <Table>
                          <TableHeader className="bg-blue-50/60">
                            <TableRow>
                              <TableHead className="text-xs font-bold text-blue-900">Material Name</TableHead>
                              <TableHead className="text-xs font-bold text-blue-900 text-right">Comp %</TableHead>
                              <TableHead className="text-xs font-bold text-blue-900 text-right">Exp. Qty</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {compMaterials.length > 0 ? compMaterials.map((m, i) => {
                              const expQty = fgQty * (m.percentage / 100);
                              return (
                                <TableRow key={i} className="hover:bg-blue-50/30">
                                  <TableCell className="py-2 text-xs font-medium text-gray-700">{m.name}</TableCell>
                                  <TableCell className="py-2 text-right text-xs text-gray-500">{m.percentage.toFixed(2)}%</TableCell>
                                  <TableCell className="py-2 text-right text-xs font-bold text-blue-600">{expQty > 0 ? expQty.toFixed(2) : "—"}</TableCell>
                                </TableRow>
                              );
                            }) : (
                              <TableRow>
                                <TableCell colSpan={3} className="text-center text-xs italic py-6 text-gray-400">
                                  No composition found for this order.
                                </TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </div>

                    {/* ── ACTUAL (editable) ── */}
                    <div className="flex flex-col gap-2">
                      <div className="rounded-t-xl px-3 py-2 bg-emerald-600 text-white text-xs font-bold tracking-wide text-center">
                        ACTUAL (ENTERED)
                      </div>
                      <div className="border border-t-0 rounded-b-xl overflow-hidden shadow-sm bg-white">
                        <Table>
                          <TableHeader className="bg-emerald-50/60">
                            <TableRow>
                              <TableHead className="text-xs font-bold text-emerald-900 min-w-[160px]">Material</TableHead>
                              <TableHead className="text-xs font-bold text-emerald-900 text-right min-w-[90px]">Qty</TableHead>
                              <TableHead className="w-8"></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {formData.rawMaterials.map((rm, idx) => (
                              <TableRow key={idx} className="hover:bg-emerald-50/30">
                                <TableCell className="py-1.5 pr-1">
                                  <Select
                                    value={rm.name}
                                    onValueChange={(val) => {
                                      const updated = [...formData.rawMaterials];
                                      updated[idx] = { ...updated[idx], name: val };
                                      setFormData({ ...formData, rawMaterials: updated });
                                    }}
                                  >
                                    <SelectTrigger className="h-8 text-xs border-emerald-200 focus:ring-emerald-400">
                                      <SelectValue placeholder="Select material…" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {materialsList.map((mat) => (
                                        <SelectItem key={mat} value={mat}>{mat}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </TableCell>
                                <TableCell className="py-1.5 px-1">
                                  <Input
                                    type="number"
                                    placeholder="Qty"
                                    value={rm.quantity}
                                    onChange={(e) => {
                                      const updated = [...formData.rawMaterials];
                                      updated[idx] = { ...updated[idx], quantity: e.target.value };
                                      setFormData({ ...formData, rawMaterials: updated });
                                    }}
                                    className="h-8 text-xs font-bold text-emerald-700 border-emerald-200 focus:ring-emerald-400"
                                  />
                                </TableCell>
                                <TableCell className="py-1.5 text-center">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-red-400 hover:text-red-600 hover:bg-red-50"
                                    onClick={() => handleRemoveMaterial(idx)}
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                            {formData.rawMaterials.length === 0 && (
                              <TableRow>
                                <TableCell colSpan={3} className="text-center text-xs italic py-6 text-gray-400">
                                  Click &quot;+ Add Row&quot; to log actual materials.
                                </TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </div>

                      {/* Add Row + validation error */}
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                          disabled={formData.rawMaterials.length >= 20}
                          onClick={() => {
                            const usedNames = formData.rawMaterials.map(r => r.name.toLowerCase());
                            const nextComp = compMaterials.find(m => !usedNames.includes(m.name.toLowerCase()));
                            setFormData(prev => ({
                              ...prev,
                              rawMaterials: [...prev.rawMaterials, { name: nextComp?.name ?? "", quantity: "" }]
                            }));
                          }}
                        >
                          <Plus className="h-3.5 w-3.5 mr-1" /> Add Row
                        </Button>
                        {formErrors.rawMaterials && (
                          <p className="text-xs text-red-600">{formErrors.rawMaterials}</p>
                        )}
                      </div>

                      {(() => {
                        const activeMaterials = formData.rawMaterials;

                        const totalQty = activeMaterials.reduce((sum, material) => {
                          const nameLower = (material.name || "").trim().toLowerCase();
                          if (
                            nameLower === "shmp" ||
                            nameLower === "ppf" ||
                            nameLower === "ssf 304" ||
                            nameLower === "ssf 310" ||
                            nameLower === "pp bag (25 kgs)" ||
                            nameLower === "pp bag (50 kgs)" ||
                            nameLower === "ton bag(1 ton)" ||
                            nameLower === "pp bag 25kg" ||
                            nameLower === "pp bag 25 kg"
                          ) {
                            return sum;
                          }
                          return sum + (Number(material.quantity) || 0);
                        }, 0);

                        const fgQuantity = Number(formData.quantityFG) || 0;

                        const roundedTotal = Number(totalQty.toFixed(2));
                        const roundedFG = Number(fgQuantity.toFixed(2));

                        const isExceeded = roundedFG > 0 && roundedTotal > roundedFG;
                        const isLow = roundedFG > 0 && roundedTotal > 0 && roundedTotal < roundedFG;

                        // Find specific quantities for PP Bags, PPF, SHMP
                        const pp25 = activeMaterials.find(m => (m.name || "").trim().toLowerCase() === "pp bag (25 kgs)");
                        const pp50 = activeMaterials.find(m => (m.name || "").trim().toLowerCase() === "pp bag (50 kgs)");
                        const pp25kg = activeMaterials.find(m => {
                          const nameLower = (m.name || "").trim().toLowerCase();
                          return nameLower === "pp bag 25kg" || nameLower === "pp bag 25 kg";
                        });
                        const shmp = activeMaterials.find(m => (m.name || "").trim().toLowerCase() === "shmp");
                        const ppf = activeMaterials.find(m => (m.name || "").trim().toLowerCase() === "ppf");

                        const pp25Qty = pp25 ? (Number(pp25.quantity) || 0) : 0;
                        const pp50Qty = pp50 ? (Number(pp50.quantity) || 0) : 0;
                        const pp25kgQty = pp25kg ? (Number(pp25kg.quantity) || 0) : 0;
                        const shmpQty = shmp ? (Number(shmp.quantity) || 0) : 0;
                        const ppfQty = ppf ? (Number(ppf.quantity) || 0) : 0;

                        return (
                          <div className="mt-4 pt-4 border-t space-y-2 text-sm font-semibold text-slate-800">
                            <div className={`flex justify-between border-b pb-1 ${isExceeded ? "text-red-600 bg-red-50 p-1.5 rounded-lg border border-red-200" : isLow ? "text-orange-600 bg-orange-50 p-1.5 rounded-lg border border-orange-200" : ""}`}>
                              <span>Total Qty :</span>
                              <span>{totalQty.toFixed(2)}</span>
                            </div>
                            {(pp25Qty > 0 || pp50Qty > 0 || pp25kgQty > 0) && (
                              <div className="space-y-1 pt-1">
                                <div className="text-xs text-slate-400 uppercase tracking-wider font-bold">Packaging Bags</div>
                                {pp25Qty > 0 && (
                                  <div className="flex justify-between text-slate-600 font-medium pl-2">
                                    <span>PP Bag (25 kgs):</span>
                                    <span>{pp25Qty}</span>
                                  </div>
                                )}
                                {pp50Qty > 0 && (
                                  <div className="flex justify-between text-slate-600 font-medium pl-2">
                                    <span>Pp Bag (50 kgs):</span>
                                    <span>{pp50Qty}</span>
                                  </div>
                                )}
                                {pp25kgQty > 0 && (
                                  <div className="flex justify-between text-slate-600 font-medium pl-2">
                                    <span>PP BAG 25KG:</span>
                                    <span>{pp25kgQty}</span>
                                  </div>
                                )}
                              </div>
                            )}
                            {(shmpQty > 0 || ppfQty > 0) && (
                              <div className="space-y-1 pt-1 border-t border-dashed mt-1">
                                <div className="text-xs text-slate-400 uppercase tracking-wider font-bold">Excluded Additives</div>
                                {shmpQty > 0 && (
                                  <div className="flex justify-between text-slate-600 font-medium pl-2">
                                    <span>SHMP:</span>
                                    <span>{shmpQty}</span>
                                  </div>
                                )}
                                {ppfQty > 0 && (
                                  <div className="flex justify-between text-slate-600 font-medium pl-2">
                                    <span>PPF:</span>
                                    <span>{ppfQty}</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>

                  </div>

                  {/* ── PROFIT / LOSS VARIANCE PANEL REMOVED FROM UI (Calculation remains in background) ── */}

                  {formErrors.quantityFG && (
                    <p className="text-xs text-red-600">{formErrors.quantityFG}</p>
                  )}
                </div>
              );
            })()}

            {/* Other Form Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t pt-6">
              <div>
                <Label htmlFor="productionDate" className="font-semibold">Date of Production</Label>
                <Input
                  id="productionDate"
                  type="date"
                  value={formData.productionDate}
                  onChange={(e) => setFormData({ ...formData, productionDate: e.target.value })}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="machineRunningHour" className="font-semibold">Machine Running Hour</Label>
                <Input
                  id="machineRunningHour"
                  type="text"
                  placeholder="e.g. 8.5"
                  value={formData.machineRunningHour}
                  onChange={(e) => setFormData({ ...formData, machineRunningHour: e.target.value })}
                  className={formErrors.machineRunningHour ? "border-red-500 mt-1.5" : "mt-1.5"}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="remarks" className="font-semibold flex items-center gap-2">
                <span>Remarks</span>
                <span className="text-xs text-gray-500 font-normal">(Optional)</span>
              </Label>
              <Input
                id="remarks"
                type="text"
                placeholder="Enter any production notes"
                value={formData.remarks}
                onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                className="mt-1.5"
              />
            </div>


            <div className="flex justify-between items-center pt-4 border-t">
              <div>
                {selectedJobCard && (
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => handleOpenCancelJcFromPending(selectedJobCard)}
                    disabled={isSubmitting}
                  >
                    Cancel Job Card
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSubmitting}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting} className="bg-olive-600 text-white hover:bg-olive-700">
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Production
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Cancel Job Card Dialog */}
      <Dialog open={isCancelJcDialogOpen} onOpenChange={setIsCancelJcDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Cancel Job Card: {selectedJobCard?.jobCardNo}</DialogTitle>
            <DialogDescription>
              Enter the quantity to cancel and provide remarks/reason.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCancelJcSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cancelJcQty">Cancel Quantity *</Label>
              <Input
                id="cancelJcQty"
                type="number"
                min="0"
                value={cancelJcQty}
                onChange={(e) => setCancelJcQty(e.target.value)}
                placeholder="Enter quantity to cancel"
                required
              />
              {selectedJobCard && (
                <p className="text-xs text-gray-500">
                  Total Job Card Quantity: {selectedJobCard.quantity} (Pending: {(selectedJobCard.quantity || 0) - (selectedJobCard.totalMade || 0)})
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="cancelJcRemarks">Remarks *</Label>
              <Textarea
                id="cancelJcRemarks"
                value={cancelJcRemarks}
                onChange={(e) => setCancelJcRemarks(e.target.value)}
                placeholder="Enter reason for cancellation"
                rows={3}
                required
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setIsCancelJcDialogOpen(false)} disabled={isSubmitting}>
                No, Keep it
              </Button>
              <Button type="submit" variant="destructive" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Yes, Cancel Job Card
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

