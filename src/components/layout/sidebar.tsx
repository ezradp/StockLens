"use client";

import {
  BookOpen,
  Calculator,
  FileUp,
  GitCompare,
  LayoutDashboard,
  Search,
  Settings,
  SlidersHorizontal,
  Star,
  TrendingUp,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/overview", label: "Overview", icon: LayoutDashboard },
  { href: "/explorer", label: "Stock Explorer", icon: Search },
  { href: "/screener", label: "Screener", icon: SlidersHorizontal },
  { href: "/compare", label: "Compare Stocks", icon: GitCompare },
  { href: "/portfolio", label: "Portfolio", icon: Wallet },
  { href: "/watchlists", label: "Watchlists", icon: Star },
  { href: "/valuation", label: "DCF Valuation", icon: Calculator },
  { href: "/research", label: "Saved Research", icon: BookOpen },
  { href: "/import", label: "Data Import", icon: FileUp },
  { href: "/settings", label: "Settings", icon: Settings },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function Brand({ className }: { className?: string }) {
  return (
    <Link href="/overview" className={cn("flex items-center gap-2 px-2 py-1", className)}>
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground">
        <TrendingUp className="h-4 w-4" aria-hidden="true" />
      </span>
      <span className="text-sm font-semibold tracking-tight">StockLens</span>
      <Badge variant="outline" className="ml-1 text-[10px]">
        MVP
      </Badge>
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();

  return (
    <>
      {/* Desktop: sidebar tetap di kiri (PRD §6) */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-border bg-card md:flex">
        <div className="px-3 py-4">
          <Brand />
        </div>
        <nav aria-label="Navigasi utama" className="flex-1 overflow-y-auto px-2 pb-6">
          <ul className="space-y-1">
            {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
              const active = isActive(pathname, href);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                      active
                        ? "bg-muted font-medium text-foreground"
                        : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="border-t border-border px-4 py-3">
          <p className="text-[10px] leading-4 text-muted-foreground">
            StockLens — zero-cost investment research
            <br />
            Fondasi · {process.env.npm_package_version}
          </p>
        </div>
      </aside>

      {/* Mobile: bar atas dengan ikon navigasi dapat digulir */}
      <header className="sticky top-0 z-40 border-b border-border bg-card md:hidden">
        <div className="flex items-center justify-between px-3 py-2">
          <Brand />
        </div>
        <nav
          aria-label="Navigasi utama (mobile)"
          className="flex gap-1 overflow-x-auto px-2 pb-2"
        >
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                title={label}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs",
                  active ? "bg-muted text-foreground" : "text-muted-foreground",
                )}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                {label}
              </Link>
            );
          })}
        </nav>
      </header>
    </>
  );
}
