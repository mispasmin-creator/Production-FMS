"use client"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuCheckboxItem } from "@/components/ui/dropdown-menu";


import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
    FileText,
    Search,
    BadgeCheck,
    Edit2,
    Building,
    ChevronDown,
    Check
} from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

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
import { useAuth, FIRM_MAP } from "@/lib/auth";
import { parseGvizDate } from "@/lib/g-sheets";

// ==================== CONSTANTS ====================


// ==================== TYPE DEFINITIONS ====================
interface CrushingRecord {
    _rowIndex: number;
    timestamp: string;
    dateOfProduction: string;
    crushingProductName: string;
    inputQty: number;
    fg1Name: string;
    fg1Qty: number;
    fg1Cost: number;
    fg2Name: string;
    fg2Qty: number;
    fg2Cost: number;
    fg3Name: string;
    fg3Qty: number;
    fg3Cost: number;
    fg4Name: string;
    fg4Qty: number;
    fg4Cost: number;
    startingPhoto: string;
    endingPhoto: string;
    remarks: string;
    machineHours: number;
    firmName?: string;
}

interface MasterItem {
    crushingProductName: string;
    finishedGoodsName: string;
}

// Column Definitions
const CRUSHING_COLUMNS_META = [
    { header: "Date", dataKey: "date", alwaysVisible: true },
    { header: "Firm Name", dataKey: "firmName", alwaysVisible: true },
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

const uploadImageToStorage = async (file: File, fileName: string): Promise<string> => {
    try {
        const extension = file.name.split('.').pop() || 'jpg';
        const safeFileName = fileName.replace(/\.[^.]+$/, '');
        const filePath = `Images/${safeFileName}_${Date.now()}.${extension}`;

        const { error: uploadError } = await supabase.storage
            .from("Crushing")
            .upload(filePath, file, {
                contentType: file.type || 'image/jpeg'
            });

        if (uploadError) throw uploadError;

        const { data } = supabase.storage
            .from("Crushing")
            .getPublicUrl(filePath);

        return data.publicUrl;
    } catch (error) {
        console.error('Error uploading image to Supabase Storage:', error);
        throw error;
    }
};

// ==================== MAIN COMPONENT ====================
export default function Step5List() {
    const { user } = useAuth();
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
    const [isSubmittedToTally, setIsSubmittedToTally] = useState(false);
    const [checkingSubmitted, setCheckingSubmitted] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [firmFilter, setFirmFilter] = useState<string[]>([]);
    const [selectedHistoryProduct, setSelectedHistoryProduct] = useState<string>('ALL');
    const [historyFromDate, setHistoryFromDate] = useState<string>('');
    const [historyToDate, setHistoryToDate] = useState<string>('');
    const [isProductPopoverOpen, setIsProductPopoverOpen] = useState<boolean>(false);
    const [productSearchInput, setProductSearchInput] = useState<string>('');
    const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
    const [submittedIds, setSubmittedIds] = useState<Set<number>>(new Set());
    
    // Inline edit states for Processing Cost
    const [editingCostIndex, setEditingCostIndex] = useState<number | null>(null);
    const [costInput, setCostInput] = useState("");
    const [savingCost, setSavingCost] = useState(false);

    const uniqueFirmsForFilter = useMemo(() => {
        const firms = new Set<string>();
        crushingRecords.forEach((item) => {
            if (item.firmName) firms.add(item.firmName);
        });
        return Array.from(firms).sort();
    }, [crushingRecords]);

    // Form state
    const [formData, setFormData] = useState({
        dateOfProduction: format(new Date(), 'yyyy-MM-dd'),
        crushingProductName: '',
        inputQty: '',
        fg1Name: '',
        fg1Qty: '',
        fg1Cost: '',
        fg2Name: '',
        fg2Qty: '',
        fg2Cost: '',
        fg3Name: '',
        fg3Qty: '',
        fg3Cost: '',
        fg4Name: '',
        fg4Qty: '',
        fg4Cost: '',
        remarks: '',
        machineHours: '',
        firmName: '',
    });

    const [startingPhoto, setStartingPhoto] = useState<File | null>(null);
    const [endingPhoto, setEndingPhoto] = useState<File | null>(null);
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});

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
            const [crushingResult, masterResult, semiActualResult] = await Promise.all([
                supabase.from('crushing_actual').select('*').order('id', { ascending: false }),
                supabase.from('master').select('*'),
                supabase.from('semi_actual').select('"S No."').like('"S No."', 'CR-%')
            ]);

            if (crushingResult.error) throw crushingResult.error;
            if (masterResult.error) throw masterResult.error;
            if (semiActualResult.error) throw semiActualResult.error;

            const crushingRows = crushingResult.data || [];
            const masterRows = masterResult.data || [];

            const submittedSet = new Set<number>();
            if (semiActualResult.data) {
                semiActualResult.data.forEach((row: any) => {
                    const sNoVal = String(row['S No.'] || '');
                    const match = sNoVal.match(/^CR-(\d+)$/);
                    if (match) {
                        submittedSet.add(parseInt(match[1], 10));
                    }
                });
            }
            setSubmittedIds(submittedSet);

            // Process Crushing Actual records
            const records: CrushingRecord[] = crushingRows.map((row: any) => ({
                _rowIndex: Number(row.id || 0),
                timestamp: row.Timestamp || '',
                dateOfProduction: row['Date Of Production'] || '',
                crushingProductName: row['Crushing Product Name'] || '',
                inputQty: Number(row['Qty Of Crushing Product'] || 0),
                fg1Name: row['Finished Goods Name 1'] || '',
                fg1Qty: Number(row['Qty 1'] || 0),
                fg1Cost: Number(row['Processing Cost 1'] || 0),
                fg2Name: row['Finished Goods Name 2'] || '',
                fg2Qty: Number(row['Qty 2'] || 0),
                fg2Cost: Number(row['Processing Cost 2'] || 0),
                fg3Name: row['Finished Goods Name 3'] || '',
                fg3Qty: Number(row['Qty 3'] || 0),
                fg3Cost: Number(row['Processing Cost 3'] || 0),
                fg4Name: row['Finished Goods Name 4'] || '',
                fg4Qty: Number(row['Qty 4'] || 0),
                fg4Cost: Number(row['Processing Cost 4'] || 0),
                startingPhoto: row['Starting Reading Photo'] || '',
                endingPhoto: row['Ending Reading Photo'] || '',
                remarks: row['Remarks'] || '',
                machineHours: Number(row['Machine Running Hour'] || 0),
                firmName: row['Firm Name'] || '',
            }));
            
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

            const sortedRecords = records.sort((a, b) => b._rowIndex - a._rowIndex);
            setCrushingRecords(filterByFirm(sortedRecords));

            // Process Master data
            const crushingProductsSet = new Set<string>();
            const finishedGoodsSet = new Set<string>();
            
            masterRows.forEach((row: any) => {
                const crushingValue = row['Crushing Product Name'];
                if (crushingValue) {
                    crushingProductsSet.add(String(crushingValue).trim());
                }
                
                const finishedValue = row['Finished Goods Name'];
                if (finishedValue) {
                    finishedGoodsSet.add(String(finishedValue).trim());
                }
            });
            
            setCrushingProducts(Array.from(crushingProductsSet).sort());
            setFinishedGoods(Array.from(finishedGoodsSet).sort());
            
        } catch (err) {
            console.error("Error loading data from Supabase:", err);
            setError(`Failed to load data: ${err instanceof Error ? err.message : String(err)}`);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const filteredRecords = useMemo(() => {
        const q = searchQuery.toLowerCase().trim();
        let data = crushingRecords;
        if (firmFilter.length > 0) {
            data = data.filter((item) => firmFilter.includes(String(item.firmName || "")));
        }
        if (!q) return data;
        return data.filter(record => 
            (record.crushingProductName || "").toLowerCase().includes(q) ||
            (record.remarks || "").toLowerCase().includes(q) ||
            (record.firmName || "").toLowerCase().includes(q) ||
            (record.fg1Name || "").toLowerCase().includes(q) ||
            (record.fg2Name || "").toLowerCase().includes(q) ||
            (record.fg3Name || "").toLowerCase().includes(q) ||
            (record.fg4Name || "").toLowerCase().includes(q) ||
            (record.dateOfProduction || "").toLowerCase().includes(q)
        );
    }, [crushingRecords, searchQuery, firmFilter]);

    const pendingRecords = useMemo(() => {
        return filteredRecords.filter(item => !submittedIds.has(item._rowIndex));
    }, [filteredRecords, submittedIds]);

    const uniqueHistoryProducts = useMemo(() => {
        const set = new Set<string>();
        crushingRecords.forEach((item) => {
            if (submittedIds.has(item._rowIndex)) {
                if (item.crushingProductName) set.add(item.crushingProductName.trim());
                if (item.fg1Name) set.add(item.fg1Name.trim());
                if (item.fg2Name) set.add(item.fg2Name.trim());
                if (item.fg3Name) set.add(item.fg3Name.trim());
                if (item.fg4Name) set.add(item.fg4Name.trim());
            }
        });
        return Array.from(set).filter(Boolean).sort();
    }, [crushingRecords, submittedIds]);

    const isDateInRange = (dateVal: any, fromDate: string, toDate: string): boolean => {
        if (!fromDate && !toDate) return true;
        if (!dateVal) return false;
        let d: Date | null = null;
        const str = String(dateVal).trim();
        if (str.includes('/')) {
            const parts = str.split(' ')[0].split('/');
            if (parts.length === 3) {
                const day = parseInt(parts[0], 10);
                const month = parseInt(parts[1], 10) - 1;
                let year = parseInt(parts[2], 10);
                if (year < 100) year += 2000;
                d = new Date(year, month, day);
            }
        } else {
            d = new Date(str);
        }
        if (!d || isNaN(d.getTime())) return false;
        if (fromDate) {
            const from = new Date(fromDate);
            from.setHours(0, 0, 0, 0);
            if (d < from) return false;
        }
        if (toDate) {
            const to = new Date(toDate);
            to.setHours(23, 59, 59, 999);
            if (d > to) return false;
        }
        return true;
    };

    const historyRecords = useMemo(() => {
        let data = crushingRecords.filter(item => submittedIds.has(item._rowIndex));
        if (firmFilter.length > 0) {
            data = data.filter((item) => firmFilter.includes(String(item.firmName || "")));
        }
        if (selectedHistoryProduct !== 'ALL') {
            const targetProd = selectedHistoryProduct.toLowerCase().trim();
            data = data.filter((item) =>
                (item.crushingProductName || "").toLowerCase().trim() === targetProd ||
                (item.fg1Name || "").toLowerCase().trim() === targetProd ||
                (item.fg2Name || "").toLowerCase().trim() === targetProd ||
                (item.fg3Name || "").toLowerCase().trim() === targetProd ||
                (item.fg4Name || "").toLowerCase().trim() === targetProd
            );
        }
        if (historyFromDate || historyToDate) {
            data = data.filter((item) => isDateInRange(item.dateOfProduction || item.timestamp, historyFromDate, historyToDate));
        }
        const q = searchQuery.toLowerCase().trim();
        if (!q) return data;
        return data.filter(record => 
            (record.crushingProductName || "").toLowerCase().includes(q) ||
            (record.remarks || "").toLowerCase().includes(q) ||
            (record.firmName || "").toLowerCase().includes(q) ||
            (record.fg1Name || "").toLowerCase().includes(q) ||
            (record.fg2Name || "").toLowerCase().includes(q) ||
            (record.fg3Name || "").toLowerCase().includes(q) ||
            (record.fg4Name || "").toLowerCase().includes(q) ||
            (record.dateOfProduction || "").toLowerCase().includes(q)
        );
    }, [crushingRecords, submittedIds, searchQuery, firmFilter, selectedHistoryProduct, historyFromDate, historyToDate]);

    const totalHistoryInputQty = useMemo(() => {
        return historyRecords.reduce((sum, item) => sum + (Number(item.inputQty) || 0), 0);
    }, [historyRecords]);

    const totalHistoryOutputQty = useMemo(() => {
        return historyRecords.reduce((sum, item) => 
            sum + (Number(item.fg1Qty) || 0) + (Number(item.fg2Qty) || 0) + (Number(item.fg3Qty) || 0) + (Number(item.fg4Qty) || 0), 0);
    }, [historyRecords]);

    const totalHistoryMachineHours = useMemo(() => {
        return historyRecords.reduce((sum, item) => sum + (Number(item.machineHours) || 0), 0);
    }, [historyRecords]);

    const displayRecords = useMemo(() => {
        return activeTab === 'pending' ? pendingRecords : historyRecords;
    }, [activeTab, pendingRecords, historyRecords]);

    const validateForm = () => {
        const errors: Record<string, string> = {};
        
        if (!formData.crushingProductName) errors.crushingProductName = "Product name is required";
        if (!formData.inputQty || Number(formData.inputQty) <= 0) errors.inputQty = "Valid input quantity is required";
        if (!formData.machineHours || Number(formData.machineHours) <= 0) errors.machineHours = "Machine hours are required";
        if (user?.role === 'admin' && !formData.firmName) errors.firmName = "Firm name is required";
        
        if (formData.fg1Name && (!formData.fg1Cost || Number(formData.fg1Cost) <= 0)) errors.fg1Cost = "Processing Cost 1 is required";
        if (formData.fg2Name && (!formData.fg2Cost || Number(formData.fg2Cost) <= 0)) errors.fg2Cost = "Processing Cost 2 is required";
        if (formData.fg3Name && (!formData.fg3Cost || Number(formData.fg3Cost) <= 0)) errors.fg3Cost = "Processing Cost 3 is required";
        if (formData.fg4Name && (!formData.fg4Cost || Number(formData.fg4Cost) <= 0)) errors.fg4Cost = "Processing Cost 4 is required";

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
                const fileName = `START_${Date.now()}`;
                startPhotoUrl = await uploadImageToStorage(startingPhoto, fileName);
            }
            if (endingPhoto) {
                const fileName = `END_${Date.now()}`;
                endPhotoUrl = await uploadImageToStorage(endingPhoto, fileName);
            }

            const timestamp = new Date().toISOString();

            // Determine firm name based on user role
            const firmNameValue = user?.role === 'admin' ? formData.firmName : (user?.firm || '');

            // Insert new crushing record into Supabase
            const { error: insertError } = await supabase
                .from('crushing_actual')
                .insert({
                    "Timestamp": timestamp,
                    "Date Of Production": formData.dateOfProduction,
                    "Crushing Product Name": formData.crushingProductName,
                    "Qty Of Crushing Product": Number(formData.inputQty),
                    "Finished Goods Name 1": formData.fg1Name || '',
                    "Qty 1": Number(formData.fg1Qty) || 0,
                    "Processing Cost 1": Number(formData.fg1Cost) || 0,
                    "Finished Goods Name 2": formData.fg2Name || '',
                    "Qty 2": Number(formData.fg2Qty) || 0,
                    "Processing Cost 2": Number(formData.fg2Cost) || 0,
                    "Finished Goods Name 3": formData.fg3Name || '',
                    "Qty 3": Number(formData.fg3Qty) || 0,
                    "Processing Cost 3": Number(formData.fg3Cost) || 0,
                    "Finished Goods Name 4": formData.fg4Name || '',
                    "Qty 4": Number(formData.fg4Qty) || 0,
                    "Processing Cost 4": Number(formData.fg4Cost) || 0,
                    "Starting Reading Photo": startPhotoUrl,
                    "Ending Reading Photo": endPhotoUrl,
                    "Remarks": formData.remarks || '',
                    "Machine Running Hour": Number(formData.machineHours) || 0,
                    "Firm Name": firmNameValue || '',
                });

            if (insertError) {
                throw insertError;
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
                fg1Cost: '',
                fg2Name: '',
                fg2Qty: '',
                fg2Cost: '',
                fg3Name: '',
                fg3Qty: '',
                fg3Cost: '',
                fg4Name: '',
                fg4Qty: '',
                fg4Cost: '',
                remarks: '',
                machineHours: '',
                firmName: '',
            });
            setStartingPhoto(null);
            setEndingPhoto(null);
            
            // Reload data to show the new record
            await loadData();
        } catch (err) {
            console.error('Error submitting form:', err);
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setIsSubmitting(false);
        }
    };

    const startEditCost = (index: number, currentCost: number) => {
        setEditingCostIndex(index);
        setCostInput((currentCost || 0).toString());
    };

    const cancelEditCost = () => {
        setEditingCostIndex(null);
        setCostInput("");
    };

    const handleSaveCost = async (index: number) => {
        if (!selectedRecord) return;
        setSavingCost(true);
        try {
            const costColumn = `Processing Cost ${index}`;
            const { error } = await supabase
                .from('crushing_actual')
                .update({ [costColumn]: Number(costInput) })
                .eq('id', selectedRecord._rowIndex);

            if (error) throw error;

            const updatedRecord = { ...selectedRecord, [`fg${index}Cost`]: Number(costInput) };
            setSelectedRecord(updatedRecord as CrushingRecord);
            setCrushingRecords(prev => prev.map(r => r._rowIndex === selectedRecord._rowIndex ? updatedRecord as CrushingRecord : r));
            
            setSuccessMessage(`Processing Cost ${index} updated successfully`);
            setEditingCostIndex(null);
        } catch (err: any) {
            setError(err.message || "Failed to update cost");
        } finally {
            setSavingCost(false);
        }
    };

    const handleViewDetails = async (record: CrushingRecord) => {
        setSelectedRecord(record);
        setIsDetailsOpen(true);
        setCheckingSubmitted(true);
        setIsSubmittedToTally(false);
        try {
            const { data, error } = await supabase
                .from('semi_actual')
                .select('id')
                .eq('"S No."', `CR-${record._rowIndex}`)
                .limit(1);
            if (!error && data && data.length > 0) {
                setIsSubmittedToTally(true);
            }
        } catch (err) {
            console.error("Error checking tally submission:", err);
        } finally {
            setCheckingSubmitted(false);
        }
    };

    const handleSubmitToTally = async (record: CrushingRecord) => {
        setIsSubmitting(true);
        setError(null);
        try {
            const { error: insertError } = await supabase
                .from('semi_actual')
                .insert({
                    "Timestamp": new Date().toISOString(),
                    "Semi Finished Job Card No.": `CR-${record._rowIndex}`,
                    "Supervisor Name": user?.username || "Crushing Operator",
                    "Date Of Production": record.dateOfProduction,
                    "Product Name": record.crushingProductName,
                    "Qty Of Semi Finished Good": record.inputQty,
                    "Raw Material Name 1": record.fg1Name || null,
                    "Quantity Of Raw Material 1": record.fg1Qty || null,
                    "Raw Material Name 2": record.fg2Name || null,
                    "Quantity Of Raw Material 2": record.fg2Qty || null,
                    "Raw Material Name 3": record.fg3Name || null,
                    "Quantity Of Raw Material 3": record.fg3Qty || null,
                    "Raw Material Name 4": record.fg4Name || null,
                    "Quantity Of Raw Material 4": record.fg4Qty || null,
                    "S No.": `CR-${record._rowIndex}`,
                    "Starting Reading Photo": record.startingPhoto || null,
                    "Ending Reading Photo": record.endingPhoto || null,
                    "Machine Running hour": record.machineHours || null,
                    "Narration": record.remarks || null,
                    "Planned1": record.dateOfProduction,
                    "Semi Finished Production No.": record.firmName || null,
                });

            if (insertError) throw insertError;

            setIsSubmittedToTally(true);
            setSubmittedIds(prev => {
                const next = new Set(prev);
                next.add(record._rowIndex);
                return next;
            });
            setSuccessMessage("Crushing entry successfully submitted to Tally Entry!");
        } catch (err: any) {
            console.error("Error submitting to Tally:", err);
            const msg = err?.message || err?.details || (typeof err === 'object' ? JSON.stringify(err) : String(err));
            setError(msg);
        } finally {
            setIsSubmitting(false);
        }
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
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                        <div>
                            <h3 className="text-lg font-semibold text-slate-800">Crushing Records</h3>
                            <p className="text-xs text-slate-400 font-medium">
                                {displayRecords.length} records found ({crushingRecords.length} total)
                            </p>
                        </div>
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full md:w-auto">
                            <div className="relative w-full sm:w-[250px]">
                                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search crushing..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-9 focus-visible:ring-olive-500"
                                />
                            </div>
                            
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="w-full sm:w-[150px] bg-white border-slate-200 text-xs h-9 rounded-lg justify-between font-normal hover:bg-transparent">
                      {firmFilter.length === 0 ? "All Firms" : `${firmFilter.length} Firm${firmFilter.length > 1 ? 's' : ''} Selected`}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-[150px] rounded-lg">
                    <DropdownMenuLabel className="text-xs">Filter by Firm</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {uniqueFirmsForFilter.map((firm) => (
                      <DropdownMenuCheckboxItem
                        key={firm}
                        checked={firmFilter.includes(firm)}
                        className="text-xs"
                        onCheckedChange={(checked: boolean) => {
                          if (checked) {
                            setFirmFilter([...firmFilter, firm])
                          } else {
                            setFirmFilter(firmFilter.filter((f) => f !== firm))
                          }
                        }}
                      >
                        {firm}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

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
                    </div>
 
                    {/* Tabs */}
                    <div className="flex gap-2 mb-4">
                        <button
                            type="button"
                            onClick={() => setActiveTab('pending')}
                            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center transition-all ${
                                activeTab === 'pending'
                                    ? 'bg-olive-600 text-white shadow-md'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                        >
                            <Clock className="h-3.5 w-3.5 mr-1.5" />
                            Pending ({pendingRecords.length})
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('history')}
                            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center transition-all ${
                                activeTab === 'history'
                                    ? 'bg-olive-600 text-white shadow-md'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                        >
                            <History className="h-3.5 w-3.5 mr-1.5" />
                            History ({historyRecords.length})
                        </button>
                    </div>

                    {/* Dedicated History Filter Toolbar & Summary Bar */}
                    {activeTab === 'history' && (
                        <div className="bg-slate-100/90 px-4 py-3 rounded-xl border border-slate-200/80 mb-4 shadow-2xs flex flex-wrap items-center justify-between gap-3">
                            {/* Filters (Left) */}
                            <div className="flex flex-wrap items-center gap-2">
                                {/* Firm Filter Dropdown */}
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="outline" className="h-8 text-xs bg-white border-slate-200 justify-between font-medium">
                                      <Building className="h-3.5 w-3.5 text-olive-600 shrink-0 mr-1.5" />
                                      {firmFilter.length === 0 ? "All Firms" : `${firmFilter.length} Selected`}
                                      <ChevronDown className="h-3 w-3 text-slate-400 shrink-0 ml-1.5" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent className="w-[150px] rounded-lg">
                                    <DropdownMenuLabel className="text-xs">Filter by Firm</DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    {uniqueFirmsForFilter.map((firm) => (
                                      <DropdownMenuCheckboxItem
                                        key={firm}
                                        checked={firmFilter.includes(firm)}
                                        className="text-xs"
                                        onCheckedChange={(checked: boolean) => {
                                          if (checked) {
                                            setFirmFilter([...firmFilter, firm])
                                          } else {
                                            setFirmFilter(firmFilter.filter((f) => f !== firm))
                                          }
                                        }}
                                      >
                                        {firm}
                                      </DropdownMenuCheckboxItem>
                                    ))}
                                  </DropdownMenuContent>
                                </DropdownMenu>

                                {/* Searchable Product Filter */}
                                <Popover open={isProductPopoverOpen} onOpenChange={setIsProductPopoverOpen}>
                                    <PopoverTrigger asChild>
                                        <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-2xs cursor-pointer hover:bg-slate-50 transition-colors h-8 text-xs">
                                            <Package className="h-3.5 w-3.5 text-olive-600 shrink-0" />
                                            <span className="font-semibold text-slate-500 whitespace-nowrap">Product:</span>
                                            <span className="font-medium text-slate-800 truncate max-w-[150px]">
                                                {selectedHistoryProduct === 'ALL' ? 'All Products' : selectedHistoryProduct}
                                            </span>
                                            <ChevronDown className="h-3 w-3 text-slate-400 shrink-0 ml-0.5" />
                                        </div>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[240px] p-2 bg-white rounded-xl border border-slate-200 shadow-lg" align="start">
                                        <div className="space-y-2">
                                            <div className="relative">
                                                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                                                <Input
                                                    placeholder="Search product..."
                                                    value={productSearchInput}
                                                    onChange={(e) => setProductSearchInput(e.target.value)}
                                                    className="h-8 text-xs pl-8 bg-slate-50 border-slate-200 focus-visible:ring-olive-500"
                                                    autoFocus
                                                />
                                            </div>
                                            <div className="max-h-[200px] overflow-y-auto space-y-0.5 pr-1">
                                                <button
                                                    type="button"
                                                    className={`w-full text-left px-2.5 py-1.5 text-xs rounded-lg transition-colors flex items-center justify-between ${
                                                        selectedHistoryProduct === 'ALL'
                                                            ? 'bg-olive-50 text-olive-800 font-bold'
                                                            : 'hover:bg-slate-100 text-slate-700'
                                                    }`}
                                                    onClick={() => {
                                                        setSelectedHistoryProduct('ALL');
                                                        setIsProductPopoverOpen(false);
                                                        setProductSearchInput('');
                                                    }}
                                                >
                                                    <span>All Products</span>
                                                    {selectedHistoryProduct === 'ALL' && <Check className="h-3.5 w-3.5 text-olive-600 shrink-0" />}
                                                </button>
                                                {(() => {
                                                    const filtered = uniqueHistoryProducts.filter(p =>
                                                        p.toLowerCase().includes(productSearchInput.toLowerCase().trim())
                                                    );
                                                    if (filtered.length === 0) {
                                                        return (
                                                            <p className="text-xs text-slate-400 text-center py-2 italic">
                                                                No products found
                                                            </p>
                                                        );
                                                    }
                                                    return filtered.map(p => (
                                                        <button
                                                            key={p}
                                                            type="button"
                                                            className={`w-full text-left px-2.5 py-1.5 text-xs rounded-lg transition-colors flex items-center justify-between ${
                                                                selectedHistoryProduct === p
                                                                    ? 'bg-olive-50 text-olive-800 font-bold'
                                                                    : 'hover:bg-slate-100 text-slate-700'
                                                            }`}
                                                            onClick={() => {
                                                                setSelectedHistoryProduct(p);
                                                                setIsProductPopoverOpen(false);
                                                                setProductSearchInput('');
                                                            }}
                                                        >
                                                            <span className="truncate">{p}</span>
                                                            {selectedHistoryProduct === p && <Check className="h-3.5 w-3.5 text-olive-600 shrink-0 ml-1" />}
                                                        </button>
                                                    ));
                                                })()}
                                            </div>
                                        </div>
                                    </PopoverContent>
                                </Popover>

                                {/* Divider */}
                                <div className="h-4.5 w-px bg-slate-300 mx-1 hidden sm:block" />

                                {/* From Date Filter */}
                                <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-2xs h-8 text-xs">
                                    <Calendar className="h-3.5 w-3.5 text-olive-600 shrink-0" />
                                    <span className="font-semibold text-slate-500 whitespace-nowrap">From:</span>
                                    <input
                                        type="date"
                                        value={historyFromDate}
                                        onChange={(e) => setHistoryFromDate(e.target.value)}
                                        className="bg-transparent font-medium text-slate-800 focus:outline-none cursor-pointer text-xs"
                                    />
                                </div>

                                {/* To Date Filter */}
                                <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-2xs h-8 text-xs">
                                    <Calendar className="h-3.5 w-3.5 text-olive-600 shrink-0" />
                                    <span className="font-semibold text-slate-500 whitespace-nowrap">To:</span>
                                    <input
                                        type="date"
                                        value={historyToDate}
                                        onChange={(e) => setHistoryToDate(e.target.value)}
                                        className="bg-transparent font-medium text-slate-800 focus:outline-none cursor-pointer text-xs"
                                    />
                                </div>

                                {/* Reset Button */}
                                {(selectedHistoryProduct !== 'ALL' || historyFromDate || historyToDate || firmFilter.length > 0 || searchQuery) && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                            setSelectedHistoryProduct('ALL');
                                            setHistoryFromDate('');
                                            setHistoryToDate('');
                                            setFirmFilter([]);
                                            setSearchQuery('');
                                        }}
                                        className="h-8 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2 font-medium"
                                    >
                                        Reset Filters
                                    </Button>
                                )}
                            </div>

                            {/* Summary Badges (Right - Single Line Layout) */}
                            <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
                                <div className="flex items-center gap-1.5 bg-white border border-amber-200 shadow-2xs px-3 py-1 rounded-lg text-slate-700 font-medium text-xs h-8">
                                    <span className="text-slate-500 font-semibold">Total Machine Hours:</span>
                                    <strong className="text-amber-700 font-bold text-xs">
                                        {totalHistoryMachineHours.toLocaleString('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} Hrs
                                    </strong>
                                </div>
                                <div className="flex items-center gap-1.5 bg-white border border-blue-200 shadow-2xs px-3 py-1 rounded-lg text-slate-700 font-medium text-xs h-8">
                                    <span className="text-slate-500 font-semibold">Total Input Qty:</span>
                                    <strong className="text-blue-700 font-bold text-xs">
                                        {totalHistoryInputQty.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 3 })} MT
                                    </strong>
                                </div>
                                <div className="flex items-center gap-1.5 bg-white border border-emerald-200 shadow-2xs px-3 py-1 rounded-lg text-slate-700 font-medium text-xs h-8">
                                    <span className="text-slate-500 font-semibold">Total Output Qty:</span>
                                    <strong className="text-emerald-700 font-bold text-xs">
                                        {totalHistoryOutputQty.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 3 })} MT
                                    </strong>
                                </div>
                            </div>
                        </div>
                    )}

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
                                {displayRecords.length > 0 ? (
                                    displayRecords.map((record) => (
                                        <TableRow key={record._rowIndex} className="hover:bg-olive-50/40">
                                            {/* Date */}
                                            <TableCell className="whitespace-nowrap">
                                                <div className="flex items-center text-sm text-slate-600">
                                                    <Calendar className="h-3 w-3 mr-1 text-slate-400" />
                                                    {formatDisplayDate(record.dateOfProduction)}
                                                </div>
                                            </TableCell>

                                            {/* Firm Name */}
                                            <TableCell className="whitespace-nowrap">
                                                <span className="text-sm font-semibold text-slate-800">
                                                    {record.firmName || '-'}
                                                </span>
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
                                                            <span className="ml-1 font-medium text-olive-600">
                                                                {record.fg1Name} ({record.fg1Qty}) {record.fg1Cost ? `[₹${record.fg1Cost}]` : ''}
                                                            </span>
                                                        </div>
                                                    )}
                                                    {record.fg2Name && (
                                                        <div className="text-xs truncate">
                                                            <span className="text-slate-500">2:</span>
                                                            <span className="ml-1 font-medium text-olive-600">
                                                                {record.fg2Name} ({record.fg2Qty}) {record.fg2Cost ? `[₹${record.fg2Cost}]` : ''}
                                                            </span>
                                                        </div>
                                                    )}
                                                    {record.fg3Name && (
                                                        <div className="text-xs truncate">
                                                            <span className="text-slate-500">3:</span>
                                                            <span className="ml-1 font-medium text-olive-600">
                                                                {record.fg3Name} ({record.fg3Qty}) {record.fg3Cost ? `[₹${record.fg3Cost}]` : ''}
                                                            </span>
                                                        </div>
                                                    )}
                                                    {record.fg4Name && (
                                                        <div className="text-xs truncate">
                                                            <span className="text-slate-500">4:</span>
                                                            <span className="ml-1 font-medium text-olive-600">
                                                                {record.fg4Name} ({record.fg4Qty}) {record.fg4Cost ? `[₹${record.fg4Cost}]` : ''}
                                                            </span>
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
                                                    variant="outline"
                                                    size="sm"
                                                    className="h-8 border-slate-200 hover:bg-olive-50 hover:text-olive-700"
                                                >
                                                    <Eye className="h-4 w-4 mr-1.5" />
                                                    View
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

                        {/* Firm Name Selection for Admin only */}
                        {user?.role === 'admin' && (
                            <div className="space-y-2">
                                <Label htmlFor="firmName">Firm Name *</Label>
                                <Select
                                    value={formData.firmName}
                                    onValueChange={(value) => setFormData({ ...formData, firmName: value })}
                                >
                                    <SelectTrigger id="firmName" className={formErrors.firmName ? "border-red-500" : ""}>
                                        <SelectValue placeholder="Select firm name..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Purab">Purab</SelectItem>
                                        <SelectItem value="Pmmpl">Pmmpl</SelectItem>
                                        <SelectItem value="Rkl">Rkl</SelectItem>
                                    </SelectContent>
                                </Select>
                                {formErrors.firmName && (
                                    <p className="text-xs text-red-500">{formErrors.firmName}</p>
                                )}
                            </div>
                        )}

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
                                step="0.001"
                                min="0.001"
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
                            <div className="grid grid-cols-3 gap-4">
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
                                        step="0.001"
                                        min="0"
                                        value={formData.fg1Qty}
                                        onChange={(e) => setFormData({ ...formData, fg1Qty: e.target.value })}
                                        placeholder="0"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="fg1Cost">Processing Cost 1</Label>
                                    <Input
                                        id="fg1Cost"
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={formData.fg1Cost}
                                        onChange={(e) => setFormData({ ...formData, fg1Cost: e.target.value })}
                                        placeholder="0.00"
                                        className={formErrors.fg1Cost ? "border-red-500" : ""}
                                    />
                                    {formErrors.fg1Cost && (
                                        <p className="text-xs text-red-500">{formErrors.fg1Cost}</p>
                                    )}
                                </div>
                            </div>

                            {/* FG 2 */}
                            <div className="grid grid-cols-3 gap-4">
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
                                        step="0.001"
                                        min="0"
                                        value={formData.fg2Qty}
                                        onChange={(e) => setFormData({ ...formData, fg2Qty: e.target.value })}
                                        placeholder="0"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="fg2Cost">Processing Cost 2</Label>
                                    <Input
                                        id="fg2Cost"
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={formData.fg2Cost}
                                        onChange={(e) => setFormData({ ...formData, fg2Cost: e.target.value })}
                                        placeholder="0.00"
                                        className={formErrors.fg2Cost ? "border-red-500" : ""}
                                    />
                                    {formErrors.fg2Cost && (
                                        <p className="text-xs text-red-500">{formErrors.fg2Cost}</p>
                                    )}
                                </div>
                            </div>

                            {/* FG 3 */}
                            <div className="grid grid-cols-3 gap-4">
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
                                        step="0.001"
                                        min="0"
                                        value={formData.fg3Qty}
                                        onChange={(e) => setFormData({ ...formData, fg3Qty: e.target.value })}
                                        placeholder="0"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="fg3Cost">Processing Cost 3</Label>
                                    <Input
                                        id="fg3Cost"
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={formData.fg3Cost}
                                        onChange={(e) => setFormData({ ...formData, fg3Cost: e.target.value })}
                                        placeholder="0.00"
                                        className={formErrors.fg3Cost ? "border-red-500" : ""}
                                    />
                                    {formErrors.fg3Cost && (
                                        <p className="text-xs text-red-500">{formErrors.fg3Cost}</p>
                                    )}
                                </div>
                            </div>

                            {/* FG 4 */}
                            <div className="grid grid-cols-3 gap-4">
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
                                        step="0.001"
                                        min="0"
                                        value={formData.fg4Qty}
                                        onChange={(e) => setFormData({ ...formData, fg4Qty: e.target.value })}
                                        placeholder="0"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="fg4Cost">Processing Cost 4</Label>
                                    <Input
                                        id="fg4Cost"
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={formData.fg4Cost}
                                        onChange={(e) => setFormData({ ...formData, fg4Cost: e.target.value })}
                                        placeholder="0.00"
                                        className={formErrors.fg4Cost ? "border-red-500" : ""}
                                    />
                                    {formErrors.fg4Cost && (
                                        <p className="text-xs text-red-500">{formErrors.fg4Cost}</p>
                                    )}
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
                                    <p className="text-xs text-slate-400 font-medium">Firm Name</p>
                                    <p className="text-sm font-semibold text-slate-700">
                                        {selectedRecord.firmName || '-'}
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
                                        <div className="bg-white p-3 rounded border border-slate-100 shadow-sm">
                                            <p className="text-xs text-slate-400 font-medium mb-1">FG 1</p>
                                            <div className="flex justify-between items-center">
                                                <p className="text-sm text-slate-700">
                                                    {selectedRecord.fg1Name}: <span className="font-semibold text-olive-600">{selectedRecord.fg1Qty}</span>
                                                </p>
                                            </div>
                                            <div className="mt-2 pt-2 border-t border-slate-50 flex items-center justify-between">
                                                {editingCostIndex === 1 ? (
                                                    <div className="flex items-center gap-2 w-full">
                                                        <Input
                                                            type="number"
                                                            step="0.01"
                                                            className="h-7 text-xs w-20"
                                                            value={costInput}
                                                            onChange={(e) => setCostInput(e.target.value)}
                                                        />
                                                        <Button size="sm" className="h-7 px-2 text-xs bg-olive-600 hover:bg-olive-700" onClick={() => handleSaveCost(1)} disabled={savingCost}>
                                                            {savingCost ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
                                                        </Button>
                                                        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={cancelEditCost} disabled={savingCost}>
                                                            <X className="h-3 w-3" />
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <p className="text-xs text-slate-500">
                                                            Cost: <span className="font-medium text-slate-700">₹{selectedRecord.fg1Cost || 0}</span>
                                                        </p>
                                                        {user?.role === 'admin' && (
                                                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-slate-400 hover:text-olive-600" onClick={() => startEditCost(1, selectedRecord.fg1Cost)}>
                                                                <Edit2 className="h-3 w-3" />
                                                            </Button>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                    {selectedRecord.fg2Name && (
                                        <div className="bg-white p-3 rounded border border-slate-100 shadow-sm">
                                            <p className="text-xs text-slate-400 font-medium mb-1">FG 2</p>
                                            <div className="flex justify-between items-center">
                                                <p className="text-sm text-slate-700">
                                                    {selectedRecord.fg2Name}: <span className="font-semibold text-olive-600">{selectedRecord.fg2Qty}</span>
                                                </p>
                                            </div>
                                            <div className="mt-2 pt-2 border-t border-slate-50 flex items-center justify-between">
                                                {editingCostIndex === 2 ? (
                                                    <div className="flex items-center gap-2 w-full">
                                                        <Input
                                                            type="number"
                                                            step="0.01"
                                                            className="h-7 text-xs w-20"
                                                            value={costInput}
                                                            onChange={(e) => setCostInput(e.target.value)}
                                                        />
                                                        <Button size="sm" className="h-7 px-2 text-xs bg-olive-600 hover:bg-olive-700" onClick={() => handleSaveCost(2)} disabled={savingCost}>
                                                            {savingCost ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
                                                        </Button>
                                                        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={cancelEditCost} disabled={savingCost}>
                                                            <X className="h-3 w-3" />
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <p className="text-xs text-slate-500">
                                                            Cost: <span className="font-medium text-slate-700">₹{selectedRecord.fg2Cost || 0}</span>
                                                        </p>
                                                        {user?.role === 'admin' && (
                                                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-slate-400 hover:text-olive-600" onClick={() => startEditCost(2, selectedRecord.fg2Cost)}>
                                                                <Edit2 className="h-3 w-3" />
                                                            </Button>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                    {selectedRecord.fg3Name && (
                                        <div className="bg-white p-3 rounded border border-slate-100 shadow-sm">
                                            <p className="text-xs text-slate-400 font-medium mb-1">FG 3</p>
                                            <div className="flex justify-between items-center">
                                                <p className="text-sm text-slate-700">
                                                    {selectedRecord.fg3Name}: <span className="font-semibold text-olive-600">{selectedRecord.fg3Qty}</span>
                                                </p>
                                            </div>
                                            <div className="mt-2 pt-2 border-t border-slate-50 flex items-center justify-between">
                                                {editingCostIndex === 3 ? (
                                                    <div className="flex items-center gap-2 w-full">
                                                        <Input
                                                            type="number"
                                                            step="0.01"
                                                            className="h-7 text-xs w-20"
                                                            value={costInput}
                                                            onChange={(e) => setCostInput(e.target.value)}
                                                        />
                                                        <Button size="sm" className="h-7 px-2 text-xs bg-olive-600 hover:bg-olive-700" onClick={() => handleSaveCost(3)} disabled={savingCost}>
                                                            {savingCost ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
                                                        </Button>
                                                        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={cancelEditCost} disabled={savingCost}>
                                                            <X className="h-3 w-3" />
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <p className="text-xs text-slate-500">
                                                            Cost: <span className="font-medium text-slate-700">₹{selectedRecord.fg3Cost || 0}</span>
                                                        </p>
                                                        {user?.role === 'admin' && (
                                                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-slate-400 hover:text-olive-600" onClick={() => startEditCost(3, selectedRecord.fg3Cost)}>
                                                                <Edit2 className="h-3 w-3" />
                                                            </Button>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                    {selectedRecord.fg4Name && (
                                        <div className="bg-white p-3 rounded border border-slate-100 shadow-sm">
                                            <p className="text-xs text-slate-400 font-medium mb-1">FG 4</p>
                                            <div className="flex justify-between items-center">
                                                <p className="text-sm text-slate-700">
                                                    {selectedRecord.fg4Name}: <span className="font-semibold text-olive-600">{selectedRecord.fg4Qty}</span>
                                                </p>
                                            </div>
                                            <div className="mt-2 pt-2 border-t border-slate-50 flex items-center justify-between">
                                                {editingCostIndex === 4 ? (
                                                    <div className="flex items-center gap-2 w-full">
                                                        <Input
                                                            type="number"
                                                            step="0.01"
                                                            className="h-7 text-xs w-20"
                                                            value={costInput}
                                                            onChange={(e) => setCostInput(e.target.value)}
                                                        />
                                                        <Button size="sm" className="h-7 px-2 text-xs bg-olive-600 hover:bg-olive-700" onClick={() => handleSaveCost(4)} disabled={savingCost}>
                                                            {savingCost ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
                                                        </Button>
                                                        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={cancelEditCost} disabled={savingCost}>
                                                            <X className="h-3 w-3" />
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <p className="text-xs text-slate-500">
                                                            Cost: <span className="font-medium text-slate-700">₹{selectedRecord.fg4Cost || 0}</span>
                                                        </p>
                                                        {user?.role === 'admin' && (
                                                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-slate-400 hover:text-olive-600" onClick={() => startEditCost(4, selectedRecord.fg4Cost)}>
                                                                <Edit2 className="h-3 w-3" />
                                                            </Button>
                                                        )}
                                                    </>
                                                )}
                                            </div>
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
                            {/* Submit to Tally Entry Action */}
                            <div className="flex justify-end gap-3 pt-6 border-t mt-6">
                                <Button 
                                    type="button" 
                                    variant="outline" 
                                    onClick={() => setIsDetailsOpen(false)}
                                >
                                    Close
                                </Button>
                                {isSubmittedToTally ? (
                                    <Button 
                                        type="button" 
                                        disabled 
                                        className="bg-emerald-600 text-white cursor-not-allowed"
                                    >
                                        <BadgeCheck className="h-4 w-4 mr-1.5" />
                                        Submitted to Tally
                                    </Button>
                                ) : (
                                    <Button 
                                        type="button" 
                                        onClick={() => handleSubmitToTally(selectedRecord)}
                                        disabled={isSubmitting || checkingSubmitted}
                                        className="bg-olive-600 text-white hover:bg-olive-700"
                                    >
                                        {isSubmitting ? (
                                            <>
                                                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                                                Submitting...
                                            </>
                                        ) : (
                                            <>
                                                <CheckCircle2 className="h-4 w-4 mr-1.5" />
                                                Submit to Tally Entry
                                            </>
                                        )}
                                    </Button>
                                )}
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
