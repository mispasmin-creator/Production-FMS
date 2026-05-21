"use client"

import React, { useState, useEffect, useCallback, useMemo } from "react"
import { 
  Loader2, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  Eye, 
  Upload, 
  Image as ImageIcon,
  FlaskConical,
  ArrowLeft,
  ShieldCheck,
  Check,
  Beaker
} from "lucide-react"
import { format } from "date-fns"
import { supabase } from "@/lib/supabase"
import { Toaster } from "@/components/ui/toaster"
import { useToast } from "@/components/ui/use-toast"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

// --- Constants ---
const COSTING_RESPONSE_TABLE = "costing_response"

interface SampleItem {
  id: number
  compositionNo: string
  orderNo: string
  productName: string
  status: string
  managementApprovalType: string
  sampleTestStatus?: string
  sampleTestImageUrl?: string
  sampleTestRemarks?: string
  sampleTestCompletedAt?: string
  // Composition for display
  rmValues: { rm: string; qty: number; cost: number }[]
}

export default function SampleTestPage() {
  const { toast } = useToast()
  const [pendingItems, setPendingItems] = useState<SampleItem[]>([])
  const [historyItems, setHistoryItems] = useState<SampleItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState("pending")

  // Modal / Action state
  const [selectedItem, setSelectedItem] = useState<SampleItem | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [remarks, setRemarks] = useState("")
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data, error: dbErr } = await supabase
        .from(COSTING_RESPONSE_TABLE)
        .select("*")
        .or(`Status.eq.Sample Test Pending,Status.eq.Management Approved`)
        .order("id", { ascending: false })

      if (dbErr) throw dbErr

      const mapped: SampleItem[] = (data || []).map((row) => {
        const rmValues: { rm: string; qty: number; cost: number }[] = []
        for (let i = 1; i <= 20; i++) {
          const rm = row[`RM${i}`]
          const qty = row[`QTY${i}`]
          const cost = row[`COST${i}`]
          if (rm && String(rm).trim()) {
            rmValues.push({
              rm: String(rm),
              qty: Number(qty || 0),
              cost: Number(cost || 0)
            })
          }
        }
        return {
          id: row.id,
          compositionNo: row["Composition No."] || "",
          orderNo: row["Order No."] || "",
          productName: row["product name"] || "",
          status: row.Status || "",
          managementApprovalType: row["Management Approval Type"] || "",
          sampleTestStatus: row["Sample Test Status"],
          sampleTestImageUrl: row["Sample Test Image URL"],
          sampleTestRemarks: row["Sample Test Remarks"],
          sampleTestCompletedAt: row["Sample Test Completed At"] 
            ? format(new Date(row["Sample Test Completed At"]), "dd/MM/yy HH:mm")
            : undefined,
          rmValues
        }
      })

      // Items that are either "Sample Test Pending" OR items that went through sample test
      setPendingItems(mapped.filter(i => i.status === "Sample Test Pending"))
      setHistoryItems(mapped.filter(i => i.status === "Management Approved" && i.managementApprovalType === "Make a sample Test"))

    } catch (err: any) {
      setError(`Failed to load data: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const openTestDialog = (item: SampleItem) => {
    setSelectedItem(item)
    setRemarks(item.sampleTestRemarks || "")
    setImageFile(null)
    setImagePreview(item.sampleTestImageUrl || null)
    setIsDialogOpen(true)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setImageFile(file)
      const reader = new FileReader()
      reader.onloadend = () => setImagePreview(reader.result as string)
      reader.readAsDataURL(file)
    }
  }

  const handleSubmit = async (result: "OK" | "Not OK") => {
    if (!selectedItem) return
    if (!imageFile && !imagePreview) {
      toast({ title: "Image Required", description: "Please upload a sample test image.", variant: "destructive" })
      return
    }

    setIsSubmitting(true)
    try {
      let publicUrl = imagePreview

      // 1. Upload Image if new file selected
      if (imageFile) {
        const fileExt = imageFile.name.split('.').pop()
        const fileName = `${selectedItem.compositionNo}_${Date.now()}.${fileExt}`
        const filePath = `samples/${fileName}`

        const { error: uploadError } = await supabase.storage
          .from('sample-tests')
          .upload(filePath, imageFile)

        if (uploadError) throw uploadError

        const { data: urlData } = supabase.storage
          .from('sample-tests')
          .getPublicUrl(filePath)
        
        publicUrl = urlData.publicUrl
      }

      // 2. Update Record
      const updatePayload: any = {
        "Sample Test Status": result,
        "Sample Test Remarks": remarks,
        "Sample Test Image URL": publicUrl,
        "Sample Test Completed At": new Date().toISOString()
      }

      if (result === "OK") {
        updatePayload.Status = "Management Approved"
      } else {
        // If Not OK, it stays in "Sample Test Pending" for another try
        updatePayload.Status = "Sample Test Pending"
      }

      const { error: updateErr } = await supabase
        .from(COSTING_RESPONSE_TABLE)
        .update(updatePayload)
        .eq("id", selectedItem.id)

      if (updateErr) throw updateErr

      toast({ 
        title: result === "OK" ? "Test Passed" : "Test Failed", 
        description: result === "OK" ? "Item moved to Job Cards." : "Item remains in pending list.",
        variant: result === "OK" ? "default" : "destructive"
      })

      setIsDialogOpen(false)
      loadData()
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-screen max-w-full overflow-x-hidden">
      <Toaster />
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Beaker className="h-6 w-6 text-olive-600" />
            Sample Test
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Verify products with physical sample tests before production.</p>
        </div>
        <div className="flex gap-2">
           <Badge variant="outline" className="bg-olive-50 px-3 py-1 text-sm shadow-sm border-olive-100 text-olive-700">
             <div className="w-2 h-2 rounded-full bg-olive-500 mr-2 animate-pulse" />
             {pendingItems.length} Pending
           </Badge>
        </div>
      </div>

      <Card className="border-none shadow-sm bg-white">
        <CardContent className="p-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full max-w-md grid-cols-2 mb-8 p-1 bg-slate-100 rounded-xl">
              <TabsTrigger value="pending" className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-olive-700 data-[state=active]:shadow-sm transition-all">
                Pending Tests
              </TabsTrigger>
              <TabsTrigger value="history" className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-olive-700 data-[state=active]:shadow-sm transition-all">
                Test History
              </TabsTrigger>
            </TabsList>

            <TabsContent value="pending" className="mt-0">
               {loading ? (
                 <div className="flex justify-center items-center py-20"><Loader2 className="h-10 w-10 animate-spin text-olive-600" /></div>
               ) : pendingItems.length === 0 ? (
                 <div className="text-center py-20 border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50/50">
                    <CheckCircle2 className="h-16 w-16 text-slate-300 mx-auto mb-4" />
                    <p className="text-slate-500 text-lg font-medium">All clear! No sample tests pending.</p>
                 </div>
               ) : (
                 <div className="overflow-hidden border border-slate-100 rounded-2xl shadow-sm">
                   <Table>
                     <TableHeader className="bg-slate-50/80">
                       <TableRow>
                         <TableHead>Composition No.</TableHead>
                         <TableHead>Order No.</TableHead>
                         <TableHead>Product Name</TableHead>
                         <TableHead className="text-right">Action</TableHead>
                       </TableRow>
                     </TableHeader>
                     <TableBody>
                       {pendingItems.map((item) => (
                         <TableRow key={item.id} className="hover:bg-slate-50/50 transition-colors">
                           <TableCell className="font-bold text-olive-600">{item.compositionNo}</TableCell>
                           <TableCell className="font-medium text-slate-700">{item.orderNo}</TableCell>
                           <TableCell className="font-semibold text-slate-900">{item.productName}</TableCell>
                           <TableCell className="text-right">
                             <Button 
                               onClick={() => openTestDialog(item)}
                               className="bg-olive-600 hover:bg-olive-700 text-white shadow-lg shadow-olive-100"
                             >
                               Perform Test
                             </Button>
                           </TableCell>
                         </TableRow>
                       ))}
                     </TableBody>
                   </Table>
                 </div>
               )}
            </TabsContent>

            <TabsContent value="history" className="mt-0">
               <div className="overflow-hidden border border-slate-100 rounded-2xl shadow-sm">
                 <Table>
                   <TableHeader className="bg-slate-50/80">
                     <TableRow>
                       <TableHead>Composition No.</TableHead>
                       <TableHead>Order No.</TableHead>
                       <TableHead>Result</TableHead>
                       <TableHead>Completed At</TableHead>
                       <TableHead className="text-right">Details</TableHead>
                     </TableRow>
                   </TableHeader>
                   <TableBody>
                     {historyItems.map((item) => (
                       <TableRow key={item.id}>
                         <TableCell className="font-bold text-slate-600">{item.compositionNo}</TableCell>
                         <TableCell className="text-slate-600">{item.orderNo}</TableCell>
                         <TableCell>
                            <Badge className={cn("px-2 py-1", item.sampleTestStatus === "OK" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700")}>
                              {item.sampleTestStatus}
                            </Badge>
                         </TableCell>
                         <TableCell className="text-slate-500">{item.sampleTestCompletedAt}</TableCell>
                         <TableCell className="text-right">
                            <Button variant="ghost" size="icon" onClick={() => openTestDialog(item)}>
                               <Eye className="h-5 w-5 text-slate-400" />
                            </Button>
                         </TableCell>
                       </TableRow>
                     ))}
                   </TableBody>
                 </Table>
               </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* --- TEST DIALOG --- */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold flex items-center gap-2">
              {selectedItem?.status === "Sample Test Pending" ? "Submit Sample Test" : "Sample Test Details"}
            </DialogTitle>
            <DialogDescription>
              Order: {selectedItem?.orderNo} | Product: {selectedItem?.productName}
            </DialogDescription>
          </DialogHeader>

          {selectedItem && (
            <div className="space-y-6 pt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left: Composition Info */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest">Composition</h3>
                  <div className="grid grid-cols-1 gap-2">
                    {selectedItem.rmValues.map((pair, idx) => (
                      <div key={idx} className="bg-slate-50 p-2 rounded-lg border border-slate-100 flex justify-between">
                         <span className="text-xs text-slate-600 truncate max-w-[120px]">{pair.rm}</span>
                         <span className="text-xs font-bold text-slate-900">{pair.qty}%</span>
                      </div>
                    ))}
                  </div>
                  <div className="pt-4">
                    <Label className="text-sm font-bold text-slate-500 uppercase tracking-widest block mb-2">Remarks</Label>
                    <Textarea 
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                      placeholder="Add any observations from the sample test..."
                      disabled={selectedItem.status !== "Sample Test Pending"}
                      className="bg-white"
                    />
                  </div>
                </div>

                {/* Right: Image Upload */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest">Sample Image</h3>
                  <div className="relative aspect-square rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 flex flex-col items-center justify-center overflow-hidden group">
                     {imagePreview ? (
                       <>
                         <img src={imagePreview} alt="Sample" className="w-full h-full object-cover" />
                         {selectedItem.status === "Sample Test Pending" && (
                           <label className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-white font-medium">
                              <Upload className="mr-2 h-5 w-5" /> Change Image
                              <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                           </label>
                         )}
                       </>
                     ) : (
                       <label className="w-full h-full flex flex-col items-center justify-center cursor-pointer p-6 text-center">
                          <ImageIcon className="h-12 w-12 text-slate-300 mb-2" />
                          <span className="text-sm text-slate-500 font-medium">Upload physical sample photograph</span>
                          <span className="text-[10px] text-slate-400 mt-1 uppercase">JPG, PNG up to 5MB</span>
                          <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                       </label>
                     )}
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="mt-6 border-t pt-6 gap-2">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            {selectedItem?.status === "Sample Test Pending" && (
              <>
                <Button 
                  variant="destructive"
                  onClick={() => handleSubmit("Not OK")}
                  disabled={isSubmitting}
                  className="px-6"
                >
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <XCircle className="h-4 w-4 mr-2" />}
                  Result Not OK
                </Button>
                <Button 
                  onClick={() => handleSubmit("OK")}
                  disabled={isSubmitting}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-8"
                >
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                  Result OK
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
