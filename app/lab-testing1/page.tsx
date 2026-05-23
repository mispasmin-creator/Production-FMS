"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { Loader2, AlertTriangle, CalendarIcon, TestTube, History, Settings, Eye } from "lucide-react"
import { format } from "date-fns"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/lib/auth"
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

// Type Definitions
interface RawMaterial {
  name: string
  quantity: number | string
}

interface ProductionItem {
  _rowIndex: number | string
  jobCardNo: string
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
  jobCardNo: string
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
  { header: "BD at 110°C", dataKey: "bdAt110", toggleable: true },
  { header: "CCS at 100°C", dataKey: "ccsAt100", toggleable: true },
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
  bdAt110: "",
  ccsAt100: "",
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
      ;(costingResponseData || []).forEach((row: any) => {
        const orderNo = row["Order No."] ? String(row["Order No."]).trim() : ""
        if (orderNo) {
          costingDataMap.set(orderNo, {
            compositionNo: row["Composition No."] ? String(row["Composition No."]).trim() : "",
            orderNo: orderNo,
            productName: row["product name"] ? String(row["product name"]).trim() : "",
            gpPercentage: row["GP %AGE"] ? String(row["GP %AGE"]) : "",
            alumina: row["alumina"] ? String(row["alumina"]) : "",
            iron: row["iron"] ? String(row["iron"]) : "",
            bd: row["BD"] ? String(row["BD"]) : "",
            ap: row["AP"] ? String(row["AP"]) : "",
            rm1: row["RM1"] ? String(row["RM1"]) : "",
            aluminaPercentage: row["Alumina Percentage %"] ? String(row["Alumina Percentage %"]) : "",
            ironPercentage: row["Iron Percentage %"] ? String(row["Iron Percentage %"]) : "",
            plannedDate: row["Planned 1"] ? format(new Date(row["Planned 1"]), "dd/MM/yyyy") : "",
          })
        }
      })

      const productionDataMap = new Map()
      ;(actualProductionData || []).forEach((row: any) => {
        const jobCardNo = String(row["Job Card No."] || "").trim()
        if (jobCardNo) {
          const materials = []
          for (let i = 1; i <= 20; i++) {
            const name = row[`Raw Material Name ${i}`]
            const quantity = row[`Quantity Of Raw Material ${i}`]
            if (name && String(name).trim()) {
              materials.push({ name: String(name).trim(), quantity: quantity || 0 })
            }
          }

          productionDataMap.set(jobCardNo, {
            jobCardNo: jobCardNo,
            machineHours: String(row["Machine Running hour"] || "-").trim(),
            rawMaterials: materials,
          })
        }
      })

      const pendingData = (jobCardsData || [])
        .filter(
          (row: any) => (row["Actual 1"] !== null && row["Actual 1"] !== "") && row["Actual 2"] === null && row["Status"] !== "cancelled",
        )
        .map((row: any) => {
          const jobCardNo = String(row["JC-Job Card Number"] || "")
          const deliveryOrderNo = String(row["Delivery Order No."] || "")

          const productionRow = (productionData || []).find(
            (prodRow: any) => String(prodRow["Delivery Order No."] || "").trim() === deliveryOrderNo.trim(),
          )

          const productionDataInfo = productionDataMap.get(jobCardNo.trim())
          const costingData = costingDataMap.get(deliveryOrderNo.trim()) || 
                              Array.from(costingDataMap.values()).find(c => c.productName.toLowerCase() === String(row["Product Name"] || "").trim().toLowerCase()) || 
                              {}

          return {
            _rowIndex: row.id,
            jobCardNo: jobCardNo.trim(),
            deliveryOrderNo: deliveryOrderNo.trim(),
            partyName: String(row["Party Name"] || ""),
            productName: costingData.productName || String(row["Product Name"] || ""),
            quantity: Number(row["Quantity"] || 0),
            dateOfProduction: row["Date Of Production"] ? format(new Date(row["Date Of Production"]), "dd/MM/yyyy") : "",
            supervisorName: String(row["Supervisor Name"] || ""),
            shift: String(row["Shift"] || ""),
            expectedDeliveryDate: productionRow?.["Expected Delivery Date"] ? format(new Date(productionRow["Expected Delivery Date"]), "dd/MM/yyyy") : "",
            priority: String(productionRow?.["Priority"] || ""),
            rawMaterials: productionDataInfo ? productionDataInfo.rawMaterials : [],
            machineHours: productionDataInfo ? productionDataInfo.machineHours : "-",
            gpPercentage: costingData.gpPercentage || "-",
            alumina: costingData.alumina || "-",
            iron: costingData.iron || "-",
            bd: costingData.bd || "-",
            ap: costingData.ap || "-",
            rm1: costingData.rm1 || "-",
            aluminaPercentage: costingData.aluminaPercentage || "-",
            ironPercentage: costingData.ironPercentage || "-",
            plannedDate: row["Planned 2"] ? format(new Date(row["Planned 2"]), "dd/MM/yyyy") : (costingData.plannedDate || "-"),
            firmName: String(row["Firm Name"] || ""),
          }
        })

