import { db } from "@/db";
import { destinationChannels, processedPosts, sourceChannels } from "@/db/schema";
import { and, desc, eq, sql } from "drizzle-orm";
import { getSettings } from "@/lib/settings";
import { getMe, getWebhookInfo } from "@/lib/telegram";

export const dynamic = "force-dynamic";

async function countRows(
  table: typeof processedPosts,
  status?: "posted" | "skipped" | "error" | "pending_review" | "rejected",
) {
  const rows = status
    ? await db.select({ c: sql<number>`count(*)` }).from(table).where(eq(table.status, status))
    : await db.select({ c: sql<number>`count(*)` }).from(table);
  return Number(rows[0]?.c ?? 0);
}

export default async function DashboardPage() {
  const settings = await getSettings();

  const [
    freefireSourceCount,
    goldSourceCount,
    postedCount,
    skippedCount,
    errorCount,
    pendingCount,
    recentPosts,
  ] = await Promise.all([
    db.select({ c: sql<number>`count(*)` }).from(sourceChannels).where(eq(sourceChannels.purpose, "freefire")),
    db.select({ c: sql<number>`count(*)` }).from(sourceChannels).where(eq(sourceChannels.purpose, "gold")),
    countRows(processedPosts, "posted"),
    countRows(processedPosts, "skipped"),
    countRows(processedPosts, "error"),
    countRows(processedPosts, "pending_review"),
    db.select().from(processedPosts).orderBy(desc(processedPosts.createdAt)).limit(8),
  ]);

  let botStatus: { connected: boolean; username?: string } = { connected: false };
  let webhookStatus: { configured: boolean; pending?: number; lastError?: string } = { configured: false };

  if (settings.botToken) {
    const me = await getMe(settings.botToken);
    if (me.ok && me.result) {
      botStatus = { connected: true, username: me.result.username };
    }
    const info = await getWebhookInfo(settings.botToken);
    if (info.ok && info.result) {
      webhookStatus = {
        configured: Boolean(info.result.url),
        pending: info.result.pending_update_count,
        lastError: info.result.last_error_message,
      };
    }
  }

  const destCount = await db.select({ c: sql<number>`count(*)` }).from(destinationChannels);

  const cards = [
    { label: "پست‌های منتشرشده", value: postedCount, color: "from-emerald-500 to-teal-400", icon: "✅" },
    { label: "پست‌های نامرتبط (رد شده)", value: skippedCount, color: "from-slate-500 to-slate-400", icon: "🚫" },
    { label: "در انتظار تایید دستی", value: pendingCount, color: "from-amber-500 to-yellow-400", icon: "🕓" },
    { label: "خطاها", value: errorCount, color: "from-rose-500 to-red-400", icon: "⚠️" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">داشبورد</h1>
        <p className="mt-1 text-sm text-slate-400">وضعیت کلی ربات و آمار فعالیت‌ها</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <p className="text-sm text-slate-400">وضعیت اتصال ربات</p>
          <p className={`mt-2 text-lg font-bold ${botStatus.connected ? "text-emerald-400" : "text-rose-400"}`}>
            {botStatus.connected ? `✅ متصل (@${botStatus.username})` : "❌ متصل نیست — توکن را در تنظیمات وارد کنید"}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <p className="text-sm text-slate-400">وضعیت وب‌هوک</p>
          <p className={`mt-2 text-lg font-bold ${webhookStatus.configured ? "text-emerald-400" : "text-rose-400"}`}>
            {webhookStatus.configured ? "✅ فعال" : "❌ تنظیم نشده — از صفحه تنظیمات فعال کنید"}
          </p>
          {webhookStatus.lastError && (
            <p className="mt-1 text-xs text-rose-400">آخرین خطا: {webhookStatus.lastError}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <div className={`mb-3 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br ${card.color} text-lg`}>
              {card.icon}
            </div>
            <p className="text-2xl font-bold text-white">{card.value}</p>
            <p className="mt-1 text-xs text-slate-400">{card.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <p className="text-sm text-slate-400">کانال‌های منبع فری‌فایر</p>
          <p className="mt-2 text-2xl font-bold text-white">{freefireSourceCount[0]?.c ?? 0}</p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <p className="text-sm text-slate-400">کانال‌های منبع قیمت طلا</p>
          <p className="mt-2 text-2xl font-bold text-white">{goldSourceCount[0]?.c ?? 0}</p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <p className="text-sm text-slate-400">کانال‌های مقصد تنظیم‌شده</p>
          <p className="mt-2 text-2xl font-bold text-white">{destCount[0]?.c ?? 0}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <h2 className="mb-4 text-lg font-bold text-white">آخرین فعالیت‌ها</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-right text-slate-400">
                <th className="py-2 pr-2">موضوع</th>
                <th className="py-2">وضعیت</th>
                <th className="py-2">دلیل</th>
                <th className="py-2">زمان</th>
              </tr>
            </thead>
            <tbody>
              {recentPosts.map((p) => (
                <tr key={p.id} className="border-b border-slate-800/60">
                  <td className="py-2 pr-2">{p.purpose === "freefire" ? "🎮 فری‌فایر" : "🪙 طلا"}</td>
                  <td className="py-2">
                    <StatusBadge status={p.status} />
                  </td>
                  <td className="max-w-[260px] truncate py-2 text-slate-400">{p.reason || "-"}</td>
                  <td className="py-2 text-slate-500">{new Date(p.createdAt).toLocaleString("fa-IR")}</td>
                </tr>
              ))}
              {recentPosts.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-slate-500">
                    هنوز هیچ پستی ثبت نشده است.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    posted: { label: "منتشر شد", cls: "bg-emerald-500/15 text-emerald-400" },
    skipped: { label: "نامرتبط", cls: "bg-slate-500/15 text-slate-300" },
    error: { label: "خطا", cls: "bg-rose-500/15 text-rose-400" },
    pending_review: { label: "در انتظار تایید", cls: "bg-amber-500/15 text-amber-400" },
    rejected: { label: "رد شده", cls: "bg-slate-600/15 text-slate-400" },
  };
  const item = map[status] ?? { label: status, cls: "bg-slate-500/15 text-slate-300" };
  return <span className={`rounded-full px-2 py-1 text-xs ${item.cls}`}>{item.label}</span>;
}
