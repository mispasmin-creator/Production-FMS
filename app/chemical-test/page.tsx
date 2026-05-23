"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { Loader2, AlertTriangle, Beaker, History, Settings, Eye } from "lucide-react"
import { format } from "date-fns"
import { supabase } from "@/lib/supabase"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

// Table Names
const JOBCARDS_TABLE = "jobcards"
const MASTER_TABLE = "master"
const PRODUCTION_TABLE = "production"
const ACTUAL_PRODUCTION_TABLE = "actual_production"
const COSTING_RESPONSE_TABLE = "costing_response"

// Type Definitions
interface RawMaterial {
  name: string
  quantity: number | string
}

interface PendingChemicalTestItem {
  id: number
  jobCardNo: string
  deliveryOrderNo: string
  partyName: string
  productName: string
  plannedDate: string
  quantity: number
  expectedDeliveryDate: string
  priority: string
  dateOfProduction: string
  shift: string
  rawMaterials: RawMaterial[]
  machineHours: string
  labTest1Status: string
  labTest2Status: string
}

interface HistoryChemicalTestItem {
  id: number
  jobCardNo: string
  deliveryOrderNo: string
  partyName: string
  productName: string
  quantity: number
  labTest2Status: string
  dateOfChemicalTest: string
  testedBy: string
  aluminaPercentage: string
  ironPercentage: string
  silicaPercentage: string
  calciumPercentage: string
  chemicalTestCompletedAt: string
}

