import Link from "next/link";
import type { ReactNode } from "react";
import { logoutAction } from "@/app/admin/actions";

const NAV_ITEMS = [
  { href: "/admin", label: "داشبورد", icon: "📊" },
  { href: "/admin/channels/freefire", label: "کانال‌های فری‌فایر", icon: "🎮" },
  { href: "/admin/channels/gold", label: "کانال‌های قیمت طلا", icon: "🪙" },
  { href: "/admin/review", label: "صف تایید دستی", icon: "🕓" },
  { href: "/admin/logs", label: "گزارش‌ها", icon: "📜" },
  { href: "/admin/settings", label: "تنظیمات", icon: "⚙️" },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div dir="rtl" className="min-h-screen bg-slate-950 text-slate-100">
      <div className="flex min-h-screen">
        <aside className="hidden w-64 flex-col border-l border-slate-800 bg-slate-900/60 p-5 md:flex">
          <div className="mb-8 flex items-center gap-2 px-1">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500 to-amber-400 text-lg">
              🤖
            </div>
            <div>
              <p className="text-sm font-bold text-white">پنل مدیریت ربات</p>
              <p className="text-xs text-slate-500">Free Fire & Gold Bot</p>
            </div>
          </div>
          <nav className="flex flex-1 flex-col gap-1">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-300 transition hover:bg-slate-800 hover:text-white"
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            ))}
          </nav>
          <form action={logoutAction}>
            <button className="mt-4 w-full rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800">
              خروج از حساب
            </button>
          </form>
        </aside>

        <div className="flex-1">
          <header className="flex items-center justify-between border-b border-slate-800 bg-slate-900/40 px-4 py-3 md:hidden">
            <p className="font-bold">پنل مدیریت ربات</p>
            <form action={logoutAction}>
              <button className="rounded-lg border border-slate-700 px-3 py-1 text-xs">خروج</button>
            </form>
          </header>
          <nav className="flex gap-1 overflow-x-auto border-b border-slate-800 bg-slate-900/40 px-3 py-2 md:hidden">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="shrink-0 rounded-lg px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
              >
                {item.icon} {item.label}
              </Link>
            ))}
          </nav>
          <main className="p-4 md:p-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
