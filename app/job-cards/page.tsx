"use client"

import type React from "react"
import { useState, useEffect, useCallback, useMemo } from "react"
import { Loader2, CalendarIcon, FileCheck, History, AlertTriangle, Settings, XCircle } from "lucide-react"
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"

// Type Definitions
interface Order {
  key: number
  _rowIndex: number
  deliveryOrderNo: string
  firmName: string
  partyName: string
  productName: string
  orderQuantity: number
  expectedDeliveryDate: string
  priority: string
  note: string
  totalMade?: number
  pending?: number
  id?: number
}


interface JobCard {
  key: number
  id: number
  _rowIndex: number
  jobCardNo: string
  firmName: string
  supervisorName: string
  deliveryOrderNo: string
  partyName: string
  productName: string
  orderQuantity: number
  dateOfProduction: string
  shift: string
  notes: string
  createdAt: string
  totalMade: number
  cancelQty?: number
  cancelRemarks?: string
  expectedDeliveryDate: string
  priority: string
  status: 'active' | 'cancelled' | string
}


interface GvizRow {
  c: ({ v: any; f?: string } | null)[]
}

// Constants
// Constants
const PRODUCTION_TABLE = "production"
const JOBCARDS_TABLE = "jobcards"
const MASTER_TABLE = "master"
const COSTING_RESPONSE_TABLE = "costing_response"


// Column definitions based on your actual JobCards sheet structure
const PENDING_ORDERS_COLUMNS_META = [
  { header: "Action", dataKey: "actionColumn", toggleable: false, alwaysVisible: true },
  { header: "Delivery Order No.", dataKey: "deliveryOrderNo", toggleable: true, alwaysVisible: true },
  { header: "Firm Name", dataKey: "firmName", toggleable: true },
  { header: "Party Name", dataKey: "partyName", toggleable: true },
  { header: "Product Name", dataKey: "productName", toggleable: true },
  { header: "Order Quantity", dataKey: "orderQuantity", toggleable: true },
  { header: "Total Made", dataKey: "totalMade", toggleable: true },
  { header: "Pending", dataKey: "pending", toggleable: true },
  { header: "Planned Date", dataKey: "plannedDate", toggleable: true },

  { header: "Expected Delivery Date", dataKey: "expectedDeliveryDate", toggleable: true },
  { header: "Priority", dataKey: "priority", toggleable: true },
]

const HISTORY_COLUMNS_META = [
  { header: "Timestamp", dataKey: "createdAt", toggleable: true, alwaysVisible: true }, // ✅ ADDED
  { header: "Job Card No.", dataKey: "jobCardNo", toggleable: true, alwaysVisible: true },
  { header: "Firm Name", dataKey: "firmName", toggleable: true },
  { header: "Supervisor", dataKey: "supervisorName", toggleable: true },
  { header: "Delivery Order No.", dataKey: "deliveryOrderNo", toggleable: true },
  { header: "Party Name", dataKey: "partyName", toggleable: true },
  { header: "Product Name", dataKey: "productName", toggleable: true },
  { header: "Order Qty", dataKey: "orderQuantity", toggleable: true },
  { header: "Date of Production", dataKey: "dateOfProduction", toggleable: true },
  { header: "Shift", dataKey: "shift", toggleable: true },
  { header: "Total Made", dataKey: "totalMade", toggleable: true },
  // { header: "Cancel Qty", dataKey: "cancelQty", toggleable: true },
  // { header: "Remarks", dataKey: "cancelRemarks", toggleable: true },
  // { header: "Status", dataKey: "status", toggleable: true },
  // { header: "Cancel Action", dataKey: "cancelAction", toggleable: false, alwaysVisible: true },
]

