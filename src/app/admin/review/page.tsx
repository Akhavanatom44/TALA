import { db } from "@/db";
import { processedPosts, sourceChannels } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { approveReviewAction, rejectReviewAction } from "@/app/admin/actions";

export const dynamic = "force-dynamic";

export default async function ReviewPage() {
  const rows = await db
    .select({
      id: processedPosts.id,
      purpose: processedPosts.purpose,
      originalText: processedPosts.originalText,
      rewrittenText: processedPosts.rewrittenText,
      mediaType: processedPosts.mediaType,
      createdAt: processedPosts.createdAt,
      sourceTitle: sourceChannels.title,
    })
    .from(processedPosts)
    .leftJoin(sourceChannels, eq(processedPosts.sourceChannelId, sourceChannels.id))
    .where(eq(processedPosts.status, "pending_review"))
    .orderBy(desc(processedPosts.createdAt));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">صف تایید دستی</h1>
        <p className="mt-1 text-sm text-slate-400">
          وقتی «انتشار خودکار» در تنظیمات غیرفعال باشد، پست‌های تاییدشده توسط Gemini پیش از انتشار اینجا منتظر تایید شما می‌مانند.
        </p>
      </div>

      <div className="space-y-4">
        {rows.map((row) => (
          <div key={row.id} className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="rounded-full bg-amber-500/15 px-2 py-1 text-xs text-amber-400">
                {row.purpose === "freefire" ? "🎮 فری‌فایر" : "🪙 طلا"} · {row.sourceTitle || "کانال نامشخص"}
                {row.mediaType ? ` · رسانه: ${row.mediaType}` : ""}
              </span>
              <span className="text-xs text-slate-500">{new Date(row.createdAt).toLocaleString("fa-IR")}</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="mb-1 text-xs text-slate-500">متن اصلی:</p>
                <p className="whitespace-pre-wrap rounded-lg bg-slate-950/60 p-3 text-sm text-slate-400">
                  {row.originalText || "(بدون متن)"}
                </p>
              </div>
              <div>
                <p className="mb-1 text-xs text-slate-500">متن بازنویسی‌شده توسط Gemini:</p>
                <p className="whitespace-pre-wrap rounded-lg bg-slate-950/60 p-3 text-sm text-white">
                  {row.rewrittenText}
                </p>
              </div>
            </div>
            <div className="mt-4 flex gap-3">
              <form action={approveReviewAction.bind(null, row.id)}>
                <button className="rounded-lg bg-emerald-500/20 px-4 py-2 text-sm font-bold text-emerald-400 hover:bg-emerald-500/30">
                  ✅ تایید و انتشار
                </button>
              </form>
              <form action={rejectReviewAction.bind(null, row.id)}>
                <button className="rounded-lg bg-rose-500/20 px-4 py-2 text-sm font-bold text-rose-400 hover:bg-rose-500/30">
                  ❌ رد کردن
                </button>
              </form>
            </div>
          </div>
        ))}
        {rows.length === 0 && (
          <p className="rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center text-slate-500">
            چیزی در صف تایید وجود ندارد 🎉
          </p>
        )}
      </div>
    </div>
  );
}
