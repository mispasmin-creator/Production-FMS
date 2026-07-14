"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { Loader2, AlertTriangle, CalendarIcon, TestTube, History, Settings, Eye, Search, FileDown } from "lucide-react"
import { format } from "date-fns"
import { supabase } from "@/lib/supabase"
import { useAuth, FIRM_MAP } from "@/lib/auth"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar } from "@/components/ui/calendar"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { jsPDF } from "jspdf"
import autoTable from "jspdf-autotable"

// Type Definitions
interface RawMaterial {
  name: string
  quantity: number | string
}

interface ProductionItem {
  _rowIndex: number | string
  productionId?: number | string
  jobCardNo: string
  firmName?: string
  deliveryOrderNo: string
  partyName: string
  productName: string
  quantity: number
  expectedDeliveryDate: string
  priority: string
  dateOfProduction: string
  supervisorName: string
  shift: string
  rawMaterials: RawMaterial[]
  machineHours: string
  gpPercentage?: string
  alumina?: string
  iron?: string
  bd?: string
  ap?: string
  rm1?: string
  aluminaPercentage?: string
  ironPercentage?: string
  plannedDate?: string
}

interface HistoryItem {
  _rowIndex: number | string
  productionId?: number | string
  jobCardNo: string
  firmName?: string
  deliveryOrderNo: string
  partyName: string
  productName: string
  quantity: number
  testStatus: string
  dateOfTest: string
  testedBy: string
  wcPercentage: string
  finalSettingTime: string
  initialSettingTime: string
  whatToBeMixed: string
  flowOfMaterial: string
  sieveAnalysisTest: string
  test1CompletedAt: string
  timestamp?: string
  bdAt110?: string
  ccsAt100?: string
  gpPercentage?: string
  alumina?: string
  iron?: string
  bd?: string
  ap?: string
  rm1?: string
  aluminaPercentage?: string
  ironPercentage?: string
  plannedDate?: string
  labTest1Remarks?: string
}

// Table Names
const JOBCARDS_TABLE = "jobcards"
const MASTER_TABLE = "master"
const PRODUCTION_TABLE = "production"
const ACTUAL_PRODUCTION_TABLE = "actual_production"
const COSTING_RESPONSE_TABLE = "costing_response"