      const firmSearch = user?.firm?.toLowerCase() || ""
      const isAdmin = user?.role?.toLowerCase() === "admin"
      const filterByFirm = (list: any[]) => {
        if (isAdmin || !firmSearch) return list
        return list.filter(item => (item.firmName || "").toLowerCase().includes(firmSearch))
      }

      setPendingTests(filterByFirm(pendingData))

      const historyFiltered = (jobCardsData || [])
        .filter((row: any) => (row["Actual 1"] !== null && row["Actual 1"] !== "") && (row["Actual 2"] !== null && row["Actual 2"] !== ""))
        .map((row: any) => {
          const jobCardNo = String(row["JC-Job Card Number"] || "").trim()
          const deliveryOrderNo = String(row["Delivery Order No."] || "").trim()
          const costingData = costingDataMap.get(deliveryOrderNo) || 
                              Array.from(costingDataMap.values()).find(c => c.productName.toLowerCase() === String(row["Product Name"] || "").trim().toLowerCase()) || 
                              {}

          return {
            _rowIndex: row.id,
            jobCardNo: jobCardNo,
            deliveryOrderNo: String(row["Delivery Order No."] || ""),
            partyName: String(row["Party Name"] || ""),
            productName: costingData.productName || String(row["Product Name"] || ""),
            quantity: Number(row["Quantity"] || 0),
            testStatus: String(row["Status 2"] || ""),
            dateOfTest: row["Date Of Test 1"] ? format(new Date(row["Date Of Test 1"]), "dd/MM/yy") : "",
            testedBy: String(row["Tested By 1"] || ""),
            wcPercentage: String(row["WC Percentage %"] || ""),
            initialSettingTime: String(row["Initial Setting Time"] || ""),
            finalSettingTime: String(row["Final Setting Time"] || ""),
            whatToBeMixed: String(row["What To Be Mixed"] || ""),
            flowOfMaterial: String(row["Flow Of Material"] || ""),
            sieveAnalysisTest: String(row["Sieve Analysis"] || ""),
            bdAt110: String(row["BD At 110C"] || ""),
            ccsAt100: String(row["CCS At 100C"] || ""),
            test1CompletedAt: row["Actual 2"] ? String(row["Actual 2"]) : "",
            timestamp: row["Actual 2"] ? format(new Date(row["Actual 2"]), "dd/MM/yyyy HH:mm:ss") : "",
            gpPercentage: costingData.gpPercentage || "-",
            alumina: costingData.alumina || "-",
            iron: costingData.iron || "-",
            bd: costingData.bd || "-",
            ap: costingData.ap || "-",
            rm1: costingData.rm1 || "-",
            aluminaPercentage: costingData.aluminaPercentage || "-",
            ironPercentage: costingData.ironPercentage || "-",
            plannedDate: costingData.plannedDate || "-",
            firmName: String(row["Firm Name"] || ""),
          }
        })
        .sort((a, b) => new Date(b.test1CompletedAt).getTime() - new Date(a.test1CompletedAt).getTime())

      setHistoryTests(filterByFirm(historyFiltered))

