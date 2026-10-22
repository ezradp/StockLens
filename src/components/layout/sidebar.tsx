"use client";

import {
  BookOpen,
  Calculator,
  FileUp,
  GitCompare,
  LayoutDashboard,
  LogOut,
  Search,
  Settings,
  SlidersHorizontal,
  Star,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOutAction } from "@/app/(auth)/actions";
import { Brand } from "@/components/layout/brand";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  /** Label ringkas untuk header mobile (tanpa ikon). */
  shortLabel?: string;
  icon: LucideIcon;
}

interface NavGroup {
  label?: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    items: [
      { href: "/overview", label: "Overview", icon: LayoutDashboard },
      { href: "/explorer", label: "Stock Explorer", shortLabel: "Explorer", icon: Search },
      { href: "/screener", label: "Screener", icon: SlidersHorizontal },
      { href: "/compare", label: "Compare Stocks", shortLabel: "Compare", icon: GitCompare },
    ],
  },
  {
    label: "Portofolio",
    items: [
      { href: "/portfolio", label: "Portfolio", icon: Wallet },
      { href: "/watchlists", label: "Watchlists", icon: Star },
    ],
  },
  {
    label: "Analisis",
    items: [
      { href: "/valuation", label: "DCF Valuation", shortLabel: "DCF", icon: Calculator },
      { href: "/research", label: "Saved Research", shortLabel: "Riset", icon: BookOpen },
    ],
  },
];

const UTILITY_ITEMS: NavItem[] = [
  { href: "/import", label: "Data Import", shortLabel: "Import", icon: FileUp },
  { href: "/settings", label: "Settings", icon: Settings },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Satu baris nav: label putih + garis aksen 1px selebar label saat aktif. */
function NavLink({
  item,
  active,
  compact = false,
}: {
  item: NavItem;
  active: boolean;
  compact?: boolean;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-9 items-center gap-2.5 rounded-[3px] px-2 text-[13px] transition-colors",
        compact ? "h-8 shrink-0 px-0 text-[12px]" : "",
        active
          ? "text-foreground"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      <Icon
        className={cn(
          "h-[15px] w-[15px] shrink-0",
          compact ? "hidden" : "",
          active ? "text-foreground" : "text-muted-foreground",
        )}
        strokeWidth={1.6}
        aria-hidden="true"
      />
      <span className={cn("inline-block leading-5", active && "rule-active")}>
        {compact ? (item.shortLabel ?? item.label) : item.label}
      </span>
    </Link>
  );
}

export function Sidebar({ email }: { email: string | null }) {
  const pathname = usePathname();

  return (
    <>
      {/* Desktop: sidebar berlabel — 10 tujuan tetap terbaca tanpa tooltip. */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[var(--sidebar-width)] flex-col border-r border-border bg-background md:flex">
        <div className="px-4 pb-3 pt-5">
          <Brand />
          <p className="mt-1.5 pl-[30px] text-[11px] leading-4 text-muted-foreground">
            Riset saham AS · SEC EDGAR
          </p>
        </div>

        <nav aria-label="Navigasi utama" className="flex-1 overflow-y-auto px-2 pb-4">
          {NAV_GROUPS.map((group, index) => (
            <div key={group.label ?? `group-${index}`}>
              {group.label ? (
                <p className="px-2 pb-1 pt-4 text-[11px] font-normal text-muted-foreground">
                  {group.label}
                </p>
              ) : (
                <div className="mb-1 mt-2 h-px bg-rule" aria-hidden="true" />
              )}
              <ul>
                {group.items.map((item) => (
                  <li key={item.href}>
                    <NavLink item={item} active={isActive(pathname, item.href)} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="mt-auto border-t border-rule px-2 py-2">
          <ul>
            {UTILITY_ITEMS.map((item) => (
              <li key={item.href}>
                <NavLink item={item} active={isActive(pathname, item.href)} />
              </li>
            ))}
          </ul>
        </div>

        {email ? (
          <div className="flex items-center justify-between gap-2 border-t border-border px-4 py-3">
            <span className="min-w-0 truncate text-[11px] text-muted-foreground" title={email}>
              {email}
            </span>
            <form action={signOutAction}>
              <button
                type="submit"
                className="flex cursor-pointer items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
              >
                <LogOut className="h-3.5 w-3.5" strokeWidth={1.6} aria-hidden="true" />
                Keluar
              </button>
            </form>
          </div>
        ) : null}
      </aside>

      {/* Mobile: satu baris brand + nav yang digulir (tanpa laci/overlay). */}
      <header className="sticky top-0 z-40 border-b border-border bg-background md:hidden">
        <div className="flex h-12 items-center justify-between px-4">
          <Brand />
          {email ? (
            <form action={signOutAction}>
              <button
                type="submit"
                aria-label="Keluar"
                className="flex h-8 items-center gap-1.5 px-1 text-[11px] text-muted-foreground"
              >
                <LogOut className="h-4 w-4" strokeWidth={1.6} aria-hidden="true" />
                Keluar
              </button>
            </form>
          ) : null}
        </div>
        <nav
          aria-label="Navigasi utama (mobile)"
          className="flex flex-wrap gap-x-4 gap-y-1 px-4 pb-2"
        >
          {[...NAV_GROUPS.flatMap((group) => group.items), ...UTILITY_ITEMS].map((item) => (
            <NavLink key={item.href} item={item} active={isActive(pathname, item.href)} compact />
          ))}
        </nav>
      </header>
    </>
  );
}
