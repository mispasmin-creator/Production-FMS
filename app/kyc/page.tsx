"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Loader2,
  BadgeCheck,
  AlertCircle,
  Search,
  Pencil,
  Save,
  X,
  Plus,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/lib/supabase";
import { useAuth, FIRM_MAP } from "@/lib/auth";
import KycProductTable from "@/components/KycProductTable";

interface KycRecord {
  id: number;
  "Product name": string | null;
  "Alumina": number | null;
  "Iron": number | null;
  "Price": number | null;
  "Bd": number | null;
  "Ap": number | null;
  "ALBD": number | null;
  "Rate Per Alumina": number | null;
  "Firm Name": string | null;
}

type KycFormData = Omit<KycRecord, "id">;

const FIRM_OPTIONS = ["PMMPL ORDER", "PURAB ORDER", "RKL ORDER"];

const FIELDS: { key: keyof KycFormData; label: string; type: "text" | "number" }[] = [
  { key: "Product name", label: "Product Name", type: "text" },
  { key: "Alumina", label: "Alumina", type: "number" },
  { key: "Iron", label: "Iron", type: "number" },
  { key: "Price", label: "Price (₹)", type: "number" },
  { key: "Bd", label: "BD", type: "number" },
  { key: "Ap", label: "AP", type: "number" },
  { key: "ALBD", label: "ALBD", type: "number" },
  { key: "Rate Per Alumina", label: "Rate Per Alumina", type: "number" },
];

const EMPTY_FORM: KycFormData = {
  "Product name": null,
  "Firm Name": null,
  "Alumina": null,
  "Iron": null,
  "Price": null,
  "Bd": null,
  "Ap": null,
  "ALBD": null,
  "Rate Per Alumina": null,
};

const COLUMNS = [
  { header: "ID", key: "id" },
  { header: "Product Name", key: "Product name" },
  { header: "Firm Name", key: "Firm Name" },
  { header: "Alumina", key: "Alumina" },
  { header: "Iron", key: "Iron" },
  { header: "Price (₹)", key: "Price" },
  { header: "BD", key: "Bd" },
  { header: "AP", key: "Ap" },
  { header: "ALBD", key: "ALBD" },
  { header: "Rate / Alumina", key: "Rate Per Alumina" },
  { header: "Edit", key: "action" },
];

const fmt = (val: number | null | undefined) =>
  val !== null && val !== undefined
    ? Number(val).toLocaleString("en-IN", { maximumFractionDigits: 2 })
    : "-";

function handleFieldChange(
  form: KycFormData,
  key: keyof KycFormData,
  value: string,
): KycFormData {
  const updated = {
    ...form,
    [key]:
      value === ""
        ? null
        : key === "Product name" || key === "Firm Name"
        ? value
        : Number(value),
  };

  const alumina = updated.Alumina !== null && updated.Alumina !== undefined ? Number(updated.Alumina) : null;
  const bd = updated.Bd !== null && updated.Bd !== undefined ? Number(updated.Bd) : null;
  const price = updated.Price !== null && updated.Price !== undefined ? Number(updated.Price) : null;

  const albd = (alumina !== null && bd !== null) ? Number((alumina * bd).toFixed(2)) : updated.ALBD;
  const ratePerAlumina = (price !== null && alumina !== null && alumina > 0)
    ? Number((price / alumina).toFixed(2))
    : (alumina === 0 ? 0 : updated["Rate Per Alumina"]);

  return {
    ...updated,
    ALBD: albd,
    "Rate Per Alumina": ratePerAlumina,
  };
}