// Add this function for formatting machine hours
const formatMachineHours = (hours: any) => {
  if (!hours || hours === "-") return "-"
  const hoursStr = String(hours)
  if (/^\d{1,2}:\d{2}:\d{2}$/.test(hoursStr)) return hoursStr
  if (hoursStr.includes("Date(")) {
    const match = hoursStr.match(/Date$$(\d+),(\d+),(\d+),(\d+),(\d+),(\d+)$$/)
    if (match) {
      const [, year, month, day, h, m, s] = match
      return `${h.padStart(2, "0")}:${m.padStart(2, "0")}:${s.padStart(2, "0")}`
    }
    const numbers = hoursStr.match(/\d+/g)
    if (numbers && numbers.length >= 6) {
      const h = numbers[numbers.length - 3]
      const m = numbers[numbers.length - 2]
      const s = numbers[numbers.length - 1]
      return `${h.padStart(2, "0")}:${m.padStart(2, "0")}:${s.padStart(2, "0")}`
    }
  }
  if (hours instanceof Date) {
    const h = hours.getHours()
    const m = hours.getMinutes()
    const s = hours.getSeconds()
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
  }
  const numHours = Number.parseFloat(hoursStr)
  if (!isNaN(numHours)) {
    const wholeHours = Math.floor(numHours)
    const minutes = Math.floor((numHours - wholeHours) * 60)
    const seconds = Math.floor(((numHours - wholeHours) * 60 - minutes) * 60)
    return `${wholeHours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
  }
  return hoursStr
}

// Column Definitions
const PENDING_COLUMNS_META = [
  { header: "Action", dataKey: "actionColumn", alwaysVisible: true, toggleable: false },
  { header: "Job Card No.", dataKey: "jobCardNo", alwaysVisible: true, toggleable: false },
  { header: "Party Name", dataKey: "partyName", toggleable: true },
  { header: "Product Name", dataKey: "productName", toggleable: true },
  { header: "Delivery Order No.", dataKey: "deliveryOrderNo", toggleable: true },
  { header: "Quantity", dataKey: "quantity", toggleable: true },
  { header: "Expected Delivery Date", dataKey: "expectedDeliveryDate", toggleable: true },
  { header: "Priority", dataKey: "priority", toggleable: true },
  { header: "Planned Date", dataKey: "plannedDate", toggleable: true },
  { header: "Date of Production", dataKey: "dateOfProduction", toggleable: true },
  { header: "Shift", dataKey: "shift", toggleable: true },
  { header: "Raw Materials", dataKey: "rawMaterials", toggleable: true },
  { header: "Machine Hours", dataKey: "machineHours", toggleable: true },
  { header: "Lab Test 1 Status", dataKey: "labTest1Status", toggleable: true },
  { header: "Lab Test 2 Status", dataKey: "labTest2Status", toggleable: true },
]

const HISTORY_COLUMNS_META = [
  { header: "Completed At", dataKey: "chemicalTestCompletedAt", toggleable: true },
  { header: "Job Card No.", dataKey: "jobCardNo", alwaysVisible: true, toggleable: false },
  { header: "Party Name", dataKey: "partyName", toggleable: true },
  { header: "Product Name", dataKey: "productName", toggleable: true },
  { header: "Delivery Order No.", dataKey: "deliveryOrderNo", toggleable: true },
  { header: "Quantity", dataKey: "quantity", toggleable: true },
  { header: "Lab Test 2 Status", dataKey: "labTest2Status", toggleable: true },
  { header: "Date of Chemical Test", dataKey: "dateOfChemicalTest", toggleable: true },
  { header: "Tested By", dataKey: "testedBy", toggleable: true },
  { header: "Alumina %", dataKey: "aluminaPercentage", toggleable: true },
  { header: "Iron %", dataKey: "ironPercentage", toggleable: true },
  { header: "Silica %", dataKey: "silicaPercentage", toggleable: true },
  { header: "Calcium %", dataKey: "calciumPercentage", toggleable: true },
]

const initialFormState = {
  status: "",
  aluminaPercentage: "",
  ironPercentage: "",
  silicaPercentage: "",
  calciumPercentage: "",
  testedBy: "",
}

export default function ChemicalTestPage() {
  const [pendingTests, setPendingTests] = useState<PendingChemicalTestItem[]>([])
  const [historyTests, setHistoryTests] = useState<HistoryChemicalTestItem[]>([])
  const [statusOptions, setStatusOptions] = useState<string[]>([])
  const [testedByOptions, setTestedByOptions] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedTest, setSelectedTest] = useState<PendingChemicalTestItem | null>(null)
  const [formData, setFormData] = useState(initialFormState)
  const [formErrors, setFormErrors] = useState<Record<string, string | null>>({})
  const [activeTab, setActiveTab] = useState("pending")
  const [visiblePendingColumns, setVisiblePendingColumns] = useState<Record<string, boolean>>({})
  const [visibleHistoryColumns, setVisibleHistoryColumns] = useState<Record<string, boolean>>({})
  const [viewingMaterials, setViewingMaterials] = useState<RawMaterial[] | null>(null)

  const safeFormatDate = (value: any, pattern = "dd/MM/yyyy") => {
    if (!value) return ""
    try {
      const d = new Date(value)
      return !isNaN(d.getTime()) ? format(d, pattern) : ""
    } catch (err) {
      return ""
    }
  }

  useEffect(() => {
    const initializeVisibility = (columnsMeta: any[]) => {
      const visibility: Record<string, boolean> = {}
      columnsMeta.forEach((col: any) => {
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
            productName: row["product name"] ? String(row["product name"]).trim() : "",
            plannedDate: row["Planned 4"] ? format(new Date(row["Planned 4"]), "dd/MM/yyyy") : "",
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

      // Filter pending tests: Actual 3 filled and Actual 4 empty
      const pendingData = (jobCardsData || [])
        .filter(
          (row: any) => (row["Actual 3"] !== null && row["Actual 3"] !== "") && (row["Actual 4"] === null || row["Actual 4"] === "") && row["Status"] !== "cancelled",
        )
        .map((row: any) => {
          const jobCardNo = String(row["JC-Job Card Number"] || "").trim()
          const deliveryOrderNo = String(row["Delivery Order No."] || "").trim()

          const productionRow = (productionData || []).find(
            (prodRow: any) => String(prodRow["Delivery Order No."] || "").trim() === deliveryOrderNo,
          )

          const productionInfo = productionDataMap.get(jobCardNo)
          const costingData = costingDataMap.get(deliveryOrderNo) || 
                              Array.from(costingDataMap.values()).find(c => c.productName.toLowerCase() === String(row["Product Name"] || "").trim().toLowerCase()) || 
                              {}

          return {
            id: row.id,
            jobCardNo: jobCardNo,
            deliveryOrderNo: deliveryOrderNo,
            partyName: String(row["Party Name"] || ""),
            productName: costingData.productName || String(row["Product Name"] || ""),
            quantity: Number(row["Quantity"] || 0),
            expectedDeliveryDate: productionRow?.["Expected Delivery Date"] ? format(new Date(productionRow["Expected Delivery Date"]), "dd/MM/yyyy") : "",
            priority: String(productionRow?.["Priority"] || ""),
            dateOfProduction: row["Date Of Production"] ? format(new Date(row["Date Of Production"]), "dd/MM/yyyy") : "",
            plannedDate: row["Planned 4"] ? format(new Date(row["Planned 4"]), "dd/MM/yyyy") : (costingData.plannedDate || ""),
            shift: String(row["Shift"] || ""),
            rawMaterials: productionInfo ? productionInfo.rawMaterials : [],
            machineHours: productionInfo ? productionInfo.machineHours : "-",
            labTest1Status: String(row["Status 2"] || "N/A"),
            labTest2Status: String(row["Status 3"] || "N/A"),
          }
        })

      setPendingTests(pendingData)

      // Filter history: Actual 4 filled
      const historyData = (jobCardsData || [])
        .filter(
          (row: any) => (row["Actual 4"] !== null && row["Actual 4"] !== ""),
        )
        .map((row: any) => {
          const jobCardNo = String(row["JC-Job Card Number"] || "").trim()
          const deliveryOrderNo = String(row["Delivery Order No."] || "").trim()
          const costingData = costingDataMap.get(deliveryOrderNo) || 
                              Array.from(costingDataMap.values()).find(c => c.productName.toLowerCase() === String(row["Product Name"] || "").trim().toLowerCase()) || 
                              {}

          return {
            id: row.id,
            jobCardNo: jobCardNo,
            deliveryOrderNo: deliveryOrderNo,
            partyName: String(row["Party Name"] || ""),
            productName: costingData.productName || String(row["Product Name"] || ""),
            quantity: Number(row["Quantity"] || 0),
            labTest2Status: String(row["Status 3"] || "N/A"),
            dateOfChemicalTest: row["Date Of Test 2"] ? format(new Date(row["Date Of Test 2"]), "dd/MM/yyyy") : "",
            testedBy: String(row["Tested By 3"] || ""),
            aluminaPercentage: String(row["Alumina %"] || ""),
            ironPercentage: String(row["Iron %"] || ""),
            silicaPercentage: String(row["Silica %"] || ""),
            calciumPercentage: String(row["Calcium %"] || ""),
            chemicalTestCompletedAt: row["Actual 4"] ? format(new Date(row["Actual 4"]), "dd/MM/yy HH:mm") : "",
          }
        })
        .sort((a, b) => new Date(b.chemicalTestCompletedAt).getTime() - new Date(a.chemicalTestCompletedAt).getTime())

      setHistoryTests(historyData)

      // Set options from master data
      const statuses = [...new Set((masterData || []).map((row: any) => String(row["Test Status"] || "")).filter(Boolean))]
      setStatusOptions(statuses)

      const testedByOpts = [...new Set((masterData || []).map((row: any) => String(row["Tested by"] || "")).filter(Boolean))]
      setTestedByOptions(testedByOpts)
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

  const handleFormChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const validateForm = () => {
    const errors: Record<string, string> = {}
    if (!formData.status) errors.status = "Status is required."
    if (!formData.testedBy) errors.testedBy = "Tested By is required."
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleOpenChemicalTest = (test: PendingChemicalTestItem) => {
    setSelectedTest(test)
    setFormData(initialFormState)
    setFormErrors({})
    setIsDialogOpen(true)
  }

  const handleSaveChemicalTest = async () => {
    if (!validateForm() || !selectedTest) return

    setIsSubmitting(true)
    try {
      const now = new Date().toISOString()
      const { error: updateErr } = await supabase
        .from(JOBCARDS_TABLE)
        .update({
          "Actual 4": now,
          "Status 4": formData.status,
          "Alumina %": formData.aluminaPercentage,
          "Iron %": formData.ironPercentage,
          "Silica %": formData.silicaPercentage,
          "Calcium %": formData.calciumPercentage,
          "Tested By 3": formData.testedBy,
        })
        .eq("id", selectedTest.id)

      if (updateErr) throw updateErr

      const { error: planSupervisorErr } = await supabase
        .from(ACTUAL_PRODUCTION_TABLE)
        .update({ "Planned5": format(new Date(), "yyyy-MM-dd") })
        .eq('"Job Card No."', selectedTest.jobCardNo)

      if (planSupervisorErr) throw planSupervisorErr

      alert("Chemical Test data saved successfully!")
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

  const renderRawMaterials = (materials: RawMaterial[]) => {
    if (!materials || materials.length === 0) return "-"

    return (
      <Button
        variant="outline"
        size="sm"
        className="h-7 text-xs bg-transparent"
        onClick={() => setViewingMaterials(materials)}
      >
        <Eye className="h-3.5 w-3.5 mr-1.5" />
        View ({materials.length})
      </Button>
    )
  }

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
        <p className="ml-4 text-lg">Loading Test Data...</p>
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
    <div className="space-y-6 p-4 md:p-6 bg-white min-h-screen">
      <Card className="shadow-md border-none">
        <CardHeader className="bg-gradient-to-r from-olive-50 to-olive-100 rounded-t-lg">
          <CardTitle className="flex items-center gap-2 text-gray-800">
            <Beaker className="h-6 w-6 text-olive-600" />
            Lab Testing: Chemical Test
          </CardTitle>
          <CardDescription className="text-gray-700">
            Perform chemical analysis for items where physical tests are complete.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full sm:w-[450px] grid-cols-2 mb-6">
              <TabsTrigger value="pending" className="flex items-center gap-2">
                <Beaker className="h-4 w-4" /> Pending Tests
                <Badge variant="secondary" className="ml-1.5 px-1.5 py-0.5 text-xs">
                  {pendingTests.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="history" className="flex items-center gap-2">
                <History className="h-4 w-4" /> Test History
                <Badge variant="secondary" className="ml-1.5 px-1.5 py-0.5 text-xs">
                  {historyTests.length}
                </Badge>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="pending">
              <Card className="shadow-sm border border-border">
                <CardHeader className="py-3 px-4 bg-olive-50 rounded-md p-2">
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-md font-semibold text-foreground">
                      <Beaker className="h-5 w-5 text-primary mr-2" />
                      Pending Items ({pendingTests.length})
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
                        {pendingTests.length > 0 ? (
                          pendingTests.map((test, index) => (
                            <TableRow key={`${test.jobCardNo}-${index}`} className="hover:bg-olive-50/50">
                              {visiblePendingColumnsMeta.map((col) => (
                                <TableCell key={col.dataKey} className="whitespace-nowrap text-sm">
                                  {col.dataKey === "actionColumn" ? (
                                    <Button
                                      size="sm"
                                      onClick={() => handleOpenChemicalTest(test)}
                                      className="bg-olive-600 text-white hover:bg-olive-700"
                                    >
                                      <Beaker className="mr-2 h-4 w-4" />
                                      Chemical Test
                                    </Button>
                                  ) : col.dataKey === "labTest1Status" ? (
                                    <Badge variant={test.labTest1Status === "Accepted" ? "default" : "destructive"}>
                                      {test.labTest1Status}
                                    </Badge>
                                  ) : col.dataKey === "labTest2Status" ? (
                                    <Badge variant={test.labTest2Status === "Pass" ? "default" : "destructive"}>
                                      {test.labTest2Status}
                                    </Badge>
                                  ) : col.dataKey === "rawMaterials" ? (
                                    renderRawMaterials(test.rawMaterials)
                                  ) : col.dataKey === "machineHours" ? (
                                    formatMachineHours(test[col.dataKey as keyof PendingChemicalTestItem])
                                  ) : (
                                    (test[col.dataKey as keyof PendingChemicalTestItem] as any) || "-"
                                  )}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={visiblePendingColumnsMeta.length} className="h-48">
                              <div className="flex flex-col items-center justify-center text-center border-2 border-dashed border-olive-200/50 bg-olive-50/50 rounded-lg mx-4 my-4 flex-1">
                                <Beaker className="h-12 w-12 text-olive-500 mb-3" />
                                <p className="font-medium text-foreground">No Pending Tests</p>
                                <p className="text-sm text-muted-foreground">
                                  All required chemical tests have been completed.
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
                <CardHeader className="py-3 px-4 bg-olive-50 rounded-md p-2">
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-md font-semibold text-foreground">
                      <History className="h-5 w-5 text-primary mr-2" />
                      History Items ({historyTests.length})
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
                        {historyTests.length > 0 ? (
                          historyTests.map((test, index) => (
                            <TableRow key={`${test.jobCardNo}-${index}`} className="hover:bg-olive-50/50">
                              {visibleHistoryColumnsMeta.map((col) => (
                                <TableCell key={col.dataKey} className="whitespace-nowrap text-sm">
                                  {col.dataKey === "labTest2Status" ? (
                                    <Badge variant={test.labTest2Status === "Pass" ? "default" : "destructive"}>
                                      {test.labTest2Status}
                                    </Badge>
                                  ) : (
                                    (test[col.dataKey as keyof HistoryChemicalTestItem] as any) || "-"
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
              <TableHeader>
                <TableRow>
                  <TableHead>Material Name</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {viewingMaterials?.map((material, index) => (
                  <TableRow key={index}>
                    <TableCell>{material.name}</TableCell>
                    <TableCell className="text-right">{material.quantity}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Chemical Test Details for JC: {selectedTest?.jobCardNo}</DialogTitle>
            <DialogDescription>
              Enter the chemical analysis results below. Fields with * are required.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleSaveChemicalTest()
            }}
            className="space-y-4 pt-4"
          >
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-4 border rounded-lg bg-muted/50">
              <div>
                <Label className="text-xs">DO No.</Label>
                <p className="text-sm font-semibold">{selectedTest?.deliveryOrderNo}</p>
              </div>
              <div>
                <Label className="text-xs">Product Name</Label>
                <p className="text-sm font-semibold">{selectedTest?.productName}</p>
              </div>
              <div>
                <Label className="text-xs">Lab Test 2 Status</Label>
                <p className="text-sm font-semibold">{selectedTest?.labTest2Status}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Status *</Label>
                <Select value={formData.status} onValueChange={(v) => handleFormChange("status", v)}>
                  <SelectTrigger className={formErrors.status ? "border-red-500" : ""}>
                    <SelectValue placeholder="Select a status..." />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((opt) => (
                      <SelectItem key={opt} value={opt}>
                        {opt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {formErrors.status && <p className="text-xs text-red-600 mt-1">{formErrors.status}</p>}
              </div>

              <div className="space-y-2">
                <Label>Tested By *</Label>
                <Select value={formData.testedBy} onValueChange={(v) => handleFormChange("testedBy", v)}>
                  <SelectTrigger className={formErrors.testedBy ? "border-red-500" : ""}>
                    <SelectValue placeholder="Select tester" />
                  </SelectTrigger>
                  <SelectContent>
                    {testedByOptions.map((opt) => (
                      <SelectItem key={opt} value={opt}>
                        {opt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {formErrors.testedBy && <p className="text-xs text-red-600 mt-1">{formErrors.testedBy}</p>}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="ironPercentage">Iron %</Label>
                <Input
                  id="ironPercentage"
                  type="number"
                  step="0.1"
                  value={formData.ironPercentage}
                  onChange={(e) => handleFormChange("ironPercentage", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="aluminaPercentage">Alumina %</Label>
                <Input
                  id="aluminaPercentage"
                  type="number"
                  step="0.1"
                  value={formData.aluminaPercentage}
                  onChange={(e) => handleFormChange("aluminaPercentage", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="silicaPercentage">Silica %</Label>
                <Input
                  id="silicaPercentage"
                  type="number"
                  step="0.1"
                  value={formData.silicaPercentage}
                  onChange={(e) => handleFormChange("silicaPercentage", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="calciumPercentage">Calcium %</Label>
                <Input
                  id="calciumPercentage"
                  type="number"
                  step="0.1"
                  value={formData.calciumPercentage}
                  onChange={(e) => handleFormChange("calciumPercentage", e.target.value)}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting} className="bg-olive-600 text-white hover:bg-olive-700">
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Test Results
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

