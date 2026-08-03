"use client"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuCheckboxItem } from "@/components/ui/dropdown-menu";


import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useAuth, FIRM_MAP } from "@/lib/auth";
import { format } from 'date-fns';
import {
    Loader2, AlertTriangle, RefreshCw, ClipboardList, History,
    FileCheck, Clock, Zap, Camera, Upload, Save, Eye, X, Plus,
    Pencil, Target, Settings, Search, Package, Calendar, ChevronDown, Check, Building
} from 'lucide-react';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";
import {
    fetchMasterRows,
    fetchSemiActualRows,
    fetchSemiJobCardRows,
    fetchSemiProductionRows,
    getMasterValue,
    SEMI_ACTUAL_TABLE,
    SEMI_JOB_CARD_TABLE,
    SEMI_PRODUCTION_TABLE,
    toSupabaseDate,
} from "@/lib/semi-finished-supabase";

// ==================== CONSTANTS ====================
const SEMI_FINISHED_BUCKET = "Semi Finished";
const SEMI_FINISHED_FOLDER = "Semi Finished Images";
const MAX_RAW_MATERIALS = 5;

// ==================== TYPE DEFINITIONS ====================
interface SemiJobCardRecord {
    _rowIndex: number;
    timestamp: string;
    sjcSrNo: string;
    sfSrNo: string;
    supervisorName: string;
    productName: string;
    qty: number;
    dateOfProduction: string;
    planned: string;
    actual: string;
    actualMade?: number;
    pending?: number;
    firmName?: string;
}

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
    rawMaterial1Rate: number;
    rawMaterial2Name: string;
    rawMaterial2Qty: number;
    rawMaterial2Rate: number;
    rawMaterial3Name: string;
    rawMaterial3Qty: number;
    rawMaterial3Rate: number;
    rawMaterial4Name: string;
    rawMaterial4Qty: number;
    rawMaterial4Rate: number;
    rawMaterial5Name: string;
    rawMaterial5Qty: number;
    rawMaterial5Rate: number;
    isAnyEndProduct: string;
    endProductRawMaterialName: string;
    endProductQty: number;
    narration: string;
    sNo: string;
    startingReading: number;
    startingReadingPhoto: string;
    endingReading: number;
    endingReadingPhoto: string;
    machineRunningHour: number;
    machineRunning: number;
    sfProductionNo: string;
    planned1: string;
    actual1: string;
    timeDelay1: string;
    status: string;
    actualQty1: number;
    planned2: string;
    actual2: string;
    timeDelay2: string;
    actualQty2: number;
    finalQty: number;
    processingCost?: number;
    firmName?: string;
}

interface RawMaterialRow {
    name: string;
    qty: string;
}

interface RawMaterial {
    name: string;
}

// ==================== HELPERS ====================
const formatDisplayDate = (val: any): string => {
    if (!val) return '-';
    try {
        const d = new Date(val);
        if (!isNaN(d.getTime())) return format(d, 'dd/MM/yy');
    } catch { }
    return String(val);
};

const isSJCPending = (record: SemiJobCardRecord): boolean => {
    const hasPlanned = Boolean(record.planned && record.planned !== '' && record.planned !== 'null');
    const hasActual = Boolean(record.actual && record.actual !== '' && record.actual !== 'null');
    return hasPlanned && !hasActual;
};

const uploadImageToStorage = async (file: File, fileName: string): Promise<string> => {
    const extension = file.name.split('.').pop() || 'jpg';
    const safeFileName = fileName.replace(/\.[^.]+$/, '');
    const filePath = `${SEMI_FINISHED_FOLDER}/${safeFileName}.${extension}`;

    const { error: uploadError } = await supabase.storage
        .from(SEMI_FINISHED_BUCKET)
        .upload(filePath, file, {
            contentType: file.type || 'image/jpeg'
        });

    if (uploadError) throw uploadError;

    const { data } = supabase.storage
        .from(SEMI_FINISHED_BUCKET)
        .getPublicUrl(filePath);

    return data.publicUrl;
};

