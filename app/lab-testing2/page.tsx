"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { Loader2, AlertTriangle, CalendarIcon, TestTube2, History, Settings, Eye } from "lucide-react"
import { format } from "date-fns"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/lib/auth"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHeader, TableRow, TableHead } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"

// Type Definitions
interface RawMaterial {
  name: string
  quantity: number | string
}

interface ProductionItem {
  id: string | number
  jobCardNo: string
  deliveryOrderNo: string
  partyName: string
  productName: string
  quantity: number
  expectedDeliveryDate: string
  plannedDate: string
  priority: string
  dateOfProduction: string
  supervisorName: string
  shift: string
  rawMaterials: RawMaterial[]
  machineHours: string
  labTest1Status: string
  firmName: string
}

interface HistoryItem {
  id: string | number
  jobCardNo: string
  deliveryOrderNo: string
  partyName: string
  productName: string
  quantity: number
  test1Status: string
  dateOfTest2: string
  testedBy: string
  test2Status: string
  ccsAt1100: string
  plcAt1100: string
  bdAt1100: string
  test2CompletedAt: string
  firmName: string
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
  { header: "Delivery Order No.", dataKey: "deliveryOrderNo", toggleable: true },
  { header: "Product Name", dataKey: "productName", toggleable: true },
  { header: "Quantity", dataKey: "quantity", toggleable: true },
  { header: "Expected Delivery Date", dataKey: "expectedDeliveryDate", toggleable: true },
  { header: "Priority", dataKey: "priority", toggleable: true },
  { header: "Planned Date", dataKey: "plannedDate", toggleable: true },
  { header: "Date of Production", dataKey: "dateOfProduction", toggleable: true },
  { header: "Supervisor Name", dataKey: "supervisorName", toggleable: true },
  { header: "Shift", dataKey: "shift", toggleable: true },
  { header: "Raw Materials", dataKey: "rawMaterials", toggleable: true },
  { header: "Machine Hours", dataKey: "machineHours", toggleable: true },
  { header: "Lab Test 1 Status", dataKey: "labTest1Status", toggleable: true },
]

const HISTORY_COLUMNS_META = [
  { header: "Completed At", dataKey: "test2CompletedAt", toggleable: true },
  { header: "Job Card No.", dataKey: "jobCardNo", alwaysVisible: true, toggleable: false },
  { header: "Party Name", dataKey: "partyName", toggleable: true },
  { header: "Product Name", dataKey: "productName", toggleable: true },
  { header: "Delivery Order No.", dataKey: "deliveryOrderNo", toggleable: true },
  { header: "Quantity", dataKey: "quantity", toggleable: true },
  { header: "Test 1 Status", dataKey: "test1Status", toggleable: true },
  { header: "Date of Test 2", dataKey: "dateOfTest2", toggleable: true },
  { header: "Tested By", dataKey: "testedBy", toggleable: true },
  { header: "Test 2 Status", dataKey: "test2Status", toggleable: true },
  { header: "CCS at 1100°C", dataKey: "ccsAt1100", toggleable: true },
  { header: "PLC at 1100°C", dataKey: "plcAt1100", toggleable: true },
  { header: "BD at 1100°C", dataKey: "bdAt1100", toggleable: true },
]

// Initial State for Form
const initialFormState = {
  dateOfTest: new Date(),
  testStatus: "",
  bdAt1100: "",
  ccsAt1100: "",
  plcAt1100: "",
  testedBy: "",
}

