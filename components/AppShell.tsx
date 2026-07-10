// components/layout/AppShell.tsx
"use client";

import { useAuth, FullPageLoader } from "@/lib/auth";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  Factory,
  ClipboardList,
  FileCheck,
  FlaskConical,
  Beaker,
  CheckSquare,
  Boxes,
  Truck,
  Settings,
  LogOut,
  LayoutDashboard,
  DollarSign,
  Menu,
  X,
  PackagePlus,
  CircleCheckBig,
  Hammer,
  ChevronDown,
  Layers,
  GitMerge,
  BadgeCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// --- Navigation structure ---
const topNavItems = [
  { id: "dashboard", href: "/", label: "Dashboard", icon: LayoutDashboard },
  { id: "orders", href: "/orders", label: "Orders", icon: Truck },
  {
    id: "full-kitting",
    href: "/full-kitting",
    label: "Composition By Lab",
    icon: Boxes,
  },
  {
    id: "pi-approval",
    href: "/pi-approval",
    label: "PI Approval",
    icon: FileCheck,
  },
  {
    id: "management-app",
    href: "/management-app",
    label: "Management App",
    icon: Settings,
  },
  {
    id: "sample-test",
    href: "/sample-test",
    label: "Sample Test",
    icon: Beaker,
  },
  {
    id: "job-cards",
    href: "/job-cards",
    label: "Job Cards",
    icon: ClipboardList,
  },
  { id: "production", href: "/production", label: "Production", icon: Factory },
  {
    id: "composition-qc",
    href: "/composition-qc",
    label: "Composition QC",
    icon: GitMerge,
  },
  {
    id: "lab-testing1",
    href: "/lab-testing1",
    label: "Lab Test 1",
    icon: FlaskConical,
  },
  {
    id: "lab-testing2",
    href: "/lab-testing2",
    label: "Lab Test 2",
    icon: Beaker,
  },
  {
    id: "chemical-test",
    href: "/chemical-test",
    label: "Chemical Test",
    icon: CheckSquare,
  },
  { id: "check", href: "/check", label: "Check", icon: FileCheck },
  {
    id: "management",
    href: "/management",
    label: "Management Approval",
    icon: Settings,
  },
  { id: "costing", href: "/costing", label: "Costing", icon: DollarSign },
  { id: "tally", href: "/tally", label: "Tally", icon: Boxes },
  { id: "kyc", href: "/kyc", label: "KYC", icon: BadgeCheck },
];

const sfNavItems = [
  {
    id: "sf-production",
    href: "/sf-production",
    label: "SF Production",
    icon: PackagePlus,
  },
  {
    id: "sfjob-card",
    href: "/sfjob-card",
    label: "Job Card Planning",
    icon: ClipboardList,
  },
  {
    id: "production-entry",
    href: "/sfproduction-entry",
    label: "Production Entry",
    icon: FileCheck,
  },
  { id: "crushing", href: "/crushing", label: "Crushing", icon: Hammer },
  {
    id: "tally_entry",
    href: "/tally_entry",
    label: "Tally Entry",
    icon: CircleCheckBig,
  },
];

const sfHrefs = sfNavItems.map((i) => i.href);

