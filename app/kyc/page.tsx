"use client";

import React from "react";
import { BadgeCheck } from "lucide-react";
import KycProductTable from "@/components/KycProductTable";

export default function KycPage() {
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
            Real-time product quality parameters & calculated rates from Purchase-FMS. 
          </p>
        </div>
      </div> 

      {/* ── Real-Time Product Quality Table (LIFT-ACCOUNTS) ── */}
      <KycProductTable />
    </div>
  );
}
