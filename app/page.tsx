"use client"
import type React from "react"
import { useState, useEffect, useCallback, useMemo } from "react"
import {
  Loader2,
  AlertTriangle,
  PackageCheck,
  TrendingUp,
  Factory,
  ClipboardList,
  ClipboardCheck,
  FileText,
  RefreshCw,
  Filter,
  Calendar as CalendarIcon,
  Eye,
} from "lucide-react"
import { format, parse } from "date-fns"
// Shadcn UI components
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import {
  Tooltip,
  ResponsiveContainer,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area
} from "recharts"
import {
  ArrowUpRight,
  ArrowDownRight,
  Activity
} from "lucide-react"
import { useAuth, FIRM_MAP } from "@/lib/auth"

// --- CONSTANTS ---
const SHEET_ID = "1Oh16UfYFmNff0YLxHRh_D3mw3r7m7b9FOvxRpJxCUh4"
const ORDERS_SHEET = "Orders"
const PRODUCTION_SHEET = "Production"
const MASTER_SHEET = "Master"
const COSTING_RESPONSE_SHEET = "Costing Response"
const JOBCARDS_SHEET = "JobCards"
const ACTUAL_PRODUCTION_SHEET = "Actual Production"
const SEMI_PRODUCTION_SHEET = "Semi Production"
const CRUSHING_ACTUAL_SHEET = "Crushing Actual"

// --- STYLING ---
const COLORS = {
  primary: "#74843C", // Light olive (Violet 500)
}

const PRIORITY_BADGE_VARIANT: { [key: string]: "default" | "destructive" | "secondary" } = {
  Urgent: "destructive",
  High: "secondary",
  Normal: "default",
}


// --- INTERFACES ---
interface AllOrdersRecord {
  id: string
  timestamp: string
  timestampObj: Date | null
  firmName: string
  partyName: string
  orderNo: string
  productName: string
}

interface ProductionOrderRecord {
  id: string
  timestamp: string
  timestampObj: Date | null
  deliveryOrderNo: string
  firmName: string
  partyName: string
  productName: string
  orderQuantity: number
  expectedDeliveryDate: string
  deliveryDateObj: Date | null
  priority: string
  note: string
  status: string
}

interface KittingHistoryRecord {
  id: string
  timestamp: string
  timestampObj: Date | null
  compositionNumber: string
  deliveryOrderNo: string
  productName: string
  sellingPrice: number
  gpPercentage: string
  rawMaterials: { name: string; quantity: number | string }[]
}

interface ActualProductionRecord {
  id: string
  timestamp: string
  timestampObj: Date | null
  jobCardNo: string
  firmName: string
  dateOfProduction: string
  supervisorName: string
  productName: string
  quantityFG: number
  serialNumber: string
  machineHours: string
  rawMaterials: { name: string; quantity: number | string }[]
  status: string
}

interface JobCardRecord {
  id: string
  timestamp: string
  timestampObj: Date | null
  jobCardNo: string
  firmName: string
  supervisorName: string
  deliveryOrderNo: string
  partyName: string
  productName: string
  orderQuantity: number
  dateOfProduction: string
  dateOfProductionObj: Date | null
  shift: string
  note: string
  status: string
}

interface SemiProductionRecord {
  id: string
  pending: number
  totalMade: number
  cancelOrder: number
}

interface CrushingActualRecord {
  id: string
  inputQty: number
  outputQty: number
}

interface MasterData {
  firmNames: string[]
  partyNames: string[]
  orderNumbers: string[]
  products: string[]
  priorities: string[]
  supervisors: string[]
}

