"use client"

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth, FIRM_MAP } from "@/lib/auth";
import { format } from 'date-fns';
import {
    Loader2, AlertTriangle, RefreshCw, ClipboardList, History,
    FileCheck, X, Plus, Clock, Search
} from 'lucide-react';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";
import {
    fetchMasterRows,
    fetchSemiJobCardRows,
    fetchSemiProductionRows,
    getMasterValue,
    SEMI_JOB_CARD_TABLE,
    SEMI_PRODUCTION_TABLE,
    toSupabaseDate,
} from "@/lib/semi-finished-supabase";

// ==================== CONSTANTS ====================
// ==================== TYPE DEFINITIONS ====================
interface SemiProductionRecord {
    _rowIndex: number;
    timestamp: string;
    sfSrNo: string;
    nameOfSemiFinished: string;
    qty: number;
    notes: string;
    totalPlanned: number;
    totalMade: number;
    pending: number;
    cancelOrder: string;
    status: string;
    planned: string;   // Column K
    actual: string;    // Column L
    firmName: string;  // Column M
}

interface SemiJobCardRecord {
    _rowIndex: number;
    timestamp: string;
    sjcSrNo: string;
    sfSrNo: string;
    supervisorName: string;
    productName: string;
    qty: number;
    dateOfProduction: string;
    firmName?: string;
}

interface Supervisor {
    name: string;
}

// ==================== HELPERS ====================
const formatDisplayDate = (val: any): string => {
    if (!val) return '-';
    // plain string date
    try {
        const d = new Date(val);
        if (!isNaN(d.getTime())) return format(d, 'dd/MM/yy');
    } catch { /* */ }
    return String(val);
};

// ==================== PENDING LOGIC ====================
// A record is PENDING if:
//   Planned (Column K) is NOT null/empty AND Actual (Column L) IS null/empty
//   OR the status is not completed/cancelled
const isOrderPending = (record: SemiProductionRecord): boolean => {
    if (Number(record.pending || 0) <= 0) return false;

    const statusStr = String(record.status || '').toLowerCase().trim();
    if (['complete', 'completed', 'cancelled', 'cancel'].includes(statusStr)) return false;

    const hasPlanned = record.planned && record.planned !== '' && record.planned !== 'null';
    const hasActual = record.actual && record.actual !== '' && record.actual !== 'null';

    // If planned is set but actual is not — definitely pending
    if (hasPlanned && !hasActual) return true;

    // Otherwise treat as pending
    return true;
};

