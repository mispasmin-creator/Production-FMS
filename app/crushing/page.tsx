"use client"

import React, { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import {
    Loader2,
    AlertTriangle,
    Plus,
    X,
    Factory,
    History,
    Eye,
    RefreshCw,
    Camera,
    Save,
    Package,
    Calendar,
    HardHat,
    CheckCircle2,
    Clock,
    FileText
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
import { useGoogleSheet, parseGvizDate } from "@/lib/g-sheets";

// ==================== CONSTANTS ====================
const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbzVnLwTlFuGrlzyPSa2VWy4h9sU2EQrsuKrPLvQvhZoaoJu8GilGDc5aQTgLliUD7ss/exec";
const CRUSHING_ACTUAL_SHEET = "Crushing Actual";
const MASTER_SHEET = "Master";
const DRIVE_FOLDER_ID = "1H6cGQ1zfKN4V3MSuhKSf1yjCQq591bcH";

// ==================== TYPE DEFINITIONS ====================
interface CrushingRecord {
    _rowIndex: number;
    timestamp: string;
    dateOfProduction: string;
    crushingProductName: string;
    inputQty: number;
    fg1Name: string;
    fg1Qty: number;
    fg2Name: string;
    fg2Qty: number;
    fg3Name: string;
    fg3Qty: number;
    fg4Name: string;
    fg4Qty: number;
    startingPhoto: string;
    endingPhoto: string;
    remarks: string;
    machineHours: number;
}

interface MasterItem {
    crushingProductName: string;
    finishedGoodsName: string;
}

// Column Definitions
const CRUSHING_COLUMNS_META = [
    { header: "Date", dataKey: "date", alwaysVisible: true },
    { header: "Product", dataKey: "product", alwaysVisible: true },
    { header: "Input Qty", dataKey: "inputQty" },
    { header: "Output", dataKey: "output" },
    { header: "Machine Hours", dataKey: "machineHours" },
    { header: "Photos", dataKey: "photos" },
    { header: "Remarks", dataKey: "remarks" },
    { header: "Actions", dataKey: "actions", alwaysVisible: true },
];

// ==================== UTILITY FUNCTIONS ====================
const formatDisplayDate = (dateString: string): string => {
    if (!dateString || dateString === 'null' || dateString === 'undefined' || dateString === '-') return '-';
    
    try {
        // Handle GViz raw date format: Date(2026,2,17,12,57,46)
        if (typeof dateString === 'string' && dateString.startsWith('Date(')) {
            const parsed = parseGvizDate(dateString);
            if (parsed) {
                const day = parsed.getDate().toString().padStart(2, '0');
                const month = (parsed.getMonth() + 1).toString().padStart(2, '0');
                const year = parsed.getFullYear().toString().slice(-2);
                return `${day}/${month}/${year}`;
            }
            return '-';
        }

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

const formatTimestamp = (date: Date): string => {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear().toString().slice(-2);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    
    return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
};

const uploadImageToDrive = async (file: File, fileName: string): Promise<string> => {
    try {
        const formData = new FormData();
        formData.append('action', 'uploadFile');
        formData.append('fileName', fileName);
        formData.append('mimeType', file.type);

        // Convert file to base64
        const base64Data = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64String = reader.result as string;
                resolve(base64String);
            };
            reader.readAsDataURL(file);
        });

        formData.append('base64Data', base64Data);
        formData.append('folderId', DRIVE_FOLDER_ID);

        const response = await fetch(WEB_APP_URL, {
            method: 'POST',
            mode: 'cors',
            body: formData
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();

        if (!result.success) {
            throw new Error(result.error || 'Failed to upload image');
        }

        return result.fileUrl;
    } catch (error) {
        console.error('Error uploading image:', error);
        throw error;
    }
};

// ==================== MAIN COMPONENT ====================
export default function Step5List() {
    const [crushingRecords, setCrushingRecords] = useState<CrushingRecord[]>([]);
    const [crushingProducts, setCrushingProducts] = useState<string[]>([]);
    const [finishedGoods, setFinishedGoods] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState('');
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [selectedRecord, setSelectedRecord] = useState<CrushingRecord | null>(null);
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);

    // Form state
    const [formData, setFormData] = useState({
        dateOfProduction: format(new Date(), 'yyyy-MM-dd'),
        crushingProductName: '',
        inputQty: '',
        fg1Name: '',
        fg1Qty: '',
        fg2Name: '',
        fg2Qty: '',
        fg3Name: '',
        fg3Qty: '',
        fg4Name: '',
        fg4Qty: '',
        remarks: '',
        machineHours: '',
    });

    const [startingPhoto, setStartingPhoto] = useState<File | null>(null);
    const [endingPhoto, setEndingPhoto] = useState<File | null>(null);
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});

    const { fetchData: fetchCrushingData } = useGoogleSheet(CRUSHING_ACTUAL_SHEET, { headers: 0 });
    const { fetchData: fetchMasterData } = useGoogleSheet(MASTER_SHEET, { headers: 0 });

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
            const [crushingTable, masterTable] = await Promise.all([
                fetchCrushingData(),
                fetchMasterData(),
            ]);

            // Process Crushing Actual data - FIXED COLUMN MAPPING
           // Process Crushing Actual data - FIXED HEADER SKIPPING
if (crushingTable && crushingTable.rows && crushingTable.rows.length > 0) {
    // Skip the first 5 header rows (adjust this number if needed)
    const HEADER_ROWS_TO_SKIP = 1;
    const dataRows = crushingTable.rows.slice(HEADER_ROWS_TO_SKIP);

    const records: CrushingRecord[] = dataRows
        .map((row: any, index: number) => {
            if (!row || !row.c || row.c.every((cell: any) => !cell || cell.v === null || cell.v === '')) {
                return null;
            }

            return {
                _rowIndex: HEADER_ROWS_TO_SKIP + index + 1,
                timestamp: row.c[0]?.v || '',
                dateOfProduction: row.c[1]?.v || '',
                crushingProductName: row.c[2]?.v || '',
                inputQty: Number(row.c[3]?.v || 0),
                fg1Name: row.c[4]?.v || '',
                fg1Qty: Number(row.c[5]?.v || 0),
                fg2Name: row.c[6]?.v || '',
                fg2Qty: Number(row.c[7]?.v || 0),
                fg3Name: row.c[8]?.v || '',
                fg3Qty: Number(row.c[9]?.v || 0),
                fg4Name: row.c[10]?.v || '',
                fg4Qty: Number(row.c[11]?.v || 0),
                startingPhoto: row.c[12]?.v || '',
                endingPhoto: row.c[13]?.v || '',
                remarks: row.c[14]?.v || '',
                machineHours: Number(row.c[15]?.v || 0),
            };
        })
        .filter(Boolean) as CrushingRecord[];

    setCrushingRecords(records.sort((a, b) => b._rowIndex - a._rowIndex));
} else {
    setCrushingRecords([]);
}

            // Process Master sheet data
            if (masterTable && masterTable.rows && masterTable.rows.length > 0) {
                // Find first data row
                const firstDataRowIndex = masterTable.rows.findIndex((r: any) => 
                    r && r.c && r.c.some((cell: any) => cell && cell.v !== null && cell.v !== '')
                );
                
                if (firstDataRowIndex !== -1) {
                    const dataRows = masterTable.rows.slice(firstDataRowIndex);
                    
                    const crushingProductsSet = new Set<string>();
                    const finishedGoodsSet = new Set<string>();
                    
                    dataRows.forEach((row: any) => {
                        if (!row || !row.c) return;
                        
                        // Column O is index 14 (Crushing Product Name)
                        const crushingValue = row.c[14]?.v;
                        if (crushingValue) {
                            crushingProductsSet.add(String(crushingValue).trim());
                        }
                        
                        // Column N is index 13 (Finished Goods Name)
                        const finishedValue = row.c[13]?.v;
                        if (finishedValue) {
                            finishedGoodsSet.add(String(finishedValue).trim());
                        }
                    });
                    
                    setCrushingProducts(Array.from(crushingProductsSet).sort());
                    setFinishedGoods(Array.from(finishedGoodsSet).sort());
                    
                    console.log('Crushing Products:', Array.from(crushingProductsSet)); // Debug log
                    console.log('Finished Goods:', Array.from(finishedGoodsSet)); // Debug log
                } else {
                    setCrushingProducts([]);
                    setFinishedGoods([]);
                }
            } else {
                setCrushingProducts([]);
                setFinishedGoods([]);
            }
        } catch (err) {
            console.error("Error loading data:", err);
            setError(`Failed to load data: ${err.message}`);
        } finally {
            setLoading(false);
        }
    }, [fetchCrushingData, fetchMasterData]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const validateForm = () => {
        const errors: Record<string, string> = {};
        
        if (!formData.crushingProductName) errors.crushingProductName = "Product name is required";
        if (!formData.inputQty || Number(formData.inputQty) <= 0) errors.inputQty = "Valid input quantity is required";
        if (!formData.machineHours || Number(formData.machineHours) <= 0) errors.machineHours = "Machine hours are required";
        
        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!validateForm()) return;

        setIsSubmitting(true);
        setError(null);

        try {
            // Upload photos if provided
            let startPhotoUrl = '';
            let endPhotoUrl = '';

            if (startingPhoto) {
                const fileName = `START_${Date.now()}.jpg`;
                startPhotoUrl = await uploadImageToDrive(startingPhoto, fileName);
            }
            if (endingPhoto) {
                const fileName = `END_${Date.now()}.jpg`;
                endPhotoUrl = await uploadImageToDrive(endingPhoto, fileName);
            }

            const timestamp = formatTimestamp(new Date());

            // Prepare row data for Crushing Actual sheet - FIXED COLUMN MAPPING
            const rowData = [
                timestamp,                          // Col A: Timestamp
                formData.dateOfProduction,          // Col B: Date Of Production
                formData.crushingProductName,       // Col C: Crushing Product Name
                Number(formData.inputQty),          // Col D: Input Qty
                formData.fg1Name || '',             // Col E: Finished Goods Name 1
                Number(formData.fg1Qty) || 0,       // Col F: Qty 1
                formData.fg2Name || '',             // Col G: Finished Goods Name 2
                Number(formData.fg2Qty) || 0,       // Col H: Qty 2
                formData.fg3Name || '',             // Col I: Finished Goods Name 3
                Number(formData.fg3Qty) || 0,       // Col J: Qty 3
                formData.fg4Name || '',             // Col K: Finished Goods Name 4
                Number(formData.fg4Qty) || 0,       // Col L: Qty 4
                startPhotoUrl,                       // Col M: Starting Photo
                endPhotoUrl,                         // Col N: Ending Photo
                formData.remarks || '',              // Col O: Remarks
                Number(formData.machineHours) || 0,  // Col P: Machine Hours
            ];

            console.log('Submitting row data:', rowData); // Debug log

            const insertBody = new URLSearchParams({
                action: "insert",
                sheetName: CRUSHING_ACTUAL_SHEET,
                rowData: JSON.stringify(rowData),
            });

            const response = await fetch(WEB_APP_URL, {
                method: 'POST',
                body: insertBody
            });

            const result = await response.json();
            console.log('Submit result:', result); // Debug log

            if (!result.success) {
                throw new Error(result.error || 'Failed to save crushing record');
            }

            setSuccessMessage('Crushing record saved successfully!');
            setIsDialogOpen(false);
            
            // Reset form
            setFormData({
                dateOfProduction: format(new Date(), 'yyyy-MM-dd'),
                crushingProductName: '',
                inputQty: '',
                fg1Name: '',
                fg1Qty: '',
                fg2Name: '',
                fg2Qty: '',
                fg3Name: '',
                fg3Qty: '',
                fg4Name: '',
                fg4Qty: '',
                remarks: '',
                machineHours: '',
            });
            setStartingPhoto(null);
            setEndingPhoto(null);
            
            // Reload data to show the new record
            await loadData();
        } catch (err) {
            console.error('Error submitting form:', err);
            setError(err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleViewDetails = (record: CrushingRecord) => {
        setSelectedRecord(record);
        setIsDetailsOpen(true);
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-olive-600" />
                <p className="ml-3 text-sm text-slate-500">Loading crushing data...</p>
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
                        <Factory className="h-6 w-6 text-olive-600" />
                        Crushing Department
                    </CardTitle>
                    <CardDescription className="text-gray-600">
                        Manage crushing operations and track finished goods output
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-4 sm:p-6">
                    {/* Header Actions */}
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                        <div>
                            <h3 className="text-lg font-semibold text-slate-800">Crushing Records</h3>
                            <p className="text-xs text-slate-400 font-medium">
                                {crushingRecords.length} records found
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                onClick={loadData}
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
                                New Crushing
                            </Button>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="overflow-x-auto rounded-lg border">
                        <Table>
                            <TableHeader className="bg-slate-50">
                                <TableRow>
                                    {CRUSHING_COLUMNS_META.map((col) => (
                                        <TableHead key={col.dataKey} className="whitespace-nowrap text-xs font-semibold">
                                            {col.header}
                                        </TableHead>
                                    ))}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {crushingRecords.length > 0 ? (
                                    crushingRecords.map((record) => (
                                        <TableRow key={record._rowIndex} className="hover:bg-olive-50/40">
                                            {/* Date */}
                                            <TableCell className="whitespace-nowrap">
                                                <div className="flex items-center text-sm text-slate-600">
                                                    <Calendar className="h-3 w-3 mr-1 text-slate-400" />
                                                    {formatDisplayDate(record.dateOfProduction)}
                                                </div>
                                            </TableCell>

                                            {/* Product */}
                                            <TableCell className="whitespace-nowrap">
                                                <span className="text-sm font-medium text-slate-800">
                                                    {record.crushingProductName}
                                                </span>
                                            </TableCell>

                                            {/* Input Qty */}
                                            <TableCell className="whitespace-nowrap">
                                                <Badge variant="secondary" className="font-medium">
                                                    {record.inputQty}
                                                </Badge>
                                            </TableCell>

                                            {/* Output */}
                                            <TableCell className="whitespace-nowrap">
                                                <div className="space-y-1 max-w-[200px]">
                                                    {record.fg1Name && (
                                                        <div className="text-xs truncate">
                                                            <span className="text-slate-500">1:</span>
                                                            <span className="ml-1 font-medium text-olive-600">{record.fg1Name} ({record.fg1Qty})</span>
                                                        </div>
                                                    )}
                                                    {record.fg2Name && (
                                                        <div className="text-xs truncate">
                                                            <span className="text-slate-500">2:</span>
                                                            <span className="ml-1 font-medium text-olive-600">{record.fg2Name} ({record.fg2Qty})</span>
                                                        </div>
                                                    )}
                                                    {record.fg3Name && (
                                                        <div className="text-xs truncate">
                                                            <span className="text-slate-500">3:</span>
                                                            <span className="ml-1 font-medium text-olive-600">{record.fg3Name} ({record.fg3Qty})</span>
                                                        </div>
                                                    )}
                                                    {record.fg4Name && (
                                                        <div className="text-xs truncate">
                                                            <span className="text-slate-500">4:</span>
                                                            <span className="ml-1 font-medium text-olive-600">{record.fg4Name} ({record.fg4Qty})</span>
                                                        </div>
                                                    )}
                                                    {!record.fg1Name && !record.fg2Name && !record.fg3Name && !record.fg4Name && (
                                                        <span className="text-xs text-slate-400">No output</span>
                                                    )}
                                                </div>
                                            </TableCell>

                                            {/* Machine Hours */}
                                            <TableCell className="whitespace-nowrap">
                                                <span className="text-sm text-slate-600">{record.machineHours} hrs</span>
                                            </TableCell>

                                            {/* Photos */}
                                            <TableCell className="whitespace-nowrap">
                                                <div className="flex items-center gap-2">
                                                    {record.startingPhoto && record.startingPhoto.includes('http') && (
                                                        <a 
                                                            href={record.startingPhoto} 
                                                            target="_blank" 
                                                            rel="noopener noreferrer"
                                                            className="text-xs text-olive-600 hover:underline flex items-center"
                                                        >
                                                            <Camera className="h-3 w-3 mr-1" />
                                                            Start
                                                        </a>
                                                    )}
                                                    {record.endingPhoto && record.endingPhoto.includes('http') && (
                                                        <a 
                                                            href={record.endingPhoto} 
                                                            target="_blank" 
                                                            rel="noopener noreferrer"
                                                            className="text-xs text-olive-600 hover:underline flex items-center"
                                                        >
                                                            <Camera className="h-3 w-3 mr-1" />
                                                            End
                                                        </a>
                                                    )}
                                                    {!record.startingPhoto && !record.endingPhoto && (
                                                        <span className="text-xs text-slate-400">No photos</span>
                                                    )}
                                                </div>
                                            </TableCell>

                                            {/* Remarks */}
                                            <TableCell className="max-w-[150px] truncate text-sm text-slate-600" title={record.remarks}>
                                                {record.remarks || '-'}
                                            </TableCell>

                                            {/* Actions */}
                                            <TableCell className="whitespace-nowrap">
                                                <Button
                                                    onClick={() => handleViewDetails(record)}
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-8 w-8 p-0 text-slate-500 hover:text-olive-600"
                                                >
                                                    <Eye className="h-4 w-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={CRUSHING_COLUMNS_META.length} className="h-32 text-center text-slate-400">
                                            No crushing records found
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            {/* Create New Crushing Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Create New Crushing Record</DialogTitle>
                        <DialogDescription>
                            Enter the details for the crushing operation
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleSubmit} className="space-y-4 py-4">
                        {/* Date */}
                        <div className="space-y-2">
                            <Label htmlFor="date">Production Date *</Label>
                            <Input
                                id="date"
                                type="date"
                                value={formData.dateOfProduction}
                                onChange={(e) => setFormData({ ...formData, dateOfProduction: e.target.value })}
                                required
                            />
                        </div>

                        {/* Crushing Product Name - Dropdown from Master Column O */}
                        <div className="space-y-2">
                            <Label htmlFor="crushingProduct">Crushing Product Name *</Label>
                            <Select
                                value={formData.crushingProductName}
                                onValueChange={(value) => setFormData({ ...formData, crushingProductName: value })}
                            >
                                <SelectTrigger id="crushingProduct" className={formErrors.crushingProductName ? "border-red-500" : ""}>
                                    <SelectValue placeholder="Select crushing product..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {crushingProducts.length > 0 ? (
                                        crushingProducts.map((product) => (
                                            <SelectItem key={product} value={product}>
                                                {product}
                                            </SelectItem>
                                        ))
                                    ) : (
                                        <SelectItem value="no-products" disabled>No products found</SelectItem>
                                    )}
                                </SelectContent>
                            </Select>
                            {formErrors.crushingProductName && (
                                <p className="text-xs text-red-500">{formErrors.crushingProductName}</p>
                            )}
                        </div>

                        {/* Input Quantity */}
                        <div className="space-y-2">
                            <Label htmlFor="inputQty">Input Quantity *</Label>
                            <Input
                                id="inputQty"
                                type="number"
                                step="0.01"
                                min="0.01"
                                value={formData.inputQty}
                                onChange={(e) => setFormData({ ...formData, inputQty: e.target.value })}
                                placeholder="Enter input quantity"
                                className={formErrors.inputQty ? "border-red-500" : ""}
                                required
                            />
                            {formErrors.inputQty && (
                                <p className="text-xs text-red-500">{formErrors.inputQty}</p>
                            )}
                        </div>

                        {/* Finished Goods Section */}
                        <div className="bg-olive-50/50 p-4 rounded-lg space-y-4">
                            <h4 className="text-sm font-semibold text-olive-700 flex items-center">
                                <Package className="h-4 w-4 mr-2" />
                                Finished Goods Output (from Master Column N)
                            </h4>

                            {/* FG 1 */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="fg1Name">Finished Goods 1 Name</Label>
                                    <Select
                                        value={formData.fg1Name}
                                        onValueChange={(value) => setFormData({ ...formData, fg1Name: value })}
                                    >
                                        <SelectTrigger id="fg1Name">
                                            <SelectValue placeholder="Select finished goods" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {finishedGoods.length > 0 ? (
                                                finishedGoods.map((good) => (
                                                    <SelectItem key={good} value={good}>
                                                        {good}
                                                    </SelectItem>
                                                ))
                                            ) : (
                                                <SelectItem value="no-goods" disabled>No finished goods found</SelectItem>
                                            )}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="fg1Qty">Quantity 1</Label>
                                    <Input
                                        id="fg1Qty"
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={formData.fg1Qty}
                                        onChange={(e) => setFormData({ ...formData, fg1Qty: e.target.value })}
                                        placeholder="0"
                                    />
                                </div>
                            </div>

                            {/* FG 2 */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="fg2Name">Finished Goods 2 Name</Label>
                                    <Select
                                        value={formData.fg2Name}
                                        onValueChange={(value) => setFormData({ ...formData, fg2Name: value })}
                                    >
                                        <SelectTrigger id="fg2Name">
                                            <SelectValue placeholder="Select finished goods" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {finishedGoods.map((good) => (
                                                <SelectItem key={good} value={good}>
                                                    {good}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="fg2Qty">Quantity 2</Label>
                                    <Input
                                        id="fg2Qty"
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={formData.fg2Qty}
                                        onChange={(e) => setFormData({ ...formData, fg2Qty: e.target.value })}
                                        placeholder="0"
                                    />
                                </div>
                            </div>

                            {/* FG 3 */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="fg3Name">Finished Goods 3 Name</Label>
                                    <Select
                                        value={formData.fg3Name}
                                        onValueChange={(value) => setFormData({ ...formData, fg3Name: value })}
                                    >
                                        <SelectTrigger id="fg3Name">
                                            <SelectValue placeholder="Select finished goods" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {finishedGoods.map((good) => (
                                                <SelectItem key={good} value={good}>
                                                    {good}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="fg3Qty">Quantity 3</Label>
                                    <Input
                                        id="fg3Qty"
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={formData.fg3Qty}
                                        onChange={(e) => setFormData({ ...formData, fg3Qty: e.target.value })}
                                        placeholder="0"
                                    />
                                </div>
                            </div>

                            {/* FG 4 */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="fg4Name">Finished Goods 4 Name</Label>
                                    <Select
                                        value={formData.fg4Name}
                                        onValueChange={(value) => setFormData({ ...formData, fg4Name: value })}
                                    >
                                        <SelectTrigger id="fg4Name">
                                            <SelectValue placeholder="Select finished goods" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {finishedGoods.map((good) => (
                                                <SelectItem key={good} value={good}>
                                                    {good}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="fg4Qty">Quantity 4</Label>
                                    <Input
                                        id="fg4Qty"
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={formData.fg4Qty}
                                        onChange={(e) => setFormData({ ...formData, fg4Qty: e.target.value })}
                                        placeholder="0"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Photos */}
                        <div className="grid grid-cols-2 gap-4">
                            {/* Starting Photo */}
                            <div className="space-y-2">
                                <Label>Starting Photo</Label>
                                <div className="flex items-center gap-2">
                                    <Input
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) => setStartingPhoto(e.target.files?.[0] || null)}
                                        className="flex-1"
                                    />
                                    {startingPhoto && (
                                        <Button
                                            type="button"
                                            variant="destructive"
                                            size="sm"
                                            onClick={() => setStartingPhoto(null)}
                                        >
                                            <X className="h-4 w-4" />
                                        </Button>
                                    )}
                                </div>
                                {startingPhoto && (
                                    <p className="text-xs text-slate-500">{startingPhoto.name}</p>
                                )}
                            </div>

                            {/* Ending Photo */}
                            <div className="space-y-2">
                                <Label>Ending Photo</Label>
                                <div className="flex items-center gap-2">
                                    <Input
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) => setEndingPhoto(e.target.files?.[0] || null)}
                                        className="flex-1"
                                    />
                                    {endingPhoto && (
                                        <Button
                                            type="button"
                                            variant="destructive"
                                            size="sm"
                                            onClick={() => setEndingPhoto(null)}
                                        >
                                            <X className="h-4 w-4" />
                                        </Button>
                                    )}
                                </div>
                                {endingPhoto && (
                                    <p className="text-xs text-slate-500">{endingPhoto.name}</p>
                                )}
                            </div>
                        </div>

                        {/* Machine Hours & Remarks */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="machineHours">Machine Hours *</Label>
                                <Input
                                    id="machineHours"
                                    type="number"
                                    step="0.1"
                                    min="0.1"
                                    value={formData.machineHours}
                                    onChange={(e) => setFormData({ ...formData, machineHours: e.target.value })}
                                    placeholder="0.0"
                                    className={formErrors.machineHours ? "border-red-500" : ""}
                                    required
                                />
                                {formErrors.machineHours && (
                                    <p className="text-xs text-red-500">{formErrors.machineHours}</p>
                                )}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="remarks">Remarks</Label>
                                <Input
                                    id="remarks"
                                    value={formData.remarks}
                                    onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                                    placeholder="Optional notes"
                                />
                            </div>
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
                                <Save className="h-4 w-4 mr-2" />
                                Save Record
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Details Dialog */}
            <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Crushing Record Details</DialogTitle>
                        <DialogDescription>
                            Complete information about this crushing operation
                        </DialogDescription>
                    </DialogHeader>

                    {selectedRecord && (
                        <div className="space-y-4 py-4">
                            {/* Basic Info */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-xs text-slate-400 font-medium">Date</p>
                                    <p className="text-sm font-semibold text-slate-700">
                                        {formatDisplayDate(selectedRecord.dateOfProduction)}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs text-slate-400 font-medium">Timestamp</p>
                                    <p className="text-sm text-slate-600">{formatDisplayDate(selectedRecord.timestamp)}</p>
                                </div>
                                <div className="col-span-2">
                                    <p className="text-xs text-slate-400 font-medium">Product</p>
                                    <p className="text-base font-bold text-olive-600">{selectedRecord.crushingProductName}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-slate-400 font-medium">Input Quantity</p>
                                    <p className="text-sm font-medium text-slate-700">{selectedRecord.inputQty}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-slate-400 font-medium">Machine Hours</p>
                                    <p className="text-sm text-slate-700">{selectedRecord.machineHours} hrs</p>
                                </div>
                            </div>

                            {/* Finished Goods Output */}
                            <div className="space-y-2">
                                <h4 className="text-sm font-semibold text-slate-700 bg-slate-50 px-3 py-2 rounded-md">
                                    Finished Goods Output
                                </h4>
                                <div className="grid grid-cols-2 gap-4">
                                    {selectedRecord.fg1Name && (
                                        <div>
                                            <p className="text-xs text-slate-400">FG 1</p>
                                            <p className="text-sm text-slate-700">
                                                {selectedRecord.fg1Name}: <span className="font-semibold text-olive-600">{selectedRecord.fg1Qty}</span>
                                            </p>
                                        </div>
                                    )}
                                    {selectedRecord.fg2Name && (
                                        <div>
                                            <p className="text-xs text-slate-400">FG 2</p>
                                            <p className="text-sm text-slate-700">
                                                {selectedRecord.fg2Name}: <span className="font-semibold text-olive-600">{selectedRecord.fg2Qty}</span>
                                            </p>
                                        </div>
                                    )}
                                    {selectedRecord.fg3Name && (
                                        <div>
                                            <p className="text-xs text-slate-400">FG 3</p>
                                            <p className="text-sm text-slate-700">
                                                {selectedRecord.fg3Name}: <span className="font-semibold text-olive-600">{selectedRecord.fg3Qty}</span>
                                            </p>
                                        </div>
                                    )}
                                    {selectedRecord.fg4Name && (
                                        <div>
                                            <p className="text-xs text-slate-400">FG 4</p>
                                            <p className="text-sm text-slate-700">
                                                {selectedRecord.fg4Name}: <span className="font-semibold text-olive-600">{selectedRecord.fg4Qty}</span>
                                            </p>
                                        </div>
                                    )}
                                    {!selectedRecord.fg1Name && !selectedRecord.fg2Name && !selectedRecord.fg3Name && !selectedRecord.fg4Name && (
                                        <p className="text-sm text-slate-400">No finished goods recorded</p>
                                    )}
                                </div>
                            </div>

                            {/* Photos */}
                            <div className="space-y-2">
                                <h4 className="text-sm font-semibold text-slate-700 bg-slate-50 px-3 py-2 rounded-md">
                                    Photos
                                </h4>
                                <div className="flex gap-4">
                                    {selectedRecord.startingPhoto && selectedRecord.startingPhoto.includes('http') && (
                                        <a 
                                            href={selectedRecord.startingPhoto} 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="text-sm text-olive-600 hover:underline flex items-center"
                                        >
                                            <Camera className="h-4 w-4 mr-1" />
                                            View Start Photo
                                        </a>
                                    )}
                                    {selectedRecord.endingPhoto && selectedRecord.endingPhoto.includes('http') && (
                                        <a 
                                            href={selectedRecord.endingPhoto} 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="text-sm text-olive-600 hover:underline flex items-center"
                                        >
                                            <Camera className="h-4 w-4 mr-1" />
                                            View End Photo
                                        </a>
                                    )}
                                    {!selectedRecord.startingPhoto && !selectedRecord.endingPhoto && (
                                        <p className="text-sm text-slate-400">No photos uploaded</p>
                                    )}
                                </div>
                            </div>

                            {/* Remarks */}
                            {selectedRecord.remarks && (
                                <div className="space-y-2">
                                    <h4 className="text-sm font-semibold text-slate-700 bg-slate-50 px-3 py-2 rounded-md">
                                        Remarks
                                    </h4>
                                    <p className="text-sm text-slate-600 bg-slate-50 p-3 rounded-md">
                                        {selectedRecord.remarks}
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
