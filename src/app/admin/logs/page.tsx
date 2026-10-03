import Link from "next/link";
import { db } from "@/db";
import { processedPosts, sourceChannels } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { deleteLogAction } from "@/app/admin/actions";

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  posted: { label: "منتشر شد", cls: "bg-emerald-500/15 text-emerald-400" },
  skipped: { label: "نامرتبط", cls: "bg-slate-500/15 text-slate-300" },
  error: { label: "خطا", cls: "bg-rose-500/15 text-rose-400" },
  pending_review: { label: "در انتظار", cls: "bg-amber-500/15 text-amber-400" },
  rejected: { label: "رد شده", cls: "bg-slate-600/15 text-slate-400" },
};

export default async function LogsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const validStatuses = ["posted", "skipped", "error", "pending_review", "rejected"] as const;
  type Status = (typeof validStatuses)[number];
  const statusFilter = validStatuses.includes(status as Status) ? (status as Status) : undefined;

  const rows = statusFilter
    ? await db
        .select({
          id: processedPosts.id,
          purpose: processedPosts.purpose,
          status: processedPosts.status,
          reason: processedPosts.reason,
          originalText: processedPosts.originalText,
          createdAt: processedPosts.createdAt,
          sourceTitle: sourceChannels.title,
        })
        .from(processedPosts)
        .leftJoin(sourceChannels, eq(processedPosts.sourceChannelId, sourceChannels.id))
        .where(eq(processedPosts.status, statusFilter))
        .orderBy(desc(processedPosts.createdAt))
        .limit(100)
    : await db
        .select({
          id: processedPosts.id,
          purpose: processedPosts.purpose,
          status: processedPosts.status,
          reason: processedPosts.reason,
          originalText: processedPosts.originalText,
          createdAt: processedPosts.createdAt,
          sourceTitle: sourceChannels.title,
        })
        .from(processedPosts)
        .leftJoin(sourceChannels, eq(processedPosts.sourceChannelId, sourceChannels.id))
        .orderBy(desc(processedPosts.createdAt))
        .limit(100);

  const filters = [
    { key: undefined, label: "همه" },
    { key: "posted", label: "منتشرشده" },
    { key: "skipped", label: "نامرتبط" },
    { key: "error", label: "خطا" },
    { key: "pending_review", label: "در انتظار" },
    { key: "rejected", label: "رد شده" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">گزارش‌ها</h1>
        <p className="mt-1 text-sm text-slate-400">تاریخچه کامل پست‌های بررسی‌شده توسط ربات (۱۰۰ مورد اخیر)</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {filters.map((f) => (
          <Link
            key={f.label}
            href={f.key ? `/admin/logs?status=${f.key}` : "/admin/logs"}
            className={`rounded-full px-3 py-1.5 text-xs ${
              status === f.key ? "bg-orange-500 text-slate-950 font-bold" : "bg-slate-800 text-slate-300"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-right text-slate-400">
              <th className="py-3 pr-4">موضوع</th>
              <th className="py-3">کانال منبع</th>
              <th className="py-3">وضعیت</th>
              <th className="py-3">متن/دلیل</th>
              <th className="py-3">زمان</th>
              <th className="py-3">عملیات</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const badge = STATUS_LABELS[row.status] ?? { label: row.status, cls: "bg-slate-500/15 text-slate-300" };
              return (
                <tr key={row.id} className="border-b border-slate-800/60">
                  <td className="py-3 pr-4">{row.purpose === "freefire" ? "🎮" : "🪙"}</td>
                  <td className="py-3 text-slate-300">{row.sourceTitle || "-"}</td>
                  <td className="py-3">
                    <span className={`rounded-full px-2 py-1 text-xs ${badge.cls}`}>{badge.label}</span>
                  </td>
                  <td className="max-w-[320px] truncate py-3 text-slate-400">
                    {row.reason || row.originalText || "-"}
                  </td>
                  <td className="py-3 text-slate-500">{new Date(row.createdAt).toLocaleString("fa-IR")}</td>
                  <td className="py-3">
                    <form action={deleteLogAction.bind(null, row.id)}>
                      <button className="text-xs text-rose-400 hover:underline">حذف</button>
                    </form>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-500">
                  موردی یافت نشد.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
