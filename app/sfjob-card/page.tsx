"use client"

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth, FIRM_MAP } from "@/lib/auth";
import { format } from 'date-fns';
import {
    Loader2, AlertTriangle, RefreshCw, ClipboardList, History,
    FileCheck, X, Plus, Clock
} from 'lucide-react';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useGoogleSheet, parseGvizDate } from "@/lib/g-sheets";

// ==================== CONSTANTS ====================
const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbzVnLwTlFuGrlzyPSa2VWy4h9sU2EQrsuKrPLvQvhZoaoJu8GilGDc5aQTgLliUD7ss/exec";
const SEMI_PRODUCTION_SHEET = "Semi Production";
const SEMI_JOB_CARD_SHEET = "Semi Job Card";
const MASTER_SHEET = "Master";

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
}

interface Supervisor {
    name: string;
}

// ==================== HELPERS ====================
const formatDisplayDate = (val: any): string => {
    if (!val) return '-';
    // gviz Date string
    if (typeof val === 'string' && val.startsWith('Date(')) {
        const d = parseGvizDate(val);
        return d ? format(d, 'dd/MM/yy') : '-';
    }
    // plain string date
    try {
        const d = new Date(val);
        if (!isNaN(d.getTime())) return format(d, 'dd/MM/yy');
    } catch { /* */ }
    return String(val);
};

// Process a gviz table into plain row objects
const processGvizTable = (table: any): any[] => {
    if (!table || !table.rows || table.rows.length === 0) return [];
    const colIds = table.cols.map((col: any) => col.id);
    const firstDataRowIndex = table.rows.findIndex(
        (r: any) => r && r.c && r.c.some((cell: any) => cell && cell.v !== null && cell.v !== '')
    );
    if (firstDataRowIndex === -1) return [];
    return table.rows.slice(firstDataRowIndex).map((row: any, rowIndex: number) => {
        if (!row || !row.c || row.c.every((cell: any) => !cell || cell.v === null || cell.v === '')) return null;
        const obj: any = { _rowIndex: firstDataRowIndex + rowIndex + 1 };
        row.c.forEach((cell: any, ci: number) => {
            const colId = colIds[ci];
            if (colId) obj[colId] = cell ? cell.v : null;
        });
        return obj;
    }).filter(Boolean);
};

// ==================== PENDING LOGIC ====================
// A record is PENDING if:
//   Planned (Column K) is NOT null/empty AND Actual (Column L) IS null/empty
//   OR the status is not completed/cancelled
const isOrderPending = (record: SemiProductionRecord): boolean => {
    const hasPlanned = record.planned && record.planned !== '' && record.planned !== 'null';
    const hasActual = record.actual && record.actual !== '' && record.actual !== 'null';

    // If planned is set but actual is not — definitely pending
    if (hasPlanned && !hasActual) return true;

    // Also check status
    const statusStr = String(record.status || '').toLowerCase().trim();
    if (['complete', 'completed', 'cancelled', 'cancel'].includes(statusStr)) return false;

    // Otherwise treat as pending
    return true;
};