      setFlowOfMaterialOptions([...new Set((masterData || []).map((row: any) => String(row["Flow Of Material"] || "")).filter(Boolean))])
      setStatusOptions([...new Set((masterData || []).map((row: any) => String(row["Test Status"] || "")).filter(Boolean))])
      setTestedByOptions([...new Set((masterData || []).map((row: any) => String(row["Tested by"] || "")).filter(Boolean))])

    } catch (err: any) {
      console.error("Error in loadAllData:", err)
      setError(`Failed to load data: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }, [])

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
    if (!formData.dateOfTest) errors.dateOfTest = "Date of Test is required."
    if (!formData.flowOfMaterial) errors.flowOfMaterial = "Flow of Material is required."
    if (!formData.wcPercentage || Number(formData.wcPercentage) <= 0) {
      errors.wcPercentage = "Valid WC % is required."
    } else if (Number(formData.wcPercentage) > 100) {
      errors.wcPercentage = "Percentage cannot be over 100."
    }
    if (!formData.testedBy) errors.testedBy = "Tested By is required."
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSaveLabTest = async () => {
    if (!validateForm() || !selectedProduction) return
    setIsSubmitting(true)
    try {
      const jobCardNo = selectedProduction.jobCardNo.trim()
      const now = new Date().toISOString()
      const { error: updateErr } = await supabase
        .from(JOBCARDS_TABLE)
        .update({
          "Actual 2": now,
          "Planned 3": format(new Date(), "yyyy-MM-dd"),
          "Status 2": String(formData.testStatus),
          "Date Of Test 1": format(formData.dateOfTest, "yyyy-MM-dd"),
          "WC Percentage %": Number(formData.wcPercentage),
          "Tested By 1": String(formData.testedBy),
          "Initial Setting Time": String(formData.initialSettingTime),
          "Flow Of Material": String(formData.flowOfMaterial),
          "Final Setting Time": String(formData.finalSettingTime),
          "What To Be Mixed": String(formData.whatToBeMixed),
          "Sieve Analysis": String(formData.sieveAnalysis),
          "BD At 110C": formData.bdAt110,
          "CCS At 100C": formData.ccsAt100,
        })
        .eq("JC-Job Card Number", jobCardNo)
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
          <CardTitle className="flex items-center gap-2 text-gray-800"><TestTube className="h-6 w-6 text-olive-600" /> Lab Testing: Physical Test 1</CardTitle>
          <CardDescription className="text-gray-700">Perform Lab Test 1 for production items.</CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 lg:p-8">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full sm:w-[450px] grid-cols-2 mb-6">
              <TabsTrigger value="pending"><TestTube className="h-4 w-4 mr-2" /> Pending ({pendingTests.length})</TabsTrigger>
              <TabsTrigger value="history"><History className="h-4 w-4 mr-2" /> History ({historyTests.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="pending">
              <Card><CardHeader><div className="flex justify-between items-center"><CardTitle>Pending</CardTitle><ColumnToggler tab="pending" columnsMeta={PENDING_COLUMNS_META} /></div></CardHeader><CardContent><Table><TableHeader><TableRow>{visiblePendingColumnsMeta.map((c) => <TableHead key={c.dataKey}>{c.header}</TableHead>)}</TableRow></TableHeader><TableBody>{pendingTests.length > 0 ? pendingTests.map((p) => <TableRow key={p._rowIndex}>{visiblePendingColumnsMeta.map((c) => <TableCell key={c.dataKey}>{c.dataKey === 'actionColumn' ? <Button size='sm' onClick={() => handleOpenLabTesting(p)}>Perform Test</Button> : c.dataKey === 'rawMaterials' ? renderRawMaterials(p.rawMaterials) : c.dataKey === 'machineHours' ? formatMachineHours(p.machineHours) : (p as any)[c.dataKey] || '-'}</TableCell>)}</TableRow>) : <TableRow><TableCell colSpan={visiblePendingColumnsMeta.length} className="text-center py-8 text-muted-foreground">No pending tests</TableCell></TableRow>}</TableBody></Table></CardContent></Card>
            </TabsContent>
            <TabsContent value="history">
              <Card><CardHeader><div className="flex justify-between items-center"><CardTitle>History</CardTitle><ColumnToggler tab="history" columnsMeta={HISTORY_COLUMNS_META} /></div></CardHeader><CardContent><Table><TableHeader><TableRow>{visibleHistoryColumnsMeta.map((c) => <TableHead key={c.dataKey}>{c.header}</TableHead>)}</TableRow></TableHeader><TableBody>{historyTests.length > 0 ? historyTests.map((t) => <TableRow key={t._rowIndex}>{visibleHistoryColumnsMeta.map((c) => <TableCell key={c.dataKey}>{(t as any)[c.dataKey] || '-'}</TableCell>)}</TableRow>) : <TableRow><TableCell colSpan={visibleHistoryColumnsMeta.length} className="text-center py-8 text-muted-foreground">No history</TableCell></TableRow>}</TableBody></Table></CardContent></Card>
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
              <div className="space-y-1">
                <Label>Date of Test *</Label>
                <Popover>
                  <PopoverTrigger asChild><Button variant="outline" className="w-full text-left justify-start">{format(formData.dateOfTest, "PPP")}</Button></PopoverTrigger>
                  <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={formData.dateOfTest} onSelect={(d) => d && handleFormChange("dateOfTest", d)} /></PopoverContent>
                </Popover>
              </div>
              <div className="space-y-1">
                <Label htmlFor="wcPercentage">WC Percentage % *</Label>
                <Input id="wcPercentage" type="number" step="0.1" value={formData.wcPercentage} onChange={(e) => handleFormChange("wcPercentage", e.target.value)} className={formErrors.wcPercentage ? "border-red-500" : ""} />
                {formErrors.wcPercentage && <p className="text-xs text-red-500">{formErrors.wcPercentage}</p>}
              </div>
            </div>

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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t pt-4">
              <div className="space-y-1">
                <Label htmlFor="bdAt110">BD at 110°C</Label>
                <Input
                  id="bdAt110"
                  placeholder="Enter value"
                  value={formData.bdAt110}
                  onChange={(e) => handleFormChange("bdAt110", e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="ccsAt100">CCS at 100°C</Label>
                <Input
                  id="ccsAt100"
                  placeholder="Enter value"
                  value={formData.ccsAt100}
                  onChange={(e) => handleFormChange("ccsAt100", e.target.value)}
                />
              </div>
            </div>

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
