"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { Loader2, AlertTriangle, CheckCircle, History, Settings, MessageSquare, Eye, TestTube, TestTube2, ClipboardCheck, FlaskConical } from "lucide-react"
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
import { Toaster } from "@/components/ui/toaster"
import { Checkbox } from "@/components/ui/checkbox"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Textarea } from "@/components/ui/textarea"
import { supabase } from "@/lib/supabase"

// --- Configuration ---
const ACTUAL_PRODUCTION_TABLE = "actual_production"
const JOBCARDS_TABLE = "jobcards"

// --- Type Definitions ---
interface PendingApprovalItem {
  id: number
  jobCardNo: string
  deliveryOrderNo: string
  productName: string
  firmName: string
  partyName: string
  quantityOfFG: number
  planned4: string
  // Lab Test 1 fields from jobcards
  lt1Status: string
  lt1DateOfTest: string
  lt1TestedBy: string
  lt1WcPercentage: string
  lt1InitialSettingTime: string
  lt1FinalSettingTime: string
  lt1FlowOfMaterial: string
  lt1WhatToBeMixed: string
  lt1SieveAnalysis: string
  // Lab Test 2 fields from jobcards
  lt2Status: string
  lt2DateOfTest: string
  lt2TestedBy: string
  lt2BdAt110: string
  lt2CcsAt100: string
  lt2BdAt1100: string
  lt2CcsAt1100: string
  lt2PlcAt1100: string
  // Check (Management) fields
  checkPlanned4: string
  // Chemical Test fields from jobcards
  ctPlannedDate: string
  ctCompletedDate: string
  ctStatus: string
  ctAluminaPercent: string
  ctIronPercent: string
  ctSilicaPercent: string
  ctCalciumPercent: string
  ctTestedBy: string
}

interface HistoryApprovalItem {
  id: number
  jobCardNo: string
  deliveryOrderNo: string
  productName: string
  firmName: string
  partyName: string
  quantityOfFG: number
  approvalDate: string
  remarks: string
  // Lab Test 1 fields
  lt1Status: string
  lt1DateOfTest: string
  lt1TestedBy: string
  lt1WcPercentage: string
  lt1InitialSettingTime: string
  lt1FinalSettingTime: string
  lt1FlowOfMaterial: string
  lt1WhatToBeMixed: string
  lt1SieveAnalysis: string
  // Lab Test 2 fields
  lt2Status: string
  lt2DateOfTest: string
  lt2TestedBy: string
  lt2BdAt110: string
  lt2CcsAt100: string
  lt2BdAt1100: string
  lt2CcsAt1100: string
  lt2PlcAt1100: string
  // Chemical Test fields from jobcards
  ctPlannedDate: string
  ctCompletedDate: string
  ctStatus: string
  ctAluminaPercent: string
  ctIronPercent: string
  ctSilicaPercent: string
  ctCalciumPercent: string
  ctTestedBy: string
}

// --- Column Definitions ---
const PENDING_COLUMNS_META = [
  { header: "Action", dataKey: "actionColumn", alwaysVisible: true },
  { header: "View", dataKey: "viewColumn", alwaysVisible: true },
  { header: "Job Card No.", dataKey: "jobCardNo", alwaysVisible: true },
  { header: "Delivery Order No.", dataKey: "deliveryOrderNo", toggleable: true },
  { header: "Product Name", dataKey: "productName", toggleable: true },
  { header: "Quantity", dataKey: "quantityOfFG", toggleable: true },
  { header: "Firm Name", dataKey: "firmName", toggleable: true },
  { header: "Party Name", dataKey: "partyName", toggleable: true },
  { header: "Planned 4", dataKey: "planned4", toggleable: true },
]

