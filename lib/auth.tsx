"use client"

import React, { createContext, useState, useContext, useEffect, useMemo, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { supabase } from "@/lib/supabase"

// --- Types and Interfaces ---
interface User {
  id: string
  username: string
  role: string
  permissions: string[]
  firm?: string
}

export const FIRM_MAP: Record<string, string> = {
  "Purab": "PURAB ORDER",
  "Pmmpl": "PMMPL ORDER",
  "Rkl": "RKL ORDER"
};

interface Page {
  pageid: string;
  pagename: string;
}

interface GvizRow {
  c: ({ v: any; f?: string; } | null)[]
}

interface AuthContextType {
  user: User | null
  allUsers: User[]
  roles: string[]
  pages: Page[]
  isAuthLoading: boolean
  isSubmitting: boolean
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>
  logout: () => void
  addUser: (userData: Omit<User, 'id'> & { password?: string }) => Promise<{ success: boolean; error?: string }>
  updateUser: (userData: Partial<User> & { id: string; password?: string }) => Promise<{ success: boolean; error?: string }>
  deleteUser: (userId: string) => Promise<{ success: boolean; error?: string }>
  refreshData: () => void
}

// --- Constants ---
const LOGIN_TABLE = "login"

// --- Hardcoded App Data (Removes Master Sheet Dependency) ---
const ROLES_AVAILABLE = ["admin", "user"];
const PAGES_AVAILABLE = [
  { pageid: "dashboard", pagename: "Dashboard" },
  { pageid: "orders", pagename: "Orders" },
  { pageid: "full-kitting", pagename: "Composition By Lab" },
  { pageid: "pi-approval", pagename: "PI Approval" },
  { pageid: "management-app", pagename: "Management App" },
  { pageid: "sample-test", pagename: "Sample Test" },
  { pageid: "job-cards", pagename: "Job Cards" },
  { pageid: "production", pagename: "Production" },
  { pageid: "composition-qc", pagename: "Composition QC" },
  { pageid: "lab-testing1", pagename: "Lab Test 1" },
  { pageid: "lab-testing2", pagename: "Lab Test 2" },
  { pageid: "chemical-test", pagename: "Chemical Test" },
  { pageid: "check", pagename: "Check" },
  { pageid: "management", pagename: "Management Approval" },
  { pageid: "costing", pagename: "Costing" },
  { pageid: "tally", pagename: "Tally" },
  { pageid: "sf-production", pagename: "SF Production" },
  { pageid: "sfjob-card", pagename: "Job Card Planning" },
  { pageid: "production-entry", pagename: "Production Entry" },
  { pageid: "mark-done", pagename: "Mark Done" },
  { pageid: "crushing", pagename: "Crushing" },
  { pageid: "kyc", pagename: "KYC" },
  { pageid: "settings", pagename: "Settings" },
];


// --- Auth Context ---
const AuthContext = createContext<AuthContextType | undefined>(undefined)

// --- Auth Provider Component ---
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [allUsers, setAllUsers] = useState<User[]>([])
  const [isAuthLoading, setIsAuthLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const router = useRouter()

  const fetchUsers = useCallback(async () => {
    setIsAuthLoading(true);
    try {
      const { data, error } = await supabase
        .from(LOGIN_TABLE)
        .select("*")

      if (error) throw error

      if (data) {
        const users = data.map((row) => ({
          username: row["User name"],
          id: row["ID"],
          role: row["Role"],
          permissions: row["Pages"] ? row["Pages"].toString().split(',').map((p: string) => p.trim()) : [],
          firm: row["Firm"]
        }))
        setAllUsers(users);

        const storedUser = sessionStorage.getItem("user")
        if (storedUser) {
          const parsed = JSON.parse(storedUser);
          const currentUserData = users.find(u => u.id === parsed.id);
          if (currentUserData) {
            setUser(currentUserData);
            sessionStorage.setItem("user", JSON.stringify(currentUserData));
          } else {
            setUser(parsed);
          }
        }
      } else {
        const storedUser = sessionStorage.getItem("user")
        if (storedUser) {
          setUser(JSON.parse(storedUser))
        }
      }

    } catch (error) {
      console.error("Failed to fetch user list from Supabase:", error);
    } finally {
      setIsAuthLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const login = async (username: string, password: string) => {
    setIsSubmitting(true)
    try {
      const { data, error } = await supabase
        .from(LOGIN_TABLE)
        .select("*")
        .ilike('User name', username)
        .eq('Pass', password)
        .maybeSingle()

      if (error) throw new Error("Invalid username or password.");

      if (data) {
        const foundUser: User = {
          username: data["User name"],
          id: data["ID"],
          role: data["Role"],
          permissions: data["Pages"] ? data["Pages"].toString().split(',').map((p: string) => p.trim()) : [],
          firm: data["Firm"]
        };
        setUser(foundUser);
        sessionStorage.setItem("user", JSON.stringify(foundUser));
        router.push("/");
        return { success: true };
      } else {
        return { success: false, error: "Invalid username or password." };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred.";
      return { success: false, error: errorMessage };
    } finally {
      setIsSubmitting(false)
    }
  }

  const addUser = async (userData: Omit<User, 'id'> & { password?: string }) => {
    try {
      const newId = Math.random().toString(36).substr(2, 9);
      const { error } = await supabase
        .from(LOGIN_TABLE)
        .insert([{
          "User name": userData.username,
          "ID": newId,
          "Pass": userData.password || "password123",
          "Role": userData.role,
          "Pages": userData.permissions.join(','),
          "Firm": userData.firm
        }])

      if (error) throw error;
      fetchUsers();
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  const updateUser = async (userData: Partial<User> & { id: string; password?: string }) => {
    try {
      const updatePayload: any = {}
      if (userData.username) updatePayload["User name"] = userData.username;
      if (userData.role) updatePayload["Role"] = userData.role;
      if (userData.permissions) updatePayload["Pages"] = userData.permissions.join(',');
      if (userData.password) updatePayload["Pass"] = userData.password;
      if (userData.firm !== undefined) updatePayload["Firm"] = userData.firm;

      const { error } = await supabase
        .from(LOGIN_TABLE)
        .update(updatePayload)
        .eq('ID', userData.id)

      if (error) throw error;
      fetchUsers();
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  const deleteUser = async (userId: string) => {
    try {
      const { error } = await supabase
        .from(LOGIN_TABLE)
        .delete()
        .eq('ID', userId)

      if (error) throw error;
      fetchUsers();
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  const logout = () => {
    setUser(null)
    sessionStorage.removeItem("user")
    router.push("/login")
  }

  const value = useMemo(
    () => ({
      user,
      allUsers,
      roles: ROLES_AVAILABLE,
      pages: PAGES_AVAILABLE,
      isAuthLoading,
      isSubmitting,
      login,
      logout,
      addUser,
      updateUser,
      deleteUser,
      refreshData: fetchUsers,
    }),
    [user, allUsers, isAuthLoading, isSubmitting, fetchUsers],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// --- Custom Hook for easy context access ---
export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}

// --- App-wide Loading Component ---
export const FullPageLoader = () => (
  <div className="flex h-screen w-screen items-center justify-center bg-background">
    <Loader2 className="h-10 w-10 animate-spin text-primary" />
  </div>
)