// --- Sidebar Component ---
function Sidebar({
  isMinimized,
  toggleMinimize,
}: {
  isMinimized: boolean;
  toggleMinimize: () => void;
}) {
  const pathname = usePathname();
  const { logout, user, pages } = useAuth();

  // Access Control Logic - Normalize permissions to IDs
  const userPermissions = useMemo(() => {
    if (!user) return [];
    return user.permissions.map((p) => {
      // Find the page ID if the permission string is a page name
      const page = pages?.find((pg) => pg.pagename === p || pg.pageid === p);
      return page ? page.pageid : p;
    });
  }, [user, pages]);

  const filteredTopNav = useMemo(() => {
    if (!user) return [];
    if (
      user.role?.toLowerCase() === "admin" &&
      user.username.toLowerCase() === "admin"
    )
      return topNavItems;
    return topNavItems.filter((item) => userPermissions.includes(item.id));
  }, [user, userPermissions]);

  const filteredSfNav = useMemo(() => {
    if (!user) return [];
    if (
      user.role?.toLowerCase() === "admin" &&
      user.username.toLowerCase() === "admin"
    )
      return sfNavItems;
    return sfNavItems.filter((item) => userPermissions.includes(item.id));
  }, [user, userPermissions]);

  // Auto-expand if current page is inside the SF group
  const isSfActive = sfHrefs.includes(pathname);
  const [sfOpen, setSfOpen] = useState(isSfActive);

  // Keep open if navigating within SF group
  useEffect(() => {
    if (isSfActive) setSfOpen(true);
  }, [isSfActive]);

  const navLinkClass = (href: string) =>
    cn(
      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150",
      "text-gray-600 hover:bg-olive-50 hover:text-olive-700",
      {
        "bg-olive-700 text-white hover:bg-olive-800 hover:text-white shadow-sm":
          pathname === href,
        "justify-center": isMinimized,
      },
    );

  return (
    <aside
      className={cn(
        "flex flex-col border-r border-gray-100 bg-white transition-all duration-300 ease-in-out h-screen fixed top-0 left-0 z-20 shadow-sm",
        isMinimized ? "-translate-x-full sm:translate-x-0 w-64 sm:w-16" : "translate-x-0 w-64"
      )}
    >
      {/* Header */}
      <div
        className={cn(
          "flex items-center justify-between px-4 py-4 border-b border-gray-100",
          { "justify-center": isMinimized },
        )}
      >
        {!isMinimized && (
          <div className="flex items-center gap-2">
            <img
              src="/Passary-refractories-logo.png"
              alt="Logo"
              className="h-8 w-auto"
              onError={(e) => (e.currentTarget.style.display = "none")}
            />
            <h1 className="text-lg font-bold text-olive-700 tracking-tight"></h1>
          </div>
        )}
        <Button
          variant="ghost"
          size={isMinimized ? "icon" : "sm"}
          onClick={toggleMinimize}
          className="hover:bg-olive-100 text-olive-600"
        >
          {isMinimized ? (
            <Menu className="h-5 w-5" />
          ) : (
            <X className="h-5 w-5" />
          )}
        </Button>
      </div>

      {/* Nav */}
      <nav className="flex-1 flex flex-col gap-0.5 px-2 py-3 overflow-y-auto">
        {/* Regular nav items */}
        {filteredTopNav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            prefetch={false}
            title={isMinimized ? item.label : ""}
            className={navLinkClass(item.href)}
          >
            <item.icon className="h-4 w-4 shrink-0" />
            {!isMinimized && <span className="truncate">{item.label}</span>}
          </Link>
        ))}

        {/* ── Semi Finished Accordion ── */}
        <div className="mt-1">
          {/* Accordion trigger */}
          <button
            onClick={() => !isMinimized && setSfOpen((o) => !o)}
            title={isMinimized ? "Semi Finished" : ""}
            className={cn(
              "w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold transition-all duration-150",
              isSfActive
                ? "text-olive-700 bg-olive-50"
                : "text-gray-500 hover:bg-olive-50 hover:text-olive-700",
              { "justify-center": isMinimized },
            )}
          >
            <Layers className="h-4 w-4 shrink-0" />
            {!isMinimized && (
              <>
                <span className="flex-1 text-left truncate">Semi Finished</span>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 shrink-0 transition-transform duration-300",
                    sfOpen ? "rotate-180" : "rotate-0",
                  )}
                />
              </>
            )}
          </button>

          {/* Accordion body — smooth height animation */}
          <div
            className={cn(
              "overflow-hidden transition-all duration-300 ease-in-out",
              sfOpen && !isMinimized
                ? "max-h-96 opacity-100"
                : "max-h-0 opacity-0",
            )}
          >
            <div className="ml-3 pl-3 border-l-2 border-olive-100 mt-1 flex flex-col gap-0.5">
              {filteredSfNav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch={false}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150",
                    pathname === item.href
                      ? "bg-olive-700 text-white shadow-sm"
                      : "text-gray-600 hover:bg-olive-50 hover:text-olive-700",
                  )}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Settings — pinned at bottom of nav */}
        <div className="mt-auto pt-2 border-t border-gray-100">
          <Link
            href="/settings"
            prefetch={false}
            title={isMinimized ? "Settings" : ""}
            className={navLinkClass("/settings")}
          >
            <Settings className="h-4 w-4 shrink-0" />
            {!isMinimized && <span className="truncate">Settings</span>}
          </Link>
        </div>
      </nav>

      {/* Footer — logout + user */}
      <div className="p-3 border-t border-gray-100">
        <Button
          variant="ghost"
          className={cn(
            "w-full justify-start gap-3 hover:bg-red-50 text-gray-500 hover:text-red-600 rounded-lg",
            { "justify-center": isMinimized },
          )}
          onClick={logout}
        >
          <LogOut className="h-4 w-4" />
          {!isMinimized && "Logout"}
        </Button>
        {user && !isMinimized && (
          <p className="mt-2 text-xs text-center text-gray-400">
            Logged in as{" "}
            <span className="font-semibold text-olive-600">
              {user.username}
            </span>
          </p>
        )}
      </div>

      {/* Branding footer */}
      {!isMinimized && (
        <div className="w-full px-4 py-3 text-center text-xs text-white bg-gradient-to-r from-olive-700 to-olive-800">
          Powered by{" "}
          <Link
            href="https://www.botivate.in/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-white hover:underline font-semibold"
          >
            Botivate
          </Link>
        </div>
      )}
    </aside>
  );
}