const HISTORY_COLUMNS_META = [
  { header: "View", dataKey: "viewColumn", alwaysVisible: true },
  { header: "Job Card No.", dataKey: "jobCardNo", alwaysVisible: true },
  { header: "Delivery Order No.", dataKey: "deliveryOrderNo", toggleable: true },
  { header: "Product Name", dataKey: "productName", toggleable: true },
  { header: "Quantity", dataKey: "quantityOfFG", toggleable: true },
  { header: "Firm Name", dataKey: "firmName", toggleable: true },
  { header: "Party Name", dataKey: "partyName", toggleable: true },
  { header: "Approval Date", dataKey: "approvalDate", toggleable: true },
  { header: "Remarks", dataKey: "remarks", toggleable: true },
]

function hasValue(value: any): boolean {
  return value !== null && value !== undefined && String(value).trim() !== "" && String(value).trim().toLowerCase() !== "null"
}

function formatDateValue(value: any, pattern = "dd/MM/yy"): string {
  if (!value) return "-"
  const date = new Date(value)
  return isNaN(date.getTime()) ? String(value) : format(date, pattern)
}

const initialFormState = {
  remarks: "",
}

export default function ManagementApprovalPage() {
  const [pendingApprovals, setPendingApprovals] = useState<PendingApprovalItem[]>([])
  const [historyApprovals, setHistoryApprovals] = useState<HistoryApprovalItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedApproval, setSelectedApproval] = useState<PendingApprovalItem | null>(null)
  const [formData, setFormData] = useState(initialFormState)
  const [formErrors, setFormErrors] = useState<Record<string, string | null>>({})
  const [activeTab, setActiveTab] = useState("pending")
  const [visiblePendingColumns, setVisiblePendingColumns] = useState<Record<string, boolean>>({})
  const [visibleHistoryColumns, setVisibleHistoryColumns] = useState<Record<string, boolean>>({})
  const [viewingItem, setViewingItem] = useState<PendingApprovalItem | HistoryApprovalItem | null>(null)
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false)

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

  const loadAllData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [
        { data: actualProductionRows, error: actualErr },
        { data: jobCardsRows, error: jobCardsErr },
      ] = await Promise.all([
        supabase.from(ACTUAL_PRODUCTION_TABLE).select("*"),
        supabase.from(JOBCARDS_TABLE).select("*"),
      ])

      if (actualErr) throw actualErr
      if (jobCardsErr) throw jobCardsErr

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
          planned4: formatDateValue(row["Planned4"]),
          lt1Status: String(jobCard?.["Status 2"] || "-"),
          lt1DateOfTest: formatDateValue(jobCard?.["Date Of Test 1"]),
          lt1TestedBy: String(jobCard?.["Tested By 1"] || "-"),
          lt1WcPercentage: String(jobCard?.["WC Percentage %"] || "-"),
          lt1InitialSettingTime: String(jobCard?.["Initial Setting Time"] || "-").replace(/^'/, ""),
          lt1FinalSettingTime: String(jobCard?.["Final Setting Time"] || "-").replace(/^'/, ""),
          lt1FlowOfMaterial: String(jobCard?.["Flow Of Material"] || "-"),
          lt1WhatToBeMixed: String(jobCard?.["What To Be Mixed"] || "-"),
          lt1SieveAnalysis: String(jobCard?.["Sieve Analysis"] || "-"),
          lt2Status: String(jobCard?.["Status 3"] || "-"),
          lt2TestedBy: String(jobCard?.["Tested By 2"] || "-"),
          lt2DateOfTest: formatDateValue(jobCard?.["Date Of Test 2"]),
          lt2BdAt110: String(jobCard?.["BD At 110C"] || "-"),
          lt2CcsAt100: String(jobCard?.["CCS At 100C"] || "-"),
          lt2BdAt1100: String(jobCard?.["BD At 1100C"] || "-"),
          lt2CcsAt1100: String(jobCard?.["CCS At 1100C"] || "-"),
          lt2PlcAt1100: String(jobCard?.["PLC At 1100C"] || "-"),
          checkPlanned4: formatDateValue(row["Planned4"]),
          ctPlannedDate: formatDateValue(jobCard?.["Planned 4"]),
          ctCompletedDate: formatDateValue(jobCard?.["Actual 4"]),
          ctStatus: String(jobCard?.["Status 4"] || "-"),
          ctAluminaPercent: String(jobCard?.["Alumina %"] || "-"),
          ctIronPercent: String(jobCard?.["Iron %"] || "-"),
          ctSilicaPercent: String(jobCard?.["Silica %"] || "-"),
          ctCalciumPercent: String(jobCard?.["Calcium %"] || "-"),
          ctTestedBy: String(jobCard?.["Tested By 3"] || "-"),
        }
      }

      const pendingData: PendingApprovalItem[] = (actualProductionRows || [])
        .filter((row: any) => hasValue(row["Job Card No."]) && hasValue(row["Planned4"]) && !hasValue(row["Actual4"]))
        .map(buildItem)

      const historyData: HistoryApprovalItem[] = (actualProductionRows || [])
        .filter((row: any) => hasValue(row["Job Card No."]) && hasValue(row["Planned4"]) && hasValue(row["Actual4"]))
        .map((row: any) => ({
          ...buildItem(row),
          approvalDate: formatDateValue(row["Actual4"], "dd/MM/yy HH:mm"),
          remarks: String(row["Remarks2"] || "-"),
        }))
        .sort((a, b) => new Date(b.approvalDate).getTime() - new Date(a.approvalDate).getTime())

      setPendingApprovals(pendingData)
      setHistoryApprovals(historyData)
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
    if (!formData.remarks || formData.remarks.trim() === "") {
      errors.remarks = "Remarks are required."
    }
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleApproval = (item: PendingApprovalItem) => {
    setSelectedApproval(item)
    setFormData(initialFormState)
    setFormErrors({})
    setIsDialogOpen(true)
  }

  const handleViewDetails = (item: PendingApprovalItem | HistoryApprovalItem) => {
    setViewingItem(item)
    setIsViewDialogOpen(true)
  }

  const handleSaveApproval = async () => {
    if (!validateForm() || !selectedApproval) return
    setIsSubmitting(true)
    try {
      const { error: updateErr } = await supabase
        .from(ACTUAL_PRODUCTION_TABLE)
        .update({
          "Actual4": format(new Date(), "yyyy-MM-dd"),
          "Remarks2": formData.remarks,
          "Planned5": format(new Date(), "yyyy-MM-dd"),
        })
        .eq("id", selectedApproval.id)

      if (updateErr) throw updateErr

      alert("Management approval completed successfully!")
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
        <p className="ml-4 text-lg">Loading Management Approval Data...</p>
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
            <CheckCircle className="h-6 w-6 text-olive-600" />
            Management Approval
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Review and approve production items with remarks.</p>
        </div>
      </div>
      <Card className="border-none shadow-sm bg-white">
        <CardContent className="p-4 sm:p-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full sm:w-[450px] grid-cols-2 mb-6 p-1 bg-slate-100 rounded-xl">
              <TabsTrigger value="pending" className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-olive-700 data-[state=active]:shadow-sm transition-all">
                <CheckCircle className="h-4 w-4 mr-2" /> Pending Approval
                <Badge variant="secondary" className="ml-1.5 px-1.5 py-0.5 text-xs">
                  {pendingApprovals.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="history" className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-olive-700 data-[state=active]:shadow-sm transition-all">
                <History className="h-4 w-4 mr-2" /> Approval History
                <Badge variant="secondary" className="ml-1.5 px-1.5 py-0.5 text-xs">
                  {historyApprovals.length}
                </Badge>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="pending">
              <Card className="shadow-sm border border-border">
                <CardHeader className="py-3 px-4 bg-olive-50/70 rounded-t-lg">
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-md font-semibold text-foreground">
                      <CheckCircle className="h-5 w-5 text-primary mr-2" />
                      Pending Items ({pendingApprovals.length})
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
                        {pendingApprovals.length > 0 ? (
                          pendingApprovals.map((item, index) => (
                            <TableRow key={`${item.jobCardNo}-${index}`} className="hover:bg-olive-50/50">
                              {visiblePendingColumnsMeta.map((col) => (
                                <TableCell key={col.dataKey} className="whitespace-nowrap text-sm">
                                  {col.dataKey === "actionColumn" ? (
                                    <Button
                                      size="sm"
                                      onClick={() => handleApproval(item)}
                                      className="bg-blue-600 text-white hover:bg-blue-700"
                                    >
                                      <MessageSquare className="mr-2 h-4 w-4" />
                                      Add Remarks
                                    </Button>
                                  ) : col.dataKey === "viewColumn" ? (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleViewDetails(item)}
                                      className="border-blue-400 text-olive-600 hover:bg-blue-50"
                                    >
                                      <Eye className="mr-2 h-3.5 w-3.5" />
                                      View
                                    </Button>
                                  ) : (
                                    (item[col.dataKey as keyof PendingApprovalItem] as any) || "-"
                                  )}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={visiblePendingColumnsMeta.length} className="h-48">
                              <div className="flex flex-col items-center justify-center text-center border-2 border-dashed border-olive-200/50 bg-olive-50/50 rounded-lg mx-4 my-4 flex-1">
                                <CheckCircle className="h-12 w-12 text-olive-500 mb-3" />
                                <p className="font-medium text-foreground">No Pending Approval Items</p>
                                <p className="text-sm text-muted-foreground">
                                  All production items have been approved.
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
                <CardHeader className="py-3 px-4 bg-blue-50 rounded-md p-2">
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-md font-semibold text-foreground">
                      <History className="h-5 w-5 text-primary mr-2" />
                      History Items ({historyApprovals.length})
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
                        {historyApprovals.length > 0 ? (
                          historyApprovals.map((item, index) => (
                            <TableRow key={`${item.jobCardNo}-${index}`} className="hover:bg-olive-50/50">
                              {visibleHistoryColumnsMeta.map((col) => (
                                <TableCell key={col.dataKey} className="whitespace-nowrap text-sm">
                                  {col.dataKey === "remarks" ? (
                                    <span className="max-w-[200px] truncate block" title={item.remarks}>
                                      {item.remarks}
                                    </span>
                                  ) : col.dataKey === "viewColumn" ? (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleViewDetails(item)}
                                      className="border-blue-400 text-olive-600 hover:bg-blue-50"
                                    >
                                      <Eye className="mr-2 h-3.5 w-3.5" />
                                      View
                                    </Button>
                                  ) : (
                                    (item[col.dataKey as keyof HistoryApprovalItem] as any) || "-"
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
                                <p className="font-medium text-foreground">No Approval History</p>
                                <p className="text-sm text-muted-foreground">
                                  Completed approval records will appear here.
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
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Management Approval for JC: {selectedApproval?.jobCardNo}</DialogTitle>
            <DialogDescription>Add your remarks to approve this production item.</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleSaveApproval()
            }}
            className="space-y-4 pt-4"
          >
            <div className="grid grid-cols-2 gap-4 p-4 border rounded-lg bg-muted/50">
              <div>
                <Label className="text-xs">DO No.</Label>
                <p className="text-sm font-semibold">{selectedApproval?.deliveryOrderNo}</p>
              </div>
              <div>
                <Label className="text-xs">Product Name</Label>
                <p className="text-sm font-semibold">{selectedApproval?.productName}</p>
              </div>
              <div>
                <Label className="text-xs">Firm Name</Label>
                <p className="text-sm font-semibold">{selectedApproval?.firmName}</p>
              </div>
              <div>
                <Label className="text-xs">Party Name</Label>
                <p className="text-sm font-semibold">{selectedApproval?.partyName}</p>
              </div>
              <div className="col-span-2">
                <Label className="text-xs">Planned 4 Value</Label>
                <p className="text-sm font-semibold text-olive-600">{selectedApproval?.planned4}</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="remarks">Remarks *</Label>
              <Textarea
                id="remarks"
                rows={4}
                placeholder="Enter your approval remarks, comments, or notes..."
                value={formData.remarks}
                onChange={(e) => handleFormChange("remarks", e.target.value)}
                className={formErrors.remarks ? "border-red-500" : ""}
              />
              {formErrors.remarks && <p className="text-xs text-red-600 mt-1">{formErrors.remarks}</p>}
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting} className="bg-blue-600 text-white hover:bg-blue-700">
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Submit Approval
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      {/* View Details Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-blue-700">
              <ClipboardCheck className="h-5 w-5" />
              Test Details — JC: {viewingItem?.jobCardNo}
            </DialogTitle>
            <DialogDescription>
              Physical Lab Test 1, Physical Lab Test 2, Chemical Test, and Management Check details for this job card.
            </DialogDescription>
          </DialogHeader>

          {viewingItem && (
            <div className="space-y-5 pt-2">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-3 p-3 bg-gray-50 rounded-lg border text-sm">
                <div><span className="text-xs text-gray-500 block">Product Name</span><span className="font-semibold">{viewingItem.productName || "-"}</span></div>
                <div><span className="text-xs text-gray-500 block">Delivery Order No.</span><span className="font-semibold">{viewingItem.deliveryOrderNo || "-"}</span></div>
                <div><span className="text-xs text-gray-500 block">Firm Name</span><span className="font-semibold">{viewingItem.firmName || "-"}</span></div>
                <div><span className="text-xs text-gray-500 block">Party Name</span><span className="font-semibold">{viewingItem.partyName || "-"}</span></div>
              </div>

              {/* Lab Test 1 */}
              <div className="space-y-2">
                <h3 className="text-sm font-semibold flex items-center gap-2 bg-olive-50 text-olive-700 px-3 py-2 rounded">
                  <TestTube className="h-4 w-4" /> Lab Test 1 (Physical Test 1)
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 p-3 border rounded-lg text-sm">
                  <div><span className="text-xs text-gray-500 block">Status</span>
                    <Badge variant={viewingItem.lt1Status === "Accepted" ? "default" : viewingItem.lt1Status === "-" ? "secondary" : "destructive"}>{viewingItem.lt1Status}</Badge>
                  </div>
                  <div><span className="text-xs text-gray-500 block">Date of Test</span><span className="font-medium">{viewingItem.lt1DateOfTest || "-"}</span></div>
                  <div><span className="text-xs text-gray-500 block">Tested By</span><span className="font-medium">{viewingItem.lt1TestedBy || "-"}</span></div>
                  <div><span className="text-xs text-gray-500 block">WC %</span><span className="font-medium">{viewingItem.lt1WcPercentage || "-"}</span></div>
                  <div><span className="text-xs text-gray-500 block">Initial Setting Time</span><span className="font-medium">{viewingItem.lt1InitialSettingTime || "-"}</span></div>
                  <div><span className="text-xs text-gray-500 block">Final Setting Time</span><span className="font-medium">{viewingItem.lt1FinalSettingTime || "-"}</span></div>
                  <div><span className="text-xs text-gray-500 block">Flow of Material</span><span className="font-medium">{viewingItem.lt1FlowOfMaterial || "-"}</span></div>
                  <div><span className="text-xs text-gray-500 block">What To Be Mixed</span><span className="font-medium">{viewingItem.lt1WhatToBeMixed || "-"}</span></div>
                  <div><span className="text-xs text-gray-500 block">Sieve Analysis</span><span className="font-medium">{viewingItem.lt1SieveAnalysis || "-"}</span></div>
                </div>
              </div>

              {/* Lab Test 2 */}
              <div className="space-y-2">
                <h3 className="text-sm font-semibold flex items-center gap-2 bg-olive-50 text-olive-700 px-3 py-2 rounded">
                  <TestTube2 className="h-4 w-4" /> Lab Test 2 (Physical Test 2)
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 p-3 border rounded-lg text-sm">
                  <div><span className="text-xs text-gray-500 block">Status</span>
                    <Badge variant={viewingItem.lt2Status === "Pass" ? "default" : viewingItem.lt2Status === "-" ? "secondary" : "destructive"}>{viewingItem.lt2Status}</Badge>
                  </div>
                  <div><span className="text-xs text-gray-500 block">Date of Test</span><span className="font-medium">{viewingItem.lt2DateOfTest || "-"}</span></div>
                  <div><span className="text-xs text-gray-500 block">Tested By</span><span className="font-medium">{viewingItem.lt2TestedBy || "-"}</span></div>
                  <div><span className="text-xs text-gray-500 block">BD at 110°C</span><span className="font-medium">{viewingItem.lt2BdAt110 || "-"}</span></div>
                  <div><span className="text-xs text-gray-500 block">CCS at 100°C</span><span className="font-medium">{viewingItem.lt2CcsAt100 || "-"}</span></div>
                  <div><span className="text-xs text-gray-500 block">BD at 1100°C</span><span className="font-medium">{viewingItem.lt2BdAt1100 || "-"}</span></div>
                  <div><span className="text-xs text-gray-500 block">CCS at 1100°C</span><span className="font-medium">{viewingItem.lt2CcsAt1100 || "-"}</span></div>
                  <div><span className="text-xs text-gray-500 block">PLC at 1100°C</span><span className="font-medium">{viewingItem.lt2PlcAt1100 || "-"}</span></div>
                </div>
              </div>

              {/* Chemical Test (Lab Test) */}
              <div className="space-y-2">
                <h3 className="text-sm font-semibold flex items-center gap-2 bg-olive-50 text-olive-700 px-3 py-2 rounded">
                  <FlaskConical className="h-4 w-4" /> Chemical Test (Lab Test)
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 p-3 border rounded-lg text-sm">
                  <div><span className="text-xs text-gray-500 block">Status</span>
                    <Badge variant={viewingItem.ctStatus === "Pass" || viewingItem.ctStatus === "Accepted" ? "default" : viewingItem.ctStatus === "-" ? "secondary" : "destructive"}>{viewingItem.ctStatus}</Badge>
                  </div>
                  <div><span className="text-xs text-gray-500 block">Planned Date</span><span className="font-medium">{viewingItem.ctPlannedDate || "-"}</span></div>
                  <div><span className="text-xs text-gray-500 block">Completed Date</span><span className="font-medium text-green-600">{viewingItem.ctCompletedDate || "-"}</span></div>
                  <div><span className="text-xs text-gray-500 block">Alumina %</span><span className="font-medium">{viewingItem.ctAluminaPercent || "-"}</span></div>
                  <div><span className="text-xs text-gray-500 block">Iron %</span><span className="font-medium">{viewingItem.ctIronPercent || "-"}</span></div>
                  <div><span className="text-xs text-gray-500 block">Silica %</span><span className="font-medium">{viewingItem.ctSilicaPercent || "-"}</span></div>
                  <div><span className="text-xs text-gray-500 block">Calcium %</span><span className="font-medium">{viewingItem.ctCalciumPercent || "-"}</span></div>
                  <div><span className="text-xs text-gray-500 block">Tested By</span><span className="font-medium">{viewingItem.ctTestedBy || "-"}</span></div>
                </div>
              </div>

              {/* Check / Management */}
              <div className="space-y-2">
                <h3 className="text-sm font-semibold flex items-center gap-2 bg-olive-50 text-olive-700 px-3 py-2 rounded">
                  <CheckCircle className="h-4 w-4" /> Check (Management Approval)
                </h3>
                <div className="grid grid-cols-2 gap-3 p-3 border rounded-lg text-sm">
                  <div><span className="text-xs text-gray-500 block">Planned 4</span><span className="font-medium">{(viewingItem as any).planned4 || (viewingItem as any).checkPlanned4 || "-"}</span></div>
                  {'approvalDate' in viewingItem && (
                    <>
                      <div><span className="text-xs text-gray-500 block">Approval Date</span><span className="font-medium text-green-600">{viewingItem.approvalDate}</span></div>
                      <div className="col-span-2"><span className="text-xs text-gray-500 block">Remarks</span><span className="font-medium">{viewingItem.remarks}</span></div>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end pt-4 border-t">
            <Button variant="outline" onClick={() => setIsViewDialogOpen(false)}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
