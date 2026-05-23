"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { Loader2, AlertTriangle, DollarSign, History, Settings, Package, Building, User, Calendar, Clock, Hash, FileText, CheckCircle } from "lucide-react"
import { format } from "date-fns"
// Shadcn UI components
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Separator } from "@/components/ui/separator"
import { Toaster } from "@/components/ui/toaster"
import { supabase } from "@/lib/supabase"

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
      ] = await Promise.all([
        supabase.from(ACTUAL_PRODUCTION_TABLE).select("*"),
        supabase.from(JOBCARDS_TABLE).select("*"),
        supabase.from(COSTING_RESPONSE_TABLE).select("*"),
      ])

      if (actualErr) throw actualErr
      if (jobCardsErr) throw jobCardsErr
      if (costingErr) throw costingErr

      const jobCardsByNo = new Map(
        (jobCardsRows || []).map((jc: any) => [String(jc["JC-Job Card Number"] || "").trim(), jc])
      )

      const buildItem = (row: any) => {
        const jobCardNo = String(row["Job Card No."] || "").trim()
        const jobCard = jobCardsByNo.get(jobCardNo)

        return {
          id: row.id,
          jobCardNo,
          deliveryOrderNo: String(row["Order No."] || jobCard?.["Delivery Order No."] || ""),
          productName: String(row["Product Name"] || jobCard?.["Product Name"] || ""),
          firmName: String(row["FIRM Name"] || jobCard?.["Firm Name"] || ""),
          partyName: String(row["Party Name"] || jobCard?.["Party Name"] || ""),
          quantityOfFG: Number(row["Quantity Of FG"] || jobCard?.["Quantity"] || 0),
          planned3: formatDateValue(row["Planned3"]),
          completeDetails: processCompleteDetails(row),
        }
      }

      const pendingData: PendingCostingItem[] = (actualProductionRows || [])
        .filter((row: any) => hasValue(row["Job Card No."]) && hasValue(row["Planned3"]) && !hasValue(row["Actual3"]))
        .map(buildItem)

      const historyData: HistoryCostingItem[] = (actualProductionRows || [])
        .filter((row: any) => hasValue(row["Job Card No."]) && hasValue(row["Planned3"]) && hasValue(row["Actual3"]))
        .map((row: any) => ({
          ...buildItem(row),
          costingAmount: Number(row["Costing Amount"] || 0),
          costingDate: formatDateTimeValue(row["Actual3"]),
        }))
        .sort((a, b) => new Date(b.costingDate).getTime() - new Date(a.costingDate).getTime())

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

  const handleCosting = (item: PendingCostingItem) => {
    setSelectedCosting(item)
    setFormData(initialFormState)
    setFormErrors({})
    setIsDialogOpen(true)
  }

  const handleSaveCosting = async () => {
    if (!validateForm() || !selectedCosting) return
    setIsSubmitting(true)
    try {
      const { error: updateErr } = await supabase
        .from(ACTUAL_PRODUCTION_TABLE)
        .update({
          "Actual3": format(new Date(), "yyyy-MM-dd"),
          "Costing Amount": Number(formData.costingAmount),
          "Planned4": format(new Date(), "yyyy-MM-dd"),
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
            Production Costing
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Add costing amounts for production items that have completed planning.</p>
        </div>
      </div>
      <Card className="border-none shadow-sm bg-white">
        <CardContent className="p-4 sm:p-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full sm:w-[450px] grid-cols-2 mb-6 p-1 bg-slate-100 rounded-xl">
              <TabsTrigger value="pending" className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-olive-700 data-[state=active]:shadow-sm transition-all">
                <DollarSign className="h-4 w-4 mr-2" /> Pending Costing
                <Badge variant="secondary" className="ml-1.5 px-1.5 py-0.5 text-xs">
                  {pendingCosting.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="history" className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-olive-700 data-[state=active]:shadow-sm transition-all">
                <History className="h-4 w-4 mr-2" /> Costing History
                <Badge variant="secondary" className="ml-1.5 px-1.5 py-0.5 text-xs">
                  {historyCosting.length}
                </Badge>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="pending">
              <Card className="shadow-sm border border-border">
                <CardHeader className="py-3 px-4 bg-olive-50/70 rounded-t-lg">
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-md font-semibold text-foreground">
                      <DollarSign className="h-5 w-5 text-olive-700 mr-2" />
                      Pending Items ({pendingCosting.length})
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
                        {pendingCosting.length > 0 ? (
                          pendingCosting.map((item, index) => (
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
                      History Items ({historyCosting.length})
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
                        {historyCosting.length > 0 ? (
                          historyCosting.map((item, index) => (
                            <TableRow key={`${item.jobCardNo}-${index}`} className="hover:bg-olive-50/50">
                              {visibleHistoryColumnsMeta.map((col) => (
                                <TableCell key={col.dataKey} className="whitespace-nowrap text-sm">
                                  {col.dataKey === "costingAmount" ? (
                                    <span className="font-medium text-green-600">
                                      ₹{Number(item.costingAmount).toLocaleString('en-IN')}
                                    </span>
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
                    <Package className="h-4 w-4" /> Raw Materials Used
                  </h3>
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader className="bg-blue-50">
                        <TableRow>
                          <TableHead className="w-12">#</TableHead>
                          <TableHead>Raw Material Name</TableHead>
                          <TableHead className="text-right">Quantity</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedCosting.completeDetails.rawMaterials.map((material, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-medium">{idx + 1}</TableCell>
                            <TableCell>{material.name}</TableCell>
                            <TableCell className="text-right">{material.quantity}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
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
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-4 border border-violet-100 rounded-lg">
                        <div className="space-y-1">
                          <Label className="text-xs text-gray-500">VARIABLE COST</Label>
                          <p className="text-sm font-bold text-violet-700">₹{response.variableCost || "-"}</p>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-gray-500">Manufacturing Cost</Label>
                          <p className="text-sm font-bold text-violet-700">₹{response.manufacturingCost || "-"}</p>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-gray-500">Interest (days)</Label>
                          <p className="text-sm font-bold text-slate-700">{response.interestDays || "-"}</p>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-gray-500">Interest Cost</Label>
                          <p className="text-sm font-bold text-violet-700">₹{response.interestCost || "-"}</p>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-gray-500">Transporting (FOR)</Label>
                          <p className="text-sm font-bold text-violet-700">₹{response.transporting || "-"}</p>
                        </div>
                        <div className="space-y-1 text-olive-700">
                          <Label className="text-xs text-olive-700 font-bold">SELLING PRICE</Label>
                          <p className="text-lg font-black">₹{response.sellingPrice || "-"}</p>
                        </div>
                      </div>
                    </div>
                  );
                }
                return null;
              })()}

              {/* Section 4: Planning and Actual Data */}
              <div className="space-y-3">
                <h3 className="text-md font-semibold flex items-center gap-2 text-olive-700 bg-olive-50 p-2 rounded">
                  <CheckCircle className="h-4 w-4" /> Planning & Actual Data
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border rounded-lg">
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-gray-600">Planned 1</Label>
                    <p className="text-sm">{selectedCosting.completeDetails.planned1 || "N/A"}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-gray-600">Actual 1</Label>
                    <p className="text-sm">{selectedCosting.completeDetails.actual1 || "N/A"}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-gray-600">Status</Label>
                    <p className="text-sm"><Badge variant="outline">{selectedCosting.completeDetails.status || "N/A"}</Badge></p>
                  </div>
                  {/* <div className="space-y-1">
                    <Label className="text-xs font-semibold text-gray-600">Actual Qty 1</Label>
                    <p className="text-sm">{selectedCosting.completeDetails.actualQty1 || "N/A"}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-gray-600">Planned 2</Label>
                    <p className="text-sm">{selectedCosting.completeDetails.planned2 || "N/A"}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-gray-600">Actual 2</Label>
                    <p className="text-sm">{selectedCosting.completeDetails.actual2 || "N/A"}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-gray-600">Time Delay 2</Label>
                    <p className="text-sm">{selectedCosting.completeDetails.timeDelay2 || "N/A"}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-gray-600">Remarks</Label>
                    <p className="text-sm">{selectedCosting.completeDetails.remarks || "N/A"}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-gray-600">Planned 3</Label>
                    <p className="text-sm font-medium text-green-600">{selectedCosting.completeDetails.planned3 || "N/A"}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-gray-600">Actual 3</Label>
                    <p className="text-sm">{selectedCosting.completeDetails.actual3 || "N/A"}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-gray-600">Costing Amount 2</Label>
                    <p className="text-sm">{selectedCosting.completeDetails.costingAmount2 || "N/A"}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-gray-600">Planned 4</Label>
                    <p className="text-sm">{selectedCosting.completeDetails.planned4 || "N/A"}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-gray-600">Actual 4</Label>
                    <p className="text-sm">{selectedCosting.completeDetails.actual4 || "N/A"}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-gray-600">Remarks 1.2</Label>
                    <p className="text-sm">{selectedCosting.completeDetails.remarks1_2 || "N/A"}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-gray-600">Planned 5</Label>
                    <p className="text-sm">{selectedCosting.completeDetails.planned5 || "N/A"}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-gray-600">Actual 5</Label>
                    <p className="text-sm">{selectedCosting.completeDetails.actual5 || "N/A"}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-gray-600">Remarks 2</Label>
                    <p className="text-sm">{selectedCosting.completeDetails.remarks2 || "N/A"}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-gray-600">Planned 6</Label>
                    <p className="text-sm">{selectedCosting.completeDetails.planned6 || "N/A"}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-gray-600">Actual 6</Label>
                    <p className="text-sm">{selectedCosting.completeDetails.actual6 || "N/A"}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-gray-600">Remarks 3</Label>
                    <p className="text-sm">{selectedCosting.completeDetails.remarks3 || "N/A"}</p>
                  </div> */}
                </div>
              </div>

              <Separator />

              {/* Costing Amount Input Section */}
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

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSubmitting}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting} className="bg-olive-600 hover:bg-olive-700">
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Costing Amount
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
