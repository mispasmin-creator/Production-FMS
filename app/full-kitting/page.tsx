"use client"

import dynamic from "next/dynamic"
import { Loader2 } from "lucide-react"

// Dynamically import the content component with SSR disabled
const FullKittingContent = dynamic(() => import("./full-kitting-content"), {
  ssr: false,
  loading: () => (
    <div className="flex justify-center items-center h-screen">
      <Loader2 className="h-12 w-12 animate-spin text-olive-600" />
      <p className="ml-3 text-sm text-slate-500 font-medium">Loading Full Kitting...</p>
    </div>
  ),
})

export default function FullKittingPage() {
  return <FullKittingContent />
}

