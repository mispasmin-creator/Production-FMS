"use client"

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { format } from 'date-fns';
import { Loader2, AlertTriangle, Plus, X, Factory, History, Eye, RefreshCw, Ban } from 'lucide-react';

// Shadcn UI components (assuming you have these installed)
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useGoogleSheet } from "@/lib/g-sheets"; // Used for Master sheet only; Semi Production uses doGet for reliable text-timestamp support
import { useAuth, FIRM_MAP } from "@/lib/auth";

// Type Definitions
interface SemiProductionItem {
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
    planned: string;
    actual: string;
    firmName: string;
    reason: string;
}

interface MasterItem {
    name: string;
    firmName: string;
}

// Constants
const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbzVnLwTlFuGrlzyPSa2VWy4h9sU2EQrsuKrPLvQvhZoaoJu8GilGDc5aQTgLliUD7ss/exec";
const SEMI_PRODUCTION_SHEET = "Semi Production";
const MASTER_SHEET = "Master";

// Column Definitions
const SEMI_COLUMNS_META = [
    { header: "SF-Sr No.", dataKey: "sfSrNo", alwaysVisible: true, toggleable: false },
    { header: "Name Of Semi Finished Good", dataKey: "nameOfSemiFinished", alwaysVisible: true, toggleable: false },
    { header: "Timestamp", dataKey: "timestamp", toggleable: true },
    { header: "Total Qty", dataKey: "qty", toggleable: true },
    { header: "Produced", dataKey: "totalMade", toggleable: true },
    { header: "Pending", dataKey: "pending", toggleable: true },
    { header: "Cancelled Qty", dataKey: "cancelOrder", toggleable: true },
    { header: "Efficiency", dataKey: "efficiency", alwaysVisible: true, toggleable: false },
    { header: "Notes", dataKey: "notes", toggleable: true },
    { header: "Firm Name", dataKey: "firmName", toggleable: true },
    { header: "Reason", dataKey: "reason", toggleable: true },
    { header: "Actions", dataKey: "actions", alwaysVisible: true, toggleable: false },
];

interface SemiProductionRecord {
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
    planned: string;
    actual: string;
    firmName: string;
    reason: string;
}

