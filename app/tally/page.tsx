"use client"

import { useState, useEffect, useCallback } from "react"
import { Loader2, AlertTriangle, FileText, History, Package, DollarSign, Clock, User, Building, Hash, CheckCircle, Calendar, Eye } from "lucide-react"
import { format, isValid } from "date-fns"
import { supabase } from "@/lib/supabase"
import { useAuth, FIRM_MAP } from "@/lib/auth"

// Shadcn UI components
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"

// --- Type Definitions ---
interface RawMaterial {
  name: string
  quantity: string | number
}

interface ActualProductionItem {
  id: number | string
  timestamp: string
  jobCardNo: string
  firmName: string
  dateOfProduction: string
  nameOfSupervisor: string
  productName: string
  quantityOfFG: number
  serialNumber: string

  rawMaterials: RawMaterial[]

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
  
  // Tally specific fields
  checkStatus: string
  checkTimestamp: string
  tallyTimestamp: string | null
  tallyRemarks: string
  
  // Costing Amount 2nd
  costingAmount2: string
}

// Helper function to format date values for display
function formatDateForDisplay(value: any, formatStr: string = "dd/MM/yy HH:mm"): string {
  if (!value) return "N/A"
  const date = new Date(value)
  if (!isValid(date)) return String(value)
  return format(date, formatStr)
}

const hasValue = (value: any) => {
  if (value === null || value === undefined) return false
  const normalized = String(value).trim().toLowerCase()
  return normalized !== "" && normalized !== "n/a" && normalized !== "-" && normalized !== "null" && normalized !== "undefined"
}

const normalizeKey = (value: any) => String(value || "").trim().toLowerCase()

const getFirmMatchValues = (firm?: string) => {
  const rawFirm = String(firm || "").trim()
  const mappedFirm = Object.entries(FIRM_MAP).find(
    ([key, value]) => normalizeKey(key) === normalizeKey(rawFirm) || normalizeKey(value) === normalizeKey(rawFirm)
  )?.[1]
  return [rawFirm, mappedFirm]
    .filter(Boolean)
    .map((value) => normalizeKey(value))
}

