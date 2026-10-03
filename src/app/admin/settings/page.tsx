import { getSettings } from "@/lib/settings";
import { saveSettingsAction } from "@/app/admin/actions";
import ActionButton from "@/app/admin/components/ActionButton";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const settings = await getSettings();

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">تنظیمات ربات</h1>
        <p className="mt-1 text-sm text-slate-400">
          توکن ربات تلگرام، کلید Gemini و تنظیمات کلی رفتار ربات را اینجا مدیریت کنید.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <ActionButton label="🔌 تست اتصال ربات" url="/api/admin/bot/test" />
        <ActionButton label="🔗 فعال‌سازی وب‌هوک" url="/api/admin/bot/webhook" method="POST" />
        <ActionButton label="🧹 حذف وب‌هوک" url="/api/admin/bot/webhook" method="DELETE" />
      </div>

      <form action={saveSettingsAction} className="space-y-6 rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <section className="space-y-4">
          <h2 className="text-sm font-bold text-orange-400">اتصال به تلگرام</h2>
          <Field label="توکن ربات تلگرام (از BotFather)">
            <input
              name="botToken"
              defaultValue={settings.botToken ?? ""}
              placeholder="123456789:AAExxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              className="input"
            />
          </Field>
          <Field label="آدرس عمومی سایت (برای تنظیم وب‌هوک)">
            <input
              name="publicBaseUrl"
              defaultValue={settings.publicBaseUrl ?? ""}
              placeholder="https://your-domain.com"
              className="input"
            />
          </Field>
          <p className="text-xs text-slate-500">
            وب‌هوک شما: <code className="text-slate-300">{"{آدرس بالا}"}/api/telegram/webhook</code> — پس از ذخیره
            تنظیمات روی «فعال‌سازی وب‌هوک» کلیک کنید.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-sm font-bold text-orange-400">هوش مصنوعی Gemini</h2>
          <Field label="کلید API جمینای (Gemini API Key)">
            <input
              name="geminiApiKey"
              defaultValue={settings.geminiApiKey ?? ""}
              placeholder="AIza..."
              className="input"
            />
          </Field>
          <Field label="مدل Gemini">
            <input name="geminiModel" defaultValue={settings.geminiModel ?? "gemini-2.5-flash"} className="input" />
          </Field>
        </section>

        <section className="space-y-4">
          <h2 className="text-sm font-bold text-orange-400">رفتار انتشار</h2>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="autoPublishFreefire"
              name="autoPublishFreefire"
              defaultChecked={settings.autoPublishFreefire}
              className="h-4 w-4"
            />
            <label htmlFor="autoPublishFreefire" className="text-sm text-slate-300">
              انتشار خودکار پست‌های فری‌فایر (در غیر این صورت وارد صف تایید دستی می‌شود)
            </label>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="autoPublishGold"
              name="autoPublishGold"
              defaultChecked={settings.autoPublishGold}
              className="h-4 w-4"
            />
            <label htmlFor="autoPublishGold" className="text-sm text-slate-300">
              انتشار خودکار پست‌های قیمت طلا
            </label>
          </div>
          <Field label="حداقل فاصله زمانی بین دو پست (ثانیه) — جلوگیری از فلود">
            <input
              type="number"
              min={0}
              name="minPostIntervalSeconds"
              defaultValue={settings.minPostIntervalSeconds}
              className="input"
            />
          </Field>
          <Field label="کلمات ممنوعه (هر خط یا با کاما جدا شود) — پست حاوی این کلمات همیشه نادیده گرفته می‌شود">
            <textarea
              name="blacklistKeywords"
              defaultValue={settings.blacklistKeywords ?? ""}
              rows={3}
              className="input"
              placeholder="تبلیغ، ریپورت، فروش آیدی"
            />
          </Field>
        </section>

        <section className="space-y-4">
          <h2 className="text-sm font-bold text-orange-400">دستورالعمل تحلیل Gemini — کانال فری‌فایر</h2>
          <textarea
            name="freefirePrompt"
            defaultValue={settings.freefirePrompt ?? ""}
            rows={8}
            className="input font-mono text-xs"
          />
        </section>

        <section className="space-y-4">
          <h2 className="text-sm font-bold text-orange-400">دستورالعمل تحلیل Gemini — کانال قیمت طلا</h2>
          <textarea
            name="goldPrompt"
            defaultValue={settings.goldPrompt ?? ""}
            rows={8}
            className="input font-mono text-xs"
          />
        </section>

        <button
          type="submit"
          className="w-full rounded-lg bg-gradient-to-r from-orange-500 to-amber-400 py-3 font-bold text-slate-950 hover:opacity-90"
        >
          ذخیره تنظیمات
        </button>
      </form>
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