export default function Step1List() {
    const { user } = useAuth();
    const [semiProductions, setSemiProductions] = useState<SemiProductionItem[]>([]);
    const [materialsList, setMaterialsList] = useState<string[]>([]);
    const [firmsList, setFirmsList] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
    const [cancelRecord, setCancelRecord] = useState<SemiProductionItem | null>(null);
    const [cancelQty, setCancelQty] = useState<number | ''>('');
    const [cancelReason, setCancelReason] = useState("");
    const [isCancelSubmitting, setIsCancelSubmitting] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');

    const [formData, setFormData] = useState({
        sfSrNo: '',
        name: '',
        firmName: '',
        qty: '',
        notes: '',
    });

    const [formErrors, setFormErrors] = useState<Record<string, string | null>>({});

    const { fetchData: fetchMasterData } = useGoogleSheet(MASTER_SHEET);

    // Auto-dismiss success toast after 3s
    useEffect(() => {
        if (!successMessage) return;
        const t = setTimeout(() => setSuccessMessage(''), 3000);
        return () => clearTimeout(t);
    }, [successMessage]);

    // ─── Fetch Semi Production via Google Visualization (gviz) API ───────────────
    // This bypasses the Apps Script doGet entirely and reads the sheet data directly.
    // Same reliable method already used for the Master sheet.
    const SHEET_ID = "1Oh16UfYFmNff0YLxHRh_D3mw3r7m7b9FOvxRpJxCUh4";

    const fetchSemiProductionGviz = useCallback(async (): Promise<SemiProductionItem[]> => {
        const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(SEMI_PRODUCTION_SHEET)}&headers=0&cb=${Date.now()}`;
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) throw new Error(`Network error: ${res.status}`);
        const text = await res.text();
        const match = text.match(/google\.visualization\.Query\.setResponse\((.*)\)/);
        if (!match || !match[1]) throw new Error("Could not parse gviz response for Semi Production sheet.");
        const json = JSON.parse(match[1]);
        if (!json.table) throw new Error("Invalid gviz data structure.");

        const table = json.table;
        const rows: any[] = table.rows || [];
        const items: SemiProductionItem[] = [];

        // First 5 rows (indices 0-4) are header/metadata rows — skip them
        const DATA_START_ROW = 5;

        for (let i = DATA_START_ROW; i < rows.length; i++) {
            const row = rows[i];
            if (!row || !row.c) continue;

            const getCell = (idx: number): string => {
                const cell = row.c[idx];
                if (!cell) return "";
                // gviz returns formatted string in cell.f, raw value in cell.v
                return cell.f !== undefined && cell.f !== null
                    ? String(cell.f)
                    : (cell.v !== null && cell.v !== undefined ? String(cell.v) : "");
            };

            // Skip completely empty rows
            if (row.c.every((c: any) => !c || c.v === null || c.v === "" || c.v === undefined)) continue;

            const tsCell = getCell(0).trim();
            if (!tsCell) continue;

            // Only include rows that have a valid SF-Sr No. in column B (e.g. "SF-1", "SF-2")
            const sfSrNo = getCell(1).trim();
            if (!sfSrNo.toUpperCase().startsWith("SF-")) continue;

            items.push({
                _rowIndex: i + 1, // 1-based row index for Apps Script updates
                timestamp: tsCell,
                sfSrNo: sfSrNo,
                nameOfSemiFinished: getCell(2),
                qty: Number(getCell(3)) || 0,
                notes: getCell(4),
                totalPlanned: Number(getCell(5)) || 0,
                totalMade: Number(getCell(6)) || 0,
                pending: Number(getCell(7)) || 0,
                cancelOrder: getCell(8),
                status: getCell(9) || "PENDING",
                planned: getCell(10),
                actual: getCell(11),
                firmName: getCell(12),
                reason: getCell(13),
            });
        }
        return items;
    }, []);

    const loadAllData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            // Fetch Semi Production via gviz (bypasses Apps Script doGet)
            const semiItems = await fetchSemiProductionGviz();
            
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

            setSemiProductions(filterByFirm(semiItems).sort((a, b) => b._rowIndex - a._rowIndex));

            // Fetch Master sheet using gviz
            const masterTable = await fetchMasterData();

            const processGvizTable = (table: any) => {
                if (!table || !table.rows || table.rows.length === 0) return [];
                const firstDataRowIndex = table.rows.findIndex((r: any) => r && r.c && r.c.some((cell: any) => cell && cell.v !== null && cell.v !== ''));
                if (firstDataRowIndex === -1) return [];
                const colIds = table.cols.map((col: any) => col.id);
                const dataRows = table.rows.slice(firstDataRowIndex);
                return dataRows.map((row: any, rowIndex: number) => {
                    if (!row || !row.c || row.c.every((cell: any) => !cell || cell.v === null || cell.v === '')) return null;
                    const rowData: any = { _rowIndex: firstDataRowIndex + rowIndex + 1 };
                    row.c.forEach((cell: any, cellIndex: number) => {
                        const colId = colIds[cellIndex];
                        if (colId) rowData[colId] = cell ? cell.v : null;
                    });
                    return rowData;
                }).filter(Boolean);
            };

            const masterDataRows = processGvizTable(masterTable);

            // Get product names from Master sheet - Column M (Name Of Raw Material, index 12)
            const materials: string[] = [...new Set(masterDataRows.map((row: any) => String(row.M || "")).filter(Boolean))] as string[];
            setMaterialsList(materials);

            // Get firm names from Master sheet - Column G (Firm Name, index 6)
            let firms: string[] = [...new Set(masterDataRows.map((row: any) => String(row.G || "")).filter(Boolean))] as string[];
            
            if (user?.firm && user?.role?.toLowerCase() !== 'admin') {
                const userFirms = user.firm.split(',').map(f => f.trim()).filter(Boolean);
                firms = firms.filter(f => {
                    const firmNameLower = f.toLowerCase();
                    return userFirms.some(uf => {
                        const firmSearch = uf.toLowerCase();
                        const mappedFirmLower = (FIRM_MAP[uf] || uf).toLowerCase();
                        return firmNameLower.includes(firmSearch) || firmNameLower.includes(mappedFirmLower);
                    });
                });
            }
            setFirmsList(firms);

        } catch (err: unknown) {
            const errMsg = err instanceof Error ? err.message : String(err);
            console.error("Error in loadAllData:", err);
            setError(`Failed to load data. ${errMsg}`);
        } finally {
            setLoading(false);
        }
    }, [fetchMasterData, fetchSemiProductionGviz]);

    useEffect(() => {
        loadAllData();
    }, [loadAllData]);

    // Generate SF number when modal opens
    useEffect(() => {
        if (isDialogOpen) {
            generateNextSfNo();
        }
    }, [isDialogOpen]);

    const generateNextSfNo = async () => {
        try {
            const latestNo = await fetchLatestSFSrNo(semiProductions);
            setFormData(prev => ({ ...prev, sfSrNo: latestNo }));
        } catch (error) {
            console.error('Error generating SF number:', error);
            setFormData(prev => ({ ...prev, sfSrNo: 'SF-1' }));
        }
    };

    const fetchLatestSFSrNo = async (productions: SemiProductionItem[]): Promise<string> => {
        if (!productions || productions.length === 0) {
            return 'SF-1';
        }

        const sfNumbers = productions
            .map(p => p.sfSrNo)
            .filter(no => no && no.startsWith('SF-'))
            .map(no => parseInt(no.replace('SF-', '')) || 0)
            .filter(n => !isNaN(n));

        const maxNumber = sfNumbers.length > 0 ? Math.max(...sfNumbers) : 0;
        return `SF-${maxNumber + 1}`;
    };

    const validateForm = () => {
        const errors: Record<string, string> = {};
        if (!formData.name) errors.name = "Product name is required.";
        if (!formData.qty || Number(formData.qty) <= 0) errors.qty = "Valid quantity is required.";
        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validateForm()) return;

        setIsSubmitting(true);
        try {
            const timestamp = format(new Date(), "dd/MM/yyyy HH:mm:ss");
            const qty = Number(formData.qty);

            // Prepare row data for Google Sheets
            const rowData = [
                timestamp,            // Column A: Timestamp
                formData.sfSrNo,      // Column B: SF-Sr No.
                formData.name,        // Column C: Name Of Semi Finished Good
                qty,                  // Column D: Qty
                formData.notes || "", // Column E: Notes
                "",                   // Column F: Total Planned
                "",                   // Column G: Total Made
                "",                   // Column H: Pending
                "",                   // Column I: Cancel Order (empty initially)
                "",                   // Column J: Status (not submitted)
                "",                   // Column K: Planned (empty)
                "",                   // Column L: Actual (empty)
                formData.firmName || "" // Column M: Firm Name
            ];

            const addBody = new URLSearchParams({
                action: "insert",
                sheetName: SEMI_PRODUCTION_SHEET,
                rowData: JSON.stringify(rowData),
            });

            const addRes = await fetch(WEB_APP_URL, { method: "POST", body: addBody });
            const addResult = await addRes.json();

            if (!addResult.success) {
                throw new Error(addResult.error || "Failed to save production data.");
            }

            setSuccessMessage("Order created successfully!");
            setIsDialogOpen(false);
            setFormData({ sfSrNo: '', name: '', firmName: '', qty: '', notes: '' });
            await loadAllData();
        } catch (err: any) {
            setError(err.message);
            alert(`Error: ${err.message}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCancelSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!cancelRecord || cancelQty === '' || Number(cancelQty) <= 0) return;

        setIsCancelSubmitting(true);
        try {
            // Prepare cancel order data
            const timestamp = format(new Date(), "dd/MM/yyyy HH:mm:ss");

            // Update the record with cancel information
            const updatedRowData = [
                cancelRecord.timestamp,                   // Column A: Original Timestamp
                cancelRecord.sfSrNo,                      // Column B
                cancelRecord.nameOfSemiFinished,          // Column C
                cancelRecord.qty,                         // Column D
                cancelRecord.notes,                       // Column E
                cancelRecord.totalPlanned,                // Column F
                cancelRecord.totalMade,                   // Column G
                Number(cancelRecord.pending) - Number(cancelQty), // Column H: Pending decreases
                Number(cancelQty),                        // Column I: Cancel Order qty
                "",                                       // Column J: Status (Cleared as requested)
                cancelRecord.planned,                     // Column K
                cancelRecord.actual,                      // Column L
                cancelRecord.firmName,                    // Column M
                cancelReason                              // Column N: Reason
            ];

            const updateBody = new URLSearchParams({
                action: "update",
                sheetName: SEMI_PRODUCTION_SHEET,
                rowIndex: String(cancelRecord._rowIndex),
                rowData: JSON.stringify(updatedRowData),
            });

            const updateRes = await fetch(WEB_APP_URL, { method: "POST", body: updateBody });
            const updateResult = await updateRes.json();

            if (!updateResult.success) {
                throw new Error(updateResult.error || "Failed to cancel order.");
            }

            setSuccessMessage(`Order ${cancelRecord.sfSrNo} cancelled successfully!`);
            setIsCancelModalOpen(false);
            setCancelRecord(null);
            setCancelQty('');
            setCancelReason('');
            await loadAllData();
        } catch (err: any) {
            console.error('Error submitting cancel order:', err);
            alert(`Error: ${err.message}`);
        } finally {
            setIsCancelSubmitting(false);
        }
    };

    const calculateProgress = (qty: number, made: number = 0) => {
        if (!qty || qty === 0) return 0;
        return Math.min(100, Math.round((made / qty) * 100));
    };

    const getStatusColor = (status: string) => {
        switch (String(status || '').toUpperCase()) {
            case 'COMPLETED':
                return 'bg-emerald-50 text-emerald-600';
            case 'IN PROGRESS':
                return 'bg-blue-50 text-blue-600';
            case 'CANCELLED':
                return 'bg-red-50 text-red-600';
            case 'PENDING':
            default:
                return 'bg-amber-50 text-amber-600';
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
                <Button onClick={loadAllData} variant="outline" size="sm" className="mt-4">
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

            {/* Header Card */}
            <Card className="shadow-lg border-none">
                <CardHeader className="bg-gradient-to-r from-olive-50 to-violet-100 rounded-t-lg">
                    <CardTitle className="flex items-center gap-2 text-gray-800">
                        <Factory className="h-6 w-6 text-olive-600" />
                        Semi Finished Production
                    </CardTitle>
                    <CardDescription className="text-gray-600">
                        Manage semi-finished goods production orders
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-4 sm:p-6">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                        <div>
                            <h3 className="text-lg font-semibold text-slate-800">Production Orders</h3>
                            <p className="text-xs text-slate-400 font-medium">
                                {semiProductions.length} orders found
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                onClick={loadAllData}
                                variant="outline"
                                size="sm"
                                className="h-9"
                            >
                                <RefreshCw className="h-4 w-4 mr-2" />
                                Refresh
                            </Button>
                            <Button
                                onClick={() => setIsDialogOpen(true)}
                                className="bg-olive-600 text-white hover:bg-olive-700"
                                size="sm"
                            >
                                <Plus className="h-4 w-4 mr-2" />
                                New Order
                            </Button>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="overflow-x-auto rounded-lg border">
                        <Table>
                            <TableHeader className="bg-slate-50">
                                <TableRow>
                                    {SEMI_COLUMNS_META.map((col) => (
                                        <TableHead key={col.dataKey} className="whitespace-nowrap text-xs font-semibold">
                                            {col.header}
                                        </TableHead>
                                    ))}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {semiProductions.length > 0 ? (
                                    semiProductions.map((item) => {
                                        const progress = calculateProgress(item.qty, item.totalMade);

                                        return (
                                            <TableRow key={item._rowIndex} className="hover:bg-olive-50/40">
                                                {/* SF-Sr No. */}
                                                <TableCell className="whitespace-nowrap">
                                                    <div className="text-sm font-semibold text-olive-600">{item.sfSrNo}</div>
                                                </TableCell>

                                                {/* Name Of Semi Finished Good */}
                                                <TableCell className="whitespace-nowrap">
                                                    <div className="font-medium text-slate-800">{item.nameOfSemiFinished}</div>
                                                </TableCell>

                                                {/* Timestamp */}
                                                <TableCell className="whitespace-nowrap text-sm text-slate-600">
                                                    {item.timestamp || '-'}
                                                </TableCell>

                                                {/* Total Qty */}
                                                <TableCell className="whitespace-nowrap text-sm font-medium">
                                                    {item.qty}
                                                </TableCell>

                                                {/* Produced */}
                                                <TableCell className="whitespace-nowrap text-sm font-medium text-olive-600">
                                                    {item.totalMade}
                                                </TableCell>

                                                {/* Pending */}
                                                <TableCell className="whitespace-nowrap text-sm font-medium text-amber-600">
                                                    {item.pending}
                                                </TableCell>

                                                {/* Cancelled Qty */}
                                                <TableCell className="whitespace-nowrap text-sm font-medium text-red-600">
                                                    {item.cancelOrder || '-'}
                                                </TableCell>

                                                {/* Efficiency */}
                                                <TableCell className="whitespace-nowrap">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                            <div
                                                                className="bg-olive-500 h-full rounded-full transition-all"
                                                                style={{ width: `${progress}%` }}
                                                            />
                                                        </div>
                                                        <span className="text-xs text-slate-500">{progress}%</span>
                                                    </div>
                                                </TableCell>

                                                {/* Notes */}
                                                <TableCell className="max-w-[150px] truncate text-sm text-slate-600" title={item.notes}>
                                                    {item.notes || '-'}
                                                </TableCell>

                                                {/* Firm Name */}
                                                <TableCell className="whitespace-nowrap text-sm text-slate-600">
                                                    {item.firmName || '-'}
                                                </TableCell>
                                                
                                                {/* Reason */}
                                                <TableCell className="max-w-[120px] truncate text-sm text-red-500" title={item.reason}>
                                                    {item.reason || '-'}
                                                </TableCell>

                                                {/* Actions */}
                                                <TableCell className="whitespace-nowrap">
                                                    <Button
                                                        onClick={() => {
                                                            setCancelRecord(item);
                                                            setCancelQty('');
                                                            setCancelReason('');
                                                            setIsCancelModalOpen(true);
                                                        }}
                                                        variant="ghost"
                                                        size="sm"
                                                        className="text-red-500 hover:text-red-600 hover:bg-red-50"
                                                    >
                                                        <Ban className="h-4 w-4 mr-1" />
                                                        Cancel
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={SEMI_COLUMNS_META.length} className="h-32 text-center text-slate-400">
                                            No production orders found
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            {/* Create New Order Modal */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Create New Semi-Finished Order</DialogTitle>
                        <DialogDescription>
                            Enter the details for the new production order.
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleSubmit} className="space-y-4 py-4">
                        {/* SF Sr No (Auto-generated) */}
                        <div className="space-y-2">
                            <Label htmlFor="sfSrNo">SF Sr. No.</Label>
                            <Input
                                id="sfSrNo"
                                value={formData.sfSrNo}
                                readOnly
                                className="bg-slate-50"
                            />
                        </div>

                        {/* Product Name - Dropdown from Master sheet Column M */}
                        <div className="space-y-2">
                            <Label htmlFor="productName">Product Name *</Label>
                            <Select
                                value={formData.name}
                                onValueChange={(value) => setFormData({ ...formData, name: value })}
                            >
                                <SelectTrigger id="productName" className={formErrors.name ? "border-red-500" : ""}>
                                    <SelectValue placeholder="Select a product..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {materialsList.map((material) => (
                                        <SelectItem key={material} value={material}>
                                            {material}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {formErrors.name && (
                                <p className="text-xs text-red-500 mt-1">{formErrors.name}</p>
                            )}
                        </div>

                        {/* Firm Name - Dropdown from Master sheet Column G */}
                        <div className="space-y-2">
                            <Label htmlFor="firmName">Firm Name</Label>
                            <Select
                                value={formData.firmName}
                                onValueChange={(value) => setFormData({ ...formData, firmName: value })}
                            >
                                <SelectTrigger id="firmName">
                                    <SelectValue placeholder="Select a firm..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {firmsList.map((firm) => (
                                        <SelectItem key={firm} value={firm}>
                                            {firm}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Quantity */}
                        <div className="space-y-2">
                            <Label htmlFor="qty">Quantity *</Label>
                            <Input
                                id="qty"
                                type="number"
                                min="1"
                                step="1"
                                value={formData.qty}
                                onChange={(e) => setFormData({ ...formData, qty: e.target.value })}
                                className={formErrors.qty ? "border-red-500" : ""}
                                placeholder="Enter quantity"
                            />
                            {formErrors.qty && (
                                <p className="text-xs text-red-500 mt-1">{formErrors.qty}</p>
                            )}
                        </div>

                        {/* Notes */}
                        <div className="space-y-2">
                            <Label htmlFor="notes">Production Notes</Label>
                            <Textarea
                                id="notes"
                                value={formData.notes}
                                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                placeholder="Enter any notes or instructions..."
                                rows={3}
                            />
                        </div>

                        {/* Form Actions */}
                        <div className="flex justify-end gap-2 pt-4">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setIsDialogOpen(false)}
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
                                Create Order
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Cancel Order Modal */}
            <Dialog open={isCancelModalOpen} onOpenChange={setIsCancelModalOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Cancel Order</DialogTitle>
                        <DialogDescription>
                            Enter the quantity to cancel for {cancelRecord?.sfSrNo}
                        </DialogDescription>
                    </DialogHeader>

                    {cancelRecord && (
                        <form onSubmit={handleCancelSubmit} className="space-y-4 py-4">
                            {/* Order Summary */}
                            <div className="bg-red-50 rounded-lg p-4 space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-600">Product:</span>
                                    <span className="font-medium">{cancelRecord.nameOfSemiFinished}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-600">Total Quantity:</span>
                                    <span className="font-medium">{cancelRecord.qty}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-600">Pending:</span>
                                    <span className="font-medium text-amber-600">{cancelRecord.pending}</span>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="cancelQty">Cancel Quantity *</Label>
                                <Input
                                    id="cancelQty"
                                    type="number"
                                    min="1"
                                    max={cancelRecord.pending}
                                    value={cancelQty}
                                    onChange={(e) => setCancelQty(e.target.value === '' ? '' : Number(e.target.value))}
                                    placeholder="Enter quantity to cancel"
                                />
                                <p className="text-xs text-slate-500">
                                    Max: {cancelRecord.pending} units
                                </p>
                            </div>

                            {/* Cancel Reason */}
                            <div className="space-y-2">
                                <Label htmlFor="cancelReason">Reason for Cancellation *</Label>
                                <Textarea
                                    id="cancelReason"
                                    value={cancelReason}
                                    onChange={(e) => setCancelReason(e.target.value)}
                                    placeholder="Enter reason for cancelling..."
                                    rows={3}
                                    required
                                />
                            </div>

                            {/* Actions */}
                            <div className="flex justify-end gap-2 pt-4">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setIsCancelModalOpen(false)}
                                    disabled={isCancelSubmitting}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="submit"
                                    disabled={isCancelSubmitting || cancelQty === '' || Number(cancelQty) <= 0 || !cancelReason.trim()}
                                    className="bg-red-500 text-white hover:bg-red-600"
                                >
                                    {isCancelSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Submit Cancel
                                </Button>
                            </div>
                        </form>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
