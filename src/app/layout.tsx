import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "ربات هوشمند بازنشر فری‌فایر و قیمت طلا",
  description:
    "ربات تلگرامی حرفه‌ای برای بازنشر خودکار پست‌های مرتبط با فری‌فایر و قیمت طلا با تحلیل هوش مصنوعی Gemini",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fa" dir="rtl">
      <body className="bg-slate-950 text-slate-100 antialiased">{children}</body>
    </html>
  );
}
