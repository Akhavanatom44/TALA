import { notFound } from "next/navigation";
import { db } from "@/db";
import { destinationChannels, sourceChannels } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  addSourceChannelAction,
  deleteDestinationAction,
  deleteSourceChannelAction,
  saveDestinationAction,
  toggleSourceChannelAction,
} from "@/app/admin/actions";
import ActionButton from "@/app/admin/components/ActionButton";

export const dynamic = "force-dynamic";

const CONFIG = {
  freefire: {
    title: "🎮 کانال‌های فری‌فایر",
    subtitle: "کانال‌های منبع برای رصد پست‌های مرتبط با بازی Free Fire و کانال مقصد انتشار",
  },
  gold: {
    title: "🪙 کانال‌های قیمت طلا",
    subtitle: "کانال‌های منبع قیمت طلا/سکه/ارز و کانال مقصد انتشار",
  },
} as const;

export default async function ChannelsPage({
  params,
}: {
  params: Promise<{ purpose: string }>;
}) {
  const { purpose } = await params;
  if (purpose !== "freefire" && purpose !== "gold") notFound();

  const [sources, destinations] = await Promise.all([
    db.select().from(sourceChannels).where(eq(sourceChannels.purpose, purpose)).orderBy(sourceChannels.id),
    db.select().from(destinationChannels).where(eq(destinationChannels.purpose, purpose)).orderBy(destinationChannels.id),
  ]);

  const cfg = CONFIG[purpose];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">{cfg.title}</h1>
        <p className="mt-1 text-sm text-slate-400">{cfg.subtitle}</p>
      </div>

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <h2 className="mb-4 text-lg font-bold text-white">کانال مقصد (جایی که پست نهایی منتشر می‌شود)</h2>
        <div className="mb-6 space-y-3">
          {destinations.map((dest) => (
            <div key={dest.id} className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <p className="font-bold text-white">{dest.title || dest.chatId}</p>
                <div className="flex gap-2">
                  <ActionButton
                    label="📨 ارسال تست"
                    url="/api/admin/channel/test"
                    body={{ chatId: dest.chatId }}
                  />
                  <form action={deleteDestinationAction.bind(null, dest.id, purpose)}>
                    <button className="rounded-lg border border-rose-900 bg-rose-950/40 px-3 py-2 text-sm text-rose-400 hover:bg-rose-950">
                      حذف
                    </button>
                  </form>
                </div>
              </div>
              <p className="text-xs text-slate-500">شناسه: {dest.chatId}</p>
              <p className="mt-1 whitespace-pre-wrap text-xs text-slate-400">فوتر: {dest.footerText || "—"}</p>
            </div>
          ))}
          {destinations.length === 0 && (
            <p className="text-sm text-slate-500">هنوز کانال مقصدی تنظیم نشده است.</p>
          )}
        </div>

        <details className="rounded-xl border border-slate-800 p-4">
          <summary className="cursor-pointer text-sm font-bold text-orange-400">
            + افزودن / ویرایش کانال مقصد
          </summary>
          <form action={saveDestinationAction} className="mt-4 grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="purpose" value={purpose} />
            <Field label="شناسه یا یوزرنیم کانال (مثال: @mychannel یا -100123456)">
              <input name="chatId" required className="input" />
            </Field>
            <Field label="عنوان (اختیاری)">
              <input name="title" className="input" />
            </Field>
            <Field label="متن فوتر (آیدی/لینک کانال شما که به انتهای هر پست اضافه می‌شود)">
              <textarea name="footerText" rows={2} className="input" placeholder={"🆔 @YourChannel"} />
            </Field>
            <Field label="متن دکمه شیشه‌ای (اختیاری)">
              <input name="buttonText" className="input" placeholder="عضویت در کانال" />
            </Field>
            <Field label="لینک دکمه شیشه‌ای (اختیاری)">
              <input name="buttonUrl" className="input" placeholder="https://t.me/YourChannel" />
            </Field>
            <div className="flex items-center gap-2 self-end pb-2">
              <input type="checkbox" id="disableLinkPreview" name="disableLinkPreview" className="h-4 w-4" />
              <label htmlFor="disableLinkPreview" className="text-sm text-slate-300">
                غیرفعال‌سازی پیش‌نمایش لینک در پیام‌های متنی
              </label>
            </div>
            <button className="sm:col-span-2 mt-2 rounded-lg bg-gradient-to-r from-orange-500 to-amber-400 py-2.5 font-bold text-slate-950">
              ذخیره کانال مقصد
            </button>
          </form>
        </details>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <h2 className="mb-4 text-lg font-bold text-white">کانال‌های منبع (رصد می‌شوند)</h2>
        <p className="mb-4 text-xs text-slate-500">
          ⚠️ نکته مهم: برای اینکه ربات پست‌های یک کانال را دریافت کند، باید ربات را به‌عنوان «ادمین» در آن کانال
          اضافه کنید. از همان لحظه افزودن، تمام پست‌های بعدی آن کانال بررسی می‌شوند.
        </p>
        <form action={addSourceChannelAction} className="mb-6 flex flex-wrap gap-3">
          <input type="hidden" name="purpose" value={purpose} />
          <input
            name="chatId"
            required
            placeholder="@channel_username یا -100123456789"
            className="input flex-1 min-w-[220px]"
          />
          <input name="title" placeholder="عنوان (اختیاری)" className="input flex-1 min-w-[160px]" />
          <button className="rounded-lg bg-gradient-to-r from-orange-500 to-amber-400 px-5 py-2 font-bold text-slate-950">
            افزودن
          </button>
        </form>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-right text-slate-400">
                <th className="py-2 pr-2">کانال</th>
                <th className="py-2">وضعیت</th>
                <th className="py-2">دیده‌شده</th>
                <th className="py-2">منتشرشده</th>
                <th className="py-2">آخرین پست</th>
                <th className="py-2">عملیات</th>
              </tr>
            </thead>
            <tbody>
              {sources.map((s) => (
                <tr key={s.id} className="border-b border-slate-800/60">
                  <td className="py-2 pr-2">{s.title || s.chatId}</td>
                  <td className="py-2">
                    <form action={toggleSourceChannelAction.bind(null, s.id, purpose, !s.active)}>
                      <button
                        className={`rounded-full px-2 py-1 text-xs ${
                          s.active ? "bg-emerald-500/15 text-emerald-400" : "bg-slate-600/20 text-slate-400"
                        }`}
                      >
                        {s.active ? "فعال" : "غیرفعال"}
                      </button>
                    </form>
                  </td>
                  <td className="py-2 text-slate-300">{s.totalSeen}</td>
                  <td className="py-2 text-slate-300">{s.totalPosted}</td>
                  <td className="py-2 text-slate-500">
                    {s.lastMessageAt ? new Date(s.lastMessageAt).toLocaleString("fa-IR") : "—"}
                  </td>
                  <td className="py-2">
                    <form action={deleteSourceChannelAction.bind(null, s.id, purpose)}>
                      <button className="text-xs text-rose-400 hover:underline">حذف</button>
                    </form>
                  </td>
                </tr>
              ))}
              {sources.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-500">
                    هنوز کانال منبعی اضافه نشده است.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-sm text-slate-300">{label}</span>
      {children}
    </label>
  );
}