// ==================== MAIN COMPONENT ====================
export default function SFJobCardPage() {
    const { user } = useAuth();
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

    // useGoogleSheet hooks for reading
    const { fetchData: fetchSemiJobCardData } = useGoogleSheet(SEMI_JOB_CARD_SHEET);
    const { fetchData: fetchMasterData } = useGoogleSheet(MASTER_SHEET);

    // Direct gviz fetch for Semi Production — skips header rows properly
    const SHEET_ID = "1Oh16UfYFmNff0YLxHRh_D3mw3r7m7b9FOvxRpJxCUh4";
    const fetchSemiProductionDirect = useCallback(async (): Promise<SemiProductionRecord[]> => {
        const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(SEMI_PRODUCTION_SHEET)}&headers=0&cb=${Date.now()}`;
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) throw new Error(`Network error: ${res.status}`);
        const text = await res.text();
        const match = text.match(/google\.visualization\.Query\.setResponse\((.*)\)/);
        if (!match || !match[1]) throw new Error('Could not parse gviz for Semi Production.');
        const json = JSON.parse(match[1]);
        if (!json.table) throw new Error('Invalid gviz data.');

        const rows: any[] = json.table.rows || [];
        const DATA_START_ROW = 5; // rows 0-4 are metadata/header rows
        const items: SemiProductionRecord[] = [];

        for (let i = DATA_START_ROW; i < rows.length; i++) {
            const row = rows[i];
            if (!row || !row.c) continue;
            if (row.c.every((c: any) => !c || c.v === null || c.v === undefined || c.v === '')) continue;

            const getCell = (idx: number): string => {
                const cell = row.c[idx];
                if (!cell) return '';
                return cell.f !== undefined && cell.f !== null
                    ? String(cell.f)
                    : (cell.v !== null && cell.v !== undefined ? String(cell.v) : '');
            };

            const sfSrNo = getCell(1).trim();
            if (!sfSrNo.toUpperCase().startsWith('SF-')) continue;

            items.push({
                _rowIndex: i + 1,
                timestamp: getCell(0),
                sfSrNo,
                nameOfSemiFinished: getCell(2),
                qty: Number(getCell(3)) || 0,
                notes: getCell(4),
                totalPlanned: Number(getCell(5)) || 0,
                totalMade: Number(getCell(6)) || 0,
                pending: Number(getCell(7)) || 0,
                cancelOrder: getCell(8),
                status: getCell(9) || '',
                planned: getCell(10),
                actual: getCell(11),
                firmName: getCell(12),
            });
        }
        return items;
    }, []);

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
                fetchSemiJobCardData(),
                fetchMasterData(),
            ]);

            // ── Process Semi Production data (direct gviz, skips header rows) ──
            const productions = await fetchSemiProductionDirect();
            
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

            setProductionData(filterByFirm(productions).sort((a, b) => b._rowIndex - a._rowIndex));

            const jobCardRows = processGvizTable(semiJobCardTable);
            const jobCards: SemiJobCardRecord[] = jobCardRows
                .filter((row: any) => row.B && typeof row.B === 'string' && /^SJC-\d+/.test(row.B))
                .map((row: any) => {
                    let dateOfProduction = '';
                    if (row.G) {
                        if (typeof row.G === 'string' && row.G.startsWith('Date(')) {
                            const d = parseGvizDate(row.G);
                            dateOfProduction = d ? format(d, 'dd/MM/yy') : '';
                        } else {
                            dateOfProduction = String(row.G);
                        }
                    }
                    return {
                        _rowIndex: row._rowIndex,
                        timestamp: row.A ? format(parseGvizDate(row.A) || new Date(), "dd/MM/yy HH:mm:ss") : "",
                        sjcSrNo: String(row.B || ""),
                        sfSrNo: String(row.C || ""),
                        supervisorName: String(row.D || ""),
                        productName: String(row.E || ""),
                        qty: Number(row.F || 0),
                        dateOfProduction,
                    };
                });

            setJobCardData(filterByFirm(jobCards).sort((a, b) => b._rowIndex - a._rowIndex));

            // ── Process Master data for supervisors ──
            const masterRows = processGvizTable(masterTable);
            const supSet = new Set<string>();
            masterRows.forEach((row: any) => {
                // Specifically use Column L (SF Supervisor Name) as requested
                const val = String(row.L || '').trim();
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
    }, [fetchSemiProductionDirect, fetchSemiJobCardData, fetchMasterData]);

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
            qty: String(record.qty),
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
            const timestamp = format(new Date(), "dd/MM/yy HH:mm:ss");
            const sjcSrNo = getNextSJCNo();

            // Row for "Semi Job Card" sheet:
            // Timestamp | SJC-Sr No. | SF-Sr No.(Production No.) | Supervisor Name | Product Name | Qty | Date Of Production
            const rowData = [
                timestamp,
                sjcSrNo,
                selectedProd.sfSrNo,
                formData.supervisorName,
                selectedProd.nameOfSemiFinished,
                Number(formData.qty),
                formData.dateOfProduction
            ];

            const body = new URLSearchParams({
                action: 'insert',
                sheetName: SEMI_JOB_CARD_SHEET,
                rowData: JSON.stringify(rowData),
            });

            const res = await fetch(WEB_APP_URL, { method: 'POST', body });
            const result = await res.json();

            if (!result.success) throw new Error(result.error || 'Failed to save Job Card.');

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
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                        <div>
                            <h3 className="text-lg font-semibold text-slate-800">Job Card Orders</h3>
                            <p className="text-xs text-slate-400 font-medium">
                                {pendingOrders.length} pending · {historyOrders.length} job cards
                            </p>
                        </div>
                        <Button onClick={loadAllData} variant="outline" size="sm" className="h-9">
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Refresh
                        </Button>
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
                                {pendingOrders.length}
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
                                {historyOrders.length}
                            </span>
                        </button>
                    </div>

                    {/* ── Pending Orders Tab ── */}
                    {activeTab === 'pending' && (
                        pendingOrders.length === 0 ? (
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
                                            <TableHead className="whitespace-nowrap text-xs font-semibold">Planned (K)</TableHead>
                                            <TableHead className="whitespace-nowrap text-xs font-semibold">Actual (L)</TableHead>
                                            <TableHead className="whitespace-nowrap text-xs font-semibold">Notes</TableHead>
                                            <TableHead className="whitespace-nowrap text-xs font-semibold">Status</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {pendingOrders.map((order, index) => (
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
                                                <TableCell className="whitespace-nowrap">
                                                    {order.planned ? (
                                                        <Badge className="bg-blue-50 text-blue-600 border-0 text-xs">
                                                            {formatDisplayDate(order.planned)}
                                                        </Badge>
                                                    ) : (
                                                        <span className="text-slate-400 text-xs">Not Scheduled</span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="whitespace-nowrap">
                                                    {order.actual ? (
                                                        <Badge className="bg-emerald-50 text-emerald-600 border-0 text-xs">
                                                            {formatDisplayDate(order.actual)}
                                                        </Badge>
                                                    ) : (
                                                        <span className="text-slate-400 text-xs">-</span>
                                                    )}
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
                        historyOrders.length === 0 ? (
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
                                        {historyOrders.map((job, index) => (
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
                                    max={selectedProd.qty}
                                    value={formData.qty}
                                    onChange={e => setFormData({ ...formData, qty: e.target.value })}
                                    placeholder={`Enter quantity (max ${selectedProd.qty})`}
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
