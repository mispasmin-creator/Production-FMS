"use client"

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth, FIRM_MAP } from "@/lib/auth";
import { 
    Loader2, 
    AlertTriangle, 
    Eye, 
    RefreshCw, 
    CheckCircle2,
    Clock,
    Calendar,
    Factory,
    History,
    User,
    X,
    ArrowRight,
    Hash,
    Package,
    Building2,
    Layers,
    FileText,
    BadgeCheck,
    Settings,
    Search
} from 'lucide-react';

// Shadcn UI components
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/lib/supabase";
import { fetchSemiActualRows, fetchSemiProductionRows, SEMI_ACTUAL_TABLE } from "@/lib/semi-finished-supabase";

// ==================== CONSTANTS ====================
// ==================== TYPE DEFINITIONS ====================
interface SemiActualRecord {
    _rowIndex: number;
    timestamp: string;
    semiFinishedJobCardNo: string;
    supervisorName: string;
    dateOfProduction: string;
    productName: string;
    qtyOfSemiFinishedGood: number;
    rawMaterial1Name: string;
    rawMaterial1Qty: number;
    rawMaterial2Name: string;
    rawMaterial2Qty: number;
    rawMaterial3Name: string;
    rawMaterial3Qty: number;
    isAnyEndProduct: string;
    endProductRawMaterialName: string;
    endProductQty: number;
    narration: string;
    serialNo: string;
    startingReading: number;
    startingReadingPhoto: string;
    endingReading: number;
    endingReadingPhoto: string;
    machineRunningHour: number;
    rawMaterial4Name: string;
    rawMaterial4Qty: number;
    rawMaterial5Name: string;
    rawMaterial5Qty: number;
    machineRunning: number;
    semiFinishedProductionNo: string;
    
    // Planning fields (using column letters as per your sheet)
    planned1: string;  // Column AC
    actual1: string;   // Column AD
    planned2: string;  // Column AH
    actual2: string;   // Column AI
    firmName?: string;
}

// Column Definitions
const PENDING_COLUMNS_META = [
    { header: "Actions", dataKey: "actions", alwaysVisible: true },
    { header: "Firm Name", dataKey: "firmName", alwaysVisible: true },
    { header: "Job Card No.", dataKey: "jobCardNo", alwaysVisible: true },
    { header: "Product Name", dataKey: "productName", alwaysVisible: true },
    { header: "Quantity", dataKey: "qty" },
    { header: "Planned Date", dataKey: "plannedDate" },
    { header: "Supervisor", dataKey: "supervisor" },
    { header: "Status", dataKey: "status" },
];

const PRODUCTION_COLUMNS_META = [
    { header: "Actions", dataKey: "actions", alwaysVisible: true },
    { header: "Firm Name", dataKey: "firmName", alwaysVisible: true },
    { header: "Job Card No.", dataKey: "jobCardNo", alwaysVisible: true },
    { header: "Product Name", dataKey: "productName", alwaysVisible: true },
    { header: "Quantity", dataKey: "qty" },
    { header: "Planned Date", dataKey: "plannedDate" },
    { header: "Supervisor", dataKey: "supervisor" },
    { header: "Status", dataKey: "status" },
];

const HISTORY_COLUMNS_META = [
    { header: "Firm Name", dataKey: "firmName", alwaysVisible: true },
    { header: "Job Card No.", dataKey: "jobCardNo", alwaysVisible: true },
    { header: "Product", dataKey: "productName", alwaysVisible: true },
    { header: "Qty", dataKey: "qty" },
    { header: "Stage 1", dataKey: "stage1" },
    { header: "Stage 2", dataKey: "stage2" },
    { header: "Supervisor", dataKey: "supervisor" },
    { header: "Status", dataKey: "status" },
];