export default function LabTesting2Page() {
  const { user } = useAuth()
  const [pendingTests, setPendingTests] = useState<ProductionItem[]>([])
  const [historyTests, setHistoryTests] = useState<HistoryItem[]>([])
  const [statusOptions, setStatusOptions] = useState<string[]>([])
  const [testedByOptions, setTestedByOptions] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedTest, setSelectedTest] = useState<ProductionItem | null>(null)
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
            productName: row["product name"] ? String(row["product name"]).trim() : "",
            plannedDate: row["Planned 2"] ? format(new Date(row["Planned 2"]), "dd/MM/yyyy") : "",
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

      // Filter pending tests: Actual 2 filled and Actual 3 empty
      const pendingData = (jobCardsData || [])
        .filter(
          (row: any) => (row["Actual 2"] !== null && row["Actual 2"] !== "") && (row["Actual 3"] === null || row["Actual 3"] === "") && row["Status"] !== "cancelled",
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
            plannedDate: row["Planned 3"] ? format(new Date(row["Planned 3"]), "dd/MM/yyyy") : (costingData.plannedDate || ""),
            supervisorName: String(row["Supervisor Name"] || ""),
            shift: String(row["Shift"] || ""),
            rawMaterials: productionInfo ? productionInfo.rawMaterials : [],
            machineHours: productionInfo ? productionInfo.machineHours : "-",
            labTest1Status: String(row["Status 2"] || "N/A"),
            firmName: String(row["Firm Name"] || ""),
          }
        })

      const firmSearch = user?.firm?.toLowerCase() || ""
      const isAdmin = user?.role?.toLowerCase() === "admin"
      const filterByFirm = (list: any[]) => {
        if (isAdmin || !firmSearch) return list
        return list.filter((item) => (item.firmName || "").toLowerCase().includes(firmSearch))
      }

      setPendingTests(filterByFirm(pendingData))

      // Filter history: Actual 3 filled
      const historyData = (jobCardsData || [])
        .filter(
          (row: any) => (row["Actual 3"] !== null && row["Actual 3"] !== ""),
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
            test1Status: String(row["Status 2"] || "N/A"),
            dateOfTest2: row["Date Of Test 2"] ? format(new Date(row["Date Of Test 2"]), "dd/MM/yyyy") : "",
            testedBy: String(row["Tested By 2"] || ""),
            test2Status: String(row["Status 3"] || "N/A"),
            ccsAt1100: String(row["CCS At 1100C"] || ""),
            plcAt1100: String(row["PLC At 1100C"] || ""),
            bdAt1100: String(row["BD At 1100C"] || ""),
            test2CompletedAt: row["Actual 3"] ? format(new Date(row["Actual 3"]), "dd/MM/yy HH:mm") : "",
            firmName: String(row["Firm Name"] || ""),
          }
        })
        .sort((a, b) => new Date(b.test2CompletedAt).getTime() - new Date(a.test2CompletedAt).getTime())

      setHistoryTests(filterByFirm(historyData))

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
    const errors: Record<string, string | null> = {}
    if (!formData.testStatus) errors.testStatus = "Status is required."
    if (!formData.dateOfTest) errors.dateOfTest = "Date of Test is required."
    if (!formData.testedBy) errors.testedBy = "Tested By is required."
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleOpenLabTesting = (test: ProductionItem) => {
    setSelectedTest(test)
    setFormData(initialFormState)
    setFormErrors({})
    setIsDialogOpen(true)
  }

  const handleSaveLabTest = async () => {
    if (!validateForm() || !selectedTest) return

    setIsSubmitting(true)
    try {
      const now = new Date().toISOString()
      const { error: updateErr } = await supabase
        .from(JOBCARDS_TABLE)
        .update({
          "Actual 3": now,
          "Planned 4": format(new Date(), "yyyy-MM-dd"),
          "Status 3": formData.testStatus,
          "Tested By 2": formData.testedBy,
          "Date Of Test 2": format(formData.dateOfTest, "yyyy-MM-dd"),
          "BD At 1100C": formData.bdAt1100,
          "CCS At 1100C": formData.ccsAt1100,
          "PLC At 1100C": formData.plcAt1100,
        })
        .eq("id", selectedTest.id)

      if (updateErr) throw updateErr

      alert("Lab Test 2 data saved successfully!")
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
              .filter((col: any) => col.toggleable)
              .map((col: any) => (
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
        <p className="ml-4 text-lg">Loading Lab Test Data...</p>
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
            <TestTube2 className="h-6 w-6 text-olive-600" />
            Lab Testing: Physical Test 2
          </CardTitle>
          <CardDescription className="text-gray-700">
            Perform Physical Test 2 for items where Test 1 is complete.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 lg:p-8">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full sm:w-[450px] grid-cols-2 mb-6">
              <TabsTrigger value="pending" className="flex items-center gap-2">
                <TestTube2 className="h-4 w-4" /> Pending Tests
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
                      <TestTube2 className="h-5 w-5 text-primary mr-2" />
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
                                <TableCell key={col.dataKey} className="whitespace-nowrap text-sm py-2 px-3">
                                  {col.dataKey === "actionColumn" ? (
                                    <Button
                                      size="sm"
                                      onClick={() => handleOpenLabTesting(test)}
                                      className="bg-olive-600 text-white hover:bg-olive-700"
                                    >
                                      <TestTube2 className="mr-2 h-4 w-4" />
                                      Perform Test 2
                                    </Button>
                                  ) : col.dataKey === "labTest1Status" ? (
                                    <Badge variant={test.labTest1Status === "Accepted" ? "default" : "destructive"}>
                                      {test.labTest1Status}
                                    </Badge>
                                  ) : col.dataKey === "rawMaterials" ? (
                                    renderRawMaterials(test.rawMaterials)
                                  ) : col.dataKey === "machineHours" ? (
                                    formatMachineHours(test[col.dataKey as keyof ProductionItem])
                                  ) : (
                                    (test as any)[col.dataKey] || "-"
                                  )}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={visiblePendingColumnsMeta.length} className="h-48">
                              <div className="flex flex-col items-center justify-center text-center border-2 border-dashed border-olive-200/50 bg-olive-50/50 rounded-lg mx-4 my-4 flex-1">
                                <TestTube2 className="h-12 w-12 text-olive-500 mb-3" />
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
                                <TableCell key={col.dataKey} className="whitespace-nowrap text-sm py-2 px-3">
                                  {col.dataKey === "test2Status" ? (
                                    <Badge variant={test.test2Status === "Pass" ? "default" : "destructive"}>
                                      {test.test2Status}
                                    </Badge>
                                  ) : col.dataKey === "test1Status" ? (
                                    <Badge variant={test.test1Status === "Accepted" ? "default" : "destructive"}>
                                      {test.test1Status}
                                    </Badge>
                                  ) : (
                                    (test as any)[col.dataKey] || "-"
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
            <DialogTitle>Physical Test 2 Details for JC: {selectedTest?.jobCardNo}</DialogTitle>
            <DialogDescription>Fill out the test results below. Fields with * are required.</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleSaveLabTest()
            }}
            className="space-y-4 pt-4"
          >
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-4 border rounded-lg bg-muted/50 text-xs">
              <div>
                <Label className="text-[10px] text-muted-foreground uppercase font-bold">DO No.</Label>
                <p className="font-semibold">{selectedTest?.deliveryOrderNo}</p>
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground uppercase font-bold">Product</Label>
                <p className="font-semibold">{selectedTest?.productName}</p>
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground uppercase font-bold">Test 1 Status</Label>
                <p className="font-semibold">{selectedTest?.labTest1Status}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Date of Test *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !formData.dateOfTest && "text-muted-foreground",
                        formErrors.dateOfTest && "border-red-500",
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.dateOfTest ? format(formData.dateOfTest, "PPP") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={formData.dateOfTest}
                      onSelect={(date) => date && handleFormChange("dateOfTest", date)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                {formErrors.dateOfTest && <p className="text-xs text-red-500">{formErrors.dateOfTest}</p>}
              </div>

              <div className="space-y-2">
                <Label>Test Status *</Label>
                <Select value={formData.testStatus} onValueChange={(v) => handleFormChange("testStatus", v)}>
                  <SelectTrigger className={formErrors.testStatus ? "border-red-500" : ""}>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((opt) => (
                      <SelectItem key={opt} value={opt}>
                        {opt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {formErrors.testStatus && <p className="text-xs text-red-500">{formErrors.testStatus}</p>}
              </div>

              <div className="space-y-2">
                <Label>Tested By *</Label>
                <Select value={formData.testedBy} onValueChange={(v) => handleFormChange("testedBy", v)}>
                  <SelectTrigger className={formErrors.testedBy ? "border-red-500" : ""}>
                    <SelectValue placeholder="Select technician" />
                  </SelectTrigger>
                  <SelectContent>
                    {testedByOptions.map((opt) => (
                      <SelectItem key={opt} value={opt}>
                        {opt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {formErrors.testedBy && <p className="text-xs text-red-500">{formErrors.testedBy}</p>}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 border-t pt-4">
              <div className="space-y-2">
                <Label htmlFor="bdAt1100">BD at 1100°C</Label>
                <Input
                  id="bdAt1100"
                  placeholder="Enter value"
                  value={formData.bdAt1100}
                  onChange={(e) => handleFormChange("bdAt1100", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ccsAt1100">CCS at 1100°C</Label>
                <Input
                  id="ccsAt1100"
                  placeholder="Enter value"
                  value={formData.ccsAt1100}
                  onChange={(e) => handleFormChange("ccsAt1100", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="plcAt1100">PLC at 1100°C</Label>
                <Input
                  id="plcAt1100"
                  placeholder="Enter value"
                  value={formData.plcAt1100}
                  onChange={(e) => handleFormChange("plcAt1100", e.target.value)}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-6">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" className="bg-olive-600 hover:bg-olive-700 text-white" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Test Results"
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