// ==================== MAIN COMPONENT ====================
export default function SFJobCardPage() {
    const { user } = useAuth();
    const [searchQuery, setSearchQuery] = useState("");
    const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedProd, setSelectedProd] = useState<SemiProductionRecord | null>(null);
    const [formError, setFormError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    const [productionData, setProductionData] = useState<SemiProductionRecord[]>([]);
    const [jobCardData, setJobCardData] = useState<SemiJobCardRecord[]>([]);
    const [supervisors, setSupervisors] = useState<Supervisor[]>([]);

    const [formData, setFormData] = useState({
        supervisorName: '',
        qty: '',
        dateOfProduction: new Date().toISOString().split('T')[0],
    });

    // Auto-dismiss success toast
    useEffect(() => {
        if (!successMessage) return;
        const t = setTimeout(() => setSuccessMessage(''), 3000);
        return () => clearTimeout(t);
    }, [successMessage]);

    const loadAllData = useCallback(async () => {
        setIsLoading(true);
        setLoadError('');
        try {
            const [semiJobCardTable, masterTable] = await Promise.all([
                fetchSemiJobCardRows(),
                fetchMasterRows(),
            ]);

            const productions = await fetchSemiProductionRows();
            const productionFirmByNo = new Map(productions.map((row) => [row.sfSrNo, row.firmName]));

            // Build a live map of sfSrNo -> sum of actualMade from job cards
            // This ensures "Total Made" in pending orders reflects real job card data
            // even if semi_production."Total Made" column is stale in the DB.
            const actualMadeBysfSrNo = new Map<string, number>();
            semiJobCardTable.forEach((row: any) => {
                const sfNo = String(row.sfSrNo || "");
                const made = Number(row.actualMade || 0);
                if (sfNo) {
                    actualMadeBysfSrNo.set(sfNo, (actualMadeBysfSrNo.get(sfNo) || 0) + made);
                }
            });

            // Patch each production record's totalMade AND pending with live-computed values.
            // pending = qty - totalMade  (so it stays in sync with the actual quantity produced)
            const patchedProductions = productions.map(p => {
                const computedTotalMade = actualMadeBysfSrNo.has(p.sfSrNo)
                    ? actualMadeBysfSrNo.get(p.sfSrNo)!
                    : p.totalMade;
                const cancelledQty = Number(p.cancelOrder) || 0;
                const computedPending = Math.max(p.qty - computedTotalMade - cancelledQty, 0);
                return {
                    ...p,
                    totalMade: computedTotalMade,
                    pending: computedPending,
                };
            });
            
            // Filter by Firm
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

            setProductionData(filterByFirm(patchedProductions).sort((a, b) => b._rowIndex - a._rowIndex));

            const jobCards: SemiJobCardRecord[] = semiJobCardTable
                .filter((row: any) => row.sjcSrNo && /^SJC-\d+/.test(row.sjcSrNo))
                .map((row: any) => ({ ...row, firmName: productionFirmByNo.get(row.sfSrNo) || "" }));

            setJobCardData(filterByFirm(jobCards).sort((a, b) => b._rowIndex - a._rowIndex));

            // ── Process Master data for supervisors ──
            const supSet = new Set<string>();
            masterTable.forEach((row: any) => {
                // Specifically use Column L (SF Supervisor Name) as requested
                const val = getMasterValue(row, ["SF Supervisor Name", "Supervisor Name", "L"]);
                if (val && val !== 'null' && val !== 'undefined') {
                    supSet.add(val);
                }
            });
            setSupervisors(Array.from(supSet).sort().map(name => ({ name })));

        } catch (err: any) {
            console.error('Error loading SF Job Card data:', err);
            setLoadError(`Failed to load data: ${err.message || 'Unknown error'}. Please try refreshing.`);
        } finally {
            setIsLoading(false);
        }
    }, [user]);

    useEffect(() => {
        loadAllData();
    }, [loadAllData]);

    // Generate next SJC number from existing data
    const getNextSJCNo = (): string => {
        if (jobCardData.length === 0) return 'SJC-381';
        const nums = jobCardData
            .map(j => parseInt(j.sjcSrNo.replace('SJC-', ''), 10))
            .filter(n => !isNaN(n));
        const max = nums.length > 0 ? Math.max(...nums) : 380;
        return `SJC-${max + 1}`;
    };

    const handlePlanClick = (record: SemiProductionRecord) => {
        setSelectedProd(record);
        setFormError('');
        setFormData({
            supervisorName: '',
            qty: String(record.pending > 0 ? record.pending : record.qty),
            dateOfProduction: new Date().toISOString().split('T')[0],
        });
        setIsModalOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedProd) return;
        if (!formData.supervisorName) { setFormError('Please select a supervisor.'); return; }
        if (!formData.qty || Number(formData.qty) <= 0) { setFormError('Please enter a valid quantity.'); return; }

        setIsSubmitting(true);
        setFormError('');
        try {
            const sjcSrNo = getNextSJCNo();

            const plannedQty = Number(formData.qty);
            const { error: insertError } = await supabase.from(SEMI_JOB_CARD_TABLE).insert({
                "Timestamp": new Date().toISOString(),
                "SJC-Sr No.": sjcSrNo,
                "Semi Finished Production No.": selectedProd.sfSrNo,
                "Supervisor Name": formData.supervisorName,
                "Product Name": selectedProd.nameOfSemiFinished,
                "Qty": plannedQty,
                "Date Of Production": toSupabaseDate(formData.dateOfProduction),
                "Actual Made": 0,
                "Pending": plannedQty,
                "Status": "",
                "Planned": new Date().toISOString().slice(0, 10),
            });

            if (insertError) throw insertError;

            const nextTotalPlanned = Number(selectedProd.totalPlanned || 0) + plannedQty;
            const cancelledQty = Number(selectedProd.cancelOrder || 0);
            const nextPending = Math.max(Number(selectedProd.qty || 0) - nextTotalPlanned - (Number.isFinite(cancelledQty) ? cancelledQty : 0), 0);
            const { error: updateError } = await supabase
                .from(SEMI_PRODUCTION_TABLE)
                .update({
                    "Total Planned": nextTotalPlanned,
                    "Pending": nextPending,
                    "Planned": new Date().toISOString().slice(0, 10),
                    "Status": nextPending <= 0 ? "COMPLETED" : "PENDING",
                })
                .eq("id", selectedProd._rowIndex);

            if (updateError) throw updateError;

            setSuccessMessage(`Job Card ${sjcSrNo} created successfully!`);
            setIsModalOpen(false);
            setSelectedProd(null);
            setFormData({ supervisorName: '', qty: '', dateOfProduction: new Date().toISOString().split('T')[0] });
            await loadAllData();
        } catch (err: any) {
            console.error('Error submitting job card:', err);
            setFormError(err.message || 'An error occurred. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Derived data
    const pendingOrders = productionData.filter(isOrderPending);
    const historyOrders = jobCardData;

    const filteredPending = useMemo(() => {
        return pendingOrders.filter((item) => {
            return searchQuery.trim() === "" || [
                item.sfSrNo,
                item.nameOfSemiFinished,
                item.notes,
                item.status,
                item.firmName
            ].some(val => String(val || "").toLowerCase().includes(searchQuery.toLowerCase().trim()))
        })
    }, [pendingOrders, searchQuery])

    const filteredHistory = useMemo(() => {
        return historyOrders.filter((item) => {
            return searchQuery.trim() === "" || [
                item.sjcSrNo,
                item.sfSrNo,
                item.supervisorName,
                item.productName,
                item.firmName
            ].some(val => String(val || "").toLowerCase().includes(searchQuery.toLowerCase().trim()))
        })
    }, [historyOrders, searchQuery])

    // ==================== RENDER ====================
    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-olive-600" />
                <p className="ml-3 text-sm text-slate-500">Loading job card data...</p>
            </div>
        );
    }

    if (loadError) {
        return (
            <div className="p-6 text-center text-red-600 bg-red-50 rounded-xl m-6">
                <AlertTriangle className="h-10 w-10 mx-auto mb-3" />
                <p className="text-sm font-semibold">Error Loading Data</p>
                <p className="text-xs mt-1 mb-4">{loadError}</p>
                <Button onClick={loadAllData} variant="outline" size="sm">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Retry
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            {/* Success Toast */}
            {successMessage && (
                <div className="fixed top-5 right-5 z-[200] flex items-center gap-3 px-5 py-3.5 bg-emerald-500 text-white rounded-2xl shadow-xl text-sm font-bold animate-in slide-in-from-top-2 duration-300">
                    <span className="text-lg">✓</span>
                    {successMessage}
                </div>
            )}

            {/* ── Header Card ── */}
            <Card className="shadow-lg border-none">
                <CardHeader className="bg-gradient-to-r from-olive-50 to-violet-100 rounded-t-lg">
                    <CardTitle className="flex items-center gap-2 text-gray-800">
                        <FileCheck className="h-6 w-6 text-olive-600" />
                        Semi Job Card Management
                    </CardTitle>
                    <CardDescription className="text-gray-600">
                        Create and manage job cards for semi-finished production
                    </CardDescription>
                </CardHeader>

                <CardContent className="p-4 sm:p-6">
                    {/* Header row */}
                    <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4 mb-6">
                        <div>
                            <h3 className="text-lg font-semibold text-slate-800">Job Card Orders</h3>
                            <p className="text-xs text-slate-400 font-medium">
                                {searchQuery ? `${filteredPending.length} / ${pendingOrders.length}` : pendingOrders.length} pending · {searchQuery ? `${filteredHistory.length} / ${historyOrders.length}` : historyOrders.length} job cards
                            </p>
                        </div>
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                            <div className="relative w-full sm:w-64">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                <Input
                                    placeholder="Search job cards..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-10 h-9 rounded-xl border-slate-200 bg-white text-xs focus:ring-olive-500/20 focus:border-olive-500"
                                />
                            </div>
                            <Button onClick={loadAllData} variant="outline" size="sm" className="h-9">
                                <RefreshCw className="h-4 w-4 mr-2" />
                                Refresh
                            </Button>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="flex space-x-1 border-b border-slate-100 mb-6">
                        <button
                            onClick={() => setActiveTab('pending')}
                            className={`flex items-center px-5 py-3 font-semibold text-sm transition-all relative ${activeTab === 'pending'
                                    ? 'text-olive-600 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-olive-600'
                                    : 'text-slate-400 hover:text-slate-600'
                                }`}
                        >
                            <Clock size={16} className="mr-2" />
                            Pending Orders
                            <span className={`ml-2 px-2 py-0.5 text-xs rounded-full font-bold ${activeTab === 'pending' ? 'bg-olive-100 text-olive-700' : 'bg-slate-100 text-slate-600'
                                }`}>
                                {searchQuery ? `${filteredPending.length} / ${pendingOrders.length}` : pendingOrders.length}
                            </span>
                        </button>

                        <button
                            onClick={() => setActiveTab('history')}
                            className={`flex items-center px-5 py-3 font-semibold text-sm transition-all relative ${activeTab === 'history'
                                    ? 'text-olive-600 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-olive-600'
                                    : 'text-slate-400 hover:text-slate-600'
                                }`}
                        >
                            <History size={16} className="mr-2" />
                            Job Card History
                            <span className={`ml-2 px-2 py-0.5 text-xs rounded-full font-bold ${activeTab === 'history' ? 'bg-olive-100 text-olive-700' : 'bg-slate-100 text-slate-600'
                                }`}>
                                {searchQuery ? `${filteredHistory.length} / ${historyOrders.length}` : historyOrders.length}
                            </span>
                        </button>
                    </div>

                    {/* ── Pending Orders Tab ── */}
                    {activeTab === 'pending' && (
                        filteredPending.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 text-center">
                                <FileCheck className="h-16 w-16 text-olive-300 mb-4" />
                                <p className="font-bold text-slate-600">No Pending Orders Found</p>
                                <p className="text-xs text-slate-400 mt-1">All production orders are completed</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto rounded-lg border border-slate-100">
                                <Table>
                                    <TableHeader className="bg-slate-50">
                                        <TableRow>
                                            <TableHead className="whitespace-nowrap text-xs font-semibold">Actions</TableHead>
                                            <TableHead className="whitespace-nowrap text-xs font-semibold">SF Sr. No.</TableHead>
                                            <TableHead className="whitespace-nowrap text-xs font-semibold">Product Name</TableHead>
                                            <TableHead className="whitespace-nowrap text-xs font-semibold">Total Qty</TableHead>
                                            <TableHead className="whitespace-nowrap text-xs font-semibold">Total Made</TableHead>
                                            <TableHead className="whitespace-nowrap text-xs font-semibold">Pending Qty</TableHead>
                                            <TableHead className="whitespace-nowrap text-xs font-semibold">Notes</TableHead>
                                            <TableHead className="whitespace-nowrap text-xs font-semibold">Status</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredPending.map((order: SemiProductionRecord, index: number) => (
                                            <TableRow key={`pending-${order.sfSrNo}-${index}`} className="hover:bg-olive-50/40">
                                                <TableCell className="whitespace-nowrap">
                                                    <Button
                                                        onClick={() => handlePlanClick(order)}
                                                        size="sm"
                                                        className="bg-olive-600 text-white hover:bg-olive-700 text-xs"
                                                    >
                                                        <ClipboardList size={12} className="mr-1" />
                                                        Plan
                                                    </Button>
                                                </TableCell>
                                                <TableCell className="whitespace-nowrap">
                                                    <div className="text-sm font-semibold text-olive-600">{order.sfSrNo}</div>
                                                </TableCell>
                                                <TableCell className="whitespace-nowrap">
                                                    <div className="font-medium text-slate-800">{order.nameOfSemiFinished}</div>
                                                </TableCell>
                                                {/* Total Qty */}
                                                <TableCell className="whitespace-nowrap text-sm font-medium text-slate-700">
                                                    {order.qty}
                                                </TableCell>
                                                {/* Total Made (col G) */}
                                                <TableCell className="whitespace-nowrap text-sm font-medium text-olive-600">
                                                    {order.totalMade}
                                                </TableCell>
                                                {/* Pending Qty (col H) */}
                                                <TableCell className="whitespace-nowrap text-sm font-medium text-amber-600">
                                                    {order.pending}
                                                </TableCell>

                                                <TableCell className="max-w-[150px] truncate text-sm text-slate-600" title={order.notes}>
                                                    {order.notes || '-'}
                                                </TableCell>
                                                <TableCell className="whitespace-nowrap">
                                                    <Badge className="bg-amber-50 text-amber-600 border-0 text-xs">
                                                        PENDING
                                                    </Badge>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )
                    )}

                    {/* ── Job Card History Tab ── */}
                    {activeTab === 'history' && (
                        filteredHistory.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 text-center">
                                <History className="h-16 w-16 text-olive-300 mb-4" />
                                <p className="font-bold text-slate-600">No Job Cards Found</p>
                                <p className="text-xs text-slate-400 mt-1">Create your first job card from pending orders</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto rounded-lg border border-slate-100">
                                <Table>
                                    <TableHeader className="bg-slate-50">
                                        <TableRow>
                                            <TableHead className="whitespace-nowrap text-xs font-semibold">Timestamp</TableHead>
                                            <TableHead className="whitespace-nowrap text-xs font-semibold">SJC Sr. No.</TableHead>
                                            <TableHead className="whitespace-nowrap text-xs font-semibold">SF Sr. No.</TableHead>
                                            <TableHead className="whitespace-nowrap text-xs font-semibold">Supervisor</TableHead>
                                            <TableHead className="whitespace-nowrap text-xs font-semibold">Product</TableHead>
                                            <TableHead className="whitespace-nowrap text-xs font-semibold">Qty</TableHead>
                                            <TableHead className="whitespace-nowrap text-xs font-semibold">Date of Production</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredHistory.map((job: SemiJobCardRecord, index: number) => (
                                            <TableRow key={`history-${job.sjcSrNo}-${index}`} className="hover:bg-olive-50/40">
                                                <TableCell className="whitespace-nowrap text-xs text-slate-500">
                                                    {job.timestamp || '-'}
                                                </TableCell>
                                                <TableCell className="whitespace-nowrap">
                                                    <div className="text-sm font-semibold text-olive-600">{job.sjcSrNo}</div>
                                                </TableCell>
                                                <TableCell className="whitespace-nowrap text-sm text-slate-600">
                                                    {job.sfSrNo}
                                                </TableCell>
                                                <TableCell className="whitespace-nowrap text-sm font-medium text-slate-700">
                                                    {job.supervisorName}
                                                </TableCell>
                                                <TableCell className="whitespace-nowrap text-sm text-slate-600">
                                                    {job.productName}
                                                </TableCell>
                                                <TableCell className="whitespace-nowrap text-sm font-bold text-slate-800">
                                                    {job.qty}
                                                </TableCell>
                                                <TableCell className="whitespace-nowrap text-sm text-slate-500">
                                                    {job.dateOfProduction || '-'}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )
                    )}
                </CardContent>
            </Card>

            {/* ── Create Job Card Modal ── */}
            <Dialog open={isModalOpen} onOpenChange={(open) => {
                setIsModalOpen(open);
                if (!open) { setSelectedProd(null); setFormError(''); }
            }}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <ClipboardList className="h-5 w-5 text-olive-600" />
                            Create Job Card
                        </DialogTitle>
                        <DialogDescription>
                            Fill in the details to create a new semi job card entry in the <strong>Semi Job Card</strong> sheet.
                        </DialogDescription>
                    </DialogHeader>

                    {selectedProd && (
                        <form onSubmit={handleSubmit} className="space-y-4 py-2">
                            {/* SF Sr No (Read Only) */}
                            <div className="space-y-2">
                                <Label htmlFor="jc-sfSrNo">SF Sr. No. (Production No.)</Label>
                                <Input
                                    id="jc-sfSrNo"
                                    value={selectedProd.sfSrNo}
                                    readOnly
                                    className="bg-slate-50 font-semibold text-olive-600"
                                />
                            </div>

                            {/* Product Name (Read Only) */}
                            <div className="space-y-2">
                                <Label htmlFor="jc-productName">Product Name</Label>
                                <Input
                                    id="jc-productName"
                                    value={selectedProd.nameOfSemiFinished}
                                    readOnly
                                    className="bg-slate-50"
                                />
                            </div>

                            {/* Supervisor Dropdown */}
                            <div className="space-y-2">
                                <Label htmlFor="jc-supervisor">Supervisor Name *</Label>
                                <Select
                                    value={formData.supervisorName}
                                    onValueChange={(value) => setFormData({ ...formData, supervisorName: value })}
                                >
                                    <SelectTrigger id="jc-supervisor">
                                        <SelectValue placeholder="Select a supervisor..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {supervisors.map((sup, idx) => (
                                            <SelectItem key={`sup-${idx}`} value={sup.name}>
                                                {sup.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Quantity */}
                            <div className="space-y-2">
                                <Label htmlFor="jc-qty">Quantity *</Label>
                                <Input
                                    id="jc-qty"
                                    type="number"
                                    min="1"
                                    max={selectedProd.pending > 0 ? selectedProd.pending : selectedProd.qty}
                                    value={formData.qty}
                                    onChange={e => setFormData({ ...formData, qty: e.target.value })}
                                    placeholder={`Enter quantity (max ${selectedProd.pending > 0 ? selectedProd.pending : selectedProd.qty})`}
                                />
                            </div>

                            {/* Date of Production */}
                            <div className="space-y-2">
                                <Label htmlFor="jc-date">Date of Production *</Label>
                                <Input
                                    id="jc-date"
                                    type="date"
                                    value={formData.dateOfProduction}
                                    onChange={e => setFormData({ ...formData, dateOfProduction: e.target.value })}
                                />
                            </div>

                            {/* Error */}
                            {formError && (
                                <div className="p-3 bg-red-50 text-red-600 rounded-xl text-xs font-medium flex items-center gap-2">
                                    <AlertTriangle size={14} />
                                    {formError}
                                </div>
                            )}

                            {/* Actions */}
                            <div className="flex justify-end gap-2 pt-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setIsModalOpen(false)}
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
                                    {isSubmitting ? 'Creating...' : 'Create Job Card'}
                                </Button>
                            </div>
                        </form>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