export default function TallyPage() {
  const { user } = useAuth()
  const [pendingTallies, setPendingTallies] = useState<ActualProductionItem[]>([])
  const [historyTallies, setHistoryTallies] = useState<ActualProductionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedTally, setSelectedTally] = useState<ActualProductionItem | null>(null)
  const [remarks, setRemarks] = useState("")

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data, error: supabaseError } = await supabase
        .from('actual_production')
        .select('*')
      
      if (supabaseError) throw supabaseError

      const allItems: ActualProductionItem[] = (data || []).map((row: any) => {
        const rawMaterials: RawMaterial[] = []
        for (let i = 1; i <= 20; i++) {
          const name = row[`Raw Material Name ${i}`]
          const qty = row[`Quantity Of Raw Material ${i}`]
          if (name && String(name).trim() !== "") {
            rawMaterials.push({
              name: String(name),
              quantity: qty || 0
            })
          }
        }

        return {
          id: row.id,
          timestamp: formatDateForDisplay(row.Timestamp),
          jobCardNo: String(row["Job Card No."] || ""),
          firmName: String(row["FIRM Name"] || ""),
          dateOfProduction: formatDateForDisplay(row["Date Of Production"], "dd/MM/yyyy"),
          nameOfSupervisor: String(row["Name Of Supervisor"] || ""),
          productName: String(row["Product Name"] || ""),
          quantityOfFG: Number(row["Quantity Of FG"] || 0),
          serialNumber: String(row["Serial Number"] || ""),
          rawMaterials,
          machineRunningHour: String(row["Machine Running hour"] || ""),
          remarks1: String(row.Remarks1 || ""),
          ppBagUsed: String(row["PP BAG USED"] || ""),
          ppBagToBeUsed: String(row["PP BAG TO BE USED"] || ""),
          partyName: String(row["Party Name"] || ""),
          ppBagSmall: String(row["PP Bag (Small)"] || ""),
          costingAmount: Number(row["Costing Amount"] || 0),
          colorCondition: String(row["Color Condition"] || ""),
          orderNo: String(row["Order No."] || ""),
          planned1: formatDateForDisplay(row.Planned1, "dd/MM/yy"),
          actual1: formatDateForDisplay(row.Actual1, "dd/MM/yy"),
          status: String(row.Status || ""),
          actualQty1: String(row.Qty || ""), 
          planned2: formatDateForDisplay(row.Planned2, "dd/MM/yy"),
          actual2: formatDateForDisplay(row.Actual2, "dd/MM/yy"),
          timeDelay2: String(row.TimeDelay2 || ""),
          remarks: String(row.Remarks || ""),
          checkStatus: String(row.Status || "N/A"),
          checkTimestamp: formatDateForDisplay(row.Planned2, "dd/MM/yy HH:mm"),
          tallyTimestamp: row.Actual2 ? formatDateForDisplay(row.Actual2, "dd/MM/yy HH:mm") : null,
          tallyRemarks: String(row.Remarks || ""),
          costingAmount2: "", 
        }
      })

      // Filter by Firm
      const filterByFirm = (data: any[]) => {
        if (!user?.firm || user?.role?.toLowerCase() === 'admin') return data;
        const firmSearchValues = getFirmMatchValues(user.firm);
        return data.filter(item => {
          const firmName = normalizeKey(item.firmName);
          return firmSearchValues.some((firmSearch) => firmName.includes(firmSearch) || firmSearch.includes(firmName));
        });
      };

      // Pending: production rows whose tally process is not completed yet.
      const pendingData = allItems.filter(item =>
        hasValue(item.jobCardNo) && hasValue(item.planned2) && !hasValue(item.tallyTimestamp)
      )
      setPendingTallies(filterByFirm(pendingData))

      // History: production rows whose tally process is completed.
      const historyData = allItems
        .filter(item => hasValue(item.jobCardNo) && hasValue(item.tallyTimestamp))
        .sort((a, b) => {
          if (a.tallyTimestamp && b.tallyTimestamp) {
            return new Date(b.tallyTimestamp).getTime() - new Date(a.tallyTimestamp).getTime()
          }
          return 0
        })
      setHistoryTallies(filterByFirm(historyData))

    } catch (err: any) {
      console.error("Error loading tally data:", err)
      setError(`Failed to load data: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }, [user?.firm, user?.role])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleVerify = (tally: ActualProductionItem) => {
    setSelectedTally(tally)
    setRemarks("")
    setIsDialogOpen(true)
  }

  const handleSaveTally = async () => {
    if (!selectedTally) return
    setIsSubmitting(true)
    try {
      // Update Actual2 (tally timestamp) and Remarks (tally remarks) in actual_production
      const { error: updateError } = await supabase
        .from('actual_production')
        .update({
          "Actual2": new Date().toISOString(),
          "Remarks": remarks
        })
        .eq("id", selectedTally.id)

      if (updateError) throw updateError

      alert("Tally verification completed successfully!")
      setIsDialogOpen(false)
      await loadData()
    } catch (err: any) {
      console.error("Error saving tally:", err)
      setError(err.message)
      alert(`Error: ${err.message}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  // --- UI Rendering ---
  const pendingTableColumns = [
    {
      header: "Action",
      key: "actionColumn",
      render: (tally: ActualProductionItem) => (
        <Button size="sm" onClick={() => handleVerify(tally)} className="bg-olive-600 text-white hover:bg-olive-700">
          <FileText className="mr-2 h-4 w-4" />
          Verify Tally
        </Button>
      ),
    },
    {
      header: "Job Card No.",
      key: "jobCardNo",
      render: (tally: ActualProductionItem) => <span className="font-medium">{tally.jobCardNo}</span>,
    },
    {
      header: "Firm Name",
      key: "firmName",
      render: (tally: ActualProductionItem) => tally.firmName,
    },
    {
      header: "Product Name",
      key: "productName",
      render: (tally: ActualProductionItem) => tally.productName
    },
    {
      header: "Quantity",
      key: "quantityOfFG",
      render: (tally: ActualProductionItem) => tally.quantityOfFG
    },
    {
      header: "Status",
      key: "status",
      render: (tally: ActualProductionItem) => <Badge variant="default">{tally.status}</Badge>,
    },
  ]

  const historyTableColumns = [
    {
      header: "Job Card No.",
      key: "jobCardNo",
      render: (tally: ActualProductionItem) => <span className="font-medium">{tally.jobCardNo}</span>,
    },
    {
      header: "Firm Name",
      key: "firmName",
      render: (tally: ActualProductionItem) => tally.firmName,
    },
    {
      header: "Product Name",
      key: "productName",
      render: (tally: ActualProductionItem) => tally.productName
    },
    {
      header: "Quantity",
      key: "quantityOfFG",
      render: (tally: ActualProductionItem) => tally.quantityOfFG
    },
    {
      header: "Tally Date",
      key: "tallyTimestamp",
      render: (tally: ActualProductionItem) => tally.tallyTimestamp || "N/A"
    },
    {
      header: "Remarks",
      key: "tallyRemarks",
      render: (tally: ActualProductionItem) => (
        <span className="max-w-xs truncate" title={tally.tallyRemarks}>
          {tally.tallyRemarks || "-"}
        </span>
      ),
    },
  ]

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-olive-600" />
        <p className="ml-4 text-lg">Loading Tally Data...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8 text-center text-red-600 bg-red-50 rounded-md">
        <AlertTriangle className="h-12 w-12 mx-auto mb-4" />
        <p className="text-lg font-semibold">Error Loading Data</p>
        <p className="text-sm">{error}</p>
        <Button onClick={loadData} className="mt-4">
          Retry
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-4 md:p-6 bg-white min-h-screen">
      <Card className="shadow-md border-none">
        <CardHeader className="bg-gradient-to-r from-olive-50 to-olive-100 rounded-t-lg">
          <CardTitle className="flex items-center gap-2 text-gray-800">
            <FileText className="h-6 w-6 text-olive-600" />
            Tally Management
          </CardTitle>
          <CardDescription className="text-gray-700">
            Manage and verify production tallies for completed items.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          <Tabs defaultValue="pending" className="w-full">
            <TabsList className="grid w-full sm:w-[450px] grid-cols-2 mb-6">
              <TabsTrigger value="pending" className="flex items-center gap-2">
                <FileText className="h-4 w-4" /> Pending Tallies
                <Badge variant="secondary" className="ml-1.5 px-1.5 py-0.5 text-xs">
                  {pendingTallies.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="history" className="flex items-center gap-2">
                <History className="h-4 w-4" /> Tally History
                <Badge variant="secondary" className="ml-1.5 px-1.5 py-0.5 text-xs">
                  {historyTallies.length}
                </Badge>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="pending">
              <Card className="shadow-sm border border-border">
                <CardHeader className="py-3 px-4 bg-olive-50 rounded-md">
                  <CardTitle className="text-md font-semibold">
                    Pending Tallies ({pendingTallies.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-muted/50">
                        <TableRow>
                          {pendingTableColumns.map((col) => (
                            <TableHead key={col.key}>{col.header}</TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pendingTallies.length > 0 ? (
                          pendingTallies.map((tally, index) => (
                            <TableRow key={`${tally.jobCardNo}-${index}`} className="hover:bg-olive-50/50">
                              {pendingTableColumns.map((col) => (
                                <TableCell key={col.key}>{col.render(tally)}</TableCell>
                              ))}
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={pendingTableColumns.length} className="h-48">
                              <div className="flex flex-col items-center justify-center text-center">
                                <FileText className="h-12 w-12 text-olive-500 mb-3" />
                                <p className="font-medium">No Pending Tallies</p>
                                <p className="text-sm text-muted-foreground">
                                  All production tallies have been verified.
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
                <CardHeader className="py-3 px-4 bg-olive-50 rounded-md">
                  <CardTitle className="text-md font-semibold">
                    Tally History ({historyTallies.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-muted/50">
                        <TableRow>
                          {historyTableColumns.map((col) => (
                            <TableHead key={col.key}>{col.header}</TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {historyTallies.length > 0 ? (
                          historyTallies.map((tally, index) => (
                            <TableRow key={`${tally.jobCardNo}-${index}`} className="hover:bg-olive-50/50">
                              {historyTableColumns.map((col) => (
                                <TableCell key={col.key}>{col.render(tally)}</TableCell>
                              ))}
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={historyTableColumns.length} className="h-48">
                              <div className="flex flex-col items-center justify-center text-center">
                                <History className="h-12 w-12 text-olive-500 mb-3" />
                                <p className="font-medium">No Tally History</p>
                                <p className="text-sm text-muted-foreground">
                                  Completed tally records will appear here.
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
              <Package className="h-5 w-5 text-olive-600" />
              Complete Production Details - Job Card: {selectedTally?.jobCardNo}
            </DialogTitle>
            <DialogDescription>
              All information from Actual Production for this job card
            </DialogDescription>
          </DialogHeader>

          {selectedTally && (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                handleSaveTally()
              }}
              className="space-y-6 pt-2"
            >
              {/* Section 1: Basic Information */}
              <div className="space-y-3">
                <h3 className="text-md font-semibold flex items-center gap-2 text-olive-700 bg-olive-50 p-2 rounded">
                  <Building className="h-4 w-4" /> Basic Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4 border rounded-lg">
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500 flex items-center gap-1">
                      <Hash className="h-3 w-3" /> Job Card Number
                    </Label>
                    <p className="text-sm font-medium bg-gray-50 p-2 rounded">{selectedTally.jobCardNo || "N/A"}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500 flex items-center gap-1">
                      <Building className="h-3 w-3" /> Firm Name
                    </Label>
                    <p className="text-sm font-medium bg-gray-50 p-2 rounded">{selectedTally.firmName || "N/A"}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500 flex items-center gap-1">
                      <Calendar className="h-3 w-3" /> Date of Production
                    </Label>
                    <p className="text-sm font-medium bg-gray-50 p-2 rounded">{selectedTally.dateOfProduction || "N/A"}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500 flex items-center gap-1">
                      <User className="h-3 w-3" /> Name of Supervisor
                    </Label>
                    <p className="text-sm font-medium bg-gray-50 p-2 rounded">{selectedTally.nameOfSupervisor || "N/A"}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500 flex items-center gap-1">
                      <Package className="h-3 w-3" /> Product Name
                    </Label>
                    <p className="text-sm font-medium bg-gray-50 p-2 rounded">{selectedTally.productName || "N/A"}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500 flex items-center gap-1">
                      <Package className="h-3 w-3" /> Quantity of FG
                    </Label>
                    <p className="text-sm font-medium bg-gray-50 p-2 rounded">{selectedTally.quantityOfFG || "N/A"}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500 flex items-center gap-1">
                      <Hash className="h-3 w-3" /> Serial Number
                    </Label>
                    <p className="text-sm font-medium bg-gray-50 p-2 rounded">{selectedTally.serialNumber || "N/A"}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500 flex items-center gap-1">
                      <Clock className="h-3 w-3" /> Machine Running Hour
                    </Label>
                    <p className="text-sm font-medium bg-gray-50 p-2 rounded">{selectedTally.machineRunningHour || "N/A"}</p>
                  </div>
                </div>
              </div>

              {/* Section 2: Raw Materials */}
              {selectedTally.rawMaterials.length > 0 && (
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
                        {selectedTally.rawMaterials.map((material, idx) => (
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

              {/* Section 3: Costing Information */}
              <div className="space-y-3">
                <h3 className="text-md font-semibold flex items-center gap-2 text-green-700 bg-green-50 p-2 rounded">
                  <DollarSign className="h-4 w-4" /> Costing Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border rounded-lg bg-green-50/30">
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500">Costing Amount (1st)</Label>
                    <p className="text-lg font-bold text-green-600">
                      ₹ {selectedTally.costingAmount?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || "0.00"}
                    </p>
                  </div>
                  {selectedTally.costingAmount2 && (
                    <div className="space-y-1">
                      <Label className="text-xs text-gray-500">Costing Amount (2nd)</Label>
                      <p className="text-lg font-bold text-green-600">₹ {Number(selectedTally.costingAmount2).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Section 4: Additional Production Details */}
              <div className="space-y-3">
                <h3 className="text-md font-semibold flex items-center gap-2 text-orange-700 bg-orange-50 p-2 rounded">
                  <FileText className="h-4 w-4" /> Additional Production Details
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4 border rounded-lg">
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500">Party Name</Label>
                    <p className="text-sm bg-gray-50 p-2 rounded">{selectedTally.partyName || "N/A"}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500">Order No.</Label>
                    <p className="text-sm bg-gray-50 p-2 rounded">{selectedTally.orderNo || "N/A"}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500">Color Condition</Label>
                    <p className="text-sm bg-gray-50 p-2 rounded">{selectedTally.colorCondition || "N/A"}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500">PP Bag Used</Label>
                    <p className="text-sm bg-gray-50 p-2 rounded">{selectedTally.ppBagUsed || "N/A"}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500">PP Bag To Be Used</Label>
                    <p className="text-sm bg-gray-50 p-2 rounded">{selectedTally.ppBagToBeUsed || "N/A"}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500">PP Bag (Small)</Label>
                    <p className="text-sm bg-gray-50 p-2 rounded">{selectedTally.ppBagSmall || "N/A"}</p>
                  </div>
                </div>
              </div>

              {/* Section 5: Planning and Actual Data */}
              <div className="space-y-3">
                <h3 className="text-md font-semibold flex items-center gap-2 text-olive-700 bg-olive-50 p-2 rounded">
                  <CheckCircle className="h-4 w-4" /> Planning & Actual Data
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border rounded-lg">
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-gray-600">Planned 1</Label>
                    <p className="text-sm">{selectedTally.planned1 || "N/A"}</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-gray-600">Actual 1</Label>
                    <p className="text-sm">{selectedTally.actual1 || "N/A"}</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-gray-600">Status</Label>
                    <p className="text-sm"><Badge>{selectedTally.status || "N/A"}</Badge></p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-gray-600">Actual Qty 1</Label>
                    <p className="text-sm">{selectedTally.actualQty1 || "N/A"}</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-gray-600">Planned 2</Label>
                    <p className="text-sm">{selectedTally.planned2 || "N/A"}</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-gray-600">Actual 2</Label>
                    <p className="text-sm">{selectedTally.actual2 || "N/A"}</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-gray-600">Time Delay 2</Label>
                    <p className="text-sm">{selectedTally.timeDelay2 || "N/A"}</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-gray-600">Remarks</Label>
                    <p className="text-sm">{selectedTally.remarks || "N/A"}</p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Tally Remarks Section */}
              <div className="space-y-3">
                <h3 className="text-md font-semibold flex items-center gap-2 text-olive-700">
                  <FileText className="h-4 w-4" /> Tally Verification Remarks
                </h3>
                <div className="space-y-2">
                  <Textarea
                    id="remarks"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="Enter your remarks for this tally verification..."
                    rows={3}
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSubmitting}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting} className="bg-olive-600 hover:bg-olive-700">
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Complete Tally Verification
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