// --- CUSTOM HOOK for data fetching ---
const useProductionData = () => {
  const { user } = useAuth()
  const [allOrders, setAllOrders] = useState<AllOrdersRecord[]>([])
  const [productionOrders, setProductionOrders] = useState<ProductionOrderRecord[]>([])
  const [actualProductionData, setActualProductionData] = useState<ActualProductionRecord[]>([])
  const [jobCardsData, setJobCardsData] = useState<JobCardRecord[]>([])
  const [semiProductionData, setSemiProductionData] = useState<SemiProductionRecord[]>([])
  const [crushingData, setCrushingData] = useState<CrushingActualRecord[]>([])
  const [kittingHistory, setKittingHistory] = useState<KittingHistoryRecord[]>([])
  const [masterData, setMasterData] = useState<MasterData>({
    firmNames: [],
    partyNames: [],
    orderNumbers: [],
    products: [],
    priorities: [],
    supervisors: [],
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchGoogleSheetData = async (sheetName: string) => {
    const response = await fetch(
      `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheetName)}&headers=1`,
    )
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
    const text = await response.text()
    const jsonText = text.substring(text.indexOf("(") + 1, text.lastIndexOf(")"))
    const json = JSON.parse(jsonText)
    if (json.status === "error") throw new Error(json.errors[0].detailed_message)
    return json.table
  }

  const processGvizTableByIndex = (table: any, startIndex = 0) => {
    if (!table || !table.rows || table.rows.length <= startIndex) return []
    const dataRows = table.rows.slice(startIndex)
    return dataRows
      .map((row: any) => {
        if (!row.c || row.c.every((cell: any) => !cell || cell.v === null || cell.v === "")) return null
        const rowData: { [key: string]: any } = {}
        row.c.forEach((cell: any, index: number) => {
          rowData[`col${index}`] = cell && cell.v !== null && cell.v !== undefined ? cell.v : ""
          if (cell && cell.f) {
            rowData[`col${index}_formatted`] = cell.f
          }
        })
        return rowData
      })
      .filter(Boolean)
  }

  const parseGvizDateTime = (gvizDate: string): Date | null => {
    if (!gvizDate || typeof gvizDate !== "string") return null
    try {
      const parsedDate = parse(gvizDate, "dd/MM/yyyy HH:mm:ss", new Date())
      if (!isNaN(parsedDate.getTime())) return parsedDate
    } catch (e) { }
    const dateTimeMatch = gvizDate.match(/Date\((\d+),(\d+),(\d+),(\d+),(\d+),(\d+)\)/)
    if (dateTimeMatch) {
      const [, year, month, day, hours, minutes, seconds] = dateTimeMatch.map(Number)
      return new Date(year, month, day, hours, minutes, seconds)
    }
    const dateOnlyParts = gvizDate.split("/")
    if (dateOnlyParts.length === 3) {
      const day = parseInt(dateOnlyParts[0], 10)
      const month = parseInt(dateOnlyParts[1], 10) - 1
      const year = parseInt(dateOnlyParts[2], 10)
      if (!isNaN(day) && !isNaN(month) && !isNaN(year)) return new Date(year, month, day)
    }
    const dateOnlyMatch = gvizDate.match(/Date\((\d+),(\d+),(\d+)\)/)
    if (dateOnlyMatch) {
      const [, year, month, day] = dateOnlyMatch.map(Number)
      return new Date(year, month, day)
    }
    return null
  }

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [
        ordersTable,
        productionSheetTable,
        masterTable,
        costingResponseTable,
        jobCardsTable,
        actualProductionTable,
        semiProductionTable,
        crushingActualTable,
      ] = await Promise.all([
        fetchGoogleSheetData(ORDERS_SHEET),
        fetchGoogleSheetData(PRODUCTION_SHEET),
        fetchGoogleSheetData(MASTER_SHEET),
        fetchGoogleSheetData(COSTING_RESPONSE_SHEET),
        fetchGoogleSheetData(JOBCARDS_SHEET),
        fetchGoogleSheetData(ACTUAL_PRODUCTION_SHEET),
        fetchGoogleSheetData(SEMI_PRODUCTION_SHEET),
        fetchGoogleSheetData(CRUSHING_ACTUAL_SHEET),
      ])

      const rawAllOrders = processGvizTableByIndex(ordersTable, 0)
      const rawProductionOrders = processGvizTableByIndex(productionSheetTable, 3)
      const rawMasterData = processGvizTableByIndex(masterTable, 0)
      const rawKittingHistory = processGvizTableByIndex(costingResponseTable, 0)
      const rawJobCards = processGvizTableByIndex(jobCardsTable, 0)
      const rawActualProduction = processGvizTableByIndex(actualProductionTable, 0)
      const rawSemiProduction = processGvizTableByIndex(semiProductionTable, 0)
      const rawCrushing = processGvizTableByIndex(crushingActualTable, 0)

      const processedAllOrders = rawAllOrders
        .map((row: any, index: number) => ({
          id: `all-orders-${index}`,
          timestamp: parseGvizDateTime(row["col0"]) ? format(parseGvizDateTime(row["col0"])!, "dd/MM/yyyy HH:mm:ss") : "N/A",
          timestampObj: parseGvizDateTime(row["col0"]),
          firmName: String(row["col1"] || ""),
          partyName: String(row["col2"] || ""),
          orderNo: String(row["col3"] || ""),
          productName: String(row["col4"] || ""),
        }))
        .filter((order: any) => order.firmName && order.firmName.trim() !== "")
        .sort((a: any, b: any) => (b.timestampObj?.getTime() ?? 0) - (a.timestampObj?.getTime() ?? 0))

      const processedProductionOrders = rawProductionOrders
        .map((row: any, index: number) => ({
          id: `prod-order-${index}`,
          timestamp: parseGvizDateTime(row["col0"]) ? format(parseGvizDateTime(row["col0"])!, "dd/MM/yyyy HH:mm:ss") : "N/A",
          timestampObj: parseGvizDateTime(row["col0"]),
          deliveryOrderNo: String(row["col1"] || ""),
          firmName: String(row["col2"] || ""),
          partyName: String(row["col3"] || ""),
          productName: String(row["col4"] || ""),
          orderQuantity: Number(row["col5"]) || 0,
          expectedDeliveryDate: row["col6_formatted"] || String(row["col6"] || ""),
          deliveryDateObj: parseGvizDateTime(String(row["col6"] || "")),
          priority: String(row["col7"] || "Normal"),
          note: String(row["col8"] || ""),
          status: String(row["col10"] || "Pending"),
        }))
        .filter((order: any) => order.deliveryOrderNo && order.deliveryOrderNo.trim() !== "")
        .sort((a: any, b: any) => (b.timestampObj?.getTime() ?? 0) - (a.timestampObj?.getTime() ?? 0))


      const processedKittingHistory = rawKittingHistory
        .map((row: any, index: number) => {
          const rawMaterials = []
          for (let i = 1; i <= 20; i++) {
            if (row[`col${14 + i}`]) {
              rawMaterials.push({ name: String(row[`col${14 + i}`]), quantity: Number(row[`col${34 + i}`]) || 0 })
            }
          }
          return {
            id: `kitting-hist-${index}`,
            timestamp: parseGvizDateTime(row["col0"]) ? format(parseGvizDateTime(row["col0"])!, "dd/MM/yyyy HH:mm:ss") : "N/A",
            timestampObj: parseGvizDateTime(row["col0"]),
            compositionNumber: String(row["col1"] || ""),
            deliveryOrderNo: String(row["col2"] || ""),
            productName: String(row["col3"] || ""),
            sellingPrice: Number(row["col9"] || 0),
            gpPercentage: String(row["col10"] || ""),
            rawMaterials: rawMaterials,
          }
        })
        .sort((a: any, b: any) => (b.timestampObj?.getTime() ?? 0) - (a.timestampObj?.getTime() ?? 0))

      const processedJobCards = rawJobCards
        .map((row: { [x: string]: any }, index: any) => ({
          id: `jc-${index}`,
          timestamp: parseGvizDateTime(row["col0"]) ? format(parseGvizDateTime(row["col0"])!, "dd/MM/yyyy HH:mm:ss") : "N/A",
          timestampObj: parseGvizDateTime(row["col0"]),
          jobCardNo: String(row["col1"] || ""),
          firmName: String(row["col2"] || ""),
          supervisorName: String(row["col3"] || ""),
          deliveryOrderNo: String(row["col4"] || ""),
          partyName: String(row["col5"] || ""),
          productName: String(row["col6"] || ""),
          orderQuantity: Number(row["col7"] || 0),
          dateOfProduction: parseGvizDateTime(String(row["col8"] || "")) ? format(parseGvizDateTime(String(row["col8"] || ""))!, "PPP") : "N/A",
          dateOfProductionObj: parseGvizDateTime(String(row["col8"] || "")),
          shift: String(row["col9"] || ""),
          note: String(row["col10"] || ""),
          status: String(row["col11"] || "Pending"),
        }))
        .filter((card: any) => card.timestampObj !== null && card.jobCardNo.startsWith("JC-"))
        .sort((a: any, b: any) => (b.timestampObj?.getTime() ?? 0) - (a.timestampObj?.getTime() ?? 0))

      const processedActualProduction = rawActualProduction
        .map((row: any, index: number) => {
          const rawMaterials = []
          for (let i = 8; i < 48; i += 2) {
            if (row[`col${i}`]) {
              rawMaterials.push({ name: String(row[`col${i}`]), quantity: Number(row[`col${i + 1}`]) || 0 })
            }
          }
          return {
            id: `ap-${index}`,
            timestamp: parseGvizDateTime(row["col0"]) ? format(parseGvizDateTime(row["col0"])!, "dd/MM/yyyy HH:mm:ss") : "N/A",
            timestampObj: parseGvizDateTime(row["col0"]),
            jobCardNo: String(row["col1"] || ""),
            firmName: String(row["col2"] || ""),
            dateOfProduction: row["col3_formatted"] || String(row["col3"] || ""),
            supervisorName: String(row["col4"] || ""),
            productName: String(row["col5"] || ""),
            quantityFG: Number(row["col6"] || 0),
            serialNumber: String(row["col7"] || ""),
            machineHours: row["col48_formatted"] || "00:00:00",
            rawMaterials: rawMaterials,
            status: String(row["col67"] || "Pending"),
          }
        })
        .filter((prod: any) => prod.timestampObj !== null && prod.jobCardNo.startsWith("JC-"))
        .sort((a: any, b: any) => (b.timestampObj?.getTime() ?? 0) - (a.timestampObj?.getTime() ?? 0))

      const getUniqueOptions = (data: any[], colIndex: number) => [...new Set(data.map((item) => String(item[`col${colIndex}`] || "")))].filter(Boolean);
      const firmNames = [...new Set(processedAllOrders.map((o: any) => o.firmName))].filter(Boolean) as string[];
      const partyNames = [...new Set(processedAllOrders.map((o: any) => o.partyName))].filter(Boolean) as string[];
      const orderNumbers = [...new Set(processedAllOrders.map((o: any) => o.orderNo))]
        .filter(Boolean)
        .sort((a: any, b: any) => b.localeCompare(a, undefined, { numeric: true })) as string[];
      const products = [...new Set(processedAllOrders.map((o: any) => o.productName))].filter(Boolean) as string[];
      const priorities = getUniqueOptions(rawMasterData, 0) as string[];
      const supervisors = getUniqueOptions(rawMasterData, 1) as string[];

      const processedSemiProduction = rawSemiProduction.map((row: any, index: number) => ({
        id: `semi-${index}`,
        firmName: String(row.col12 || ""),
        pending: Number(row.col7) || 0,
        totalMade: Number(row.col6) || 0,
        cancelOrder: Number(row.col8) || 0
      }));

      const processedCrushing = rawCrushing.map((row: any, index: number) => ({
        id: `crushing-${index}`,
        inputQty: Number(row.col3) || 0,
        outputQty: (Number(row.col5) || 0) + (Number(row.col7) || 0) + (Number(row.col9) || 0) + (Number(row.col11) || 0)
      }));

      setAllOrders(processedAllOrders)
      setProductionOrders(processedProductionOrders)
      setActualProductionData(processedActualProduction)
      setJobCardsData(processedJobCards)
      setSemiProductionData(processedSemiProduction)
      setCrushingData(processedCrushing)
      setKittingHistory(processedKittingHistory)
      setMasterData({ firmNames, partyNames, orderNumbers, products, priorities, supervisors })
    } catch (err: any) {
      setError(`Failed to load data: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { allOrders, productionOrders, actualProductionData, jobCardsData, semiProductionData, crushingData, kittingHistory, masterData, loading, error, refetch: fetchData }
}

// --- MAIN DASHBOARD COMPONENT ---
export default function ProductionDashboard() {
  const { allOrders, productionOrders, actualProductionData, jobCardsData, semiProductionData, crushingData, kittingHistory, masterData, loading, error, refetch } = useProductionData()

  // --- DERIVED METRICS ---
  const metrics = useMemo(() => {
    const totalOrders = allOrders.length
    const pendingOrders = allOrders.length - productionOrders.length
    const activeProduction = productionOrders.filter(o => o.status !== 'Completed').length
    const completedProduction = actualProductionData.length // Approximate

    // Calculate completion rate
    const completionRate = totalOrders > 0 ? ((productionOrders.length / totalOrders) * 100).toFixed(1) : "0"

    const costingPending = actualProductionData.filter(p => p.status !== 'Completed').length;

    // SF Prod Summary
    const sfPending = semiProductionData.reduce((acc, item) => acc + item.pending, 0);
    const sfCompleted = semiProductionData.reduce((acc, item) => acc + item.totalMade, 0);
    const sfCancelled = semiProductionData.reduce((acc, item) => acc + item.cancelOrder, 0);

    // Crushing Summary
    const crushingInput = crushingData.reduce((acc, item) => acc + item.inputQty, 0);
    const crushingOutput = crushingData.reduce((acc, item) => acc + item.outputQty, 0);

    return {
      totalOrders,
      pendingOrders,
      activeProduction,
      completedProduction,
      completionRate,
      jobCards: jobCardsData.length,
      costingPending,
      sfPending,
      sfCompleted,
      sfCancelled,
      crushingInput,
      crushingOutput
    }
  }, [allOrders, productionOrders, actualProductionData, jobCardsData, semiProductionData, crushingData])

  // --- CHART DATA PREPARATION ---

  const CHART_COLORS = ["#74843C", "#556B2F", "#10B981", "#F59E0B", "#3B82F6", "#6366F1"];

  // 1. Top Parties (Bar Chart)
  const topPartiesData = useMemo(() => {
    if (!productionOrders.length) return []
    const counts = productionOrders.reduce((acc, order) => {
      const party = order.partyName || "Unknown"
      acc[party] = (acc[party] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
  }, [productionOrders])

  // 2. Priority Distribution (Pie Chart)
  const priorityData = useMemo(() => {
    const counts = productionOrders.reduce((acc, order) => {
      const p = order.priority || "Normal"
      acc[p] = (acc[p] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    return Object.entries(counts).map(([name, value]) => ({ name, value }))
  }, [productionOrders])

  // 3. Order Status (Donut Chart)
  const statusData = useMemo(() => {
    const counts = productionOrders.reduce((acc, order) => {
      const s = order.status || "Pending"
      acc[s] = (acc[s] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    return Object.entries(counts).map(([name, value]) => ({ name, value }))
  }, [productionOrders])

  // 4. Production Trend (Area Chart - Last 7 Days)
  const productionTrendData = useMemo(() => {
    const last7Days = new Array(7).fill(0).map((_, i) => {
      const d = new Date()
      d.setDate(d.getDate() - i)
      return format(d, "dd/MM")
    }).reverse()

    const counts = actualProductionData.reduce((acc, prod) => {
      if (prod.timestampObj) {
        const dateStr = format(prod.timestampObj, "dd/MM")
        acc[dateStr] = (acc[dateStr] || 0) + (prod.quantityFG || 0)
      }
      return acc
    }, {} as Record<string, number>)

    return last7Days.map(date => ({
      date,
      quantity: counts[date] || 0
    }))
  }, [actualProductionData])

  // 5. Recent Activity Feed
  const recentActivities = useMemo(() => {
    const activities = [
      ...productionOrders.map(o => ({
        id: o.id,
        type: 'order',
        title: `New Order: ${o.deliveryOrderNo}`,
        subtitle: `${o.productName} - ${o.partyName}`,
        date: o.timestampObj,
        color: "text-blue-500",
        bg: "bg-blue-50"
      })),
      ...jobCardsData.map(j => ({
        id: j.id,
        type: 'jobcard',
        title: `Job Card: ${j.jobCardNo}`,
        subtitle: `${j.productName} - ${j.supervisorName}`,
        date: j.timestampObj,
        color: "text-olive-500",
        bg: "bg-olive-50"
      })),
      ...actualProductionData.map(p => ({
        id: p.id,
        type: 'production',
        title: `Production: ${p.jobCardNo}`,
        subtitle: `${p.productName} - ${p.quantityFG} units`,
        date: p.timestampObj,
        color: "text-emerald-500",
        bg: "bg-emerald-50"
      })),
      ...kittingHistory.map(k => ({
        id: k.id,
        type: 'kitting',
        title: `Kitting Verified: ${k.compositionNumber}`,
        subtitle: `${k.productName}`,
        date: k.timestampObj,
        color: "text-amber-500",
        bg: "bg-amber-50"
      }))
    ]

    return activities
      .sort((a, b) => (b.date?.getTime() || 0) - (a.date?.getTime() || 0))
      .slice(0, 7)
  }, [productionOrders, jobCardsData, actualProductionData, kittingHistory])


  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-muted-foreground animate-pulse">Loading Dashboard...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-50 p-4">
        <Card className="max-w-md w-full border-destructive/50 bg-destructive/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Error Loading Data
            </CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={refetch} variant="outline" className="w-full">
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry Connection
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50/50 p-6 space-y-8 animate-in fade-in duration-500">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Dashboard</h1>
          <p className="text-slate-500 mt-1">Overview of production performance and activities.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">Last updated: {format(new Date(), "HH:mm")}</span>
          <Button variant="outline" size="sm" onClick={refetch} className="hover:bg-slate-100">
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* METRICS GRID */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          title="Total Orders"
          value={metrics.totalOrders}
          icon={ClipboardList}
          trend="+12% from last month"
          trendUp={true}
          color="text-blue-600"
          bgColor="bg-blue-100"
        />
        <SummaryCard
          title="Pending Process"
          value={metrics.pendingOrders}
          icon={Activity}
          trend={`${metrics.pendingOrders} waiting`}
          trendUp={false}
          color="text-amber-600"
          bgColor="bg-amber-100"
        />
        <SummaryCard
          title="Active Production"
          value={metrics.activeProduction}
          icon={Factory}
          trend="Currently running"
          trendUp={true}
          color="text-olive-600"
          bgColor="bg-olive-100"
        />
        <SummaryCard
          title="Total Output"
          value={metrics.completedProduction}
          icon={PackageCheck}
          trend="Completed Units"
          trendUp={true}
          color="text-emerald-600"
          bgColor="bg-emerald-100"
        />
      </div>

      {/* OVERALL STAGE INFORMATION GRID */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2 px-1">
          <Factory className="h-5 w-5 text-olive-600" />
          Production Stage Summary
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <StageCard
            stage="Step 1: Orders"
            metric={`${metrics.totalOrders}`}
            label="Total D.O."
            color="border-l-blue-500"
            subMetric={`${metrics.pendingOrders} Waiting`}
          />
          <StageCard
            stage="Step 2: Planning"
            metric={`${metrics.activeProduction}`}
            label="In Production"
            color="border-l-olive-500"
            subMetric={`${metrics.completionRate}% Done`}
          />
          <StageCard
            stage="Step 3: SF Production"
            metric={`${metrics.sfPending}`}
            label="Pending SF"
            color="border-l-violet-500"
            subMetric={`${metrics.sfCompleted} Produced`}
          />
          <StageCard
            stage="Step 4: Job Cards"
            metric={`${metrics.jobCards}`}
            label="Total Created"
            color="border-l-olive-500"
            subMetric={`Active Batch`}
          />
          <StageCard
            stage="Step 5: Crushing"
            metric={`${Math.round(metrics.crushingInput)}`}
            label="Input (Kg)"
            color="border-l-pink-500"
            subMetric={`${Math.round(metrics.crushingOutput)} Output`}
          />
          <StageCard
            stage="Step 6: Costing"
            metric={`${metrics.costingPending}`}
            label="Pending Cost"
            color="border-l-emerald-500"
            subMetric={`${kittingHistory.length} Total`}
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">

        {/* LEFT COLUMN - MAIN CHARTS (Span 4) */}
        <div className="col-span-4 space-y-4">

          {/* PRODUCTION TREND */}
          <Card className="shadow-sm border-slate-200">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-slate-800">Production Output (Last 7 Days)</CardTitle>
              <CardDescription>Daily finished goods quantity</CardDescription>
            </CardHeader>
            <CardContent className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={productionTrendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorQty" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#74843C" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#74843C" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                  <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <Area type="monotone" dataKey="quantity" stroke="#74843C" strokeWidth={3} fillOpacity={1} fill="url(#colorQty)" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* TOP PARTIES CHART */}
          <Card className="shadow-sm border-slate-200">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-slate-800">Top Parties by Volume</CardTitle>
              <CardDescription>Clients with highest order count</CardDescription>
            </CardHeader>
            <CardContent className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topPartiesData} layout="vertical" margin={{ top: 0, right: 30, left: 60, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" width={100} axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                  <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <Bar dataKey="count" fill="#74843C" radius={[0, 4, 4, 0]} barSize={32}>
                    {topPartiesData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT COLUMN - SECONDARY CHARTS & FEED (Span 3) */}
        <div className="col-span-3 space-y-4">

          {/* PRIORITY DISTRIBUTION */}
          <Card className="shadow-sm border-slate-200">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-slate-800">Order Priority</CardTitle>
            </CardHeader>
            <CardContent className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={priorityData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {priorityData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* RECENT ACTIVITY */}
          <Card className="shadow-sm border-slate-200 flex flex-col h-[500px]">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                <Activity className="h-5 w-5 text-olive-500" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto pr-2">
              <div className="space-y-4">
                {recentActivities.map((activity) => (
                  <div key={activity.id} className="flex items-start gap-4 pb-4 border-b border-slate-100 last:border-0 last:pb-0">
                    <div className={cn("p-2 rounded-full shrink-0", activity.bg)}>
                      <div className={cn("h-4 w-4", activity.color)} />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-slate-800 leading-none">{activity.title}</p>
                      <p className="text-xs text-slate-500">{activity.subtitle}</p>
                      <p className="text-[10px] text-slate-400 capitalize">{activity.date ? format(activity.date, 'MMM dd, HH:mm') : 'N/A'}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  )
}

// --- HELPER COMPONENTS ---

function SummaryCard({ title, value, icon: Icon, trend, trendUp, color, bgColor }: any) {
  return (
    <Card className="shadow-sm border-slate-200">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-slate-500">{title}</CardTitle>
        <div className={cn("p-2 rounded-lg", bgColor)}>
          <Icon className={cn("h-4 w-4", color)} />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-slate-900">{value}</div>
        <p className="text-xs text-slate-500 mt-1 flex items-center">
          {trendUp ? <ArrowUpRight className="mr-1 h-3 w-3 text-emerald-500" /> : <ArrowDownRight className="mr-1 h-3 w-3 text-red-500" />}
          <span className={trendUp ? "text-emerald-500" : "text-slate-500"}>{trend}</span>
        </p>
      </CardContent>
    </Card>
  )
}

function StageCard({ stage, metric, label, color, subMetric }: any) {
  return (
    <Card className={cn("shadow-sm border border-slate-200 border-l-4", color)}>
      <CardContent className="p-4">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">{stage}</p>
        <div className="flex items-baseline gap-2">
          <h3 className="text-2xl font-black text-slate-800">{metric}</h3>
          <span className="text-xs font-medium text-slate-500">{label}</span>
        </div>
        <p className="text-xs font-semibold text-slate-400 mt-2 flex items-center gap-1">
          <TrendingUp className="h-3 w-3 text-emerald-500" />
          {subMetric}
        </p>
      </CardContent>
    </Card>
  )
}
