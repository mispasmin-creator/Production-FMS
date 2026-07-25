"use client";

import React, { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import { Loader2, Radio, Filter, RefreshCw, Search } from "lucide-react";
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

// Supabase Connection credentials for Purchase-FMS
const SUPABASE_URL = "https://jcgmyvxcamstnhuwmemc.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpjZ215dnhjYW1zdG5odXdtZW1jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwMDgyODAsImV4cCI6MjA4NTU4NDI4MH0.wMKYEcXGOgrRwy7DKBlBz-a_mWhAuZaknG_iXYvKLLo";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

interface FormattedProductRecord {
  firmName: string;
  productName: string;
  alumina: number;
  iron: number;
  price: number;
  bd: number;
  ap: number;
  albd: number;
  ratePerAlumina: number;
  timestamp?: string;
}

export default function KycProductTable() {
  const [data, setData] = useState<FormattedProductRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedFirm, setSelectedFirm] = useState<string>("ALL");
  const [selectedProduct, setSelectedProduct] = useState<string>("ALL");
  const [isLive, setIsLive] = useState<boolean>(false);

  // Real-Time Data Fetching Function (Deduplicated to keep ONLY LATEST entry per Firm & Product)
  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: rawData, error } = await supabase
        .from("LIFT-ACCOUNTS")
        .select("*")
        .order("Timestamp", { ascending: false });

      if (error) throw error;

      // Aggregation map to collect latest non-null values for each Firm + Product
      const recordMap = new Map<string, {
        firmName: string;
        productName: string;
        alumina: number | null;
        iron: number | null;
        price: number | null;
        bd: number | null;
        ap: number | null;
        timestamp?: string;
      }>();

      for (const row of rawData || []) {
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
          rec.price = parseFloat(row["Rate"]);
        }
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
          bd,
          ap,
          albd,
          ratePerAlumina,
          timestamp: rec.timestamp,
        });
      }

      setData(latestRecords);
    } catch (err: any) {
      console.error("Error fetching KYC product data from LIFT-ACCOUNTS:", err?.message || err);
    } finally {
      setLoading(false);
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
    const q = searchQuery.toLowerCase().trim();
    const matchSearch =
      !q ||
      item.productName.toLowerCase().includes(q) ||
      item.firmName.toLowerCase().includes(q);

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
          <div className="relative flex-1 md:w-56">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <Input
              placeholder="Search product or firm..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 text-xs rounded-xl border-gray-200 focus:ring-olive-500/20"
            />
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
                    <TableCell className="px-6 py-3.5 text-xs font-bold text-olive-700 whitespace-nowrap">
                      ₹{row.price.toLocaleString("en-IN")}
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
    </Card>
  );
}