// --- AppShell ---
export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, isAuthLoading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [isSidebarMinimized, setIsSidebarMinimized] = useState(false);

  const toggleSidebar = () => setIsSidebarMinimized((v) => !v);

  useEffect(() => {
    if (isAuthLoading) return;
    const isAuthPage = pathname === "/login";
    if (!user && !isAuthPage) router.push("/login");
    if (user && isAuthPage) router.push("/");
  }, [user, isAuthLoading, pathname, router]);

  useEffect(() => {
    // Whenever pathname changes, minimize sidebar on mobile screens
    if (typeof window !== "undefined" && window.innerWidth < 640) {
      setIsSidebarMinimized(true);
    }
  }, [pathname]);

  if (isAuthLoading || (!user && pathname !== "/login")) {
    return <FullPageLoader />;
  }

  if (pathname === "/login") {
    return <>{children}</>;
  }

  return (
    <div className="flex">
      {/* Backdrop overlay for mobile view when sidebar is open */}
      {!isSidebarMinimized && (
        <div
          className="sm:hidden fixed inset-0 bg-black/40 z-10 transition-opacity"
          onClick={toggleSidebar}
        />
      )}

      {/* Floating hamburger button for mobile view when sidebar is minimized */}
      {isSidebarMinimized && (
        <button
          onClick={toggleSidebar}
          className="sm:hidden fixed top-4 left-4 z-30 p-2 rounded-lg bg-white border border-gray-200 text-slate-700 shadow-md hover:bg-slate-50 transition-colors"
        >
          <Menu className="h-5 w-5" />
        </button>
      )}

      <Sidebar
        isMinimized={isSidebarMinimized}
        toggleMinimize={toggleSidebar}
      />
      <main
        className={cn(
          "flex-1 bg-gray-50 p-4 sm:p-6 lg:p-8 transition-all duration-300 ease-in-out min-h-screen min-w-0 max-w-full overflow-x-hidden",
          isSidebarMinimized ? "ml-0 sm:ml-16" : "ml-0 sm:ml-64",
        )}
      >
        {children}
      </main>
    </div>
  );
}