// ==================== UTILITY FUNCTIONS ====================
const formatDisplayDate = (dateString: string): string => {
    if (!dateString || dateString === 'null' || dateString === 'undefined' || dateString === '-') return '-';
    
    try {
        // If already in DD/MM/YY format
        if (dateString.match(/^\d{2}\/\d{2}\/\d{2}$/)) {
            return dateString;
        }
        
        // If already in DD/MM/YYYY format
        if (dateString.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
            return dateString;
        }
        
        // Handle ISO date strings
        if (dateString.includes('T')) {
            const date = new Date(dateString);
            if (!isNaN(date.getTime())) {
                const day = date.getDate().toString().padStart(2, '0');
                const month = (date.getMonth() + 1).toString().padStart(2, '0');
                const year = date.getFullYear().toString().slice(-2);
                return `${day}/${month}/${year}`;
            }
        }
        
        // Handle format like "2/18/2026, 4:17:51 PM"
        const dateMatch = dateString.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
        if (dateMatch) {
            const [_, month, day, year] = dateMatch;
            return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year.slice(-2)}`;
        }
        
        return dateString;
    } catch {
        return dateString;
    }
};

// ==================== MAIN COMPONENT ====================
type TabType = 'pending' | 'history';

export default function Step4List() {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState<TabType>('pending');
    const [semiActualData, setSemiActualData] = useState<SemiActualRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState('');
    const [selectedRecord, setSelectedRecord] = useState<SemiActualRecord | null>(null);
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);
    const [isMarkDoneOpen, setIsMarkDoneOpen] = useState(false);
    const [markDoneRemarks, setMarkDoneRemarks] = useState('');
    const [markDoneErrors, setMarkDoneErrors] = useState<Record<string, string>>({});
    const [searchQuery, setSearchQuery] = useState("");
    const [firmFilter, setFirmFilter] = useState("all");

    const uniqueFirmsForFilter = useMemo(() => {
        const firms = new Set<string>();
        semiActualData.forEach((item) => {
            if (item.firmName) firms.add(item.firmName);
        });
        return Array.from(firms).sort();
    }, [semiActualData]);

    // Auto-dismiss success message
    useEffect(() => {
        if (!successMessage) return;
        const timer = setTimeout(() => setSuccessMessage(''), 3000);
        return () => clearTimeout(timer);
    }, [successMessage]);

    const loadData = useCallback(async () => {
        setLoading(true);
        setError(null);
        
        try {
            const [actualTable, productionTable] = await Promise.all([
                fetchSemiActualRows(),
                fetchSemiProductionRows()
            ]);

            const productionFirmByNo = new Map<string, string>();
            productionTable.forEach((row: any) => {
                const compositeKey = `${row.sfSrNo}::${String(row.nameOfSemiFinished || "").toLowerCase().trim()}`;
                productionFirmByNo.set(compositeKey, row.firmName);
                productionFirmByNo.set(row.sfSrNo, row.firmName);
            });

            const filterByFirm = (data: any[]) => {
                if (!user?.firm || user?.role?.toLowerCase() === 'admin') return data;
                const userFirms = user.firm.split(',').map(f => f.trim()).filter(Boolean);
                return data.filter(item => {
                    const fName = String(item.firmName || "").toLowerCase();
                    return userFirms.some(uf => {
                        const firmSearch = uf.toLowerCase();
                        const mappedFirmLower = (FIRM_MAP[uf] || uf).toLowerCase();
                        return fName.includes(firmSearch) || fName.includes(mappedFirmLower);
                    });
                });
            };

            const records: SemiActualRecord[] = actualTable
                .filter((row: any) => {
                    const serial = String(row.sNo || row.serialNo || "");
                    return serial.startsWith("SA-") || serial.startsWith("CR-");
                })
                .map((row: any) => {
                    const sfProductionNo = row.semiFinishedProductionNo || row.sfProductionNo || "";
                    const compositeKey = `${sfProductionNo}::${String(row.productName || "").toLowerCase().trim()}`;
                    
                    let firmName = "";
                    if (String(row.serialNo || row.sNo || "").startsWith("CR-")) {
                        firmName = sfProductionNo;
                    } else {
                        firmName = productionFirmByNo.get(compositeKey) || productionFirmByNo.get(sfProductionNo) || "";
                    }

                    return {
                        ...row,
                        serialNo: row.serialNo || row.sNo || "",
                        semiFinishedProductionNo: sfProductionNo,
                        firmName: firmName,
                    };
                });

            setSemiActualData(filterByFirm(records));
        } catch (err) {
            console.error("Error loading data:", err);
            setError(`Failed to load data: ${err instanceof Error ? err.message : String(err)}`);
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const filteredSemiActual = useMemo(() => {
        const q = searchQuery.toLowerCase().trim();
        let data = semiActualData;
        if (firmFilter !== "all") {
            data = data.filter((item) => String(item.firmName || "").toLowerCase() === firmFilter.toLowerCase());
        }
        if (!q) return data;
        return data.filter(item =>
            (item.semiFinishedJobCardNo || "").toLowerCase().includes(q) ||
            (item.firmName || "").toLowerCase().includes(q) ||
            (item.productName || "").toLowerCase().includes(q) ||
            (item.supervisorName || "").toLowerCase().includes(q) ||
            (item.serialNo || "").toLowerCase().includes(q)
        );
    }, [semiActualData, searchQuery, firmFilter]);

    // Filter data based on tabs
    // Pending Tab: entries where Stage 2 is not verified yet
    const pendingOrders = useMemo(() => filteredSemiActual.filter(item => {
        const actual2 = String(item.actual2 || '').trim();
        return actual2 === '' || actual2 === '-' || actual2 === 'null' || actual2 === 'undefined';
    }), [filteredSemiActual]);

    // History Tab: entries where Stage 2 has been verified
    const historyOrders = useMemo(() => filteredSemiActual.filter(item => {
        const actual2 = String(item.actual2 || '').trim();
        return actual2 !== '' && actual2 !== '-' && actual2 !== 'null' && actual2 !== 'undefined';
    }), [filteredSemiActual]);

    const getCurrentData = () => {
        switch (activeTab) {
            case 'pending': return pendingOrders;
            case 'history': return historyOrders;
            default: return [];
        }
    };

    const getTabCount = (tab: TabType) => {
        switch (tab) {
            case 'pending': return pendingOrders.length;
            case 'history': return historyOrders.length;
            default: return 0;
        }
    };

    const getStatusBadge = (record: SemiActualRecord) => {
        if (activeTab === 'pending') {
            return <Badge className="bg-amber-50 text-amber-600 hover:bg-amber-100">Tally Pending</Badge>;
        } else {
            const actual1 = String(record.actual1 || '').trim();
            const actual2 = String(record.actual2 || '').trim();
            
            if (actual1 && actual1 !== '-' && actual2 && actual2 !== '-') {
                return <Badge className="bg-emerald-50 text-emerald-600 hover:bg-emerald-100">Fully Verified</Badge>;
            } else if (actual1 && actual1 !== '-') {
                return <Badge className="bg-olive-50 text-olive-600 hover:bg-olive-100">Stage 1 Completed</Badge>;
            } else if (actual2 && actual2 !== '-') {
                return <Badge className="bg-olive-50 text-olive-600 hover:bg-olive-100">Stage 2 Completed</Badge>;
            }
            return <Badge className="bg-slate-50 text-slate-600 hover:bg-slate-100">Completed</Badge>;
        }
    };

    const handleViewDetails = (record: SemiActualRecord) => {
        setSelectedRecord(record);
        setIsDetailsOpen(true);
    };

    const handleMarkDone = (record: SemiActualRecord) => {
        setSelectedRecord(record);
        setMarkDoneRemarks('');
        setMarkDoneErrors({});
        setIsMarkDoneOpen(true);
    };

    const handleMarkDoneSubmit = async () => {
        if (!selectedRecord || !selectedRecord._rowIndex) {
            setError('Unable to identify the record row');
            return;
        }

        if (!markDoneRemarks.trim()) {
            setMarkDoneErrors({ remarks: 'Remarks are required' });
            return;
        }

        setIsSubmitting(true);
        setError(null);

        try {
            const today = new Date().toISOString().slice(0, 10);
            const updatePayload = {
                "Actual1": today,
                "Status": markDoneRemarks.trim(),
                "Planned2": today,
                "Actual2": today,
                "Status1": markDoneRemarks.trim()
            };

            const { error: updateError } = await supabase
                .from(SEMI_ACTUAL_TABLE)
                .update(updatePayload)
                .eq("id", selectedRecord._rowIndex);

            if (updateError) throw updateError;

            setSuccessMessage(`Record verified successfully!`);
            setIsMarkDoneOpen(false);
            await loadData();
        } catch (err) {
            console.error('Error marking as done:', err);
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-olive-600" />
                <p className="ml-3 text-sm text-slate-500">Loading production data...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-6 text-center text-red-600 bg-red-50 rounded-xl">
                <AlertTriangle className="h-10 w-10 mx-auto mb-3" />
                <p className="text-sm font-semibold">Error Loading Data</p>
                <p className="text-xs mt-1">{error}</p>
                <Button onClick={loadData} variant="outline" size="sm" className="mt-4">
                    Retry
                </Button>
            </div>
        );
    }

    const currentData = getCurrentData();

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            {/* Success Toast */}
            {successMessage && (
                <div className="fixed top-5 right-5 z-[200] flex items-center gap-3 px-5 py-3.5 bg-emerald-500 text-white rounded-2xl shadow-xl text-sm font-bold animate-in slide-in-from-top-2 duration-300">
                    <CheckCircle2 className="h-5 w-5" />
                    {successMessage}
                </div>
            )}

            {/* Header Card */}
            <Card className="shadow-lg border-none">
                <CardHeader className="bg-gradient-to-r from-olive-50 to-violet-100 rounded-t-lg">
                    <CardTitle className="flex items-center gap-2 text-gray-800">
                        <BadgeCheck className="h-6 w-6 text-olive-600" />
                        Tally Entry
                    </CardTitle>
                    <CardDescription className="text-gray-600">
                        Track and verify production stages from Semi Actual sheet
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-4 sm:p-6">
                    {/* Tabs & Search */}
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                        <div className="flex space-x-1 p-1 bg-slate-100 rounded-xl w-fit">
                            <button
                                onClick={() => setActiveTab('pending')}
                                className={`flex items-center px-4 py-2 rounded-lg font-medium text-xs transition-all ${
                                    activeTab === 'pending'
                                        ? 'bg-white text-olive-600 shadow-sm'
                                        : 'text-slate-500 hover:text-slate-700'
                                }`}
                            >
                                <Clock className="h-4 w-4 mr-2" />
                                Tally Verify ({getTabCount('pending')})
                            </button>
                            <button
                                onClick={() => setActiveTab('history')}
                                className={`flex items-center px-4 py-2 rounded-lg font-medium text-xs transition-all ${
                                    activeTab === 'history'
                                        ? 'bg-white text-olive-600 shadow-sm'
                                        : 'text-slate-500 hover:text-slate-700'
                                }`}
                            >
                                <History className="h-4 w-4 mr-2" />
                                History ({getTabCount('history')})
                            </button>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                            <Select
                                value={firmFilter}
                                onValueChange={setFirmFilter}
                            >
                                <SelectTrigger className="w-full sm:w-[150px] bg-white border-slate-200 text-xs h-9 rounded-lg">
                                    <SelectValue placeholder="All Firms" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all" className="text-xs">All Firms</SelectItem>
                                    {uniqueFirmsForFilter.map((firm) => (
                                        <SelectItem key={firm} value={firm} className="text-xs">
                                            {firm}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <div className="relative w-full sm:w-[250px]">
                                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search approval cards..."
                                    value={searchQuery}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                                    className="pl-9 focus-visible:ring-olive-500 h-9"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Refresh Button */}
                    <div className="flex justify-end mb-4">
                        <Button
                            onClick={loadData}
                            variant="outline"
                            size="sm"
                            className="h-8"
                        >
                            <RefreshCw className="h-3 w-3 mr-2" />
                            Refresh
                        </Button>
                    </div>

                    {/* Tables */}
                    <div className="overflow-x-auto rounded-lg border">
                        <Table>
                            <TableHeader className="bg-slate-50">
                                <TableRow>
                                    {(activeTab === 'pending' ? PENDING_COLUMNS_META : HISTORY_COLUMNS_META).map((col) => (
                                        <TableHead key={col.dataKey} className="whitespace-nowrap text-xs font-semibold">
                                            {col.header}
                                        </TableHead>
                                    ))}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {currentData.length > 0 ? (
                                    currentData.map((record, index) => (
                                        <TableRow key={`${record.serialNo}-${index}`} className="hover:bg-olive-50/40">
                                            {/* Actions Column - only for pending tab */}
                                            {activeTab === 'pending' && (
                                                <TableCell className="whitespace-nowrap">
                                                    <div className="flex items-center gap-2">
                                                        <Button
                                                            onClick={() => handleViewDetails(record)}
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-8 w-8 p-0 text-slate-500 hover:text-olive-600"
                                                        >
                                                            <Eye className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            onClick={() => handleMarkDone(record)}
                                                            size="sm"
                                                            className="h-8 bg-olive-600 text-white hover:bg-olive-700"
                                                        >
                                                            <CheckCircle2 className="h-3 w-3 mr-1" />
                                                            Verify
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            )}

                                            {/* Firm Name */}
                                            <TableCell className="whitespace-nowrap">
                                                <span className="text-sm font-semibold text-slate-800">
                                                    {record.firmName}
                                                </span>
                                            </TableCell>

                                            {/* Job Card No */}
                                            <TableCell className="whitespace-nowrap">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-semibold text-olive-600">
                                                        {record.semiFinishedJobCardNo}
                                                    </span>
                                                    {String(record.serialNo || "").startsWith("CR-") && (
                                                        <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-200 border-none text-[10px] px-1.5 py-0">
                                                            Crushing
                                                        </Badge>
                                                    )}
                                                </div>
                                            </TableCell>

                                            {/* Product Name */}
                                            <TableCell className="whitespace-nowrap">
                                                <span className="text-sm text-slate-700">
                                                    {record.productName}
                                                </span>
                                            </TableCell>

                                            {/* Quantity */}
                                            <TableCell className="whitespace-nowrap">
                                                <Badge variant="secondary" className="font-medium">
                                                    {record.qtyOfSemiFinishedGood}
                                                </Badge>
                                            </TableCell>

                                            {activeTab === 'pending' && (
                                                <TableCell className="whitespace-nowrap">
                                                    <div className="flex items-center text-sm text-slate-600">
                                                        <Calendar className="h-3 w-3 mr-1 text-slate-400" />
                                                        {formatDisplayDate(record.planned1)}
                                                    </div>
                                                </TableCell>
                                            )}
                                            {activeTab === 'history' && (
                                                <>
                                                    <TableCell className="whitespace-nowrap">
                                                        <div className="flex items-center gap-2 text-xs">
                                                            <span className="text-slate-400">{formatDisplayDate(record.planned1)}</span>
                                                            <ArrowRight className="h-3 w-3 text-olive-400" />
                                                            <span className="font-medium text-olive-600">{formatDisplayDate(record.actual1)}</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="whitespace-nowrap">
                                                        <div className="flex items-center gap-2 text-xs">
                                                            <span className="text-slate-400">{formatDisplayDate(record.planned2)}</span>
                                                            <ArrowRight className="h-3 w-3 text-blue-400" />
                                                            <span className="font-medium text-blue-600">{formatDisplayDate(record.actual2)}</span>
                                                        </div>
                                                    </TableCell>
                                                </>
                                            )}

                                            {/* Supervisor */}
                                            <TableCell className="whitespace-nowrap">
                                                <div className="flex items-center text-sm text-slate-600">
                                                    <User className="h-3 w-3 mr-1 text-slate-400" />
                                                    {record.supervisorName}
                                                </div>
                                            </TableCell>

                                            {/* Status */}
                                            <TableCell className="whitespace-nowrap">
                                                {getStatusBadge(record)}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell 
                                            colSpan={
                                                (activeTab === 'pending' ? PENDING_COLUMNS_META.length :
                                                 HISTORY_COLUMNS_META.length) + 1
                                            } 
                                            className="h-32 text-center text-slate-400"
                                        >
                                            No records found
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            {/* Details Dialog */}
            <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
                <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Production Details</DialogTitle>
                        <DialogDescription>
                            Job Card: {selectedRecord?.semiFinishedJobCardNo} | S.No: {selectedRecord?.serialNo}
                        </DialogDescription>
                    </DialogHeader>

                    {selectedRecord && (
                        <div className="space-y-6 py-4">
                            {/* Basic Information */}
                            <div className="space-y-3">
                                <h4 className="text-sm font-semibold text-slate-700 bg-slate-50 px-3 py-2 rounded-md">Basic Information</h4>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                    <div>
                                        <p className="text-xs text-slate-400 font-medium">Job Card No.</p>
                                        <p className="text-sm font-semibold text-olive-600">{selectedRecord.semiFinishedJobCardNo}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-400 font-medium">Supervisor</p>
                                        <p className="text-sm text-slate-700">{selectedRecord.supervisorName}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-400 font-medium">Production Date</p>
                                        <p className="text-sm text-slate-700">{formatDisplayDate(selectedRecord.dateOfProduction)}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-400 font-medium">Product Name</p>
                                        <p className="text-sm text-slate-700">{selectedRecord.productName}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-400 font-medium">Quantity</p>
                                        <p className="text-sm font-medium text-slate-700">{selectedRecord.qtyOfSemiFinishedGood}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-400 font-medium">Serial No.</p>
                                        <p className="text-sm text-slate-700">{selectedRecord.serialNo}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Raw Materials */}
                            <div className="space-y-3">
                                <h4 className="text-sm font-semibold text-slate-700 bg-slate-50 px-3 py-2 rounded-md">
                                    {String(selectedRecord.serialNo || "").startsWith("CR-") ? "Finished Goods Output" : "Raw Materials Consumed"}
                                </h4>
                                <div className="grid grid-cols-2 gap-4">
                                    {selectedRecord.rawMaterial1Name && (
                                        <div>
                                            <p className="text-xs text-slate-400 font-medium">
                                                {String(selectedRecord.serialNo || "").startsWith("CR-") ? "Finished Good 1" : "Raw Material 1"}
                                            </p>
                                            <p className="text-sm text-slate-700">{selectedRecord.rawMaterial1Name} ({selectedRecord.rawMaterial1Qty})</p>
                                        </div>
                                    )}
                                    {selectedRecord.rawMaterial2Name && (
                                        <div>
                                            <p className="text-xs text-slate-400 font-medium">
                                                {String(selectedRecord.serialNo || "").startsWith("CR-") ? "Finished Good 2" : "Raw Material 2"}
                                            </p>
                                            <p className="text-sm text-slate-700">{selectedRecord.rawMaterial2Name} ({selectedRecord.rawMaterial2Qty})</p>
                                        </div>
                                    )}
                                    {selectedRecord.rawMaterial3Name && (
                                        <div>
                                            <p className="text-xs text-slate-400 font-medium">
                                                {String(selectedRecord.serialNo || "").startsWith("CR-") ? "Finished Good 3" : "Raw Material 3"}
                                            </p>
                                            <p className="text-sm text-slate-700">{selectedRecord.rawMaterial3Name} ({selectedRecord.rawMaterial3Qty})</p>
                                        </div>
                                    )}
                                    {selectedRecord.rawMaterial4Name && (
                                        <div>
                                            <p className="text-xs text-slate-400 font-medium">
                                                {String(selectedRecord.serialNo || "").startsWith("CR-") ? "Finished Good 4" : "Raw Material 4"}
                                            </p>
                                            <p className="text-sm text-slate-700">{selectedRecord.rawMaterial4Name} ({selectedRecord.rawMaterial4Qty})</p>
                                        </div>
                                    )}
                                    {selectedRecord.rawMaterial5Name && (
                                        <div>
                                            <p className="text-xs text-slate-400 font-medium">Raw Material 5</p>
                                            <p className="text-sm text-slate-700">{selectedRecord.rawMaterial5Name} ({selectedRecord.rawMaterial5Qty})</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Machine Details */}
                            <div className="space-y-3">
                                <h4 className="text-sm font-semibold text-slate-700 bg-slate-50 px-3 py-2 rounded-md">Machine Details</h4>
                                <div className="grid grid-cols-3 gap-4">
                                    <div>
                                        <p className="text-xs text-slate-400 font-medium">Starting Reading</p>
                                        <p className="text-sm text-slate-700">{selectedRecord.startingReading}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-400 font-medium">Ending Reading</p>
                                        <p className="text-sm text-slate-700">{selectedRecord.endingReading}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-400 font-medium">Machine Hours</p>
                                        <p className="text-sm text-slate-700">{selectedRecord.machineRunningHour}</p>
                                    </div>
                                </div>
                                
                                {/* Photos */}
                                <div className="flex gap-4 mt-2">
                                    {selectedRecord.startingReadingPhoto && (
                                        <a 
                                            href={selectedRecord.startingReadingPhoto} 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="text-xs text-olive-600 hover:underline flex items-center"
                                        >
                                            <Eye className="h-3 w-3 mr-1" />
                                            View Start Photo
                                        </a>
                                    )}
                                    {selectedRecord.endingReadingPhoto && (
                                        <a 
                                            href={selectedRecord.endingReadingPhoto} 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="text-xs text-olive-600 hover:underline flex items-center"
                                        >
                                            <Eye className="h-3 w-3 mr-1" />
                                            View End Photo
                                        </a>
                                    )}
                                </div>
                            </div>

                            {/* Planning Dates */}
                            <div className="space-y-3">
                                <h4 className="text-sm font-semibold text-slate-700 bg-slate-50 px-3 py-2 rounded-md">Planning & Actual Dates</h4>
                                <div className="grid grid-cols-2 gap-6">
                                    <div>
                                        <p className="text-xs text-slate-400 font-medium mb-1">Stage 1</p>
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm text-slate-400">{formatDisplayDate(selectedRecord.planned1)}</span>
                                            <ArrowRight className="h-3 w-3 text-olive-400" />
                                            <span className="text-sm font-medium text-olive-600">{formatDisplayDate(selectedRecord.actual1)}</span>
                                        </div>
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-400 font-medium mb-1">Stage 2</p>
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm text-slate-400">{formatDisplayDate(selectedRecord.planned2)}</span>
                                            <ArrowRight className="h-3 w-3 text-blue-400" />
                                            <span className="text-sm font-medium text-blue-600">{formatDisplayDate(selectedRecord.actual2)}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Narration */}
                            {selectedRecord.narration && (
                                <div className="space-y-2">
                                    <h4 className="text-sm font-semibold text-slate-700 bg-slate-50 px-3 py-2 rounded-md">Narration</h4>
                                    <p className="text-sm text-slate-600 bg-slate-50 p-3 rounded-md">
                                        {selectedRecord.narration}
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/*Tally Dialog */}
            <Dialog open={isMarkDoneOpen} onOpenChange={setIsMarkDoneOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Verify Tally</DialogTitle>
                        <DialogDescription>
                            {selectedRecord?.semiFinishedJobCardNo} — {selectedRecord?.productName}
                        </DialogDescription>
                    </DialogHeader>

                    {selectedRecord && (
                        <form onSubmit={(e) => { e.preventDefault(); handleMarkDoneSubmit(); }} className="space-y-4 py-4">
                            {/* Summary */}
                            <div className="bg-slate-50 rounded-lg p-4 space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">Job Card:</span>
                                    <span className="font-medium text-olive-600">{selectedRecord.semiFinishedJobCardNo}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">Product:</span>
                                    <span className="font-medium text-slate-700">{selectedRecord.productName}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">Supervisor:</span>
                                    <span className="text-slate-600">{selectedRecord.supervisorName}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">Planned Date:</span>
                                    <span className="text-slate-600">
                                        {formatDisplayDate(selectedRecord.planned1)}
                                    </span>
                                </div>
                            </div>

                            {/* Remarks */}
                            <div className="space-y-2">
                                <Label htmlFor="remarks">Remarks <span className="text-red-500">*</span></Label>
                                <Textarea
                                    id="remarks"
                                    value={markDoneRemarks}
                                    onChange={(e) => {
                                        setMarkDoneRemarks(e.target.value);
                                        if (markDoneErrors.remarks) {
                                            setMarkDoneErrors({});
                                        }
                                    }}
                                    placeholder="Enter completion remarks..."
                                    className={markDoneErrors.remarks ? "border-red-500" : ""}
                                    rows={3}
                                />
                                {markDoneErrors.remarks && (
                                    <p className="text-xs text-red-500">{markDoneErrors.remarks}</p>
                                )}
                            </div>

                            {/* Actions */}
                            <div className="flex justify-end gap-2 pt-4">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setIsMarkDoneOpen(false)}
                                    disabled={isSubmitting}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="bg-olive-600 text-white hover:bg-olive-700"
                                >
                                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Confirm
                                </Button>
                            </div>
                        </form>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