// ==================== MAIN COMPONENT ====================
export default function SemiActualProductionPage() {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState<'pending' | 'history' | 'summary'>('pending');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isViewModalOpen, setIsViewModalOpen] = useState(false);
    const [selectedSjc, setSelectedSjc] = useState<SemiJobCardRecord | null>(null);
    const [selectedActual, setSelectedActual] = useState<SemiActualRecord | null>(null);
    const [formError, setFormError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [firmFilter, setFirmFilter] = useState<string[]>([]);
    const [selectedHistoryProduct, setSelectedHistoryProduct] = useState<string>('ALL');
    const [historyFromDate, setHistoryFromDate] = useState<string>('');
    const [historyToDate, setHistoryToDate] = useState<string>('');
    const [isProductPopoverOpen, setIsProductPopoverOpen] = useState<boolean>(false);
    const [productSearchInput, setProductSearchInput] = useState<string>('');
    const [summaryStartDate, setSummaryStartDate] = useState('');
    const [summaryEndDate, setSummaryEndDate] = useState('');
    const [summaryProduct, setSummaryProduct] = useState('ALL');
    const [summaryMaterial, setSummaryMaterial] = useState('ALL');
    const isAdmin = user?.role?.toLowerCase() === 'admin';

    const [isEditingProcessingCost, setIsEditingProcessingCost] = useState(false);
    const [editProcessingCostValue, setEditProcessingCostValue] = useState('');
    const [savingProcessingCost, setSavingProcessingCost] = useState(false);

    const [jobCardData, setJobCardData] = useState<SemiJobCardRecord[]>([]);
    const [semiActualData, setSemiActualData] = useState<SemiActualRecord[]>([]);

    const uniqueFirmsForFilter = useMemo(() => {
        const firms = new Set<string>();
        jobCardData.forEach((item) => {
            if (item.firmName) firms.add(item.firmName);
        });
        semiActualData.forEach((item) => {
            if (item.firmName) firms.add(item.firmName);
        });
        return Array.from(firms).sort();
    }, [jobCardData, semiActualData]);
    const [rawMaterials, setRawMaterials] = useState<RawMaterial[]>([]);
    const [nextSerialNo, setNextSerialNo] = useState('SA-1001');

    const startPhotoRef = useRef<HTMLInputElement>(null);
    const endPhotoRef = useRef<HTMLInputElement>(null);
    const [startPhotoFile, setStartPhotoFile] = useState<File | null>(null);
    const [endPhotoFile, setEndPhotoFile] = useState<File | null>(null);
    const [startPhotoPreview, setStartPhotoPreview] = useState('');
    const [endPhotoPreview, setEndPhotoPreview] = useState('');

    // Dynamic raw material rows (start with 1 row)
    const [rawMaterialRows, setRawMaterialRows] = useState<RawMaterialRow[]>([{ name: '', qty: '' }]);

    const [formData, setFormData] = useState({
        qtyOfSemiFinishedGood: '',
        processingCost: '',
        isAnyEndProduct: 'No',
        endProductRawMaterialName: '',
        endProductQty: '',
        startingReading: '',
        endingReading: '',
        machineRunningHour: '',
        dateOfProduction: '',
    });

    useEffect(() => {
        if (!successMessage) return;
        const t = setTimeout(() => setSuccessMessage(''), 3500);
        return () => clearTimeout(t);
    }, [successMessage]);

    const loadAllData = useCallback(async () => {
        setIsLoading(true);
        setLoadError('');
        try {
            const [sjcTable, actualTable, masterTable, productionTable] = await Promise.all([
                fetchSemiJobCardRows(),
                fetchSemiActualRows(),
                fetchMasterRows(),
                fetchSemiProductionRows(),
            ]);

            const productionFirmByNo = new Map<string, string>();
            productionTable.forEach((row: any) => {
                const compositeKey = `${row.sfSrNo}::${String(row.nameOfSemiFinished || "").toLowerCase().trim()}`;
                productionFirmByNo.set(compositeKey, row.firmName);
                productionFirmByNo.set(row.sfSrNo, row.firmName);
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

            const jobCards: SemiJobCardRecord[] = sjcTable
                .filter((row: any) => row.sjcSrNo && row.sjcSrNo.startsWith('SJC-'))
                .map((row: any) => {
                    const compositeKey = `${row.sfSrNo}::${String(row.productName || "").toLowerCase().trim()}`;
                    return {
                        ...row,
                        firmName: productionFirmByNo.get(compositeKey) || productionFirmByNo.get(row.sfSrNo) || ""
                    };
                });
            setJobCardData(filterByFirm(jobCards).sort((a, b) => b._rowIndex - a._rowIndex));

            const actuals: SemiActualRecord[] = actualTable
                .filter((row: any) => row.sNo && row.sNo.startsWith('SA-'))
                .map((row: any) => {
                    const compositeKey = `${row.sfProductionNo}::${String(row.productName || "").toLowerCase().trim()}`;
                    return {
                        ...row,
                        firmName: productionFirmByNo.get(compositeKey) || productionFirmByNo.get(row.sfProductionNo) || ""
                    };
                });
            setSemiActualData(filterByFirm(actuals).sort((a, b) => b._rowIndex - a._rowIndex));

            const rmSet = new Set<string>();
            masterTable.forEach((row: any) => {
                const val = getMasterValue(row, ["Name Of Raw Material", "Raw Material Name", "Material Name", "M"]);
                if (val && val.length > 1 && val.length < 60 && !/^\d+$/.test(val)) {
                    rmSet.add(val);
                }
            });
            setRawMaterials(Array.from(rmSet).map(name => ({ name })));

            // Generate next SA serial
            const saNumbers = actuals
                .map(a => parseInt(a.sNo.replace('SA-', ''), 10))
                .filter(n => !isNaN(n));
            const maxSA = saNumbers.length > 0 ? Math.max(...saNumbers) : 1000;
            setNextSerialNo(`SA-${maxSA + 1}`);

        } catch (err: any) {
            setLoadError(`Failed to load data: ${err.message || 'Unknown error'}.`);
        } finally {
            setIsLoading(false);
        }
    }, [user]);

    useEffect(() => { loadAllData(); }, [loadAllData]);

    const resetForm = () => {
        setFormData({
            qtyOfSemiFinishedGood: '',
            processingCost: '',
            isAnyEndProduct: 'No',
            endProductRawMaterialName: '',
            endProductQty: '',
            startingReading: '',
            endingReading: '',
            machineRunningHour: '',
            dateOfProduction: '',
        });
        setRawMaterialRows([{ name: '', qty: '' }]);
        setStartPhotoFile(null); setEndPhotoFile(null);
        setStartPhotoPreview(''); setEndPhotoPreview('');
        setFormError('');
    };

    const handleEntryClick = (record: SemiJobCardRecord) => {
        setSelectedSjc(record);
        resetForm();
        setFormData(prev => ({
            ...prev,
            qtyOfSemiFinishedGood: String(record.qty),
            dateOfProduction: toSupabaseDate(record.dateOfProduction),
        }));
        setIsModalOpen(true);
    };

    const handleViewClick = (record: SemiActualRecord) => {
        setSelectedActual(record);
        setIsViewModalOpen(true);
    };

    const handleSaveProcessingCost = async () => {
        if (!selectedActual) return;
        setSavingProcessingCost(true);
        try {
            const newRate = Number(editProcessingCostValue) || 0;
            const { error } = await supabase
                .from(SEMI_ACTUAL_TABLE)
                .update({ "Processing Cost": newRate })
                .eq("id", selectedActual._rowIndex);
            if (error) throw error;
            
            setSelectedActual({
                ...selectedActual,
                processingCost: newRate
            });

            setIsEditingProcessingCost(false);
            setSuccessMessage('Processing cost saved successfully!');
            await loadAllData();
        } catch (err: any) {
            setLoadError(err?.message || 'Failed to save processing cost.');
        } finally {
            setSavingProcessingCost(false);
        }
    };

    const addRawMaterialRow = () => {
        if (rawMaterialRows.length < MAX_RAW_MATERIALS) {
            setRawMaterialRows(prev => [...prev, { name: '', qty: '' }]);
        }
    };

    const removeRawMaterialRow = (index: number) => {
        if (rawMaterialRows.length > 1) {
            setRawMaterialRows(prev => prev.filter((_, i) => i !== index));
        }
    };

    const updateRawMaterialRow = (index: number, field: 'name' | 'qty' | 'cost', value: string) => {
        setRawMaterialRows(prev => prev.map((row, i) => i === index ? { ...row, [field]: value } : row));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedSjc) return;
        if (!formData.qtyOfSemiFinishedGood || Number(formData.qtyOfSemiFinishedGood) <= 0) {
            setFormError('Please enter a valid quantity.');
            return;
        }
        if (!formData.startingReading) { setFormError('Starting reading is required.'); return; }
        if (!formData.endingReading) { setFormError('Ending reading is required.'); return; }
        if (!formData.processingCost || Number(formData.processingCost) <= 0) {
            setFormError('Please enter a valid Processing Cost.');
            return;
        }

        setIsSubmitting(true);
        setIsUploading(true);
        setFormError('');

        try {
            let startPhotoUrl = '';
            let endPhotoUrl = '';
            if (startPhotoFile) {
                startPhotoUrl = await uploadImageToStorage(startPhotoFile, `start_${selectedSjc.sjcSrNo}_${Date.now()}.jpg`);
            }
            if (endPhotoFile) {
                endPhotoUrl = await uploadImageToStorage(endPhotoFile, `end_${selectedSjc.sjcSrNo}_${Date.now()}.jpg`);
            }
            setIsUploading(false);

            // Pad raw material rows to 5
            const paddedRM = [...rawMaterialRows];
            while (paddedRM.length < 5) paddedRM.push({ name: '', qty: '' });

            const calculatedMachineHours = (Number(formData.endingReading) - Number(formData.startingReading)) || 0;
            const machineHours = formData.machineRunningHour !== ''
                ? Number(formData.machineRunningHour)
                : calculatedMachineHours;
            const madeQty = Number(formData.qtyOfSemiFinishedGood) || 0;
            const processingCostValue = Number(formData.processingCost) || 0;
            const { error: insertError } = await supabase.from(SEMI_ACTUAL_TABLE).insert({
                "Timestamp": new Date().toISOString(),
                "Semi Finished Job Card No.": selectedSjc.sjcSrNo,
                "Supervisor Name": selectedSjc.supervisorName,
                "Date Of Production": toSupabaseDate(formData.dateOfProduction),
                "Product Name": selectedSjc.productName,
                "Qty Of Semi Finished Good": madeQty,
                "Processing Cost": processingCostValue,
                "Raw Material Name 1": paddedRM[0].name || '',
                "Quantity Of Raw Material 1": Number(paddedRM[0].qty) || 0,
                "Raw Material Name 2": paddedRM[1].name || '',
                "Quantity Of Raw Material 2": Number(paddedRM[1].qty) || 0,
                "Raw Material Name 3": paddedRM[2].name || '',
                "Quantity Of Raw Material 3": Number(paddedRM[2].qty) || 0,
                "Raw Material Name 4": paddedRM[3].name || '',
                "Quantity Of Raw Material 4": Number(paddedRM[3].qty) || 0,
                "Raw Material Name 5": paddedRM[4].name || '',
                "Quantity Of Raw Material 5": Number(paddedRM[4].qty) || 0,
                "Is Any End Product": formData.isAnyEndProduct === "Yes",
                "End Product Name": formData.endProductRawMaterialName || '',
                "End Product Qty": Number(formData.endProductQty) || 0,
                "Narration": '',
                "S No.": nextSerialNo,
                "Starting Reading": Number(formData.startingReading) || 0,
                "Starting Reading Photo": startPhotoUrl,
                "Ending Reading": Number(formData.endingReading) || 0,
                "Ending Reading Photo": endPhotoUrl,
                "Machine Running hour": machineHours >= 0 ? machineHours : 0,
                "Machine Running": machineHours >= 0 ? machineHours : 0,
                "Semi Finished Production No.": selectedSjc.sfSrNo,
                "Planned1": new Date().toISOString().slice(0, 10),
            });
            if (insertError) throw insertError;

            const nextActualMade = Number(selectedSjc.actualMade || 0) + madeQty;
            const nextPending = Math.max(Number(selectedSjc.qty || 0) - nextActualMade, 0);
            const { error: updateError } = await supabase
                .from(SEMI_JOB_CARD_TABLE)
                .update({
                    "Actual Made": nextActualMade,
                    "Pending": nextPending,
                    "Actual": nextPending <= 0 ? new Date().toISOString().slice(0, 10) : null,
                    "Status": nextPending <= 0 ? "COMPLETED" : "PENDING",
                })
                .eq("id", selectedSjc._rowIndex);
            if (updateError) throw updateError;

            // Also update "Total Made" in semi_production table so that
            // the "Produced" column on Semi Finished Production page and
            // the "Total Made" column on Semi Job Card Management page show correct data.
            if (selectedSjc.sfSrNo) {
                const { data: spRows, error: spFetchErr } = await supabase
                    .from(SEMI_PRODUCTION_TABLE)
                    .select("id, \"Total Made\"")
                    .eq("SF-Sr No.", selectedSjc.sfSrNo)
                    .limit(1);
                if (!spFetchErr && spRows && spRows.length > 0) {
                    const spRow = spRows[0];
                    const newTotalMade = Number(spRow["Total Made"] || 0) + madeQty;
                    await supabase
                        .from(SEMI_PRODUCTION_TABLE)
                        .update({ "Total Made": newTotalMade })
                        .eq("id", spRow.id);
                }
            }

            setSuccessMessage(`Production entry ${nextSerialNo} logged successfully!`);
            setIsModalOpen(false);
            setSelectedSjc(null);
            resetForm();
            await loadAllData();
        } catch (err: any) {
            setFormError(err.message || 'An error occurred. Please try again.');
        } finally {
            setIsSubmitting(false);
            setIsUploading(false);
        }
    };

    const filteredPending = useMemo(() => {
        const q = searchQuery.toLowerCase().trim();
        let pending = jobCardData.filter(isSJCPending);
        if (firmFilter.length > 0) {
            pending = pending.filter(item => firmFilter.includes(String(item.firmName || "")));
        }
        if (!q) return pending;
        return pending.filter(item =>
            (item.sjcSrNo || "").toLowerCase().includes(q) ||
            (item.sfSrNo || "").toLowerCase().includes(q) ||
            (item.firmName || "").toLowerCase().includes(q) ||
            (item.productName || "").toLowerCase().includes(q) ||
            (item.supervisorName || "").toLowerCase().includes(q)
        );
    }, [jobCardData, searchQuery, firmFilter]);

    const uniqueHistoryProducts = useMemo(() => {
        const set = new Set<string>();
        semiActualData.forEach(item => {
            if (item.productName) set.add(item.productName.trim());
        });
        return Array.from(set).filter(Boolean).sort();
    }, [semiActualData]);

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

    const filteredHistory = useMemo(() => {
        const q = searchQuery.toLowerCase().trim();
        let history = semiActualData;
        if (firmFilter.length > 0) {
            history = history.filter(item => firmFilter.includes(String(item.firmName || "")));
        }
        if (selectedHistoryProduct !== 'ALL') {
            history = history.filter(item => (item.productName || "").trim() === selectedHistoryProduct);
        }
        if (historyFromDate || historyToDate) {
            history = history.filter(item => isDateInRange(item.dateOfProduction || item.timestamp, historyFromDate, historyToDate));
        }
        if (!q) return history;
        return history.filter(item =>
            (item.sNo || "").toLowerCase().includes(q) ||
            (item.semiFinishedJobCardNo || "").toLowerCase().includes(q) ||
            (item.sfProductionNo || "").toLowerCase().includes(q) ||
            (item.firmName || "").toLowerCase().includes(q) ||
            (item.productName || "").toLowerCase().includes(q) ||
            (item.supervisorName || "").toLowerCase().includes(q) ||
            (item.status || "").toLowerCase().includes(q)
        );
    }, [semiActualData, searchQuery, firmFilter, selectedHistoryProduct, historyFromDate, historyToDate]);

    const totalHistoryQty = useMemo(() => {
        return filteredHistory.reduce((sum, item) => sum + (Number(item.qtyOfSemiFinishedGood) || 0), 0);
    }, [filteredHistory]);

    const totalMachineHours = useMemo(() => {
        return filteredHistory.reduce((sum, item) => sum + (Number(item.machineRunningHour || item.machineRunning) || 0), 0);
    }, [filteredHistory]);

    const materialSummaryData = useMemo(() => {
        if (!summaryStartDate && !summaryEndDate && summaryMaterial === 'ALL' && summaryProduct === 'ALL') {
            return { totalQty: 0, matchingRuns: [] };
        }

        let totalQty = 0;
        const matchingRuns: any[] = [];

        let data = semiActualData;
        if (firmFilter.length > 0) {
            data = data.filter((item) => firmFilter.includes(String(item.firmName || "")));
        }

        data.forEach((run) => {
            if (run.status === "cancelled") return;

            if (!isDateInRange(run.dateOfProduction || run.timestamp, summaryStartDate, summaryEndDate)) {
                return;
            }

            if (summaryProduct !== "ALL") {
                if (String(run.productName || "").trim() !== summaryProduct) {
                    return;
                }
            }

            let materialQtyFound = 0;
            let hasMaterial = false;

            const rmList = [
                { name: run.rawMaterial1Name, qty: run.rawMaterial1Qty },
                { name: run.rawMaterial2Name, qty: run.rawMaterial2Qty },
                { name: run.rawMaterial3Name, qty: run.rawMaterial3Qty },
                { name: run.rawMaterial4Name, qty: run.rawMaterial4Qty },
                { name: run.rawMaterial5Name, qty: run.rawMaterial5Qty },
            ];

            if (summaryMaterial !== "ALL") {
                const matchedMat = rmList.find(rm => String(rm.name || "").trim() === summaryMaterial);
                if (matchedMat) {
                    materialQtyFound = Number(matchedMat.qty) || 0;
                    hasMaterial = true;
                }
            } else {
                rmList.forEach(rm => {
                    materialQtyFound += Number(rm.qty) || 0;
                });
                hasMaterial = rmList.some(rm => String(rm.name || "").trim() !== "" && (Number(rm.qty) || 0) > 0);
            }

            if (hasMaterial || (summaryMaterial === "ALL" && summaryProduct !== "ALL")) {
                totalQty += materialQtyFound;
                matchingRuns.push({
                    ...run,
                    specificMaterialQty: materialQtyFound
                });
            }
        });

        return { totalQty, matchingRuns };
    }, [semiActualData, summaryStartDate, summaryEndDate, summaryProduct, summaryMaterial, firmFilter]);

    const summarySFGQty = useMemo(() => {
        return materialSummaryData.matchingRuns.reduce((sum, run) => sum + (Number(run.qtyOfSemiFinishedGood) || 0), 0);
    }, [materialSummaryData]);

    const sfgBreakdown = useMemo(() => {
        const map = new Map<string, number>();
        materialSummaryData.matchingRuns.forEach((run) => {
            const key = String(run.productName || "").trim() || "Unknown";
            map.set(key, (map.get(key) || 0) + (Number(run.qtyOfSemiFinishedGood) || 0));
        });
        return Array.from(map.entries()).map(([name, qty]) => ({ name, qty })).sort((a, b) => b.qty - a.qty);
    }, [materialSummaryData]);

    const rmBreakdown = useMemo(() => {
        const map = new Map<string, number>();
        materialSummaryData.matchingRuns.forEach((run) => {
            const rmList = [
                { name: run.rawMaterial1Name, qty: run.rawMaterial1Qty },
                { name: run.rawMaterial2Name, qty: run.rawMaterial2Qty },
                { name: run.rawMaterial3Name, qty: run.rawMaterial3Qty },
                { name: run.rawMaterial4Name, qty: run.rawMaterial4Qty },
                { name: run.rawMaterial5Name, qty: run.rawMaterial5Qty },
            ];
            rmList.forEach((rm) => {
                const matName = String(rm.name || "").trim();
                if (!matName) return;
                if (summaryMaterial !== "ALL" && matName !== summaryMaterial) return;
                
                map.set(matName, (map.get(matName) || 0) + (Number(rm.qty) || 0));
            });
        });
        return Array.from(map.entries()).map(([name, qty]) => ({ name, qty })).sort((a, b) => b.qty - a.qty);
    }, [materialSummaryData, summaryMaterial]);

    const pendingJobCards = filteredPending;
    const historyEntries = filteredHistory;

    // ==================== RENDER ====================
    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
                <p className="ml-3 text-sm text-slate-500">Loading production data...</p>
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
                    <RefreshCw className="h-4 w-4 mr-2" /> Retry
                </Button>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6 bg-slate-50 min-h-screen max-w-full overflow-x-hidden">
            {/* Success Toast */}
            {successMessage && (
                <div className="fixed top-5 right-5 z-[200] flex items-center gap-3 px-5 py-3.5 bg-olive-600 text-white rounded-2xl shadow-xl text-sm font-bold animate-in slide-in-from-top-2 duration-300">
                    <span className="text-lg">✓</span>
                    {successMessage}
                </div>
            )}

            {/* ── Header ── */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Pencil className="h-6 w-6 text-olive-600" />
                        Actual Production Entry
                    </h2>
                    <p className="text-sm text-slate-500 mt-0.5">Log daily production entries for semi-finished goods</p>
                </div>
                <Button onClick={loadAllData} variant="outline" size="sm" className="h-9 border-olive-200 text-olive-700 hover:bg-olive-50">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                </Button>
            </div>

            {/* ── Tabs & Search Bar ── */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="bg-slate-100 rounded-xl p-1 flex gap-1 w-fit">
                    <button
                        onClick={() => setActiveTab('pending')}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${activeTab === 'pending'
                            ? 'bg-white text-olive-700 shadow-sm'
                            : 'text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        <Pencil size={14} />
                        Pending Tests
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${activeTab === 'pending' ? 'bg-olive-100 text-olive-700' : 'bg-slate-200 text-slate-600'}`}>
                            {pendingJobCards.length}
                        </span>
                    </button>
                    <button
                        onClick={() => setActiveTab('history')}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${activeTab === 'history'
                            ? 'bg-white text-olive-700 shadow-sm'
                            : 'text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        <Clock size={14} />
                        Test History
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${activeTab === 'history' ? 'bg-olive-100 text-olive-700' : 'bg-slate-200 text-slate-600'}`}>
                            {historyEntries.length}
                        </span>
                    </button>
                    <button
                        onClick={() => setActiveTab('summary')}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${activeTab === 'summary'
                            ? 'bg-white text-olive-700 shadow-sm'
                            : 'text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        <Search size={14} />
                        Summary
                    </button>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
                    {/* Firm Filter for Pending tab */}
                    {activeTab === 'pending' && (
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
                    )}

                    {/* Search Input */}
                    <div className="relative w-full sm:w-[280px]">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search entries..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9 focus-visible:ring-olive-500 bg-white"
                        />
                    </div>
                </div>
            </div>

            {/* ── Dedicated Filter Toolbar & Summary Bar (History Tab) ── */}
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
                    <div className="flex flex-wrap items-center gap-2.5 sm:ml-auto">
                        <div className="flex items-center gap-1.5 bg-white border border-amber-200 shadow-2xs px-3 py-1 rounded-lg text-slate-700 font-medium text-xs h-8">
                            <span className="text-slate-500 font-semibold">Total Machine Hours:</span>
                            <strong className="text-amber-700 font-bold text-xs">
                                {totalMachineHours.toLocaleString('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} Hrs
                            </strong>
                        </div>
                        <div className="flex items-center gap-1.5 bg-white border border-blue-200 shadow-2xs px-3 py-1 rounded-lg text-slate-700 font-medium text-xs h-8">
                            <span className="text-slate-500 font-semibold">Total Qty:</span>
                            <strong className="text-blue-700 font-bold text-xs">
                                {totalHistoryQty.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 3 })} MT
                            </strong>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Pending Tab ── */}
            {activeTab === 'pending' && (
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                    <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
                        <Pencil size={16} className="text-olive-600" />
                        <h3 className="font-semibold text-slate-700">Pending Items ({pendingJobCards.length})</h3>
                    </div>

                    {pendingJobCards.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                            <FileCheck className="h-14 w-14 text-violet-200 mb-4" />
                            <p className="font-semibold text-slate-500">No Pending Items</p>
                            <p className="text-xs text-slate-400 mt-1">All job cards have been processed</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-slate-100">
                                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wide">Action</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wide">Firm Name</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wide">SJC No.</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wide">SF No.</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wide">Product Name</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wide">Qty</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wide">Planned Date</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wide">Date of Prod.</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wide">Supervisor</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {pendingJobCards.map((job, index) => (
                                        <tr key={`pending-${job.sjcSrNo}-${index}`} className="hover:bg-slate-50/70 transition-colors">
                                            <td className="px-6 py-3.5">
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => handleEntryClick(job)}
                                                        className="flex items-center gap-2 px-4 py-2 bg-olive-600 hover:bg-olive-700 text-white text-xs font-semibold rounded-lg transition-colors"
                                                    >
                                                        <Pencil size={12} />
                                                        Perform Test
                                                    </button>
                                                </div>
                                            </td>
                                            <td className="px-6 py-3.5">
                                                <span className="text-sm font-semibold text-slate-800">{job.firmName}</span>
                                            </td>
                                            <td className="px-6 py-3.5">
                                                <span className="text-sm font-semibold text-olive-600">{job.sjcSrNo}</span>
                                            </td>
                                            <td className="px-6 py-3.5 text-sm text-slate-600">{job.sfSrNo}</td>
                                            <td className="px-6 py-3.5">
                                                <span className="text-sm font-medium text-slate-800">{job.productName}</span>
                                            </td>
                                            <td className="px-6 py-3.5">
                                                <span className="text-sm font-semibold text-slate-700">{job.qty}</span>
                                            </td>
                                            <td className="px-6 py-3.5">
                                                {job.planned ? (
                                                    <span className="text-sm text-slate-600">{formatDisplayDate(job.planned)}</span>
                                                ) : (
                                                    <span className="text-slate-400 text-xs">-</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-3.5 text-sm text-slate-500">{job.dateOfProduction || '-'}</td>
                                            <td className="px-6 py-3.5 text-sm text-slate-600">{job.supervisorName}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* ── History Tab ── */}
            {activeTab === 'history' && (
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                    <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
                        <Clock size={16} className="text-olive-600" />
                        <h3 className="font-semibold text-slate-700">Production History ({historyEntries.length})</h3>
                    </div>

                    {historyEntries.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                            <History className="h-14 w-14 text-violet-200 mb-4" />
                            <p className="font-semibold text-slate-500">No History Found</p>
                            <p className="text-xs text-slate-400 mt-1">Start logging entries from pending jobs</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-slate-100">
                                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wide">Action</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wide">S No.</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wide">Timestamp</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wide">Firm Name</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wide">SJC No.</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wide">SF No.</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wide">Product</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wide">Qty</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wide">Processing Cost</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wide">Date of Prod.</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wide">Supervisor</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wide">Machine Hrs</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wide">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {historyEntries.map((entry, index) => (
                                        <tr key={`history-${entry.sNo}-${index}`} className="hover:bg-slate-50/70 transition-colors">
                                            <td className="px-6 py-3.5">
                                                <button
                                                    onClick={() => handleViewClick(entry)}
                                                    className="flex items-center gap-2 px-4 py-2 border border-violet-300 text-olive-700 hover:bg-olive-50 text-xs font-semibold rounded-lg transition-colors"
                                                >
                                                    <Eye size={12} />
                                                    View
                                                </button>
                                            </td>
                                            <td className="px-6 py-3.5">
                                                <span className="text-sm font-semibold text-olive-600">{entry.sNo}</span>
                                            </td>
                                            <td className="px-6 py-3.5 text-xs text-slate-400 whitespace-nowrap">{entry.timestamp}</td>
                                            <td className="px-6 py-3.5 text-sm font-medium text-slate-800">{entry.firmName}</td>
                                            <td className="px-6 py-3.5 text-sm font-medium text-slate-700">{entry.semiFinishedJobCardNo}</td>
                                            <td className="px-6 py-3.5 text-xs text-slate-500">{entry.sfProductionNo}</td>
                                            <td className="px-6 py-3.5">
                                                <span className="text-sm text-slate-700 font-medium max-w-[130px] truncate block" title={entry.productName}>{entry.productName}</span>
                                            </td>
                                            <td className="px-6 py-3.5">
                                                <span className="text-sm font-semibold text-slate-800">{entry.qtyOfSemiFinishedGood}</span>
                                            </td>
                                            <td className="px-6 py-3.5">
                                                <span className="text-sm font-semibold text-emerald-600">₹{entry.processingCost || 0}</span>
                                            </td>
                                            <td className="px-6 py-3.5 text-sm text-slate-500 whitespace-nowrap">{entry.dateOfProduction || '-'}</td>
                                            <td className="px-6 py-3.5 text-sm text-slate-600 whitespace-nowrap">{entry.supervisorName}</td>
                                            <td className="px-6 py-3.5 text-sm font-semibold text-amber-600">{entry.machineRunningHour}h</td>
                                            <td className="px-6 py-3.5">
                                                {entry.status ? (
                                                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${entry.status.toLowerCase().includes('complete')
                                                        ? 'bg-emerald-50 text-emerald-700'
                                                        : 'bg-amber-50 text-amber-700'
                                                        }`}>
                                                        {entry.status}
                                                    </span>
                                                ) : <span className="text-slate-400 text-xs">-</span>}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* ── Summary Tab ── */}
            {activeTab === 'summary' && (
                <Card className="shadow-sm border-border bg-white rounded-xl">
                    <CardHeader className="py-3 px-4 bg-olive-50/70 rounded-t-lg border-b border-slate-100 flex flex-row items-center justify-between gap-4">
                        <div>
                            <CardTitle className="text-base font-semibold text-slate-800">Raw Material & Semi Finished Goods Summary</CardTitle>
                            <CardDescription className="text-xs text-slate-500 mt-0.5">Calculate total consumption of raw materials or production of semi finished goods within a date range.</CardDescription>
                        </div>
                    </CardHeader>
                    <CardContent className="p-6 space-y-6">
                        {/* Filters inside tab */}
                        <div className={`bg-slate-50/50 p-4 rounded-xl border border-slate-200 shadow-inner grid grid-cols-1 md:grid-cols-4 gap-4 items-end`}>
                            <div className="space-y-1.5">
                                <Label htmlFor="sumFromDate" className="text-xs font-bold text-slate-600 uppercase tracking-wider">Start Date</Label>
                                <Input
                                    id="sumFromDate"
                                    type="date"
                                    value={summaryStartDate}
                                    onChange={(e) => setSummaryStartDate(e.target.value)}
                                    className="h-10 rounded-xl border-slate-200 bg-white focus:ring-olive-500/20"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="sumToDate" className="text-xs font-bold text-slate-600 uppercase tracking-wider">End Date</Label>
                                <Input
                                    id="sumToDate"
                                    type="date"
                                    value={summaryEndDate}
                                    onChange={(e) => setSummaryEndDate(e.target.value)}
                                    className="h-10 rounded-xl border-slate-200 bg-white focus:ring-olive-500/20"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Semi Finished Good</Label>
                                <Select value={summaryProduct} onValueChange={setSummaryProduct}>
                                    <SelectTrigger className="h-10 rounded-xl border-slate-200 bg-white">
                                        <SelectValue placeholder="All Products" />
                                    </SelectTrigger>
                                    <SelectContent className="max-h-60">
                                        <SelectItem value="ALL">All Products</SelectItem>
                                        {uniqueHistoryProducts.map((p) => (
                                            <SelectItem key={p} value={p}>
                                                {p}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Raw Material Name</Label>
                                <Select value={summaryMaterial} onValueChange={setSummaryMaterial}>
                                    <SelectTrigger className="h-10 rounded-xl border-slate-200 bg-white">
                                        <SelectValue placeholder="Select Raw Material" />
                                    </SelectTrigger>
                                    <SelectContent className="max-h-60">
                                        <SelectItem value="ALL">All Materials</SelectItem>
                                        {rawMaterials.map((m) => (
                                            <SelectItem key={m.name} value={m.name}>
                                                {m.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Reset button — top aligned above cards */}
                        <div className="flex justify-end mb-3">
                            <Button
                                variant="outline"
                                type="button"
                                onClick={() => {
                                    setSummaryStartDate("")
                                    setSummaryEndDate("")
                                    setSummaryProduct("ALL")
                                    setSummaryMaterial("ALL")
                                }}
                                className="h-9 px-5 rounded-xl border-slate-200 hover:bg-slate-50 font-semibold text-sm bg-white shadow-sm"
                                disabled={!summaryStartDate && !summaryEndDate && summaryProduct === "ALL" && summaryMaterial === "ALL"}
                            >
                                Reset Summary Filters
                            </Button>
                        </div>

                        {/* Two full-width side-by-side cards */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            {/* Raw Material Card */}
                            <div className="bg-gradient-to-br from-olive-50 to-olive-100/60 p-6 rounded-2xl border border-olive-200/60 shadow-sm flex flex-col items-center text-center">
                                <p className="text-xs font-bold text-olive-800 uppercase tracking-widest mb-2">Raw Material Consumption</p>
                                <p className="text-4xl font-black text-olive-900 mb-1">
                                    {materialSummaryData.totalQty.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                                </p>
                                {summaryMaterial && summaryMaterial !== "ALL" ? (
                                    <p className="text-xs text-olive-700 font-medium">
                                        of <span className="font-bold">{summaryMaterial}</span>
                                    </p>
                                ) : (
                                    <p className="text-xs text-olive-700 font-medium">of All Raw Materials</p>
                                )}
                                {rmBreakdown.length > 0 && (
                                    <div className="mt-4 w-full max-h-48 overflow-y-auto rounded-xl border border-olive-200 bg-white/70 divide-y divide-olive-100 text-left">
                                        {rmBreakdown.map((item) => (
                                            <div key={item.name} className="flex justify-between items-center px-4 py-2">
                                                <span className="text-xs text-olive-800 font-medium truncate max-w-[65%]">{item.name}</span>
                                                <span className="text-xs font-bold text-olive-900 shrink-0">{item.qty.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Semi Finished Good Card */}
                            <div className="bg-gradient-to-br from-blue-50 to-blue-100/60 p-6 rounded-2xl border border-blue-200/60 shadow-sm flex flex-col items-center text-center">
                                <p className="text-xs font-bold text-blue-800 uppercase tracking-widest mb-2">Semi Finished Good Total Qty</p>
                                <p className="text-4xl font-black text-blue-900 mb-1">
                                    {summarySFGQty.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                                </p>
                                {summaryProduct && summaryProduct !== "ALL" ? (
                                    <p className="text-xs text-blue-700 font-medium">
                                        of <span className="font-bold">{summaryProduct}</span>
                                    </p>
                                ) : (
                                    <p className="text-xs text-blue-700 font-medium">of All Semi Finished Goods</p>
                                )}
                                {sfgBreakdown.length > 0 && (
                                    <div className="mt-4 w-full max-h-48 overflow-y-auto rounded-xl border border-blue-200 bg-white/70 divide-y divide-blue-100 text-left">
                                        {sfgBreakdown.map((item) => (
                                            <div key={item.name} className="flex justify-between items-center px-4 py-2">
                                                <span className="text-xs text-blue-800 font-medium truncate max-w-[65%]">{item.name}</span>
                                                <span className="text-xs font-bold text-blue-900 shrink-0">{item.qty.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* ── Log Production Entry Modal ── */}
            <Dialog open={isModalOpen} onOpenChange={(open) => {
                setIsModalOpen(open);
                if (!open) { setSelectedSjc(null); resetForm(); }
            }}>
                <DialogContent className="sm:max-w-2xl max-h-[92vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-slate-800">
                            <Pencil className="h-5 w-5 text-olive-600" />
                            Log Production Entry
                        </DialogTitle>
                        {selectedSjc && (
                            <DialogDescription>
                                <span className="text-olive-600 font-semibold text-xs">
                                    {selectedSjc.sjcSrNo} — {selectedSjc.productName}
                                </span>
                            </DialogDescription>
                        )}
                    </DialogHeader>

                    {selectedSjc && (
                        <form onSubmit={handleSubmit} className="space-y-5 py-2">

                            {/* Read-only Info Grid */}
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-olive-50/60 p-4 rounded-xl border border-olive-100">
                                {[
                                    { label: 'SJC No.', value: selectedSjc.sjcSrNo, accent: true },
                                    { label: 'SF No.', value: selectedSjc.sfSrNo },
                                    { label: 'S No.', value: nextSerialNo, accent: true },
                                    { label: 'Product', value: selectedSjc.productName },
                                    { label: 'Supervisor', value: selectedSjc.supervisorName },
                                ].map(({ label, value, accent }) => (
                                    <div key={label}>
                                        <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wide mb-0.5">{label}</div>
                                        <div className={`text-xs font-semibold ${accent ? 'text-olive-600' : 'text-slate-700'}`}>{value}</div>
                                    </div>
                                ))}
                                <div>
                                    <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wide mb-0.5">Date of Prod.</div>
                                    <Input
                                        type="date"
                                        required
                                        value={formData.dateOfProduction}
                                        onChange={e => setFormData({ ...formData, dateOfProduction: e.target.value })}
                                        className="h-8 text-xs font-semibold focus-visible:ring-olive-500 bg-white border border-slate-200 rounded-lg px-2 py-1 w-full"
                                    />
                                </div>
                            </div>

                            {/* Qty and Rate */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-semibold text-slate-700">
                                        Qty Of Semi Finished Good <span className="text-red-500">*</span>
                                    </Label>
                                    <Input
                                        type="number"
                                        min="0.001"
                                        step="0.001"
                                        required
                                        placeholder="Enter quantity produced"
                                        value={formData.qtyOfSemiFinishedGood}
                                        onChange={e => setFormData({ ...formData, qtyOfSemiFinishedGood: e.target.value })}
                                        className="font-semibold focus-visible:ring-olive-500"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-semibold text-slate-700">
                                        Processing Cost (₹) <span className="text-red-500">*</span>
                                    </Label>
                                    <Input
                                        type="number"
                                        min="0.01"
                                        step="0.01"
                                        required
                                        placeholder="Enter processing cost"
                                        value={formData.processingCost}
                                        onChange={e => setFormData({ ...formData, processingCost: e.target.value })}
                                        className="font-semibold focus-visible:ring-olive-500"
                                    />
                                </div>
                            </div>

                            {/* Raw Materials */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <Label className="text-xs font-semibold text-slate-700">Raw Materials Consumption</Label>
                                    {rawMaterialRows.length < MAX_RAW_MATERIALS && (
                                        <button
                                            type="button"
                                            onClick={addRawMaterialRow}
                                            className="flex items-center gap-1.5 px-3 py-1.5 bg-olive-600 hover:bg-olive-700 text-white text-xs font-semibold rounded-lg transition-colors"
                                        >
                                            <Plus size={12} />
                                            Add Raw Material
                                        </button>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
                                        <div className="text-[10px] text-slate-400 uppercase font-semibold px-1">Material Name</div>
                                        <div className="text-[10px] text-slate-400 uppercase font-semibold px-1">Quantity</div>
                                        <div className="w-8" />
                                    </div>
                                    {rawMaterialRows.map((row, index) => (
                                        <div key={index} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
                                            <Select
                                                value={row.name}
                                                onValueChange={v => updateRawMaterialRow(index, 'name', v)}
                                            >
                                                <SelectTrigger className="h-9 text-xs focus:ring-olive-500">
                                                    <SelectValue placeholder="Select material..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {rawMaterials.map(rm => (
                                                        <SelectItem key={rm.name} value={rm.name}>{rm.name}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <Input
                                                type="number"
                                                step="0.001"
                                                min="0"
                                                placeholder="Qty"
                                                value={row.qty}
                                                onChange={e => updateRawMaterialRow(index, 'qty', e.target.value)}
                                                className="h-9 text-xs focus-visible:ring-olive-500"
                                            />
                                            {rawMaterialRows.length > 1 ? (
                                                <button
                                                    type="button"
                                                    onClick={() => removeRawMaterialRow(index)}
                                                    className="w-8 h-8 flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                >
                                                    <X size={14} />
                                                </button>
                                            ) : <div className="w-8" />}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* End Product */}
                            <div className="space-y-3 bg-olive-50/50 p-4 rounded-xl border border-olive-100">
                                <Label className="text-xs font-semibold text-olive-700 flex items-center gap-1.5">
                                    <Target size={12} />
                                    End Product Details
                                </Label>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <div className="space-y-1.5">
                                        <Label className="text-[10px] text-slate-500 uppercase font-semibold">Is Any End Product?</Label>
                                        <Select value={formData.isAnyEndProduct} onValueChange={v => setFormData({ ...formData, isAnyEndProduct: v })}>
                                            <SelectTrigger className="focus:ring-olive-500"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="No">No</SelectItem>
                                                <SelectItem value="Yes">Yes</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    {formData.isAnyEndProduct === 'Yes' && (
                                        <>
                                            <div className="space-y-1.5">
                                                <Label className="text-[10px] text-slate-500 uppercase font-semibold">Raw Material Name</Label>
                                                <Select value={formData.endProductRawMaterialName} onValueChange={v => setFormData({ ...formData, endProductRawMaterialName: v })}>
                                                    <SelectTrigger className="focus:ring-olive-500"><SelectValue placeholder="Select..." /></SelectTrigger>
                                                    <SelectContent>
                                                        {rawMaterials.map(rm => <SelectItem key={rm.name} value={rm.name}>{rm.name}</SelectItem>)}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-1.5">
                                                <Label className="text-[10px] text-slate-500 uppercase font-semibold">End Product Qty</Label>
                                                <Input
                                                    type="number"
                                                    step="0.001"
                                                    min="0"
                                                    value={formData.endProductQty}
                                                    onChange={e => setFormData({ ...formData, endProductQty: e.target.value })}
                                                    className="focus-visible:ring-olive-500"
                                                />
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Machine Readings & Photos */}
                            <div className="space-y-3 bg-amber-50/40 p-4 rounded-xl border border-amber-100">
                                <Label className="text-xs font-semibold text-amber-700 flex items-center gap-1.5">
                                    <Settings size={12} />
                                    Machine Readings & Photos
                                </Label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-3">
                                        <div className="space-y-1.5">
                                            <Label className="text-[10px] text-slate-500 uppercase font-semibold">Starting Reading <span className="text-red-500">*</span></Label>
                                            <Input
                                                type="number"
                                                step="0.001"
                                                required
                                                placeholder="Enter starting reading"
                                                value={formData.startingReading}
                                                onChange={e => setFormData({ ...formData, startingReading: e.target.value })}
                                                className="focus-visible:ring-olive-500"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-[10px] text-slate-500 uppercase font-semibold">Ending Reading <span className="text-red-500">*</span></Label>
                                            <Input
                                                type="number"
                                                step="0.001"
                                                required
                                                placeholder="Enter ending reading"
                                                value={formData.endingReading}
                                                onChange={e => setFormData({ ...formData, endingReading: e.target.value })}
                                                className="focus-visible:ring-olive-500"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-[10px] text-slate-500 uppercase font-semibold">Machine Running Hour</Label>
                                            <Input
                                                type="number"
                                                step="0.001"
                                                min="0"
                                                placeholder="Enter running hour"
                                                value={formData.machineRunningHour}
                                                onChange={e => setFormData({ ...formData, machineRunningHour: e.target.value })}
                                                className="focus-visible:ring-olive-500"
                                            />
                                        </div>

                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        {/* Start Photo */}
                                        <div className="space-y-1.5">
                                            <Label className="text-[10px] text-slate-500 uppercase font-semibold">Start Photo</Label>
                                            <input ref={startPhotoRef} type="file" accept="image/*" onChange={e => {
                                                const f = e.target.files?.[0];
                                                if (f) {
                                                    setStartPhotoFile(f);
                                                    const reader = new FileReader();
                                                    reader.onloadend = () => setStartPhotoPreview(reader.result as string);
                                                    reader.readAsDataURL(f);
                                                }
                                            }} className="hidden" />
                                            {startPhotoPreview ? (
                                                <div className="relative">
                                                    <img src={startPhotoPreview} alt="Start" className="w-full h-24 object-cover rounded-xl border border-slate-200" />
                                                    <button type="button" onClick={() => { setStartPhotoFile(null); setStartPhotoPreview(''); }}
                                                        className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600">
                                                        <X size={10} />
                                                    </button>
                                                </div>
                                            ) : (
                                                <div onClick={() => startPhotoRef.current?.click()}
                                                    className="w-full h-24 border-2 border-dashed border-amber-200 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:bg-amber-50 transition-colors">
                                                    <Camera size={18} className="text-amber-400 mb-1" />
                                                    <span className="text-[9px] font-bold text-amber-500 uppercase">Upload</span>
                                                </div>
                                            )}
                                        </div>
                                        {/* End Photo */}
                                        <div className="space-y-1.5">
                                            <Label className="text-[10px] text-slate-500 uppercase font-semibold">End Photo</Label>
                                            <input ref={endPhotoRef} type="file" accept="image/*" onChange={e => {
                                                const f = e.target.files?.[0];
                                                if (f) {
                                                    setEndPhotoFile(f);
                                                    const reader = new FileReader();
                                                    reader.onloadend = () => setEndPhotoPreview(reader.result as string);
                                                    reader.readAsDataURL(f);
                                                }
                                            }} className="hidden" />
                                            {endPhotoPreview ? (
                                                <div className="relative">
                                                    <img src={endPhotoPreview} alt="End" className="w-full h-24 object-cover rounded-xl border border-slate-200" />
                                                    <button type="button" onClick={() => { setEndPhotoFile(null); setEndPhotoPreview(''); }}
                                                        className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600">
                                                        <X size={10} />
                                                    </button>
                                                </div>
                                            ) : (
                                                <div onClick={() => endPhotoRef.current?.click()}
                                                    className="w-full h-24 border-2 border-dashed border-amber-200 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:bg-amber-50 transition-colors">
                                                    <Upload size={18} className="text-amber-400 mb-1" />
                                                    <span className="text-[9px] font-bold text-amber-500 uppercase">Upload</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {formError && (
                                <div className="p-3 bg-red-50 text-red-600 rounded-xl text-xs font-medium flex items-center gap-2 border border-red-100">
                                    <AlertTriangle size={13} />
                                    {formError}
                                </div>
                            )}

                            <div className="flex justify-end gap-2 pt-1">
                                <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)} disabled={isSubmitting}
                                    className="border-slate-200">
                                    Cancel
                                </Button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting || isUploading}
                                    className="flex items-center gap-2 px-5 py-2.5 bg-olive-600 hover:bg-olive-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors"
                                >
                                    {(isSubmitting || isUploading) ? (
                                        <><Loader2 size={14} className="animate-spin" />{isUploading ? 'Uploading...' : 'Saving...'}</>
                                    ) : (
                                        <><Save size={14} />Log Daily Entry</>
                                    )}
                                </button>
                            </div>
                        </form>
                    )}
                </DialogContent>
            </Dialog>

            {/* ── View Detail Modal ── */}
            <Dialog open={isViewModalOpen} onOpenChange={(open) => {
                setIsViewModalOpen(open);
                if (!open) {
                    setSelectedActual(null);
                    setIsEditingProcessingCost(false);
                }
            }}>
                <DialogContent className="sm:max-w-2xl max-h-[92vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-slate-800">
                            <Eye className="h-5 w-5 text-olive-600" />
                            Production Entry Details
                        </DialogTitle>
                        {selectedActual && (
                            <DialogDescription>
                                <span className="text-olive-600 font-semibold text-xs">{selectedActual.sNo} — {selectedActual.productName}</span>
                            </DialogDescription>
                        )}
                    </DialogHeader>

                    {selectedActual && (
                        <div className="space-y-4 py-2">
                            {/* Basic Info */}
                            <div className="bg-slate-50 p-4 rounded-xl">
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Basic Information</div>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                    {[
                                        { label: 'S No.', value: selectedActual.sNo, accent: true },
                                        { label: 'Timestamp', value: selectedActual.timestamp },
                                        { label: 'SJC No.', value: selectedActual.semiFinishedJobCardNo },
                                        { label: 'SF Prod. No.', value: selectedActual.sfProductionNo },
                                        { label: 'Product', value: selectedActual.productName },
                                        { label: 'Supervisor', value: selectedActual.supervisorName },
                                        { label: 'Date of Prod.', value: selectedActual.dateOfProduction || '-' },
                                        { label: 'Qty Made', value: String(selectedActual.qtyOfSemiFinishedGood), accent: true },
                                        { label: 'Processing Cost', value: `₹${selectedActual.processingCost || 0}`, accent: true },
                                    ].map(({ label, value, accent }) => (
                                        <div key={label}>
                                            <div className="text-[10px] text-slate-400 uppercase font-semibold mb-0.5">{label}</div>
                                            {label === 'Processing Cost' && isAdmin && isEditingProcessingCost ? (
                                                <div className="flex items-center gap-1.5 mt-0.5">
                                                    <Input
                                                        type="number"
                                                        min="0"
                                                        step="0.01"
                                                        autoFocus
                                                        value={editProcessingCostValue}
                                                        onChange={e => setEditProcessingCostValue(e.target.value)}
                                                        className="h-7 w-20 text-[10px] focus-visible:ring-olive-500 bg-white"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={handleSaveProcessingCost}
                                                        disabled={savingProcessingCost}
                                                        className="w-6 h-6 flex items-center justify-center text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors disabled:opacity-50"
                                                    >
                                                        {savingProcessingCost ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setIsEditingProcessingCost(false)}
                                                        disabled={savingProcessingCost}
                                                        className="w-6 h-6 flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors disabled:opacity-50"
                                                    >
                                                        <X size={12} />
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className={`flex items-center gap-2 text-xs ${accent ? 'text-olive-600 font-bold' : 'text-slate-700 font-medium'}`}>
                                                    <span>{value || '-'}</span>
                                                    {label === 'Processing Cost' && isAdmin && (
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setIsEditingProcessingCost(true);
                                                                setEditProcessingCostValue(String(selectedActual?.processingCost || 0));
                                                            }}
                                                            className="w-5 h-5 flex items-center justify-center text-olive-600 hover:bg-olive-50 rounded-md transition-colors"
                                                            title="Edit processing cost"
                                                        >
                                                            <Pencil size={10} />
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Raw Materials */}
                            <div className="bg-slate-50 p-4 rounded-xl">
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Raw Materials Used</div>
                                {[
                                    { name: selectedActual.rawMaterial1Name, qty: selectedActual.rawMaterial1Qty },
                                    { name: selectedActual.rawMaterial2Name, qty: selectedActual.rawMaterial2Qty },
                                    { name: selectedActual.rawMaterial3Name, qty: selectedActual.rawMaterial3Qty },
                                    { name: selectedActual.rawMaterial4Name, qty: selectedActual.rawMaterial4Qty },
                                    { name: selectedActual.rawMaterial5Name, qty: selectedActual.rawMaterial5Qty },
                                ].filter(rm => rm.name && rm.qty > 0).length > 0 ? (
                                    <div className="space-y-2">
                                        {[
                                            { name: selectedActual.rawMaterial1Name, qty: selectedActual.rawMaterial1Qty },
                                            { name: selectedActual.rawMaterial2Name, qty: selectedActual.rawMaterial2Qty },
                                            { name: selectedActual.rawMaterial3Name, qty: selectedActual.rawMaterial3Qty },
                                            { name: selectedActual.rawMaterial4Name, qty: selectedActual.rawMaterial4Qty },
                                            { name: selectedActual.rawMaterial5Name, qty: selectedActual.rawMaterial5Qty },
                                        ].filter(rm => rm.name && rm.qty > 0).map((rm, i) => (
                                            <div key={i} className="flex items-center justify-between bg-white px-3 py-2 rounded-lg border border-slate-100">
                                                <span className="text-xs font-medium text-slate-700">{rm.name}</span>
                                                <span className="text-xs font-bold text-olive-600">{rm.qty}</span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-xs text-slate-400">No raw materials recorded</p>
                                )}
                            </div>

                            {/* End Product */}
                            {selectedActual.isAnyEndProduct === 'Yes' && (
                                <div className="bg-olive-50 p-4 rounded-xl border border-olive-100">
                                    <div className="text-[10px] font-bold text-olive-500 uppercase tracking-wider mb-3">End Product</div>
                                    <div className="flex items-center justify-between bg-white px-3 py-2 rounded-lg border border-olive-100">
                                        <span className="text-xs font-medium text-olive-700">{selectedActual.endProductRawMaterialName}</span>
                                        <span className="text-xs font-bold text-olive-600">{selectedActual.endProductQty}</span>
                                    </div>
                                </div>
                            )}

                            {/* Machine Readings */}
                            <div className="bg-amber-50/50 p-4 rounded-xl border border-amber-100">
                                <div className="text-[10px] font-bold text-amber-600 uppercase tracking-wider mb-3">Machine Readings</div>
                                <div className="grid grid-cols-3 gap-3 mb-4">
                                    {[
                                        { label: 'Starting Reading', value: String(selectedActual.startingReading) },
                                        { label: 'Ending Reading', value: String(selectedActual.endingReading) },
                                        { label: 'Running Hours', value: `${selectedActual.machineRunningHour}h`, accent: true },
                                    ].map(({ label, value, accent }) => (
                                        <div key={label}>
                                            <div className="text-[10px] text-slate-400 uppercase font-semibold mb-0.5">{label}</div>
                                            <div className={`text-xs font-semibold ${accent ? 'text-amber-600' : 'text-slate-700'}`}>{value}</div>
                                        </div>
                                    ))}
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <div className="text-[10px] text-slate-400 uppercase font-semibold mb-1">Start Photo</div>
                                        {selectedActual.startingReadingPhoto ? (
                                            <button onClick={() => window.open(selectedActual.startingReadingPhoto, '_blank')}
                                                className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-blue-200 text-blue-600 rounded-lg text-xs font-medium hover:bg-blue-50 transition-colors">
                                                <Camera size={11} /> View Photo
                                            </button>
                                        ) : <span className="text-xs text-slate-400">Not uploaded</span>}
                                    </div>
                                    <div>
                                        <div className="text-[10px] text-slate-400 uppercase font-semibold mb-1">End Photo</div>
                                        {selectedActual.endingReadingPhoto ? (
                                            <button onClick={() => window.open(selectedActual.endingReadingPhoto, '_blank')}
                                                className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-emerald-200 text-emerald-600 rounded-lg text-xs font-medium hover:bg-emerald-50 transition-colors">
                                                <Eye size={11} /> View Photo
                                            </button>
                                        ) : <span className="text-xs text-slate-400">Not uploaded</span>}
                                    </div>
                                </div>
                            </div>



                            <div className="flex justify-end pt-1">
                                <button onClick={() => setIsViewModalOpen(false)}
                                    className="px-5 py-2.5 border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-semibold rounded-lg transition-colors">
                                    Close
                                </button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
