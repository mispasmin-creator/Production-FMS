"use client";

import React, { useState, useEffect } from "react";
import { Loader2, Radio, Filter, RefreshCw, Search, Info, Receipt, HelpCircle, Plus, PlusCircle, Trash2, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

import { supabase as prodSupabase, purchaseSupabase as supabase } from "@/lib/supabase";

function normFirm(name: any): string {
  const str = String(name || "").toLowerCase().trim();
  if (str.includes("purab")) return "purab";
  if (str.includes("pmmpl")) return "pmmpl";
  if (str.includes("rkl")) return "rkl";
  return str;
}

function normProd(name: any): string {
  return String(name || "").toLowerCase().trim();
}

interface FormattedProductRecord {
  firmName: string;
  productName: string;
  alumina: number;
  iron: number;
  price: number;
  baseRate: number;
  transportRate: number;
  procCost: number;
  procCostSource?: "crushing" | "semi";
  bd: number;
  ap: number;
  albd: number;
  ratePerAlumina: number;
  timestamp?: string;
  isCustom?: boolean;
}

export default function KycProductTable() {
  const [data, setData] = useState<FormattedProductRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedFirm, setSelectedFirm] = useState<string>("ALL");
  const [selectedProduct, setSelectedProduct] = useState<string>("ALL");
  const [selectedRecordForBreakdown, setSelectedRecordForBreakdown] = useState<FormattedProductRecord | null>(null);
  const [isBreakdownOpen, setIsBreakdownOpen] = useState<boolean>(false);
  const [isLive, setIsLive] = useState<boolean>(false);

  const [isAddProductOpen, setIsAddProductOpen] = useState<boolean>(false);
  const [newProductData, setNewProductData] = useState({
    firmName: "Pmmpl",
    productName: "",
    alumina: "",
    iron: "",
    bd: "",
    ap: "",
    baseRate: "",
    transportRate: "",
  });

  // Real-Time Data Fetching Function (Deduplicated to keep ONLY LATEST entry per Firm & Product)
  const fetchData = async () => {
    setLoading(true);
    try {
      const [
        { data: rawData, error },
        { data: semiActualData },
        { data: crushingActualData },
        { data: sjcData },
        { data: sfProdData }
      ] = await Promise.all([
        supabase
          .from("LIFT-ACCOUNTS")
          .select("*")
          .order("Timestamp", { ascending: false }),
        prodSupabase
          .from("semi_actual")
          .select("*")
          .order("id", { ascending: false }),
        prodSupabase
          .from("crushing_actual")
          .select("*")
          .order("id", { ascending: false }),
        prodSupabase.from("semi_job_card").select("*"),
        prodSupabase.from("semi_production").select("*"),
      ]);

      if (error) throw error;

      const sfFirmMap = new Map<string, string>();
      (sfProdData || []).forEach((row: any) => {
        const sfNo = String(row["SF-Sr No."] || "").trim();
        const pName = normProd(row["Name Of Semi Finished Good"]);
        const firm = String(row["Firm name"] || row["Firm Name"] || "").trim();
        if (sfNo && firm) {
          sfFirmMap.set(sfNo, firm);
          if (pName) sfFirmMap.set(`${sfNo}::${pName}`, firm);
        }
      });

      const sjcFirmMap = new Map<string, string>();
      (sjcData || []).forEach((row: any) => {
        const sjcNo = String(row["SJC-Sr No."] || "").trim();
        const sfNo = String(row["Semi Finished Production No."] || "").trim();
        const pName = normProd(row["Product Name"]);
        const firm = String(row["Firm Name"] || row["Firm name"] || "").trim() || sfFirmMap.get(`${sfNo}::${pName}`) || sfFirmMap.get(sfNo) || "";
        if (sjcNo && firm) {
          sjcFirmMap.set(sjcNo, firm);
          if (pName) sjcFirmMap.set(`${sjcNo}::${pName}`, firm);
        }
      });

      const procCostMap = new Map<string, number>();
      const procCostSourceMap = new Map<string, "crushing" | "semi">();

      (semiActualData || []).forEach((row: any) => {
        const sjcNo = String(row["Semi Finished Job Card No."] || "").trim();
        const sfNo = String(row["Semi Finished Production No."] || "").trim();
        const prodName = normProd(row["Product Name"]);

        const fName = normFirm(
          row["Firm name"] || 
          row["Firm Name"] || 
          sjcFirmMap.get(`${sjcNo}::${prodName}`) || 
          sjcFirmMap.get(sjcNo) || 
          sfFirmMap.get(`${sfNo}::${prodName}`) || 
          sfFirmMap.get(sfNo)
        );

        const mainCost = Number(row["Processing Cost"] || 0);

        if (prodName && mainCost > 0) {
          if (fName) {
            const key = `${fName}___${prodName}`;
            if (!procCostMap.has(key)) {
              procCostMap.set(key, mainCost);
              procCostSourceMap.set(key, "semi");
            }
          }
          if (!procCostMap.has(prodName)) {
            procCostMap.set(prodName, mainCost);
            procCostSourceMap.set(prodName, "semi");
          }
        }

        for (let i = 1; i <= 5; i++) {
          const rmName = normProd(row[`Raw Material Name ${i}`]);
          const cost = Number(row[`Processing Cost ${i}`] || 0);
          if (rmName && cost > 0) {
            if (fName) {
              const key = `${fName}___${rmName}`;
              if (!procCostMap.has(key)) {
                procCostMap.set(key, cost);
                procCostSourceMap.set(key, "semi");
              }
            }
            if (!procCostMap.has(rmName)) {
              procCostMap.set(rmName, cost);
              procCostSourceMap.set(rmName, "semi");
            }
          }
        }
      });

      (crushingActualData || []).forEach((row: any) => {
        const fName = normFirm(row["Firm Name"] || row["Firm name"]);
        const mainCost = Number(row["Processing Cost"] || 0);

        const crushProdName = normProd(row["Crushing Product Name"]);
        if (crushProdName && mainCost > 0) {
          if (fName) {
            const key = `${fName}___${crushProdName}`;
            if (!procCostMap.has(key)) {
              procCostMap.set(key, mainCost);
              procCostSourceMap.set(key, "crushing");
            }
          }
          if (!procCostMap.has(crushProdName)) {
            procCostMap.set(crushProdName, mainCost);
            procCostSourceMap.set(crushProdName, "crushing");
          }
        }

        for (let i = 1; i <= 4; i++) {
          const fgName = normProd(row[`Finished Goods Name ${i}`]);
          const cost = Number(row[`Processing Cost ${i}`] || 0);
          if (fgName && cost > 0) {
            if (fName) {
              const key = `${fName}___${fgName}`;
              if (!procCostMap.has(key)) {
                procCostMap.set(key, cost);
                procCostSourceMap.set(key, "crushing");
              }
            }
            if (!procCostMap.has(fgName)) {
              procCostMap.set(fgName, cost);
              procCostSourceMap.set(fgName, "crushing");
            }
          }
        }
      });

      // Aggregation map to collect latest non-null values for each Firm + Product
      const recordMap = new Map<string, {
        firmName: string;
        productName: string;
        alumina: number | null;
        iron: number | null;
        price: number | null;
        baseRate?: number | null;
        transportRate?: number | null;
        procCost?: number | null;
        procCostSource?: "crushing" | "semi";
        bd: number | null;
        ap: number | null;
        timestamp?: string;
        isCustom?: boolean;
      }>();

      // Sort rawData by Actual Receipt Date / Bill Date / Timestamp descending (matching Purchase FMS UI)
      const getReceiptTime = (row: any) => {
        const d = row["Date Of Receiving"] || row["ACTUAL RECEIPT DATE"] || row["Date Of Bill"] || row["DATE OF BILL"] || row["Timestamp"];
        return d ? new Date(d).getTime() : 0;
      };
      const sortedRawData = (rawData || []).slice().sort((a: any, b: any) => getReceiptTime(b) - getReceiptTime(a));

      for (const row of sortedRawData) {
        const firmName = String(row["Firm Name"] || "N/A").trim();
        const productName = String(row["Raw Material Name"] || row["Product Name"] || "N/A").trim();

        if (!firmName || !productName) continue;

        const key = `${firmName.toLowerCase()}___${productName.toLowerCase()}`;

        if (!recordMap.has(key)) {
          recordMap.set(key, {
            firmName,
            productName,
            alumina: null,
            iron: null,
            price: null,
            baseRate: null,
            transportRate: null,
            procCost: null,
            bd: null,
            ap: null,
            timestamp: row["Timestamp"],
          });
        }

        const rec = recordMap.get(key)!;

        // Pick latest non-null values for each property
        if (rec.alumina === null && row["Alumina Percent Age %"] !== null && row["Alumina Percent Age %"] !== undefined && !isNaN(Number(row["Alumina Percent Age %"]))) {
          rec.alumina = parseFloat(row["Alumina Percent Age %"]);
        }
        if (rec.iron === null && row["Iron Percent Age %"] !== null && row["Iron Percent Age %"] !== undefined && !isNaN(Number(row["Iron Percent Age %"]))) {
          rec.iron = parseFloat(row["Iron Percent Age %"]);
        }
        if (rec.bd === null && row["BD Percent Age %"] !== null && row["BD Percent Age %"] !== undefined && !isNaN(Number(row["BD Percent Age %"]))) {
          rec.bd = parseFloat(row["BD Percent Age %"]);
        }
        if (rec.ap === null && row["AP Percent Age %"] !== null && row["AP Percent Age %"] !== undefined && !isNaN(Number(row["AP Percent Age %"]))) {
          rec.ap = parseFloat(row["AP Percent Age %"]);
        }
        if (rec.price === null && row["Rate"] !== null && row["Rate"] !== undefined && !isNaN(Number(row["Rate"]))) {
          const baseRate = parseFloat(row["Rate"]);
          let transportRate = (row["Transporting Rate"] !== null && row["Transporting Rate"] !== undefined && !isNaN(Number(row["Transporting Rate"])))
            ? parseFloat(row["Transporting Rate"])
            : 0;

          const rateType = String(row["Type Of Transporting Rate"] || "").trim().toLowerCase();

          // Fallback: When Rate Type is Fixed and per mt transportation rate column has no value (0/null/undefined),
          // fetch (Total Transport Amount / Billing Qty)
          if ((transportRate === 0 || isNaN(transportRate)) && rateType === "fixed") {
            const totalTransportAmount = Number(row["Transporter Rate"] || 0);
            const billingQty = Number(row["Lifting Qty"] || row["Total Bill Quantity"] || row["Actual Quantity"] || row["Qty"] || 0);
            if (totalTransportAmount > 0 && billingQty > 0) {
              transportRate = totalTransportAmount / billingQty;
            }
          }

          rec.price = baseRate + transportRate;
          rec.baseRate = baseRate;
          rec.transportRate = transportRate;
          rec.procCost = 0;
          rec.procCostSource = undefined;
        }
      }

      // Helper function to find parent raw material record in recordMap for crushed grains
      const findParentRecord = (fNameRaw: string, parentNameRaw: string, fgNameRaw: string) => {
        const normF = normFirm(fNameRaw);
        const normP = normProd(parentNameRaw);
        const normFg = normProd(fgNameRaw);

        const cleanP = normP.replace(/\s+/g, "").replace("lumps", "").replace("slag", "");
        const fgBase = normFg.split("(")[0].trim().replace(/\s+/g, "");

        let parentRec = recordMap.get(`${normF}___${normP}`);
        if (parentRec) return parentRec;

        for (const [k, v] of recordMap.entries()) {
          if (k.startsWith(`${normF}___`)) {
            const pNameInMap = k.split("___")[1].replace(/\s+/g, "").replace("lumps", "").replace("slag", "");
            if (pNameInMap === cleanP || pNameInMap === fgBase) return v;
          }
        }

        return null;
      };

      // Add crushed grains from crushingActualData if not present in recordMap
      (crushingActualData || []).forEach((row: any) => {
        const firmName = String(row["Firm Name"] || row["Firm name"] || "").trim();
        const parentProdName = String(row["Crushing Product Name"] || "").trim();
        if (!firmName) return;

        for (let i = 1; i <= 4; i++) {
          const fgName = String(row[`Finished Goods Name ${i}`] || "").trim();
          const fgCost = Number(row[`Processing Cost ${i}`] || 0);
          if (!fgName) continue;

          const grainKey = `${firmName.toLowerCase()}___${fgName.toLowerCase()}`;
          if (!recordMap.has(grainKey)) {
            const parentRec = findParentRecord(firmName, parentProdName, fgName);
            const bRate = parentRec ? (parentRec.baseRate ?? null) : null;
            const tRate = parentRec ? (parentRec.transportRate ?? null) : null;
            const calcPrice = (bRate || 0) + (tRate || 0) + fgCost;

            recordMap.set(grainKey, {
              firmName,
              productName: fgName,
              alumina: parentRec ? parentRec.alumina : null,
              iron: parentRec ? parentRec.iron : null,
              price: calcPrice > 0 ? calcPrice : null,
              baseRate: bRate,
              transportRate: tRate,
              procCost: fgCost,
              procCostSource: "crushing",
              bd: parentRec ? parentRec.bd : null,
              ap: parentRec ? parentRec.ap : null,
              timestamp: row["Timestamp"] || (parentRec ? parentRec.timestamp : undefined),
            });
          }
        }
      });

      // Unique list of firms present in recordMap
      const knownFirms = Array.from(new Set(Array.from(recordMap.values()).map(r => r.firmName).filter(Boolean)));

      // Helper function to find matching grain rate for semi-finished / fines products ONLY for the target firm
      const findGrainRateForFines = (targetFirm: string, finesProdName: string) => {
        const normF = normFirm(targetFirm);
        if (!normF) return null;
        const cleanBase = normProd(finesProdName).replace("fines", "").replace("fine", "").replace(/\s+/g, "");

        // Only check exact firm match
        for (const [k, v] of recordMap.entries()) {
          if (k.startsWith(`${normF}___`)) {
            const pNameInMap = k.split("___")[1];
            const cleanedP = pNameInMap.replace(/\s+/g, "");
            const isGrain = cleanedP.includes("(0-1)") || 
                            cleanedP.includes("(1-3)") || 
                            cleanedP.includes("(3-5)") || 
                            cleanedP.includes("clinker") || 
                            cleanedP.includes("lumps") || 
                            cleanedP.includes("slag");

            if (cleanedP.startsWith(cleanBase) && isGrain) {
              if (v.price && v.price > 0) return v;
            }
          }
        }

        return null;
      };

      // Process ALL semi_actual history products with traced firm names
      (semiActualData || []).forEach((row: any) => {
        const sjcNo = String(row["Semi Finished Job Card No."] || "").trim();
        const sfNo = String(row["Semi Finished Production No."] || "").trim();
        const prodName = String(row["Product Name"] || "").trim();
        const procCost = Number(row["Processing Cost"] || 0);

        if (!prodName) return;

        const tracedFirmRaw = String(
          row["Firm name"] || 
          row["Firm Name"] || 
          sjcFirmMap.get(`${sjcNo}::${normProd(prodName)}`) || 
          sjcFirmMap.get(sjcNo) || 
          sfFirmMap.get(`${sfNo}::${normProd(prodName)}`) || 
          sfFirmMap.get(sfNo) || 
          ""
        ).trim();

        const targetFirms = tracedFirmRaw ? [tracedFirmRaw] : knownFirms;

        targetFirms.forEach((fName) => {
          const displayFirm = fName || "Pmmpl";
          const grainKey = `${normFirm(displayFirm)}___${prodName.toLowerCase()}`;

          // Option A: If a direct purchase bill for this product exists in Purchase FMS for this firm, preserve it as is.
          // Only synthesize / add processing cost if NO direct purchase bill exists for this product & firm.
          if (!recordMap.has(grainKey)) {
            const grainRec = findGrainRateForFines(displayFirm, prodName);
            const parentRec = grainRec || findParentRecord(displayFirm, prodName, prodName);
            const bRate = parentRec ? parentRec.baseRate : null;
            const tRate = parentRec ? parentRec.transportRate : null;
            const calcPrice = (bRate || 0) + (tRate || 0) + procCost;

            recordMap.set(grainKey, {
              firmName: displayFirm,
              productName: prodName,
              alumina: parentRec ? parentRec.alumina : null,
              iron: parentRec ? parentRec.iron : null,
              price: calcPrice > 0 ? calcPrice : (procCost > 0 ? procCost : null),
              baseRate: bRate,
              transportRate: tRate,
              procCost,
              procCostSource: procCost > 0 ? "semi" : undefined,
              bd: parentRec ? parentRec.bd : null,
              ap: parentRec ? parentRec.ap : null,
              timestamp: row["Timestamp"],
            });
          }
        });
      });

      // 4. Merge Custom Products from localStorage
      try {
        const storedCustom = localStorage.getItem("custom_kyc_products");
        if (storedCustom) {
          const parsedCustom = JSON.parse(storedCustom);
          if (Array.isArray(parsedCustom)) {
            parsedCustom.forEach((item: any) => {
              const fName = String(item.firmName || "Pmmpl").trim();
              const pName = String(item.productName || "").trim();
              if (fName && pName) {
                const key = `${normFirm(fName)}___${pName.toLowerCase()}`;
                const bRate = Number(item.baseRate) || 0;
                const tRate = Number(item.transportRate) || 0;
                const totalPrice = bRate + tRate;

                recordMap.set(key, {
                  firmName: fName,
                  productName: pName,
                  alumina: Number(item.alumina) || null,
                  iron: Number(item.iron) || null,
                  price: totalPrice > 0 ? totalPrice : null,
                  baseRate: bRate,
                  transportRate: tRate,
                  procCost: 0,
                  bd: Number(item.bd) || null,
                  ap: Number(item.ap) || null,
                  timestamp: item.timestamp || new Date().toISOString(),
                  isCustom: true,
                });
              }
            });
          }
        }
      } catch (e) {
        console.error("Error reading custom_kyc_products from localStorage:", e);
      }

      const latestRecords: FormattedProductRecord[] = [];
      for (const rec of recordMap.values()) {
        const alumina = rec.alumina || 0;
        const iron = rec.iron || 0;
        const price = rec.price || 0;
        const bd = rec.bd || 0;
        const ap = rec.ap || 0;

        const albd = Number((alumina * bd).toFixed(2));
        const ratePerAlumina = alumina > 0 ? Number((price / alumina).toFixed(2)) : 0;

        latestRecords.push({
          firmName: rec.firmName,
          productName: rec.productName,
          alumina,
          iron,
          price,
          baseRate: rec.baseRate || 0,
          transportRate: rec.transportRate || 0,
          procCost: rec.procCost || 0,
          procCostSource: rec.procCostSource || (rec.procCost ? "semi" : undefined),
          bd,
          ap,
          albd,
          ratePerAlumina,
          timestamp: rec.timestamp,
          isCustom: (rec as any).isCustom,
        });
      }

      setData(latestRecords);
    } catch (err: any) {
      console.error("Error fetching KYC product data from LIFT-ACCOUNTS:", err?.message || err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddProductSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProductData.productName.trim() || !newProductData.baseRate) return;

    try {
      const storedCustom = localStorage.getItem("custom_kyc_products");
      const list = storedCustom ? JSON.parse(storedCustom) : [];
      const newEntry = {
        ...newProductData,
        productName: newProductData.productName.trim(),
        timestamp: new Date().toISOString(),
      };
      list.push(newEntry);
      localStorage.setItem("custom_kyc_products", JSON.stringify(list));

      // Attempt async insert into Supabase master 'kyc' table & 'custom_kyc_products' table
      (async () => {
        try {
          const totalRate = (Number(newEntry.baseRate) || 0) + (Number(newEntry.transportRate) || 0);
          const firmOrderName = `${newEntry.firmName.toUpperCase()} ORDER`;

          await prodSupabase.from("kyc").insert([{
            "Product name": newEntry.productName,
            "Firm Name": firmOrderName,
            "Alumina": Number(newEntry.alumina) || null,
            "Iron": Number(newEntry.iron) || null,
            "Bd": Number(newEntry.bd) || null,
            "Ap": Number(newEntry.ap) || null,
            "Price": totalRate > 0 ? totalRate : null,
          }]);

          await prodSupabase.from("custom_kyc_products").insert([{
            firm_name: newEntry.firmName,
            product_name: newEntry.productName,
            alumina: Number(newEntry.alumina) || null,
            iron: Number(newEntry.iron) || null,
            bd: Number(newEntry.bd) || null,
            ap: Number(newEntry.ap) || null,
            base_rate: Number(newEntry.baseRate) || 0,
            transport_rate: Number(newEntry.transportRate) || 0,
          }]);
        } catch (e) {
          console.error("Error inserting into kyc table:", e);
        }
      })();

      // Reset form & close modal
      setNewProductData({
        firmName: "Pmmpl",
        productName: "",
        alumina: "",
        iron: "",
        bd: "",
        ap: "",
        baseRate: "",
        transportRate: "",
      });
      setIsAddProductOpen(false);
      fetchData();
    } catch (err) {
      console.error("Error saving custom product:", err);
    }
  };

  const handleDeleteCustomProduct = (firmName: string, productName: string) => {
    try {
      const storedCustom = localStorage.getItem("custom_kyc_products");
      if (storedCustom) {
        const list = JSON.parse(storedCustom);
        const filtered = list.filter(
          (item: any) =>
            !(normFirm(item.firmName) === normFirm(firmName) && normProd(item.productName) === normProd(productName))
        );
        localStorage.setItem("custom_kyc_products", JSON.stringify(filtered));
      }

      // Also delete from Supabase master 'kyc' table
      (async () => {
        try {
          await prodSupabase
            .from("kyc")
            .delete()
            .ilike("Product name", productName);
        } catch (e) {
          console.error("Error deleting from kyc table:", e);
        }
      })();

      fetchData();
    } catch (err) {
      console.error("Error deleting custom product:", err);
    }
  };

  useEffect(() => {
    fetchData();

    // Supabase Real-Time Listener for LIFT-ACCOUNTS
    const channel = supabase
      .channel("realtime-kyc-products")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "LIFT-ACCOUNTS" },
        () => {
          fetchData();
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setIsLive(true);
        } else {
          setIsLive(false);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Filter Dropdown Options
  const firmOptions = Array.from(new Set(data.map((d) => d.firmName))).filter(Boolean);
  const productOptions = Array.from(new Set(data.map((d) => d.productName))).filter(Boolean);

  // Filtered Records (Firm + Product + Search string)
  const filteredData = data.filter((item) => {
    const matchFirm = selectedFirm === "ALL" || item.firmName.toLowerCase() === selectedFirm.toLowerCase();
    const matchProduct = selectedProduct === "ALL" || item.productName.toLowerCase() === selectedProduct.toLowerCase();
    
    const qRaw = searchQuery.toLowerCase().trim();
    if (!qRaw) return matchFirm && matchProduct;

    const qClean = qRaw.replace(/[^a-z0-9]/g, "");

    const pNameRaw = item.productName.toLowerCase();
    const pNameClean = pNameRaw.replace(/[^a-z0-9]/g, "");

    const fNameRaw = item.firmName.toLowerCase();
    const fNameClean = fNameRaw.replace(/[^a-z0-9]/g, "");

    const matchSearch =
      pNameRaw.includes(qRaw) ||
      fNameRaw.includes(qRaw) ||
      (qClean.length > 0 && pNameClean.includes(qClean)) ||
      (qClean.length > 0 && fNameClean.includes(qClean)) ||
      String(item.price || "").includes(qRaw) ||
      String(item.baseRate || "").includes(qRaw) ||
      String(item.alumina || "").includes(qRaw) ||
      String(item.iron || "").includes(qRaw);

    return matchFirm && matchProduct && matchSearch;
  });

  return (
    <Card className="border-none shadow-2xl shadow-gray-200/50 rounded-3xl overflow-hidden bg-white mt-8">
      {/* Header */}
      <CardHeader className="border-b border-gray-100 bg-white/50 backdrop-blur-sm px-6 py-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-3">
            <CardTitle className="text-xl font-bold text-slate-800">
              Latest Product Quality Data (LIFT-ACCOUNTS)
            </CardTitle>
            <Badge
              variant="outline"
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                isLive
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : "bg-amber-50 text-amber-700 border-amber-200"
              }`}
            >
              <Radio className={`h-3 w-3 ${isLive ? "animate-pulse text-emerald-600" : ""}`} />
              {isLive ? "Live Sync Active" : "Connecting..."}
            </Badge>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Displaying the latest quality parameters & calculated rates per Firm & Product from Purchase-FMS
          </p>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Search Input */}
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <Input
              placeholder="Search product, firm, rate or alumina..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-8 h-9 text-xs rounded-xl border-gray-200 focus:ring-olive-500/20"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-slate-100 text-gray-400 hover:text-slate-600 transition-colors"
                title="Clear Search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Firm Name Filter */}
          <div className="flex items-center gap-2 min-w-[160px]">
            <Filter className="h-4 w-4 text-gray-400" />
            <Select value={selectedFirm} onValueChange={setSelectedFirm}>
              <SelectTrigger className="h-9 rounded-xl border-gray-200 bg-white text-xs font-medium focus:ring-olive-500/20">
                <SelectValue placeholder="All Firms" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="ALL">All Firms ({firmOptions.length})</SelectItem>
                {firmOptions.map((firm) => (
                  <SelectItem key={firm} value={firm}>
                    {firm}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Product Name Filter */}
          <div className="flex items-center gap-2 min-w-[180px]">
            <Select value={selectedProduct} onValueChange={setSelectedProduct}>
              <SelectTrigger className="h-9 rounded-xl border-gray-200 bg-white text-xs font-medium focus:ring-olive-500/20">
                <SelectValue placeholder="All Products" />
              </SelectTrigger>
              <SelectContent className="rounded-xl max-h-60">
                <SelectItem value="ALL">All Products ({productOptions.length})</SelectItem>
                {productOptions.map((prod) => (
                  <SelectItem key={prod} value={prod}>
                    {prod}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Add Custom Product Button */}
          <button
            onClick={() => setIsAddProductOpen(true)}
            className="h-9 px-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white transition-colors flex items-center gap-1.5 text-xs font-semibold shadow-sm"
          >
            <Plus className="h-3.5 w-3.5 text-indigo-400" />
            Add Product
          </button>

          {/* Manual Refresh Button */}
          <button
            onClick={fetchData}
            disabled={loading}
            className="h-9 px-3 rounded-xl border border-gray-200 hover:bg-slate-50 text-gray-600 transition-colors flex items-center gap-1.5 text-xs font-semibold"
            title="Refresh Data"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin text-olive-600" : ""}`} />
            Refresh
          </button>
        </div>
      </CardHeader>

      {/* Table Content */}
      <CardContent className="p-0">
        <div className="overflow-x-auto overflow-y-auto max-h-[600px] custom-scrollbar">
          <Table>
            <TableHeader className="bg-gray-50/50">
              <TableRow className="border-b border-gray-100">
                <TableHead className="sticky top-0 z-20 bg-gray-50 h-12 px-6 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 whitespace-nowrap">
                  Firm Name
                </TableHead>
                <TableHead className="sticky top-0 z-20 bg-gray-50 h-12 px-6 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 whitespace-nowrap">
                  Product Name
                </TableHead>
                <TableHead className="sticky top-0 z-20 bg-gray-50 h-12 px-6 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 whitespace-nowrap">
                  Alumina (%)
                </TableHead>
                <TableHead className="sticky top-0 z-20 bg-gray-50 h-12 px-6 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 whitespace-nowrap">
                  Iron (%)
                </TableHead>
                <TableHead className="sticky top-0 z-20 bg-gray-50 h-12 px-6 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 whitespace-nowrap">
                  Price (₹)
                </TableHead>
                <TableHead className="sticky top-0 z-20 bg-gray-50 h-12 px-6 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 whitespace-nowrap">
                  BD (%)
                </TableHead>
                <TableHead className="sticky top-0 z-20 bg-gray-50 h-12 px-6 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 whitespace-nowrap">
                  AP (%)
                </TableHead>
                <TableHead className="sticky top-0 z-20 bg-gray-50 h-12 px-6 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 whitespace-nowrap text-olive-700">
                  ALBD
                </TableHead>
                <TableHead className="sticky top-0 z-20 bg-gray-50 h-12 px-6 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 whitespace-nowrap text-olive-700">
                  Rate Per Alumina (₹)
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-48 text-center">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <Loader2 className="h-8 w-8 animate-spin text-olive-600" />
                      <p className="text-xs font-semibold text-slate-500 animate-pulse uppercase tracking-wider">
                        Fetching Real-Time Product Quality Data...
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-48 text-center text-gray-500 font-medium text-xs">
                    No matching quality records found in LIFT-ACCOUNTS.
                  </TableCell>
                </TableRow>
              ) : (
                filteredData.map((row, idx) => (
                  <TableRow
                    key={idx}
                    className="group hover:bg-olive-50/30 transition-colors border-b border-gray-50 last:border-0"
                  >
                    <TableCell className="px-6 py-3.5 text-xs font-semibold text-slate-600 whitespace-nowrap">
                      {row.firmName}
                    </TableCell>
                    <TableCell className="px-6 py-3.5 text-xs font-bold text-slate-800 whitespace-nowrap">
                      {row.productName}
                    </TableCell>
                    <TableCell className="px-6 py-3.5 text-xs font-medium text-slate-700 whitespace-nowrap">
                      {row.alumina}%
                    </TableCell>
                    <TableCell className="px-6 py-3.5 text-xs font-medium text-slate-700 whitespace-nowrap">
                      {row.iron}%
                    </TableCell>
                    <TableCell
                      className="px-6 py-3.5 text-xs font-bold text-olive-700 whitespace-nowrap cursor-pointer hover:bg-olive-100/60 transition-all rounded group/cell"
                      onClick={() => {
                        setSelectedRecordForBreakdown(row);
                        setIsBreakdownOpen(true);
                      }}
                      title="Click to view Price Breakdown"
                    >
                      <div className="inline-flex items-center gap-1.5">
                        <span className="underline underline-offset-2 decoration-olive-300 group-hover/cell:decoration-olive-700">₹{row.price.toLocaleString("en-IN")}</span>
                        <Info className="h-3.5 w-3.5 text-olive-600 opacity-70 group-hover/cell:opacity-100 transition-opacity" />
                      </div>
                    </TableCell>
                    <TableCell className="px-6 py-3.5 text-xs font-medium text-slate-700 whitespace-nowrap">
                      {row.bd}%
                    </TableCell>
                    <TableCell className="px-6 py-3.5 text-xs font-medium text-slate-700 whitespace-nowrap">
                      {row.ap}%
                    </TableCell>
                    <TableCell className="px-6 py-3.5 text-xs font-black text-slate-900 bg-olive-50/40 whitespace-nowrap">
                      {row.albd}
                    </TableCell>
                    <TableCell className="px-6 py-3.5 text-xs font-black text-olive-800 bg-olive-50/60 whitespace-nowrap">
                      ₹{row.ratePerAlumina.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      {/* ── Price Breakdown Popup Dialog ── */}
      <Dialog open={isBreakdownOpen} onOpenChange={setIsBreakdownOpen}>
        <DialogContent className="sm:max-w-[460px] bg-white rounded-2xl p-6 shadow-xl border border-slate-200">
          <DialogHeader className="pb-3 border-b border-slate-100">
            <DialogTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
              <Receipt className="h-5 w-5 text-olive-600" />
              Price Breakdown Details
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Complete rate breakdown for <strong className="text-slate-800">{selectedRecordForBreakdown?.productName}</strong> ({selectedRecordForBreakdown?.firmName})
            </DialogDescription>
          </DialogHeader>

          {selectedRecordForBreakdown && (
            <div className="space-y-4 py-3">
              <div className="bg-slate-50/80 rounded-xl p-3.5 border border-slate-100 space-y-2.5 text-xs">
                <div className="flex justify-between items-center py-1 border-b border-slate-100">
                  <div className="flex flex-col">
                    <span className="text-slate-700 font-semibold">Base Material Rate</span>
                    <span className="text-[10px] text-slate-400">Purchase-FMS (LIFT-ACCOUNTS)</span>
                  </div>
                  <span className="font-bold text-slate-800 text-sm">₹{selectedRecordForBreakdown.baseRate.toLocaleString("en-IN")}</span>
                </div>

                <div className="flex justify-between items-center py-1 border-b border-slate-100">
                  <div className="flex flex-col">
                    <span className="text-slate-700 font-semibold">Per MT Transporting Rate</span>
                    <span className="text-[10px] text-slate-400">Purchase-FMS (LIFT-ACCOUNTS)</span>
                  </div>
                  <span className="font-bold text-slate-800 text-sm">+ ₹{selectedRecordForBreakdown.transportRate.toLocaleString("en-IN")}</span>
                </div>

                <div className="flex justify-between items-center py-1">
                  <div className="flex flex-col">
                    <span className="text-emerald-800 font-semibold">
                      {selectedRecordForBreakdown.procCostSource === "crushing" ? "Crushing Processing Cost" : "Semi-Finished Processing Cost"}
                    </span>
                    <span className="text-[10px] text-emerald-600">
                      {selectedRecordForBreakdown.procCostSource === "crushing" ? "Production-FMS (Actual Crush. Entry)" : "Production-FMS (Actual Prod. Entry)"}
                    </span>
                  </div>
                  <span className="font-bold text-emerald-700 text-sm">+ ₹{selectedRecordForBreakdown.procCost.toLocaleString("en-IN")}</span>
                </div>

                <div className="border-t-2 border-slate-200 pt-2.5 flex justify-between items-center text-sm">
                  <span className="font-extrabold text-slate-900">Total Calculated Price:</span>
                  <span className="font-black text-olive-700 text-base">₹{selectedRecordForBreakdown.price.toLocaleString("en-IN")} / MT</span>
                </div>
              </div>

              <div className="text-[11px] text-slate-600 bg-amber-50/70 border border-amber-200/80 p-3 rounded-xl flex items-start gap-2">
                <Info className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  Processing cost is matched by <strong>Firm Name ({selectedRecordForBreakdown.firmName})</strong> and <strong>Product Name ({selectedRecordForBreakdown.productName})</strong> from {selectedRecordForBreakdown.procCostSource === "crushing" ? "Actual Crushing Entry" : "Actual Production Entry"} history.
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Custom Product Modal */}
      <Dialog open={isAddProductOpen} onOpenChange={setIsAddProductOpen}>
        <DialogContent className="sm:max-w-[480px] bg-white rounded-3xl p-6 shadow-2xl border border-slate-100">
          <DialogHeader className="pb-3 border-b border-slate-100">
            <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <PlusCircle className="h-5 w-5 text-indigo-600" />
              Add Custom Product
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Enter quality specifications and rates to add a custom product to the KYC catalog.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAddProductSubmit} className="space-y-4 mt-3">
            {/* Firm Name & Product Name */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Firm Name *</label>
                <Select
                  value={newProductData.firmName}
                  onValueChange={(val) => setNewProductData((prev) => ({ ...prev, firmName: val }))}
                >
                  <SelectTrigger className="h-9 rounded-xl text-xs bg-white border-slate-200">
                    <SelectValue placeholder="Select Firm" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="Pmmpl">Pmmpl</SelectItem>
                    <SelectItem value="Purab">Purab</SelectItem>
                    <SelectItem value="Rkl">Rkl</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Product Name *</label>
                <Input
                  required
                  placeholder="e.g. Special Bauxite"
                  value={newProductData.productName}
                  onChange={(e) => setNewProductData((prev) => ({ ...prev, productName: e.target.value }))}
                  className="h-9 text-xs rounded-xl border-slate-200"
                />
              </div>
            </div>

            {/* Alumina & Iron */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Alumina (%)</label>
                <Input
                  type="number"
                  step="any"
                  placeholder="e.g. 70.5"
                  value={newProductData.alumina}
                  onChange={(e) => setNewProductData((prev) => ({ ...prev, alumina: e.target.value }))}
                  className="h-9 text-xs rounded-xl border-slate-200"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Iron (%)</label>
                <Input
                  type="number"
                  step="any"
                  placeholder="e.g. 1.2"
                  value={newProductData.iron}
                  onChange={(e) => setNewProductData((prev) => ({ ...prev, iron: e.target.value }))}
                  className="h-9 text-xs rounded-xl border-slate-200"
                />
              </div>
            </div>

            {/* BD & AP */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">BD (%)</label>
                <Input
                  type="number"
                  step="any"
                  placeholder="e.g. 2.45"
                  value={newProductData.bd}
                  onChange={(e) => setNewProductData((prev) => ({ ...prev, bd: e.target.value }))}
                  className="h-9 text-xs rounded-xl border-slate-200"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">AP (%)</label>
                <Input
                  type="number"
                  step="any"
                  placeholder="e.g. 3.1"
                  value={newProductData.ap}
                  onChange={(e) => setNewProductData((prev) => ({ ...prev, ap: e.target.value }))}
                  className="h-9 text-xs rounded-xl border-slate-200"
                />
              </div>
            </div>

            {/* Base Rate & Transport Rate */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Base Rate (₹/MT) *</label>
                <Input
                  type="number"
                  step="any"
                  required
                  placeholder="e.g. 35000"
                  value={newProductData.baseRate}
                  onChange={(e) => setNewProductData((prev) => ({ ...prev, baseRate: e.target.value }))}
                  className="h-9 text-xs rounded-xl border-slate-200"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Transport Rate (₹/MT)</label>
                <Input
                  type="number"
                  step="any"
                  placeholder="e.g. 1500"
                  value={newProductData.transportRate}
                  onChange={(e) => setNewProductData((prev) => ({ ...prev, transportRate: e.target.value }))}
                  className="h-9 text-xs rounded-xl border-slate-200"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsAddProductOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20 transition-colors"
              >
                Save Product
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