function FormFields({
  form,
  onChange,
}: {
  form: KycFormData;
  onChange: (key: keyof KycFormData, val: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {/* Firm Name dropdown */}
      <div className="space-y-1.5">
        <Label className="text-[10px] font-black uppercase tracking-widest text-gray-400">
          Firm Name
        </Label>
        <Select
          value={form["Firm Name"] || ""}
          onValueChange={(val) => onChange("Firm Name", val)}
        >
          <SelectTrigger className="h-10 rounded-xl border-gray-200 focus:ring-olive-500/20">
            <SelectValue placeholder="Select Firm" />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            {FIRM_OPTIONS.map((opt) => (
              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {FIELDS.map((field) => (
        <div key={String(field.key)} className="space-y-1.5">
          <Label className="text-[10px] font-black uppercase tracking-widest text-gray-400">
            {field.label}
            {field.key === "Product name" && (
              <span className="text-red-400 ml-1">*</span>
            )}
          </Label>
          <Input
            type={field.type}
            value={form[field.key] !== null && form[field.key] !== undefined ? String(form[field.key]) : ""}
            onChange={(e) => onChange(field.key, e.target.value)}
            className="h-10 rounded-xl border-gray-200 bg-white text-gray-800 placeholder:text-gray-400 focus:ring-olive-500/20 focus:border-olive-500"
            placeholder={field.label}
          />
        </div>
      ))}
    </div>
  );
}

export default function KycPage() {
  const { user } = useAuth();
  const [data, setData] = useState<KycRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Edit dialog
  const [editRow, setEditRow] = useState<KycRecord | null>(null);
  const [editForm, setEditForm] = useState<KycFormData>({ ...EMPTY_FORM });

  // Add dialog
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState<KycFormData>({ ...EMPTY_FORM });

  const [saving, setSaving] = useState(false);

  const isAdmin =
    user?.role?.toLowerCase() === "admin" &&
    user?.username?.toLowerCase() === "admin";

  const fetchKyc = async () => {
    setLoading(true);
    const { data: rows, error } = await supabase
      .from("kyc")
      .select("*")
      .order("id", { ascending: true });

    if (error) console.error("KYC fetch error:", error.message);

    const processedRows = (rows || []).map((row: any) => {
      const alumina = row.Alumina !== null && row.Alumina !== undefined ? Number(row.Alumina) : null;
      const bd = row.Bd !== null && row.Bd !== undefined ? Number(row.Bd) : null;
      const price = row.Price !== null && row.Price !== undefined ? Number(row.Price) : null;

      const albd = (alumina !== null && bd !== null)
        ? Number((alumina * bd).toFixed(2))
        : (row.ALBD !== null && row.ALBD !== undefined ? Number(row.ALBD) : null);

      const ratePerAlumina = (price !== null && alumina !== null && alumina > 0)
        ? Number((price / alumina).toFixed(2))
        : (alumina === 0 ? 0 : (row["Rate Per Alumina"] !== null && row["Rate Per Alumina"] !== undefined ? Number(row["Rate Per Alumina"]) : null));

      return {
        ...row,
        ALBD: albd,
        "Rate Per Alumina": ratePerAlumina,
      };
    });

    setData(processedRows);
    setLoading(false);
  };

  useEffect(() => { fetchKyc(); }, []);

  const firmFiltered = useMemo(() => {
    if (!user) return [];
    if (isAdmin) return data;
    if (!user.firm) return data;
    const userFirms = user.firm.split(',').map(f => f.trim()).filter(Boolean);
    return data.filter((row) => {
      const fName = String(row["Firm Name"] || "").trim().toLowerCase();
      if (!fName) return true;
      return userFirms.some(uf => {
        const firmSearch = uf.toLowerCase();
        const mapped = (FIRM_MAP[uf] || uf).toLowerCase();
        return fName.includes(firmSearch) || fName.includes(mapped);
      });
    });
  }, [data, user, isAdmin]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return firmFiltered;
    return firmFiltered.filter(
      (row) =>
        String(row["Product name"] || "").toLowerCase().includes(q) ||
        String(row["Firm Name"] || "").toLowerCase().includes(q),
    );
  }, [firmFiltered, search]);

  // ── Edit helpers ──
  const openEdit = (row: KycRecord) => {
    setEditRow(row);
    const { id, ...rest } = row;
    setEditForm(rest as KycFormData);
  };
  const closeEdit = () => { setEditRow(null); setEditForm({ ...EMPTY_FORM }); };


  const handleSave = async () => {
    if (!editRow) return;
    setSaving(true);
    const { error } = await supabase.from("kyc").update(editForm).eq("id", editRow.id);
    if (error) alert("Save failed: " + error.message);
    else { await fetchKyc(); closeEdit(); }
    setSaving(false);
  };

  // ── Add helpers ──
  const openAdd = () => { setAddForm({ ...EMPTY_FORM }); setAddOpen(true); };
  const closeAdd = () => { setAddOpen(false); setAddForm({ ...EMPTY_FORM }); };

  const handleAdd = async () => {
    if (!addForm["Product name"]?.trim()) {
      alert("Product Name zaroori hai.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("kyc").insert([addForm]);
    if (error) alert("Add failed: " + error.message);
    else { await fetchKyc(); closeAdd(); }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center h-screen bg-white">
        <Loader2 className="h-12 w-12 animate-spin text-olive-600 mb-4" />
        <p className="text-olive-800 font-medium animate-pulse tracking-widest uppercase text-xs">
          Loading KYC Data...
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-screen max-w-full overflow-x-hidden">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <BadgeCheck className="h-6 w-6 text-olive-600" />
            KYC
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Product-wise KYC records with composition details.
          </p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search product or firm..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 h-10 rounded-xl border-gray-200 focus:ring-olive-500/20 focus-visible:ring-olive-500"
            />
          </div>
          <Button
            onClick={openAdd}
            className="h-10 px-4 rounded-xl bg-olive-600 hover:bg-olive-700 text-white font-bold shadow-md shadow-olive-600/20 whitespace-nowrap"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Product
          </Button>
        </div>
      </div>

      {/* Table Card */}
      <Card className="border-none shadow-2xl shadow-gray-200/50 rounded-3xl overflow-hidden bg-white">
        <CardHeader className="border-b border-gray-100 bg-white/50 backdrop-blur-sm sticky top-0 z-10 px-6 py-5">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">
            {filtered.length} Record{filtered.length !== 1 ? "s" : ""}
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto overflow-y-auto max-h-[650px] custom-scrollbar">
            <Table>
              <TableHeader className="bg-gray-50/50">
                <TableRow className="border-b border-gray-100">
                  {COLUMNS.map((col) => (
                    <TableHead
                      key={col.key}
                      className="sticky top-0 z-20 bg-gray-50 h-14 px-6 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 whitespace-nowrap align-middle"
                    >
                      {col.header}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length > 0 ? (
                  filtered.map((row) => (
                    <TableRow
                      key={row.id}
                      className="group hover:bg-olive-50/30 transition-colors border-b border-gray-50 last:border-0"
                    >
                      {COLUMNS.map((col) => (
                        <TableCell
                          key={col.key}
                          className="px-6 py-4 text-xs font-semibold text-gray-700 whitespace-nowrap"
                        >
                          {col.key === "action" ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEdit(row)}
                              className="h-8 w-8 p-0 rounded-lg text-olive-500 hover:text-olive-700 hover:bg-olive-50"
                              title="Edit row"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          ) : col.key === "id" ? (
                            <span className="text-olive-700 font-bold">{row.id}</span>
                          ) : col.key === "Product name" ? (
                            <span className="font-bold text-slate-800">
                              {row["Product name"] || "-"}
                            </span>
                          ) : col.key === "Firm Name" ? (
                            <span className="text-slate-600">
                              {row["Firm Name"] || "-"}
                            </span>
                          ) : col.key === "Price" ? (
                            row["Price"] !== null && row["Price"] !== undefined ? (
                              <span className="text-olive-700 font-bold">
                                ₹{fmt(row["Price"])}
                              </span>
                            ) : "-"
                          ) : (
                            fmt(row[col.key as keyof KycRecord] as number | null)
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={COLUMNS.length} className="h-64">
                      <div className="flex flex-col items-center justify-center text-center p-12 space-y-4">
                        <div className="p-4 bg-gray-50 rounded-full">
                          <AlertCircle className="h-10 w-10 text-gray-300" />
                        </div>
                        <div className="space-y-1">
                          <p className="text-lg font-bold text-gray-900 uppercase tracking-widest">
                            No Records Found
                          </p>
                          <p className="text-sm text-gray-500 max-w-xs">
                            {search
                              ? "No KYC records match your search."
                              : "No KYC data available. Add a product to get started."}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* ── Real-Time Product Quality Table (LIFT-ACCOUNTS) ── */}
      <KycProductTable />

      {/* ── Add Dialog ── */}
      <Dialog open={addOpen} onOpenChange={(o) => !o && closeAdd()}>
        <DialogContent className="max-w-lg rounded-3xl p-0 overflow-hidden border-none shadow-2xl">
          <div className="bg-olive-600 px-8 py-6 text-white">
            <DialogHeader>
              <DialogTitle className="text-2xl font-black tracking-tight uppercase text-white">
                Add New Product
              </DialogTitle>
              <p className="text-olive-100 text-sm font-medium mt-1">
                Naya KYC record add karein
              </p>
            </DialogHeader>
          </div>
          <div className="p-8 space-y-5 bg-white">
            <FormFields
              form={addForm}
              onChange={(key, val) =>
                setAddForm((prev) => handleFieldChange(prev, key, val))
              }
            />
            <div className="flex gap-3 pt-2">
              <Button
                variant="ghost"
                onClick={closeAdd}
                className="flex-1 h-12 rounded-2xl font-bold uppercase tracking-widest text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button
                onClick={handleAdd}
                disabled={saving}
                className="flex-[2] h-12 rounded-2xl bg-olive-600 hover:bg-olive-700 text-white font-black uppercase tracking-widest shadow-xl shadow-olive-600/20"
              >
                {saving ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Product
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Edit Dialog ── */}
      <Dialog open={!!editRow} onOpenChange={(o) => !o && closeEdit()}>
        <DialogContent className="max-w-lg rounded-3xl p-0 overflow-hidden border-none shadow-2xl">
          <div className="bg-olive-700 px-8 py-6 text-white">
            <DialogHeader>
              <DialogTitle className="text-2xl font-black tracking-tight uppercase text-white">
                Edit KYC Record
              </DialogTitle>
              <p className="text-olive-100 text-sm font-medium mt-1">
                ID: {editRow?.id} — {editRow?.["Product name"] || "—"}
              </p>
            </DialogHeader>
          </div>
          <div className="p-8 space-y-5 bg-white">
            <FormFields
              form={editForm}
              onChange={(key, val) =>
                setEditForm((prev) => handleFieldChange(prev, key, val))
              }
            />
            <div className="flex gap-3 pt-2">
              <Button
                variant="ghost"
                onClick={closeEdit}
                className="flex-1 h-12 rounded-2xl font-bold uppercase tracking-widest text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving}
                className="flex-[2] h-12 rounded-2xl bg-olive-700 hover:bg-olive-800 text-white font-black uppercase tracking-widest shadow-xl shadow-olive-700/20"
              >
                {saving ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
