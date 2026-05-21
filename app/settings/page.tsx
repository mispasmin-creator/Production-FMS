// app/settings/page.tsx
"use client"

import React, { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Settings, Shield, Key, Plus, Trash2, Edit, Loader2 } from "lucide-react"
import { useAuth } from "@/lib/auth"
import { supabase } from "@/lib/supabase"
import { cn } from "@/lib/utils" // Import cn for conditional class styling

// --- Type Definitions for this page ---
interface User {
  id: string;
  username: string;
  role: string;
  permissions: string[];
  firm?: string;
}

interface Page {
  pageid: string;
  pagename: string;
}

interface ConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  title: string;
  description: string;
  isSubmitting: boolean;
}

// --- Confirmation Dialog Component for Deleting Users ---
const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({ open, onOpenChange, onConfirm, title, description, isSubmitting }) => (
    <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="bg-white"> {/* White background for dialog */}
            <DialogHeader>
                <DialogTitle>{title}</DialogTitle>
                <DialogDescription>{description}</DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:justify-end">
                <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>Cancel</Button>
                <Button variant="destructive" onClick={onConfirm} disabled={isSubmitting} className="bg-olive-600 text-white hover:bg-olive-700"> {/* Light olive delete button */}
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                    Confirm Delete
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
);


export default function SettingsPage() {
  const { user, allUsers, roles, pages, addUser, updateUser, deleteUser, isAuthLoading } = useAuth()
  
  const [message, setMessage] = useState("")
  const [messageType, setMessageType] = useState<"success" | "error">("success")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isAddUserOpen, setIsAddUserOpen] = useState(false)
  const [isEditUserOpen, setIsEditUserOpen] = useState(false)
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<string | null>(null);
  
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [newUserData, setNewUserData] = useState({ username: "", password: "", role: "user", permissions: [] as string[], firm: "" })
  const [editUserData, setEditUserData] = useState({ id: "", username: "", password: "", role: "user", permissions: [] as string[], firm: "" })
  const [firmOptions, setFirmOptions] = useState<string[]>([])
  const [newPasswordData, setNewPasswordData] = useState({ newPassword: "", confirmPassword: "" })
  
  const showMessage = (msg: string, type: "success" | "error" = "success") => {
    setMessage(msg)
    setMessageType(type)
    setTimeout(() => setMessage(""), 5000)
  }

  const handleUpdatePassword = async () => {
    if (newPasswordData.newPassword !== newPasswordData.confirmPassword) return showMessage("Passwords do not match.", "error")
    if (newPasswordData.newPassword.length < 6) return showMessage("Password must be at least 6 characters.", "error")
    
    setIsSubmitting(true)
    const result = await updateUser({ id: user!.id, password: newPasswordData.newPassword })
    if (result.success) {
      showMessage("Password updated successfully!")
      setNewPasswordData({ newPassword: "", confirmPassword: "" })
    } else { showMessage(`Error: ${result.error}`, "error") }
    setIsSubmitting(false)
  }

  const handleAddUser = async () => {
    if (!newUserData.username || !newUserData.password) return showMessage("Username and password required.", "error");
    if (allUsers.some(u => u.username.toLowerCase() === newUserData.username.toLowerCase())) return showMessage("Username already exists.", "error");

    setIsSubmitting(true);
    const result = await addUser(newUserData);
    if (result.success) {
      showMessage("User added successfully!");
      setIsAddUserOpen(false);
      setNewUserData({ username: "", password: "", role: "user", permissions: [], firm: "" });
    } else { showMessage(`Error: ${result.error}`, "error"); }
    setIsSubmitting(false);
  }

  // Fetch firm options
  React.useEffect(() => {
    const fetchFirms = async () => {
      try {
        const { data, error } = await supabase.from("master").select("*");
        if (error) {
          console.error("Supabase error fetching master:", error);
          throw error;
        }
        if (data) {
          const uniqueFirms = [
            ...new Set(
              data
                .map((m: any) => String(m["Firm Name"] || "").trim())
                .filter(Boolean),
            ),
          ] as string[];
          setFirmOptions(uniqueFirms.sort((a, b) => a.localeCompare(b)));
        }
      } catch (err: any) {
        console.error(
          "Error fetching firms from master table:", 
          err?.message || err?.details || JSON.stringify(err) || err
        );
      }
    };
    fetchFirms();
  }, []);

  const openEditDialog = (userToEdit: User) => {
    setEditingUser(userToEdit);
    setEditUserData({
      id: userToEdit.id,
      username: userToEdit.username,
      role: userToEdit.role,
      permissions: userToEdit.permissions || [],
      password: "",
      firm: userToEdit.firm || ""
    });
    setIsEditUserOpen(true);
  }

  const handleUpdateUser = async () => {
      if(!editingUser) return;
      setIsSubmitting(true);
      const result = await updateUser(editUserData);
      if(result.success) {
          showMessage("User updated successfully!");
          setIsEditUserOpen(false);
      } else { showMessage(`Error: ${result.error}`, "error"); }
      setIsSubmitting(false);
  }
  
  const handleDeleteClick = (userId: string) => {
      if(userId === user!.id) {
          showMessage("You cannot delete your own account.", "error");
          return;
      }
      setUserToDelete(userId);
      setIsConfirmOpen(true);
  }

  const handleConfirmDelete = async () => {
      if (!userToDelete) return;
      setIsSubmitting(true);
      const result = await deleteUser(userToDelete);
       if(result.success) {
          showMessage("User deleted successfully!");
      } else { showMessage(`Error: ${result.error}`, "error"); }
      setIsConfirmOpen(false);
      setUserToDelete(null);
      setIsSubmitting(false);
  }

  const handlePermissionSelection = (isSelectAll: boolean) => {
    const allPageIds = pages.map(p => p.pageid);
    // FIX: Use separate state setters to allow TypeScript to infer the correct type for prevState
    if (editingUser) {
        setEditUserData(prevState => ({
            ...prevState,
            permissions: isSelectAll ? allPageIds : [],
        }));
    } else {
        setNewUserData(prevState => ({
            ...prevState,
            permissions: isSelectAll ? allPageIds : [],
        }));
    }
  };
  
  if (isAuthLoading) return <div className="p-8 bg-white min-h-screen flex justify-center items-center"><Loader2 className="h-8 w-8 animate-spin text-olive-600"/></div>; {/* White background, olive loader */}
  if (!user) return null;

  return (
    <div className="p-4 sm:p-6 lg:p-8 bg-white min-h-screen"> {/* White background */}
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Settings</h1> {/* Darker text for title */}
      {message && <Alert variant={messageType === 'error' ? 'destructive' : 'default'} className="mb-4 bg-olive-50 text-olive-800 border-olive-200"><AlertDescription>{message}</AlertDescription></Alert>} {/* Light olive alert */}

      <Tabs defaultValue="security" className="w-full">
        <TabsList className={`grid w-full ${user.role?.toLowerCase() === 'admin' ? 'grid-cols-2' : 'grid-cols-1'} bg-olive-50`}> {/* Light olive tab list background */}
          <TabsTrigger value="security" className="data-[state=active]:bg-olive-100 data-[state=active]:text-olive-800"><Key className="mr-2 h-4 w-4 text-olive-600"/>My Security</TabsTrigger> {/* Light olive active tab, olive icon */}
          {user.role?.toLowerCase() === 'admin' && <TabsTrigger value="admin" className="data-[state=active]:bg-olive-100 data-[state=active]:text-olive-800"><Shield className="mr-2 h-4 w-4 text-olive-600"/>Admin Panel</TabsTrigger>} {/* Light olive active tab, olive icon */}
        </TabsList>

        <TabsContent value="security" className="mt-6">
          <Card className="border-none shadow-md"> {/* No border, soft shadow */}
            <CardHeader className="bg-gradient-to-r from-olive-50 to-olive-100 rounded-t-lg"> {/* olive gradient header */}
              <CardTitle className="text-gray-800">Change Your Password</CardTitle> {/* Darker text */}
              <CardDescription className="text-gray-700">Enter and confirm a new password.</CardDescription> {/* Darker text */}
            </CardHeader>
            <CardContent className="space-y-4 p-4 max-w-sm">
                 <div className="space-y-2"><Label htmlFor="newPass">New Password</Label><Input id="newPass" type="password" value={newPasswordData.newPassword} onChange={e => setNewPasswordData({...newPasswordData, newPassword: e.target.value})} className="bg-white border-olive-200 focus:ring-olive-400"/></div> {/* Light olive input */}
                 <div className="space-y-2"><Label htmlFor="confirmPass">Confirm New Password</Label><Input id="confirmPass" type="password" value={newPasswordData.confirmPassword} onChange={e => setNewPasswordData({...newPasswordData, confirmPassword: e.target.value})} className="bg-white border-olive-200 focus:ring-olive-400"/></div> {/* Light olive input */}
                 <Button onClick={handleUpdatePassword} disabled={isSubmitting} className="bg-olive-600 text-white hover:bg-olive-700"> {/* Light olive button */}
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                    Update My Password
                </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {user.role?.toLowerCase() === 'admin' && (
          <TabsContent value="admin" className="mt-6 space-y-6">
            <Card className="border-none shadow-md"> {/* No border, soft shadow */}
              <CardHeader className="bg-gradient-to-r from-olive-50 to-olive-100 rounded-t-lg"> {/* olive gradient header */}
                <CardTitle className="text-gray-800">User Management</CardTitle> {/* Darker text */}
                <CardDescription className="text-gray-700">Add, edit, or remove users and assign permissions.</CardDescription> {/* Darker text */}
              </CardHeader>
              <CardContent className="p-4">
                <div className="flex justify-end mb-4">
                    <Button onClick={() => setIsAddUserOpen(true)} className="bg-olive-600 text-white hover:bg-olive-700"> {/* Light olive button */}
                        <Plus className="mr-2 h-4 w-4"/> Add User
                    </Button>
                </div>
                <div className="border rounded-lg border-olive-200"> {/* Light olive border for table */}
                    <Table>
                        <TableHeader className="bg-olive-50">
                            <TableRow>
                                <TableHead className="text-gray-700">Username</TableHead>
                                <TableHead className="text-gray-700">Firm</TableHead>
                                <TableHead className="text-gray-700">Role</TableHead>
                                <TableHead className="text-right text-gray-700">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {allUsers.map((u: User) => (
                                <TableRow key={u.id} className="hover:bg-olive-50/50">
                                    <TableCell className="text-gray-700">{u.username}</TableCell>
                                    <TableCell className="text-gray-700">{u.firm || "-"}</TableCell>
                                    <TableCell className="capitalize text-gray-700">{u.role}</TableCell>
                                    <TableCell className="text-right space-x-2">
                                        <Button variant="outline" size="sm" onClick={() => openEditDialog(u)} className="border-olive-300 text-olive-600 hover:bg-olive-100">
                                            <Edit className="h-4 w-4 mr-2"/>Edit
                                        </Button>
                                        <Button variant="destructive" size="sm" onClick={() => handleDeleteClick(u.id)} disabled={u.id === user.id} className="bg-red-500 text-white hover:bg-red-600">
                                            <Trash2 className="h-4 w-4 mr-2"/>Delete
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {/* Add / Edit User Dialog */}
      <Dialog open={isAddUserOpen || isEditUserOpen} onOpenChange={isEditUserOpen ? setIsEditUserOpen : setIsAddUserOpen}>
        <DialogContent className="sm:max-w-2xl bg-white"> {/* White background for dialog */}
          <DialogHeader><DialogTitle>{editingUser ? "Edit User" : "Add New User"}</DialogTitle></DialogHeader>
          <div className="py-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Username</Label><Input value={editingUser ? editUserData.username : newUserData.username} onChange={e => editingUser ? setEditUserData({...editUserData, username: e.target.value}) : setNewUserData({...newUserData, username: e.target.value})} className="bg-white border-olive-200 focus:ring-olive-400"/></div> {/* Light olive input */}
                  <div className="space-y-2"><Label>Password {editingUser ? "(Leave blank to keep same)" : ""}</Label><Input type="password" placeholder="••••••••" value={editingUser ? editUserData.password : newUserData.password} onChange={e => editingUser ? setEditUserData({...editUserData, password: e.target.value}) : setNewUserData({...newUserData, password: e.target.value})} className="bg-white border-olive-200 focus:ring-olive-400"/></div> {/* Light olive input */}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Role</Label>
                    <Select value={editingUser ? editUserData.role : newUserData.role} onValueChange={val => editingUser ? setEditUserData({...editUserData, role: val}) : setNewUserData({...newUserData, role: val})}>
                        <SelectTrigger className="border-olive-200 focus:ring-olive-400"><SelectValue/></SelectTrigger>
                        <SelectContent className="bg-white border-olive-200">
                            {roles.map((r: string) => <SelectItem key={r} value={r} className="capitalize hover:bg-olive-50">{r}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                {(editingUser ? editUserData.role : newUserData.role) === "user" && (
                  <div className="space-y-2"><Label>Firm</Label>
                      <Select value={editingUser ? editUserData.firm : newUserData.firm} onValueChange={val => editingUser ? setEditUserData({...editUserData, firm: val}) : setNewUserData({...newUserData, firm: val})}>
                          <SelectTrigger className="border-olive-200 focus:ring-olive-400"><SelectValue placeholder="Select Firm"/></SelectTrigger>
                          <SelectContent className="bg-white border-olive-200 max-h-40 overflow-y-auto">
                              {firmOptions.map((f: string) => <SelectItem key={f} value={f} className="hover:bg-olive-50">{f}</SelectItem>)}
                          </SelectContent>
                      </Select>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center mb-2">
                  <Label>Page Permissions</Label>
                  <div className="flex items-center gap-2">
                    <Button variant="link" className="p-0 h-auto text-xs text-olive-600 hover:text-olive-800" onClick={() => handlePermissionSelection(true)}>Select All</Button> {/* Light olive link */}
                    <span className="text-gray-300">/</span>
                    <Button variant="link" className="p-0 h-auto text-xs text-olive-600 hover:text-olive-800" onClick={() => handlePermissionSelection(false)}>Deselect All</Button> {/* Light olive link */}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto border rounded-md p-3 border-olive-200 bg-olive-50"> {/* Light olive border and background */}
                    {pages.map((page: Page) => (
                        <div key={page.pageid} className="flex items-center space-x-2">
                        <Checkbox id={`${editingUser ? 'edit' : 'new'}-${page.pageid}`} 
                            checked={(editingUser ? editUserData.permissions : newUserData.permissions).includes(page.pageid)}
                            onCheckedChange={checked => {
                                const currentPerms = editingUser ? editUserData.permissions : newUserData.permissions;
                                const newPerms = !!checked ? [...currentPerms, page.pageid] : currentPerms.filter((p: string) => p !== page.pageid);
                                if(editingUser) { setEditUserData({...editUserData, permissions: newPerms}) }
                                else { setNewUserData({...newUserData, permissions: newPerms}) }
                            }}
                            className={cn("border-olive-400 data-[state=checked]:bg-olive-600 data-[state=checked]:text-white")} // Light olive checkbox
                        /><Label htmlFor={`${editingUser ? 'edit' : 'new'}-${page.pageid}`} className="text-sm font-normal cursor-pointer text-gray-700">{page.pagename}</Label> {/* Darker text */}
                        </div>
                    ))}
                </div>
              </div>
              <Button onClick={editingUser ? handleUpdateUser : handleAddUser} disabled={isSubmitting} className="w-full bg-olive-600 text-white hover:bg-olive-700"> {/* Light olive button */}
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                {editingUser ? "Save Changes" : "Create User"}
              </Button>
          </div>
        </DialogContent>
      </Dialog>
      
      <ConfirmationDialog 
        open={isConfirmOpen} 
        onOpenChange={setIsConfirmOpen}
        onConfirm={handleConfirmDelete}
        title="Are you absolutely sure?"
        description="This action cannot be undone. This will permanently delete the user account."
        isSubmitting={isSubmitting}
      />
    </div>
  )
}