export default function JobCardsPage() {
  const { user } = useAuth()
  const [pendingOrders, setPendingOrders] = useState<Order[]>([])
  const [historyJobCards, setHistoryJobCards] = useState<JobCard[]>([])
  const [supervisors, setSupervisors] = useState<string[]>([])
  const [shifts, setShifts] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [selectedJobCard, setSelectedJobCard] = useState<JobCard | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false)
  const [activeTab, setActiveTab] = useState("pending")
  const [visiblePendingColumns, setVisiblePendingColumns] = useState<Record<string, boolean>>({})
  const [visibleHistoryColumns, setVisibleHistoryColumns] = useState<Record<string, boolean>>({})

  const [formData, setFormData] = useState({
    supervisorName: "",
    dateOfProduction: new Date(),
    shift: "",
    notes: "",
    totalMade: "",
  })

  const [cancelFormData, setCancelFormData] = useState({
    cancelQty: "",
    cancelRemarks: "",
  })

  const [formErrors, setFormErrors] = useState<Record<string, string | null>>({})
  const [cancelFormErrors, setCancelFormErrors] = useState<Record<string, string | null>>({})



  useEffect(() => {
    const initializeVisibility = (columnsMeta: any[]) => {
      const visibility: Record<string, boolean> = {}
      columnsMeta.forEach((col) => {
        visibility[col.dataKey] = col.alwaysVisible || col.toggleable
      })
      return visibility
    }

    setVisiblePendingColumns(initializeVisibility(PENDING_ORDERS_COLUMNS_META))
    setVisibleHistoryColumns(initializeVisibility(HISTORY_COLUMNS_META))
  }, [])

  const loadAllData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [
        { data: allProductionData },
        { data: allJobCardsData },
        { data: allMasterData },
        { data: allCostingData }
      ] = await Promise.all([
        supabase.from(PRODUCTION_TABLE).select("*"),
        supabase.from(JOBCARDS_TABLE).select("*"),
        supabase.from(MASTER_TABLE).select("*"),
        supabase.from(COSTING_RESPONSE_TABLE).select("*")
      ])

      if (!allProductionData || !allJobCardsData || !allMasterData || !allCostingData) {
        throw new Error("Failed to fetch one or more tables")
      }

      // Process pending orders from Costing Response
      // Logic: has Planned 2 date and missing Actual 3 date
      const filteredRows = allCostingData.filter((row) => {
        const isApproved = row.Status === "Management Approved"
        const emptyActual3 = !row["Actual 3"] || String(row["Actual 3"]).trim() === ""
        return isApproved && emptyActual3
      })

      const findProductionRow = (deliveryOrderNo: string, productName: string) => {
        const normalizedDo = deliveryOrderNo.trim().toLowerCase()
        const normalizedProduct = productName.trim().toLowerCase()
        return allProductionData.find((p) => {
          const pDo = String(p["Delivery Order No."] || "").trim().toLowerCase()
          const pProduct = String(p["Product Name"] || "").trim().toLowerCase()
          return pDo === normalizedDo && pProduct === normalizedProduct
        }) || allProductionData.find(
          (p) => String(p["Delivery Order No."] || "").trim().toLowerCase() === normalizedDo
        )
      }

      const processedOrders: Order[] = filteredRows.map((row) => {
        const deliveryOrderNo = String(row["Order No."] || "").trim()
        const productName = String(row["product name"] || "").trim()
        const prodRow = findProductionRow(deliveryOrderNo, productName)
        const orderQty = prodRow ? Number(prodRow["Order Quantity"] || 0) : 0

        const matchingJobCards = allJobCardsData.filter(
          (jc: any) =>
            String(jc["Delivery Order No."] || "").trim() === deliveryOrderNo &&
            String(jc["Status"] || "active").toLowerCase() !== "cancelled"
        )
        const totalMadeSum = matchingJobCards.reduce(
          (sum: number, jc: any) => sum + Number(jc["Total Made"] || jc["Quantity"] || 0),
          0
        )

        return {
          key: row.id,
          id: row.id,
          _rowIndex: row.id,
          deliveryOrderNo,
          firmName: prodRow ? String(prodRow["Firm Name"] || "") : "",
          partyName: prodRow ? String(prodRow["Party Name"] || "") : "",
          productName,
          orderQuantity: orderQty,
          expectedDeliveryDate: prodRow && prodRow["Expected Delivery Date"] ? format(new Date(prodRow["Expected Delivery Date"]), "dd/MM/yyyy") : "",
          plannedDate: row["Planned 2"] ? format(new Date(row["Planned 2"]), "dd/MM/yy") : "",
          priority: prodRow ? String(prodRow["Priority"] || "") : "",
          totalMade: totalMadeSum,
          pending: orderQty - totalMadeSum,
          note: "",
        }
      }).filter((order) => Number(order.pending || 0) > 0)

      // Process job cards history
      const processedHistory: JobCard[] = allJobCardsData
        .map((row: any) => {
          const prodDate = row["Date Of Production"] ? new Date(row["Date Of Production"]) : null
          const createdAt = row["Timestamp"] ? new Date(row["Timestamp"]) : null
          
          const productionRow = findProductionRow(
            String(row["Delivery Order No."] || ""),
            String(row["Product Name"] || "")
          )

          return {
            key: row.id,
            id: row.id,
            _rowIndex: row.id,
            jobCardNo: String(row["JC-Job Card Number"] || ""),
            firmName: String(row["Firm Name"] || ""),
            supervisorName: String(row["Supervisor Name"] || ""),
            deliveryOrderNo: String(row["Delivery Order No."] || ""),
            partyName: String(row["Party Name"] || productionRow?.["Party Name"] || ""),
            productName: String(row["Product Name"] || ""),
            orderQuantity: Number(row["Quantity"] || 0),
            dateOfProduction: prodDate ? format(prodDate, "dd/MM/yyyy") : "",
            shift: String(row["Shift"] || ""),
            totalMade: Number(row["Total Made"] || 0),
            notes: String(row["Notes"] || ""),
            createdAt: createdAt ? format(createdAt, "dd/MM/yyyy HH:mm:ss") : "",
            expectedDeliveryDate: productionRow && productionRow["Expected Delivery Date"] 
              ? format(new Date(productionRow["Expected Delivery Date"]), "dd/MM/yyyy") 
              : "",
            priority: productionRow ? String(productionRow["Priority"] || "") : "",
            status: String(row["Status"] || "active").toLowerCase(),
          }
        })
        .sort((a, b) => b.id - a.id)

      // Filter by Firm
      const filterByFirm = (data: any[]) => {
        if (!user?.firm || user?.role?.toLowerCase() === 'admin') return data;
        const firmSearch = user.firm.toLowerCase();
        return data.filter(item => {
          const fName = String(item.firmName || "").toLowerCase();
          return fName.includes(firmSearch);
        });
      };

      setPendingOrders(filterByFirm(processedOrders))
      setHistoryJobCards(filterByFirm(processedHistory))

      // Load supervisors and shifts from master table
      const supervisorsList: string[] = [
        ...new Set(allMasterData.map((row: any) => String(row["Supervisor Name"] || "")).filter(Boolean)),
      ]
      const shiftsList: string[] = [...new Set(allMasterData.map((row: any) => String(row["Shift"] || "")).filter(Boolean))]

      setSupervisors(supervisorsList.length > 0 ? supervisorsList : ["Morning", "Evening", "Night"])
      setShifts(shiftsList.length > 0 ? shiftsList : ["Day", "Evening", "Night"])
    } catch (err: any) {
      console.error("Error loading data:", err)
      setError(`Failed to load data. Error: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }, [])


  useEffect(() => {
    loadAllData()
  }, [loadAllData])

  const handleOpenDialog = (order: Order) => {
    setSelectedOrder(order)
    setFormData({
      supervisorName: "",
      dateOfProduction: new Date(),
      shift: "",
      notes: "",
      totalMade: "",
    })
    setFormErrors({})
    setIsDialogOpen(true)
  }

  const handleOpenCancelDialog = (jobCard: JobCard) => {
    setSelectedJobCard(jobCard)
    setCancelFormData({
      cancelQty: "",
      cancelRemarks: "",
    })
    setCancelFormErrors({})
    setIsCancelDialogOpen(true)
  }

  const handleFormChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    if (formErrors[field]) setFormErrors((prev) => ({ ...prev, [field]: null }))
  }

  const handleCancelFormChange = (field: string, value: any) => {
    setCancelFormData((prev) => ({ ...prev, [field]: value }))
    if (cancelFormErrors[field]) setCancelFormErrors((prev) => ({ ...prev, [field]: null }))
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {}
    if (!formData.supervisorName) newErrors.supervisorName = "Supervisor name is required"
    if (!formData.dateOfProduction) newErrors.dateOfProduction = "Production date is required"
    if (!formData.shift) newErrors.shift = "Shift is required"
    if (!formData.totalMade || Number(formData.totalMade) <= 0) {
      newErrors.totalMade = "Valid total made quantity is required"
    }
    if (selectedOrder && Number(formData.totalMade) > selectedOrder.orderQuantity) {
      newErrors.totalMade = "Total made cannot exceed order quantity"
    }
    setFormErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const validateCancelForm = () => {
    const newErrors: Record<string, string> = {}
    if (!cancelFormData.cancelQty || Number(cancelFormData.cancelQty) <= 0) {
      newErrors.cancelQty = "Valid cancel quantity is required"
    }
    if (selectedJobCard && Number(cancelFormData.cancelQty) > selectedJobCard.totalMade) {
      newErrors.cancelQty = "Cancel quantity cannot exceed total made"
    }
    if (!cancelFormData.cancelRemarks?.trim()) {
      newErrors.cancelRemarks = "Remarks are required for cancellation"
    }
    setCancelFormErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const getNextJobCardNumber = () => {
    if (historyJobCards.length === 0) return 1
    
    const numbers = historyJobCards
      .map(card => {
        const match = card.jobCardNo.match(/JC-(\d+)/)
        return match ? parseInt(match[1], 10) : 0
      })
      .filter(num => !isNaN(num))
    
    return numbers.length > 0 ? Math.max(...numbers) + 1 : 1
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!validateForm()) return
    if (!selectedOrder || !selectedOrder.deliveryOrderNo) {
      alert("Error: Missing selected order details. Please refresh and try again.")
      return
    }

    setIsSubmitting(true)
    try {
      const nextNumber = getNextJobCardNumber()
      const jobCardNumber = `JC-${String(nextNumber).padStart(3, "0")}`

      const { error: insertError } = await supabase
        .from(JOBCARDS_TABLE)
        .insert([{
          "JC-Job Card Number": jobCardNumber,
          "Firm Name": selectedOrder.firmName,
          "Supervisor Name": formData.supervisorName,
          "Delivery Order No.": selectedOrder.deliveryOrderNo,
          "Party Name": selectedOrder.partyName,
          "Product Name": selectedOrder.productName,
          "Quantity": Number(formData.totalMade),
          "Date Of Production": format(formData.dateOfProduction, "yyyy-MM-dd"),
          "Shift": formData.shift,
          "Notes": formData.notes || "",
          "Status": "active"
        }])

      if (insertError) throw insertError

      alert(`Job Card ${jobCardNumber} created successfully!`)
      setIsDialogOpen(false)
      await loadAllData()
    } catch (err: any) {
      console.error("Submit error:", err)
      setError(err.message)
      alert(`Error: ${err.message}`)
    } finally {
      setIsSubmitting(false)
    }
  }


  const handleCancelSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!validateCancelForm()) return
    if (!selectedJobCard) return

    setIsSubmitting(true)
    try {
      const { error: updateError } = await supabase
        .from(JOBCARDS_TABLE)
        .update({
          Status: "cancelled",
          Notes: `${selectedJobCard.notes}\nCancelled: ${cancelFormData.cancelRemarks} (Qty: ${cancelFormData.cancelQty})`
        })
        .eq("id", selectedJobCard.id)

      if (updateError) throw updateError

      alert(`Job Card ${selectedJobCard.jobCardNo} cancelled successfully!`)
      setIsCancelDialogOpen(false)
      await loadAllData()
    } catch (err: any) {
      console.error("Cancel error:", err)
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
      if (col.toggleable && !col.alwaysVisible) newVisibility[col.dataKey] = checked
    })
    const setter = tab === "pending" ? setVisiblePendingColumns : setVisibleHistoryColumns
    setter((prev) => ({ ...prev, ...newVisibility }))
  }

  const visiblePendingOrdersColumns = useMemo(
    () => PENDING_ORDERS_COLUMNS_META.filter((col) => visiblePendingColumns[col.dataKey]),
    [visiblePendingColumns],
  )

  const visibleHistoryJobCardsColumns = useMemo(
    () => HISTORY_COLUMNS_META.filter((col) => visibleHistoryColumns[col.dataKey]),
    [visibleHistoryColumns],
  )

 const pendingQty = useMemo(() => {
  if (!selectedOrder) return 0

  // ✅ ALWAYS from sheet (NOT from input)
  const total = Number(selectedOrder.totalMade || 0)

  return selectedOrder.orderQuantity - total
}, [selectedOrder])

  if (loading)
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-olive-600" /> 
        <p className="ml-4 text-lg">Loading Data...</p>
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
    <div className="space-y-6 p-4 md:p-6 bg-white min-h-screen max-w-full overflow-x-hidden">
      <Card className="shadow-md border-none">
        <CardHeader className="bg-gradient-to-r from-olive-50 to-olive-100 rounded-t-lg">
          <CardTitle className="flex items-center gap-2 text-gray-800">
            <FileCheck className="h-6 w-6 text-olive-600" />
            Job Card Management
          </CardTitle>
          <CardDescription className="text-gray-700">
            Create and manage job cards for production orders 
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 lg:p-8">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
            <TabsList className="grid w-full sm:w-[450px] grid-cols-2 mb-6">
              <TabsTrigger value="pending" className="flex items-center gap-2">
                <FileCheck className="h-4 w-4" /> Pending Orders{" "}
                <Badge variant="secondary" className="ml-1.5 px-1.5 py-0.5 text-xs">
                  {pendingOrders.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="history" className="flex items-center gap-2">
                <History className="h-4 w-4" /> Job Card History{" "}
                <Badge variant="secondary" className="ml-1.5 px-1.5 py-0.5 text-xs">
                  {historyJobCards.length}
                </Badge>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="pending" className="flex-1 flex flex-col mt-0">
              <Card className="shadow-sm border border-border flex-1 flex flex-col">
                <CardHeader className="py-3 px-4 bg-muted/30">
                  <div className="flex flex-wrap justify-between items-center bg-olive-50 rounded-md p-2 gap-4">
                    <CardTitle className="flex items-center text-md font-semibold text-foreground">
                      <FileCheck className="h-5 w-5 text-primary mr-2" />
                      Pending for Production ({pendingOrders.length})
                    </CardTitle>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="h-8 text-xs bg-transparent">
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
                              onClick={() => handleSelectAllColumns("pending", PENDING_ORDERS_COLUMNS_META, true)}
                            >
                              Select All
                            </Button>
                            <span className="text-gray-300 mx-1">|</span>
                            <Button
                              variant="link"
                              size="sm"
                              className="p-0 h-auto text-xs"
                              onClick={() => handleSelectAllColumns("pending", PENDING_ORDERS_COLUMNS_META, false)}
                            >
                              Deselect All
                            </Button>
                          </div>
                          <div className="space-y-1.5 max-h-48 overflow-y-auto">
                            {PENDING_ORDERS_COLUMNS_META.filter((col) => col.toggleable).map((col) => (
                              <div key={`toggle-pending-${col.dataKey}`} className="flex items-center space-x-2">
                                <Checkbox
                                  id={`toggle-pending-${col.dataKey}`}
                                  checked={!!visiblePendingColumns[col.dataKey]}
                                  onCheckedChange={(checked) =>
                                    handleToggleColumn("pending", col.dataKey, Boolean(checked))
                                  }
                                  disabled={col.alwaysVisible}
                                />
                                <Label
                                  htmlFor={`toggle-pending-${col.dataKey}`}
                                  className="text-xs font-normal cursor-pointer"
                                >
                                  {col.header}
                                </Label>
                              </div>
                            ))}
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                </CardHeader>
                <CardContent className="p-0 flex-1 flex flex-col">
                  {pendingOrders.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 px-4 text-center flex-1">
                      <FileCheck className="h-12 w-12 text-olive-500 mb-3" />
                      <p className="font-medium text-foreground">No Pending Orders Found</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto w-full rounded-b-lg" style={{ maxHeight: "60vh" }}>
                      <Table>
                        <TableHeader className="bg-muted/50 sticky top-0 z-10">
                          <TableRow>
                            {visiblePendingOrdersColumns.map((col) => (
                              <TableHead key={col.dataKey} className="whitespace-nowrap text-xs">
                                {col.header}
                              </TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {pendingOrders.map((order) => (
                            <TableRow key={order.key} className="hover:bg-olive-50/50">
                              {visiblePendingOrdersColumns.map((column) => (
                                <TableCell
                                  key={column.dataKey}
                                  className={`whitespace-nowrap text-xs ${
                                    column.dataKey === "deliveryOrderNo" ? "font-medium text-primary" : "text-gray-700"
                                  }`}
                                >
                                  {column.dataKey === "actionColumn" ? (
                                    <Button
                                      onClick={() => handleOpenDialog(order)}
                                      size="sm"
                                      disabled={isSubmitting}
                                      className="text-xs h-7 px-2 py-1 bg-olive-600 text-white hover:bg-olive-700"
                                    >
                                      Create Job Card
                                    </Button>
                                  ) : (
                                    order[column.dataKey as keyof Order]?.toString() || "-"
                                  )}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="history" className="flex-1 flex flex-col mt-0">
              <Card className="shadow-sm border border-border flex-1 flex flex-col">
                <CardHeader className="py-3 px-4 bg-muted/30">
                  <div className="flex flex-wrap justify-between items-center bg-olive-50 rounded-md p-2 gap-4">
                    <CardTitle className="flex items-center text-md font-semibold text-foreground">
                      <History className="h-5 w-5 text-primary mr-2" />
                      Job Card History ({historyJobCards.length})
                    </CardTitle>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="h-8 text-xs bg-transparent">
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
                              onClick={() => handleSelectAllColumns("history", HISTORY_COLUMNS_META, true)}
                            >
                              Select All
                            </Button>
                            <span className="text-gray-300 mx-1">|</span>
                            <Button
                              variant="link"
                              size="sm"
                              className="p-0 h-auto text-xs"
                              onClick={() => handleSelectAllColumns("history", HISTORY_COLUMNS_META, false)}
                            >
                              Deselect All
                            </Button>
                          </div>
                          <div className="space-y-1.5 max-h-48 overflow-y-auto">
                            {HISTORY_COLUMNS_META.filter((col) => col.toggleable).map((col) => (
                              <div key={`toggle-history-${col.dataKey}`} className="flex items-center space-x-2">
                                <Checkbox
                                  id={`toggle-history-${col.dataKey}`}
                                  checked={!!visibleHistoryColumns[col.dataKey]}
                                  onCheckedChange={(checked) =>
                                    handleToggleColumn("history", col.dataKey, Boolean(checked))
                                  }
                                  disabled={col.alwaysVisible}
                                />
                                <Label
                                  htmlFor={`toggle-history-${col.dataKey}`}
                                  className="text-xs font-normal cursor-pointer"
                                >
                                  {col.header}
                                </Label>
                              </div>
                            ))}
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                </CardHeader>
                <CardContent className="p-0 flex-1 flex flex-col">
                  {historyJobCards.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-center flex-1">
                      <History className="h-12 w-12 text-olive-500 mb-3" />
                      <p className="font-medium text-foreground">No Job Cards Found</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto w-full rounded-b-lg" style={{ maxHeight: "60vh" }}>
                      <Table>
                        <TableHeader className="bg-muted/50 sticky top-0 z-10">
                          <TableRow>
                            {visibleHistoryJobCardsColumns.map((col) => (
                              <TableHead key={col.dataKey} className="whitespace-nowrap text-xs">
                                {col.header}
                              </TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {historyJobCards.map((card) => (
                            <TableRow key={card.key} className="hover:bg-olive-50/50">
                              {visibleHistoryJobCardsColumns.map((column) => (
                                <TableCell
                                  key={column.dataKey}
                                  className={`whitespace-nowrap text-xs ${
                                    column.dataKey === "jobCardNo" ? "font-medium text-primary" : "text-gray-700"
                                  }`}
                                >
                                  {column.dataKey === "status" ? (
                                    <Badge variant={card.status === 'cancelled' ? 'destructive' : 'default'}>
                                      {card.status}
                                    </Badge>
                                  ) : column.dataKey === "cancelAction" ? (
                                    card.status === 'active' && (
                                      <Button
                                        onClick={() => handleOpenCancelDialog(card)}
                                        size="sm"
                                        variant="destructive"
                                        className="text-xs h-7 px-2 py-1"
                                      >
                                        <XCircle className="h-3 w-3 mr-1" />
                                        Cancel
                                      </Button>
                                    )
                                  ) : (
                                    card[column.dataKey as keyof JobCard]?.toString() || "-"
                                  )}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Create Job Card Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Job Card for DO: {selectedOrder?.deliveryOrderNo}</DialogTitle>
            <DialogDescription>
              Fill out the production details below. Fields with * are required.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid gap-6 py-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <Label>Firm Name</Label>
                  <Input value={selectedOrder?.firmName || ""} readOnly className="bg-muted" />
                </div>
                <div>
                  <Label>Party Name</Label>
                  <Input value={selectedOrder?.partyName || ""} readOnly className="bg-muted" />
                </div>
                <div>
                  <Label>Product Name</Label>
                  <Input value={selectedOrder?.productName || ""} readOnly className="bg-muted" />
                </div>
                <div>
                  <Label>Order Quantity</Label>
                  <Input value={selectedOrder?.orderQuantity} readOnly type="number" className="bg-muted" />
                </div>
              </div>
               {selectedOrder && (
                <p className="text-xs text-gray-500 mt-1">
                  Pending Qty: {pendingQty}
                </p>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                <div>
                  <Label htmlFor="supervisor">Supervisor Name *</Label>
                  <Select 
                    value={formData.supervisorName} 
                    onValueChange={(v) => handleFormChange("supervisorName", v)}
                  >
                    <SelectTrigger id="supervisor" className={formErrors.supervisorName ? "border-red-500" : ""}>
                      <SelectValue placeholder="Select Supervisor..." />
                    </SelectTrigger>
                    <SelectContent>
                      {supervisors.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {formErrors.supervisorName && (
                    <p className="text-xs text-red-600 mt-1">{formErrors.supervisorName}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="date-of-prod">Date of Production *</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        id="date-of-prod"
                        variant="outline"
                        className={cn(
                          "w-full justify-start font-normal",
                          !formData.dateOfProduction && "text-muted-foreground",
                          formErrors.dateOfProduction && "border-red-500",
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {formData.dateOfProduction ? (
                          format(formData.dateOfProduction, "PPP")
                        ) : (
                          <span>Pick a date</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={formData.dateOfProduction}
                        onSelect={(d) => handleFormChange("dateOfProduction", d)}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  {formErrors.dateOfProduction && (
                    <p className="text-xs text-red-600 mt-1">{formErrors.dateOfProduction}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="shift">Shift *</Label>
                  <Select value={formData.shift} onValueChange={(v) => handleFormChange("shift", v)}>
                    <SelectTrigger id="shift" className={formErrors.shift ? "border-red-500" : ""}>
                      <SelectValue placeholder="Select Shift..." />
                    </SelectTrigger>
                    <SelectContent>
                      {shifts.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {formErrors.shift && <p className="text-xs text-red-600 mt-1">{formErrors.shift}</p>}
                </div>

                <div>
                  <Label htmlFor="totalMade">Total Made *</Label>
                  <Input
                    id="totalMade"
                    type="number"
                    min="0"
                    max={selectedOrder?.orderQuantity}
                    value={formData.totalMade}
                    onChange={(e) => handleFormChange("totalMade", e.target.value)}
                    className={formErrors.totalMade ? "border-red-500" : ""}
                    placeholder="Enter quantity produced"
                  />
                  {formErrors.totalMade && (
                    <p className="text-xs text-red-600 mt-1">{formErrors.totalMade}</p>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="notes">Notes / Remarks</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => handleFormChange("notes", e.target.value)}
                  placeholder="Enter any production notes..."
                  rows={3}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting} className="bg-olive-600 text-white hover:bg-olive-700">
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Job Card
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Cancel Job Card Dialog */}
      <Dialog open={isCancelDialogOpen} onOpenChange={setIsCancelDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Cancel Job Card: {selectedJobCard?.jobCardNo}</DialogTitle>
            <DialogDescription>
              Enter the quantity to cancel and provide remarks.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCancelSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cancelQty">Cancel Quantity *</Label>
              <Input
                id="cancelQty"
                type="number"
                min="0"
                max={selectedJobCard?.totalMade}
                value={cancelFormData.cancelQty}
                onChange={(e) => handleCancelFormChange("cancelQty", e.target.value)}
                className={cancelFormErrors.cancelQty ? "border-red-500" : ""}
                placeholder="Enter quantity to cancel"
              />
              {cancelFormErrors.cancelQty && (
                <p className="text-xs text-red-600">{cancelFormErrors.cancelQty}</p>
              )}
              {selectedJobCard && (
                <p className="text-xs text-gray-500">
                  Max cancel quantity: {selectedJobCard.totalMade}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="cancelRemarks">Remarks *</Label>
              <Textarea
                id="cancelRemarks"
                value={cancelFormData.cancelRemarks}
                onChange={(e) => handleCancelFormChange("cancelRemarks", e.target.value)}
                className={cancelFormErrors.cancelRemarks ? "border-red-500" : ""}
                placeholder="Enter reason for cancellation"
                rows={3}
              />
              {cancelFormErrors.cancelRemarks && (
                <p className="text-xs text-red-600">{cancelFormErrors.cancelRemarks}</p>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setIsCancelDialogOpen(false)} disabled={isSubmitting}>
                No, Keep it
              </Button>
              <Button type="submit" variant="destructive" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Yes, Cancel
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