// Add this function for formatting machine hours
const formatMachineHours = (hours: any) => {
  if (!hours || hours === "-") return "-"
  const hoursStr = String(hours)
  if (/^\d{1,2}:\d{2}:\d{2}$/.test(hoursStr)) return hoursStr
  
  const numHours = Number.parseFloat(hoursStr)
  if (!isNaN(numHours)) {
    const wholeHours = Math.floor(numHours)
    const minutes = Math.floor((numHours - wholeHours) * 60)
    const seconds = Math.floor(((numHours - wholeHours) * 60 - minutes) * 60)
    return `${wholeHours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
  }
  
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
  { header: "Party Name", dataKey: "partyName", toggleable: true },
  { header: "Product Name", dataKey: "productName", toggleable: true },
  { header: "Quantity", dataKey: "quantity", toggleable: true },
  { header: "Delivery Order No.", dataKey: "deliveryOrderNo", toggleable: true },
  { header: "Planned Date", dataKey: "plannedDate", toggleable: true },
  { header: "Expected Delivery Date", dataKey: "expectedDeliveryDate", toggleable: true },
  { header: "Priority", dataKey: "priority", toggleable: true },
  { header: "Date of Production", dataKey: "dateOfProduction", toggleable: true },
  { header: "Supervisor Name", dataKey: "supervisorName", toggleable: true },
  { header: "Shift", dataKey: "shift", toggleable: true },
  { header: "Raw Materials", dataKey: "rawMaterials", toggleable: true },
  { header: "Machine Hours", dataKey: "machineHours", toggleable: true },
]

const HISTORY_COLUMNS_META = [
  { header: "ID", dataKey: "productionId", toggleable: true },
  { header: "Job Card No.", dataKey: "jobCardNo", alwaysVisible: true, toggleable: false },
  { header: "Party Name", dataKey: "partyName", toggleable: true },
  { header: "Product Name", dataKey: "productName", toggleable: true },
  { header: "Delivery Order No.", dataKey: "deliveryOrderNo", toggleable: true },
  { header: "Planned Date", dataKey: "plannedDate", toggleable: true },
  { header: "Timestamp", dataKey: "timestamp", toggleable: true },
  { header: "Quantity", dataKey: "quantity", toggleable: true },
  { header: "Test Status", dataKey: "testStatus", toggleable: true },
  { header: "Date of Test", dataKey: "dateOfTest", toggleable: true },
  { header: "Tested By", dataKey: "testedBy", toggleable: true },
  { header: "WC Percentage %", dataKey: "wcPercentage", toggleable: true },
  { header: "Final Setting Time", dataKey: "finalSettingTime", toggleable: true },
  { header: "Initial Setting Time", dataKey: "initialSettingTime", toggleable: true },
  { header: "What To Be Mixed", dataKey: "whatToBeMixed", toggleable: true },
  { header: "Flow of Material", dataKey: "flowOfMaterial", toggleable: true },
  { header: "Sieve Analysis Test", dataKey: "sieveAnalysisTest", toggleable: true },
]

// Initial State for Form
const initialFormState = {
  dateOfTest: new Date(),
  testStatus: "",
  wcPercentage: "",
  testedBy: "",
  initialSettingTime: "",
  finalSettingTime: "",
  whatToBeMixed: "",
  flowOfMaterial: "",
  sieveAnalysis: "",
  labTest1Remarks: "",
}

const hasValue = (value: any) => {
  if (value === null || value === undefined) return false
  const normalized = String(value).trim().toLowerCase()
  return normalized !== "" && normalized !== "-" && normalized !== "null" && normalized !== "undefined"
}

const isCancelledStatus = (value: any) => String(value || "").trim().toLowerCase() === "cancelled"

const normalizeKey = (value: any) => String(value || "").trim().toLowerCase()

const makeOrderProductKey = (orderNo: any, productName: any) => `${normalizeKey(orderNo)}::${normalizeKey(productName)}`

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

const parseUIDate = (dateStr: string) => {
  if (!dateStr || dateStr === "-") return null
  const parts = dateStr.split("/")
  if (parts.length !== 3) return null
  const day = parseInt(parts[0], 10)
  const month = parseInt(parts[1], 10) - 1
  let year = parseInt(parts[2], 10)
  if (parts[2].length === 2) {
    year += 2000
  }
  const date = new Date(year, month, day)
  return isNaN(date.getTime()) ? null : date
}

export default function LabTesting1Page() {
  const { user } = useAuth()
  const [pendingTests, setPendingTests] = useState<ProductionItem[]>([])
  const [historyTests, setHistoryTests] = useState<HistoryItem[]>([])
  const [flowOfMaterialOptions, setFlowOfMaterialOptions] = useState<string[]>([])
  const [statusOptions, setStatusOptions] = useState<string[]>([])
  const [testedByOptions, setTestedByOptions] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedProduction, setSelectedProduction] = useState<ProductionItem | null>(null)
  const [formData, setFormData] = useState(initialFormState)
  const [formErrors, setFormErrors] = useState<Record<string, string | null>>({})
  const [activeTab, setActiveTab] = useState("pending")
  const [visiblePendingColumns, setVisiblePendingColumns] = useState<Record<string, boolean>>({})
  const [visibleHistoryColumns, setVisibleHistoryColumns] = useState<Record<string, boolean>>({})
  const [viewingMaterials, setViewingMaterials] = useState<RawMaterial[] | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [productFilter, setProductFilter] = useState("all")
  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")

  const uniqueProductsForFilter = useMemo(() => {
    const products = new Set<string>()
    pendingTests.forEach((item) => {
      if (item.productName) products.add(item.productName.trim())
    })
    historyTests.forEach((item) => {
      if (item.productName) products.add(item.productName.trim())
    })
    return Array.from(products).sort()
  }, [pendingTests, historyTests])

  const filteredPending = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    let list = pendingTests

    if (productFilter !== "all") {
      list = list.filter((item) => String(item.productName || "").trim().toLowerCase() === productFilter.toLowerCase())
    }

    if (fromDate || toDate) {
      const from = fromDate ? new Date(fromDate) : null
      if (from) from.setHours(0, 0, 0, 0)
      const to = toDate ? new Date(toDate) : null
      if (to) to.setHours(23, 59, 59, 999)

      list = list.filter((item) => {
        const itemDate = parseUIDate(item.dateOfProduction || item.plannedDate || "")
        if (!itemDate) return false
        if (from && itemDate < from) return false
        if (to && itemDate > to) return false
        return true
      })
    }

    if (!q) return list
    return list.filter(item =>
      (item.jobCardNo || "").toLowerCase().includes(q) ||
      (item.productName || "").toLowerCase().includes(q) ||
      (item.partyName || "").toLowerCase().includes(q) ||
      (item.supervisorName || "").toLowerCase().includes(q)
    )
  }, [pendingTests, searchQuery, fromDate, toDate, productFilter])

  const filteredHistory = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    let list = historyTests

    if (productFilter !== "all") {
      list = list.filter((item) => String(item.productName || "").trim().toLowerCase() === productFilter.toLowerCase())
    }

    if (fromDate || toDate) {
      const from = fromDate ? new Date(fromDate) : null
      if (from) from.setHours(0, 0, 0, 0)
      const to = toDate ? new Date(toDate) : null
      if (to) to.setHours(23, 59, 59, 999)

      list = list.filter((item) => {
        const itemDate = parseUIDate(item.dateOfTest)
        if (!itemDate) return false
        if (from && itemDate < from) return false
        if (to && itemDate > to) return false
        return true
      })
    }

    if (!q) return list
    return list.filter(item =>
      (item.jobCardNo || "").toLowerCase().includes(q) ||
      (item.productName || "").toLowerCase().includes(q) ||
      (item.partyName || "").toLowerCase().includes(q) ||
      (item.testedBy || "").toLowerCase().includes(q)
    )
  }, [historyTests, searchQuery, fromDate, toDate, productFilter])

  const pendingTotalQty = useMemo(
    () => filteredPending.reduce((total, item) => total + (Number(item.quantity) || 0), 0),
    [filteredPending]
  )

  const historyTotalQty = useMemo(
    () => filteredHistory.reduce((total, item) => total + (Number(item.quantity) || 0), 0),
    [filteredHistory]
  )

  const handleExportPDF = () => {
    const doc = new jsPDF("landscape")
    const isPending = activeTab === "pending"
    const title = isPending ? "Lab Testing 1 - Pending Tests" : "Lab Testing 1 - Test History"
    const columnsMeta = isPending ? visiblePendingColumnsMeta : visibleHistoryColumnsMeta
    const dataList = isPending ? filteredPending : filteredHistory

    const exportColumns = columnsMeta.filter(col => col.dataKey !== "actionColumn")
    const headers = exportColumns.map(col => col.header)
    const rows = dataList.map(item => {
      return exportColumns.map(col => {
        const key = col.dataKey
        const value = (item as any)[key]
        if (key === "rawMaterials") {
          const materials = value as RawMaterial[]
          if (!materials || materials.length === 0) return "-"
          return materials.map(m => `${m.name}: ${m.quantity}`).join(", ")
        }
        if (key === "machineHours") {
          return formatMachineHours(value)
        }
        return value !== undefined && value !== null ? String(value) : "-"
      })
    })

    const colCount = exportColumns.length
    const fontSize = colCount > 15 ? 6 : colCount > 11 ? 7 : 8
    const cellPadding = colCount > 15 ? 1 : colCount > 11 ? 1.5 : 2
    const startY = fromDate || toDate ? 22 : 15

    doc.setFontSize(14)
    doc.text(title, 8, 10)

    if (fromDate || toDate) {
      doc.setFontSize(9)
      doc.text(`Date Range: ${fromDate || "Any"} to ${toDate || "Any"}`, 8, 16)
    }

    autoTable(doc, {
      head: [headers],
      body: rows,
      startY: startY,
      margin: { left: 8, right: 8 },
      theme: "grid",
      styles: { 
        fontSize: fontSize, 
        cellPadding: cellPadding,
        overflow: "linebreak" 
      },
      headStyles: { fillColor: [107, 110, 48] },
      bodyStyles: { textColor: [0, 0, 0] }
    })

    doc.save(`${title.toLowerCase().replace(/ /g, "_")}_${format(new Date(), "yyyyMMdd")}.pdf`)
  }

  useEffect(() => {
    const initializeVisibility = (columnsMeta: any[]) => {
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
        { data: masterData, error: masterErr },
        { data: productionData, error: prodErr },
        { data: actualProductionData, error: actualProdErr },
        { data: costingResponseData, error: costingErr }
      ] = await Promise.all([
        supabase.from(JOBCARDS_TABLE).select("*"),
        supabase.from(MASTER_TABLE).select("*"),
        supabase.from(PRODUCTION_TABLE).select("*"),
        supabase.from(ACTUAL_PRODUCTION_TABLE).select("*"),
        supabase.from(COSTING_RESPONSE_TABLE).select("*"),
      ])

      if (jobCardsErr) throw jobCardsErr
      if (masterErr) throw masterErr
      if (prodErr) throw prodErr
      if (actualProdErr) throw actualProdErr
      if (costingErr) throw costingErr

      const costingDataMap = new Map()
      const costingDataByOrder = new Map()
      ;(costingResponseData || []).forEach((row: any) => {
        const orderNo = row["Order No."] ? String(row["Order No."]).trim() : ""
        const productName = row["product name"] ? String(row["product name"]).trim() : ""
        if (orderNo) {
          const costingInfo = {
            compositionNo: row["Composition No."] ? String(row["Composition No."]).trim() : "",
            orderNo: orderNo,
            productName,
            gpPercentage: row["GP %AGE"] ? String(row["GP %AGE"]) : "",
            alumina: row["alumina"] ? String(row["alumina"]) : "",
            iron: row["iron"] ? String(row["iron"]) : "",
            bd: row["BD"] ? String(row["BD"]) : "",
            ap: row["AP"] ? String(row["AP"]) : "",
            rm1: row["RM1"] ? String(row["RM1"]) : "",
            aluminaPercentage: row["Alumina Percentage %"] ? String(row["Alumina Percentage %"]) : "",
            ironPercentage: row["Iron Percentage %"] ? String(row["Iron Percentage %"]) : "",
            plannedDate: row["Planned 1"] ? format(new Date(row["Planned 1"]), "dd/MM/yyyy") : "",
          }
          costingDataMap.set(makeOrderProductKey(orderNo, productName), costingInfo)
          if (!costingDataByOrder.has(orderNo)) costingDataByOrder.set(orderNo, [])
          costingDataByOrder.get(orderNo).push(costingInfo)
        }
      })

      const findCostingData = (orderNo: string, productName: string) => {
        const exact = costingDataMap.get(makeOrderProductKey(orderNo, productName))
        if (exact) return exact
        const orderRows = costingDataByOrder.get(orderNo) || []
        if (orderRows.length === 1) return orderRows[0]
        return Array.from(costingDataMap.values()).find(
          (c: any) => normalizeKey(c.productName) === normalizeKey(productName)
        ) || {}
      }

      const findProductionRow = (orderNo: string, productName: string) => {
        const orderRows = (productionData || []).filter(
          (prodRow: any) => normalizeKey(prodRow["Delivery Order No."]) === normalizeKey(orderNo)
        )
        return orderRows.find(
          (prodRow: any) => normalizeKey(prodRow["Product Name"]) === normalizeKey(productName)
        ) || (orderRows.length === 1 ? orderRows[0] : null)
      }

      const productionDataMap = new Map()
      const productionDataByJobCard = new Map()
      const buildActualProductionInfo = (row: any) => {
        const jobCardNo = String(row["Job Card No."] || "").trim()
        const orderNo = String(row["Order No."] || "").trim()
        const productName = String(row["Product Name"] || "").trim()
        const materials = []
        for (let i = 1; i <= 20; i++) {
          const name = row[`Raw Material Name ${i}`]
          const quantity = row[`Quantity Of Raw Material ${i}`]
          if (name && String(name).trim()) {
            materials.push({ name: String(name).trim(), quantity: quantity || 0 })
          }
        }

        return {
          id: row.id,
          jobCardNo,
          orderNo,
          productName,
          firmName: String(row["FIRM Name"] || "").trim(),
          partyName: String(row["Party Name"] || "").trim(),
          quantityFG: Number(row["Quantity Of FG"] || 0),
          dateOfProduction: row["Date Of Production"] ? format(new Date(row["Date Of Production"]), "dd/MM/yyyy") : "",
          supervisorName: String(row["Name Of Supervisor"] || "").trim(),
          machineHours: String(row["Machine Running hour"] || "-").trim(),
          planned1: row["Planned1"] || row["Planned 1"],
          actual1: row["Actual1"] || row["Actual 1"],
          actual2: row["Actual2"] || row["Actual 2"],
          planned3: row["Planned3"] || row["Planned 3"],
          status2: row["Status2"] || row["Status 2"],
          dateOfTest1: row["DateOfTest1"] || row["Date Of Test 1"],
          wcPercentage: row["WCPercentage"] || row["WC Percentage %"],
          testedBy1: row["TestedBy1"] || row["Tested By 1"],
          initialSettingTime: row["InitialSettingTime"] || row["Initial Setting Time"],
          flowOfMaterial: row["FlowOfMaterial"] || row["Flow Of Material"],
          finalSettingTime: row["FinalSettingTime"] || row["Final Setting Time"],
          whatToBeMixed: row["WhatToBeMixed"] || row["What To Be Mixed"],
          sieveAnalysis: row["SieveAnalysis"] || row["Sieve Analysis"],
          bdAt110: row["BDAt110C"] || row["BD At 110C"],
          ccsAt100: row["CCSAt100C"] || row["CCS At 100C"],
          labTest1Remarks: row["LabTest1Remarks"] || "",
        }
      }

      ;(actualProductionData || []).forEach((row: any) => {
        const productionInfo = buildActualProductionInfo(row)
        if (productionInfo.jobCardNo) {
          productionDataMap.set(makeProductionRecordKey(productionInfo.jobCardNo, productionInfo.orderNo, productionInfo.productName), productionInfo)
          if (!productionDataByJobCard.has(productionInfo.jobCardNo)) productionDataByJobCard.set(productionInfo.jobCardNo, [])
          productionDataByJobCard.get(productionInfo.jobCardNo).push(productionInfo)
        }
      })

      const findActualProductionInfo = (jobCardNo: string, orderNo: string, productName: string) => {
        const exact = productionDataMap.get(makeProductionRecordKey(jobCardNo, orderNo, productName))
        if (exact) return exact
        const jobCardRows = productionDataByJobCard.get(jobCardNo) || []
        return jobCardRows.find(
          (record: any) => normalizeKey(record.orderNo) === normalizeKey(orderNo) && normalizeKey(record.productName) === normalizeKey(productName)
        ) || jobCardRows.find(
          (record: any) => normalizeKey(record.productName) === normalizeKey(productName)
        ) || (jobCardRows.length === 1 ? jobCardRows[0] : null)
      }

      const pendingData = (actualProductionData || [])
        .map((row: any) => buildActualProductionInfo(row))
        .filter((productionDataInfo: any) => productionDataInfo.jobCardNo && productionDataInfo.planned1 && !hasValue(productionDataInfo.actual1))
        .map((row: any) => {
          const jobCardNo = String(row.jobCardNo || "")
          const deliveryOrderNo = String(row.orderNo || "")
          const jobCardProductName = String(row.productName || "")
          const jobCard = (jobCardsData || []).find(
            (jc: any) =>
              normalizeKey(jc["JC-Job Card Number"]) === normalizeKey(jobCardNo) &&
              normalizeKey(jc["Firm Name"]) === normalizeKey(row.firmName) &&
              normalizeKey(jc["Delivery Order No."]) === normalizeKey(deliveryOrderNo) &&
              normalizeKey(jc["Product Name"]) === normalizeKey(jobCardProductName)
          ) || (jobCardsData || []).find((jc: any) => normalizeKey(jc["JC-Job Card Number"]) === normalizeKey(jobCardNo))

          if (isCancelledStatus(jobCard?.["Status"])) return null
          const productionRow = findProductionRow(deliveryOrderNo, jobCardProductName)

          const costingData = findCostingData(deliveryOrderNo.trim(), jobCardProductName.trim())

          return {
            _rowIndex: row.id,
            productionId: productionRow?.id ?? "",
            jobCardNo: jobCardNo.trim(),
            deliveryOrderNo: deliveryOrderNo.trim(),
            partyName: String(row.partyName || jobCard?.["Party Name"] || ""),
            productName: jobCardProductName,
            quantity: Number(row.quantityFG || 0),
            dateOfProduction: row.dateOfProduction || "",
            supervisorName: String(row.supervisorName || jobCard?.["Supervisor Name"] || ""),
            shift: String(jobCard?.["Shift"] || ""),
            expectedDeliveryDate: productionRow?.["Expected Delivery Date"] ? format(new Date(productionRow["Expected Delivery Date"]), "dd/MM/yyyy") : "",
            priority: String(productionRow?.["Priority"] || ""),
            rawMaterials: row.rawMaterials || [],
            machineHours: row.machineHours || "-",
            gpPercentage: costingData.gpPercentage || "-",
            alumina: costingData.alumina || "-",
            iron: costingData.iron || "-",
            bd: costingData.bd || "-",
            ap: costingData.ap || "-",
            rm1: costingData.rm1 || "-",
            aluminaPercentage: costingData.aluminaPercentage || "-",
            ironPercentage: costingData.ironPercentage || "-",
            plannedDate: row.planned3 ? format(new Date(row.planned3), "dd/MM/yyyy") : (costingData.plannedDate || "-"),
            firmName: String(row.firmName || jobCard?.["Firm Name"] || ""),
          }
        })
        .filter(Boolean)

      const firmSearchValues = getFirmMatchValues(user?.firm)
      const isAdmin = user?.role?.toLowerCase() === "admin"
      const filterByFirm = (list: any[]) => {
        if (isAdmin || firmSearchValues.length === 0) return list
        return list.filter(item => {
          const fName = normalizeKey(item.firmName)
          return firmSearchValues.some((firmSearch) => fName.includes(firmSearch) || firmSearch.includes(fName))
        })
      }

      setPendingTests(filterByFirm(pendingData))

      const historyFiltered = (actualProductionData || [])
        .map((row: any) => buildActualProductionInfo(row))
        .filter((row: any) => row.jobCardNo && hasValue(row.actual1))
        .map((row: any) => {
          const jobCardNo = String(row.jobCardNo || "").trim()
          const deliveryOrderNo = String(row.orderNo || "").trim()
          const jobCardProductName = String(row.productName || "").trim()
          const jobCard = (jobCardsData || []).find(
            (jc: any) =>
              normalizeKey(jc["JC-Job Card Number"]) === normalizeKey(jobCardNo) &&
              normalizeKey(jc["Firm Name"]) === normalizeKey(row.firmName) &&
              normalizeKey(jc["Delivery Order No."]) === normalizeKey(deliveryOrderNo) &&
              normalizeKey(jc["Product Name"]) === normalizeKey(jobCardProductName)
          ) || (jobCardsData || []).find((jc: any) => normalizeKey(jc["JC-Job Card Number"]) === normalizeKey(jobCardNo))
          const productionRow = findProductionRow(deliveryOrderNo, jobCardProductName)
          const costingData = findCostingData(deliveryOrderNo, jobCardProductName)

          return {
            _rowIndex: row.id,
            productionId: productionRow?.id ?? "",
            jobCardNo: jobCardNo,
            deliveryOrderNo,
            partyName: String(row.partyName || jobCard?.["Party Name"] || ""),
            productName: jobCardProductName,
            quantity: Number(row.quantityFG || 0),
            testStatus: String(row.status2 || ""),
            dateOfTest: row.dateOfTest1 ? format(new Date(row.dateOfTest1), "dd/MM/yy") : "",
            testedBy: String(row.testedBy1 || ""),
            wcPercentage: String(row.wcPercentage || ""),
            initialSettingTime: String(row.initialSettingTime || ""),
            finalSettingTime: String(row.finalSettingTime || ""),
            whatToBeMixed: String(row.whatToBeMixed || ""),
            flowOfMaterial: String(row.flowOfMaterial || ""),
            sieveAnalysisTest: String(row.sieveAnalysis || ""),
            bdAt110: String(row.bdAt110 || ""),
            ccsAt100: String(row.ccsAt100 || ""),
            test1CompletedAt: row.actual2 ? String(row.actual2) : "",
            timestamp: row.actual2 ? format(new Date(row.actual2), "dd/MM/yyyy HH:mm:ss") : "",
            gpPercentage: costingData.gpPercentage || "-",
            alumina: costingData.alumina || "-",
            iron: costingData.iron || "-",
            bd: costingData.bd || "-",
            ap: costingData.ap || "-",
            rm1: costingData.rm1 || "-",
            aluminaPercentage: costingData.aluminaPercentage || "-",
            ironPercentage: costingData.ironPercentage || "-",
            plannedDate: costingData.plannedDate || "-",
            firmName: String(row.firmName || jobCard?.["Firm Name"] || ""),
            labTest1Remarks: String(row.labTest1Remarks || ""),
          }
        })
        .sort((a, b) => new Date(b.test1CompletedAt).getTime() - new Date(a.test1CompletedAt).getTime())

      setHistoryTests(filterByFirm(historyFiltered))

      setFlowOfMaterialOptions([...new Set((masterData || []).map((row: any) => String(row["Flow Of Material"] || "")).filter(Boolean))])
      const statuses = [...new Set((masterData || []).map((row: any) => String(row["Test Status"] || "")).filter(Boolean))]
      if (!statuses.includes("Tested")) statuses.push("Tested")
      if (!statuses.includes("Non Tested")) statuses.push("Non Tested")
      if (!statuses.includes("Direct supply")) statuses.push("Direct supply")
      setStatusOptions(statuses)
      setTestedByOptions([...new Set((masterData || []).map((row: any) => String(row["Tested by"] || "")).filter(Boolean))])

    } catch (err: any) {
      console.error("Error in loadAllData:", err)
      setError(`Failed to load data: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }, [user?.firm, user?.role])

  useEffect(() => {
    loadAllData()
  }, [loadAllData])

  const handleOpenLabTesting = (production: ProductionItem) => {
    setSelectedProduction(production)
    setFormData(initialFormState)
    setFormErrors({})
    setIsDialogOpen(true)
  }

  const handleFormChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const validateForm = () => {
    const errors: Record<string, string | null> = {}
    if (!formData.testStatus) errors.testStatus = "Status is required."
    
    if (formData.testStatus !== "Non Tested" && formData.testStatus !== "Direct supply") {
      if (!formData.dateOfTest) errors.dateOfTest = "Date of Test is required."
      if (!formData.flowOfMaterial) errors.flowOfMaterial = "Flow of Material is required."
      if (!formData.wcPercentage || String(formData.wcPercentage).trim() === "") {
        errors.wcPercentage = "WC % is required."
      }
      if (!formData.testedBy) errors.testedBy = "Tested By is required."
    } else {
      if (!formData.labTest1Remarks || !formData.labTest1Remarks.trim()) {
        errors.labTest1Remarks = "Remark is required."
      }
    }
    
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSaveLabTest = async () => {
    if (!validateForm() || !selectedProduction) return
    setIsSubmitting(true)
    try {
      const jobCardNo = selectedProduction.jobCardNo.trim()
      const now = new Date().toISOString()
      const isNonTested = formData.testStatus === "Non Tested"
      const isDirectSupply = formData.testStatus === "Direct supply"
      const isSkipped = isNonTested || isDirectSupply
      const payload: any = {
        "Actual1": now,
        "Status2": String(formData.testStatus),
      }
      if (!isSkipped) {
        payload["DateOfTest1"] = format(formData.dateOfTest, "yyyy-MM-dd")
        payload["WCPercentage"] = formData.wcPercentage ? String(formData.wcPercentage).trim() : null
        payload["TestedBy1"] = String(formData.testedBy)
        payload["InitialSettingTime"] = String(formData.initialSettingTime)
        payload["FlowOfMaterial"] = String(formData.flowOfMaterial)
        payload["FinalSettingTime"] = String(formData.finalSettingTime)
        payload["WhatToBeMixed"] = String(formData.whatToBeMixed)
        payload["SieveAnalysis"] = String(formData.sieveAnalysis)
        payload["LabTest1Remarks"] = null
      } else {
        payload["DateOfTest1"] = null
        payload["WCPercentage"] = null
        payload["TestedBy1"] = null
        payload["InitialSettingTime"] = null
        payload["FlowOfMaterial"] = null
        payload["FinalSettingTime"] = null
        payload["WhatToBeMixed"] = null
        payload["SieveAnalysis"] = null
        payload["LabTest1Remarks"] = formData.labTest1Remarks ? String(formData.labTest1Remarks).trim() : null
        
        // Skip Lab Test 2 and Chemical Test. Go straight to Check Devshree (Planned4).
        const todayStr = format(new Date(), "yyyy-MM-dd")
        payload["Actual2"] = todayStr
        payload["Planned3"] = todayStr
        payload["Actual3"] = todayStr
        payload["Planned4"] = todayStr
      }

      const { error: updateErr } = await supabase
        .from(ACTUAL_PRODUCTION_TABLE)
        .update(payload)
        .eq("id", selectedProduction._rowIndex)
      if (updateErr) throw updateErr
      alert("Lab Test 1 data saved successfully!")
      setIsDialogOpen(false)
      await loadAllData()
    } catch (err: any) {
      setError(err.message)
      alert(`Error: ${err.message}`)
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
    columnsMeta.forEach((col: any) => {
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

  const renderRawMaterials = (materials: RawMaterial[]) => {
    if (!materials || materials.length === 0) return "-"
    return (
      <Button variant="outline" size="sm" className="h-7 text-xs bg-transparent" onClick={() => setViewingMaterials(materials)}>
        <Eye className="h-3.5 w-3.5 mr-1.5" /> View ({materials.length})
      </Button>
    )
  }

  const ColumnToggler = ({ tab, columnsMeta }: { tab: string; columnsMeta: any[] }) => (
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
                <Checkbox id={`toggle-${tab}-${col.dataKey}`} checked={tab === "pending" ? !!visiblePendingColumns[col.dataKey] : !!visibleHistoryColumns[col.dataKey]} onCheckedChange={(checked) => handleToggleColumn(tab, col.dataKey, Boolean(checked))} />
                <Label htmlFor={`toggle-${tab}-${col.dataKey}`} className="text-xs font-normal cursor-pointer">{col.header}</Label>
              </div>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )

  if (loading) return <div className="flex justify-center items-center h-screen"><Loader2 className="h-12 w-12 animate-spin text-olive-600" /></div>
  if (error) return <div className="p-8 text-center text-red-600 bg-red-50 rounded-md"><AlertTriangle className="h-12 w-12 mx-auto mb-4" />{error}</div>

  return (
    <div className="space-y-6 p-4 md:p-6 bg-white min-h-screen">
      <Card className="shadow-md border-none">
        <CardHeader className="bg-gradient-to-r from-olive-50 to-olive-100 rounded-t-lg">
          <CardTitle className="flex items-center gap-2 text-gray-800"><TestTube className="h-6 w-6 text-olive-600" /> Lab Test 1</CardTitle>
          <CardDescription className="text-gray-700">Perform Lab Test 1 for production items.</CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 lg:p-8">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <div className="flex flex-col gap-4 mb-6">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <TabsList className="grid w-full lg:w-[450px] grid-cols-2 mb-0 shrink-0">
                  <TabsTrigger value="pending"><TestTube className="h-4 w-4 mr-2" /> Pending ({filteredPending.length})</TabsTrigger>
                  <TabsTrigger value="history"><History className="h-4 w-4 mr-2" /> History ({filteredHistory.length})</TabsTrigger>
                </TabsList>

                <div className="text-sm font-semibold text-slate-700 lg:text-right">
                  Total Quantity:{" "}
                  <span className="text-olive-700">
                    {(activeTab === "pending"
                      ? pendingTotalQty
                      : historyTotalQty
                    ).toLocaleString()}
                  </span>
                </div>
              </div>
              
              <div className="flex flex-wrap items-center gap-3 w-full bg-slate-50/50 p-3 rounded-xl border border-slate-100 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto">
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <span className="text-xs text-muted-foreground font-semibold whitespace-nowrap">From:</span>
                    <Input
                      type="date"
                      value={fromDate}
                      onChange={(e) => setFromDate(e.target.value)}
                      className="w-full sm:w-[130px] h-8 text-xs focus-visible:ring-olive-500 bg-white"
                    />
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <span className="text-xs text-muted-foreground font-semibold whitespace-nowrap">To:</span>
                    <Input
                      type="date"
                      value={toDate}
                      onChange={(e) => setToDate(e.target.value)}
                      className="w-full sm:w-[130px] h-8 text-xs focus-visible:ring-olive-500 bg-white"
                    />
                  </div>
                  {(fromDate || toDate) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setFromDate("")
                        setToDate("")
                      }}
                      className="h-8 px-2 text-xs text-red-500 hover:text-red-700 hover:bg-red-50 rounded shrink-0 self-end sm:self-auto"
                    >
                      Clear Date
                    </Button>
                  )}
                </div>
                <div className="w-[180px]">
                  <Select value={productFilter} onValueChange={setProductFilter}>
                    <SelectTrigger className="h-8 text-xs bg-white focus-visible:ring-olive-500">
                      <SelectValue placeholder="All Products" />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      <SelectItem value="all">All Products</SelectItem>
                      {uniqueProductsForFilter.map((p) => (
                        <SelectItem key={p} value={p}>
                          {p}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="relative w-full sm:w-[200px]">
                  <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search tests..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 h-8 text-xs focus-visible:ring-olive-500 bg-white"
                  />
                </div>
                <div className="ml-auto">
                  <Button
                    onClick={handleExportPDF}
                    className="bg-olive-600 hover:bg-olive-700 text-white text-xs h-8 px-3 gap-1.5"
                  >
                    <FileDown className="h-4 w-4" />
                    Export PDF
                  </Button>
                </div>
              </div>
            </div>
            <TabsContent value="pending">
              <Card className="shadow-sm border border-border">
                <CardHeader className="py-3 px-4 bg-olive-50 rounded-md p-2">
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-md font-semibold text-foreground">
                      <TestTube className="h-5 w-5 text-primary mr-2" />
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
                          filteredPending.map((p, index) => (
                            <TableRow key={`${p.jobCardNo}-${index}`} className="hover:bg-olive-50/50">
                              {visiblePendingColumnsMeta.map((col) => (
                                <TableCell key={col.dataKey} className="whitespace-nowrap text-sm py-2 px-3">
                                  {col.dataKey === "actionColumn" ? (
                                    <Button
                                      size="sm"
                                      onClick={() => handleOpenLabTesting(p)}
                                      className="bg-olive-600 text-white hover:bg-olive-700"
                                    >
                                      <TestTube className="mr-2 h-4 w-4" />
                                      Perform Test 1
                                    </Button>
                                  ) : col.dataKey === "rawMaterials" ? (
                                    renderRawMaterials(p.rawMaterials)
                                  ) : col.dataKey === "machineHours" ? (
                                    formatMachineHours(p.machineHours)
                                  ) : (
                                    (p as any)[col.dataKey] || "-"
                                  )}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={visiblePendingColumnsMeta.length} className="h-48">
                              <div className="flex flex-col items-center justify-center text-center border-2 border-dashed border-olive-200/50 bg-olive-50/50 rounded-lg mx-4 my-4 flex-1">
                                <TestTube className="h-12 w-12 text-olive-500 mb-3" />
                                <p className="font-medium text-foreground">No Pending Tests</p>
                                <p className="text-sm text-muted-foreground">All required tests have been completed.</p>
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
                <CardHeader className="py-3 px-4 bg-olive-50 rounded-md p-2">
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-md font-semibold text-foreground">
                      <History className="h-5 w-5 text-primary mr-2" />
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
                          filteredHistory.map((t, index) => (
                            <TableRow key={`${t.jobCardNo}-${index}`} className="hover:bg-olive-50/50">
                              {visibleHistoryColumnsMeta.map((col) => (
                                <TableCell key={col.dataKey} className="whitespace-nowrap text-sm py-2 px-3">
                                  {col.dataKey === "testStatus" ? (
                                    <Badge variant={t.testStatus === "Tested" || t.testStatus === "Accepted" || t.testStatus === "Pass" ? "default" : "destructive"}>
                                      {t.testStatus}
                                    </Badge>
                                  ) : (
                                    (t as any)[col.dataKey] || "-"
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
                                <p className="font-medium text-foreground">No Test History</p>
                                <p className="text-sm text-muted-foreground">
                                  Completed test records will appear here.
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

      <Dialog open={!!viewingMaterials} onOpenChange={(isOpen) => !isOpen && setViewingMaterials(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Raw Materials Used</DialogTitle>
            <DialogDescription>Full list of materials and quantities used for this production run.</DialogDescription>
          </DialogHeader>
          <div className="mt-4 max-h-80 overflow-y-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Material Name</TableHead><TableHead className="text-right">Quantity</TableHead></TableRow></TableHeader>
              <TableBody>{viewingMaterials?.map((m, i) => <TableRow key={i}><TableCell>{m.name}</TableCell><TableCell className="text-right">{m.quantity}</TableCell></TableRow>)}</TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Lab Test 1: {selectedProduction?.jobCardNo}</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); handleSaveLabTest(); }} className="space-y-4">
            <div className="grid grid-cols-3 gap-4 border p-4 rounded bg-muted/50">
              <div><Label>DO No.</Label><p className="font-bold">{selectedProduction?.deliveryOrderNo}</p></div>
              <div><Label>Product</Label><p className="font-medium">{selectedProduction?.productName}</p></div>
              <div><Label>Planned Date</Label><p className="font-medium">{selectedProduction?.plannedDate}</p></div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <Label>Status *</Label>
                <Select value={formData.testStatus} onValueChange={(v) => handleFormChange("testStatus", v)}>
                  <SelectTrigger className={formErrors.testStatus ? "border-red-500" : ""}>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>{statusOptions.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                </Select>
                {formErrors.testStatus && <p className="text-xs text-red-500">{formErrors.testStatus}</p>}
              </div>
              {(formData.testStatus === "Non Tested" || formData.testStatus === "Direct supply") && (
                <div className="space-y-1 col-span-2">
                  <Label htmlFor="labTest1Remarks">Remarks *</Label>
                  <Input id="labTest1Remarks" placeholder={formData.testStatus === "Direct supply" ? "Enter remarks for direct supply..." : "Enter reason for not testing..."} value={formData.labTest1Remarks} onChange={(e) => handleFormChange("labTest1Remarks", e.target.value)} className={formErrors.labTest1Remarks ? "border-red-500" : ""} />
                  {formErrors.labTest1Remarks && <p className="text-xs text-red-500">{formErrors.labTest1Remarks}</p>}
                </div>
              )}
              
              {formData.testStatus !== "Non Tested" && formData.testStatus !== "Direct supply" && (
                <>
                  <div className="space-y-1">
                    <Label>Date of Test *</Label>
                    <Popover>
                      <PopoverTrigger asChild><Button variant="outline" className="w-full text-left justify-start">{format(formData.dateOfTest, "PPP")}</Button></PopoverTrigger>
                      <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={formData.dateOfTest} onSelect={(d) => d && handleFormChange("dateOfTest", d)} /></PopoverContent>
                    </Popover>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="wcPercentage">WC Percentage % *</Label>
                    <Input id="wcPercentage" type="text" value={formData.wcPercentage} onChange={(e) => handleFormChange("wcPercentage", e.target.value)} className={formErrors.wcPercentage ? "border-red-500" : ""} />
                    {formErrors.wcPercentage && <p className="text-xs text-red-500">{formErrors.wcPercentage}</p>}
                  </div>
                </>
              )}
            </div>

            {formData.testStatus !== "Non Tested" && formData.testStatus !== "Direct supply" && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <Label>Tested By *</Label>
                    <Select value={formData.testedBy} onValueChange={(v) => handleFormChange("testedBy", v)}>
                      <SelectTrigger className={formErrors.testedBy ? "border-red-500" : ""}><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>{testedByOptions.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                    </Select>
                    {formErrors.testedBy && <p className="text-xs text-red-500">{formErrors.testedBy}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1"><Label htmlFor="initialSettingTime">Initial Setting Time</Label><Input id="initialSettingTime" placeholder="e.g. 2 hours" value={formData.initialSettingTime} onChange={(e) => handleFormChange("initialSettingTime", e.target.value)} /></div>
                  <div className="space-y-1"><Label htmlFor="finalSettingTime">Final Setting Time</Label><Input id="finalSettingTime" placeholder="e.g. 5 hours" value={formData.finalSettingTime} onChange={(e) => handleFormChange("finalSettingTime", e.target.value)} /></div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label>Flow Of Material *</Label>
                    <Select value={formData.flowOfMaterial} onValueChange={(v) => handleFormChange("flowOfMaterial", v)}>
                      <SelectTrigger className={formErrors.flowOfMaterial ? "border-red-500" : ""}><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>{flowOfMaterialOptions.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                    </Select>
                    {formErrors.flowOfMaterial && <p className="text-xs text-red-500">{formErrors.flowOfMaterial}</p>}
                  </div>
                  <div className="space-y-1"><Label htmlFor="whatToBeMixed">What To Be Mixed</Label><Input id="whatToBeMixed" value={formData.whatToBeMixed} onChange={(e) => handleFormChange("whatToBeMixed", e.target.value)} /></div>
                </div>

                <div className="space-y-1"><Label htmlFor="sieveAnalysis">Sieve Analysis</Label><Textarea id="sieveAnalysis" value={formData.sieveAnalysis} onChange={(e) => handleFormChange("sieveAnalysis", e.target.value)} /></div>
              </>
            )}

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSubmitting}>Cancel</Button>
              <Button type="submit" disabled={isSubmitting}>{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save Test Results</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
