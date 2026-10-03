import Link from "next/link";
import CopyBox from "@/app/components/CopyBox";

export const dynamic = "force-dynamic";

const NODE_ENV_EXAMPLE = `# ===== Database =====
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/ffbot

# ===== Admin panel =====
ADMIN_PASSWORD=change-me-strong-password
AUTH_SECRET=change-me-random-64-char-secret

# ===== Postgres (docker-compose only) =====
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=ffbot

# Telegram bot token, Gemini API key, channel IDs و فوتر همگی از پنل ادمین
# (/admin/settings و /admin/channels/freefire | /admin/channels/gold) تنظیم می‌شوند.`;

const PY_ENV_EXAMPLE = `# ===== Database =====
DATABASE_URL=sqlite:///./data/bot.db
# یا برای Postgres:
# DATABASE_URL=postgresql+psycopg://postgres:postgres@127.0.0.1:5432/ffbot

# ===== Admin panel =====
ADMIN_PASSWORD=change-me-strong-password
SECRET_KEY=change-me-random-64-char-secret
HOST=0.0.0.0
PORT=8000

# Telegram bot token, Gemini API key, channel IDs و فوتر همگی از پنل ادمین
# وب (http://localhost:8000/admin) تنظیم می‌شوند.`;

const FEATURES = [
  { icon: "🧠", title: "تحلیل هوشمند با Gemini AI", desc: "هر پست با هوش مصنوعی Gemini بررسی می‌شود تا فقط محتوای واقعاً مرتبط منتشر شود." },
  { icon: "✍️", title: "بازنویسی ضدکپی", desc: "متن هر پست بازنویسی می‌شود تا کاملاً یکتا باشد و کپی مستقیم از منبع نباشد." },
  { icon: "🧹", title: "حذف خودکار لینک/آیدی مزاحم", desc: "لینک‌ها، یوزرنیم‌ها و دعوت‌ به کانال‌های دیگر به‌طور کامل از متن حذف می‌شود." },
  { icon: "🖼️", title: "پشتیبانی از آلبوم عکس و ویدیو", desc: "پست‌های چندرسانه‌ای (چند عکس/ویدیو) به‌صورت آلبوم واحد بازنشر می‌شوند." },
  { icon: "🏷️", title: "فوتر اختصاصی شما", desc: "آیدی/لینک کانال شما و حتی دکمه شیشه‌ای اختصاصی به‌جای فوتر اصلی قرار می‌گیرد." },
  { icon: "🪙", title: "کانال دوم: قیمت طلا", desc: "یک ماژول کاملاً جدا برای رصد و بازنشر قیمت طلا/سکه/ارز با همان موتور هوشمند." },
  { icon: "🕓", title: "صف تایید دستی (اختیاری)", desc: "می‌توانید انتشار خودکار را خاموش کنید و پیش از انتشار، پست را دستی تایید کنید." },
  { icon: "🚫", title: "فیلتر کلمات ممنوعه + ضد فلود", desc: "کلمات ممنوعه و حداقل فاصله زمانی بین پست‌ها قابل تنظیم است." },
  { icon: "📊", title: "داشبورد و گزارش کامل", desc: "آمار لحظه‌ای، وضعیت اتصال ربات، وب‌هوک و تاریخچه کامل هر پست." },
  { icon: "🖥️", title: "پنل مدیریت کامل", desc: "افزودن/حذف کانال‌های منبع و مقصد، تنظیم پرامپت Gemini، توکن و همه‌چیز بدون نیاز به تغییر کد." },
];

export default function HomePage() {
  return (
    <main className="min-h-screen">
      <section className="border-b border-slate-800 bg-gradient-to-b from-slate-900 to-slate-950 px-6 py-16">
        <div className="mx-auto max-w-5xl text-center">
          <p className="mb-3 inline-block rounded-full bg-orange-500/10 px-4 py-1 text-xs font-bold text-orange-400">
            ربات تلگرامی حرفه‌ای بازنشر هوشمند
          </p>
          <h1 className="text-[clamp(2rem,5vw,3.5rem)] font-extrabold leading-tight text-white">
            ربات هوشمند بازنشر <span className="text-orange-400">فری‌فایر</span> و{" "}
            <span className="text-amber-300">قیمت طلا</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-8 text-slate-400">
            این پروژه هر کانال منبعی که اضافه کنید را به‌صورت لحظه‌ای رصد می‌کند، با هوش مصنوعی Gemini بررسی می‌کند
            که آیا پست واقعاً مرتبط است یا نه، سپس متن را بازنویسی و لینک/آیدی کانال‌های دیگر را حذف می‌کند و در
            نهایت با فوتر اختصاصی خودتان (همراه با عکس، ویدیو یا آلبوم) در کانال شما منتشر می‌کند — کاملاً خودکار.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/admin"
              className="rounded-xl bg-gradient-to-r from-orange-500 to-amber-400 px-6 py-3 font-bold text-slate-950 hover:opacity-90"
            >
              ورود به پنل مدیریت ⚙️
            </Link>
            <a
              href="#downloads"
              className="rounded-xl border border-slate-700 px-6 py-3 font-bold text-slate-200 hover:bg-slate-800"
            >
              دانلود فایل‌های پروژه ⬇️
            </a>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="mb-8 text-center text-2xl font-bold text-white">امکانات کلیدی</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <div className="mb-3 text-2xl">{f.icon}</div>
              <h3 className="mb-1 font-bold text-white">{f.title}</h3>
              <p className="text-sm text-slate-400">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="downloads" className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="mb-2 text-center text-2xl font-bold text-white">دانلود پروژه برای دیپلوی روی سرور</h2>
        <p className="mb-10 text-center text-sm text-slate-400">
          دو نسخه کاملاً مستقل و آماده دیپلوی — هرکدام را که مایلید دانلود و روی گیت‌هاب/سرور خودتان قرار دهید.
        </p>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <div className="mb-4 flex items-center gap-3">
              <span className="text-3xl">🐳</span>
              <div>
                <h3 className="font-bold text-white">نسخه Docker (Next.js + PostgreSQL)</h3>
                <p className="text-xs text-slate-500">کل همین پروژه، آماده اجرا با docker-compose</p>
              </div>
            </div>
            <ul className="mb-5 space-y-1.5 text-sm text-slate-400">
              <li>✅ شامل Dockerfile و docker-compose.yml (App + Postgres)</li>
              <li>✅ اجرای خودکار مهاجرت دیتابیس هنگام بالا آمدن کانتینر</li>
              <li>✅ پنل مدیریت تحت وب با Next.js App Router</li>
            </ul>
            <a
              href="/downloads/telegram-bot-docker-nextjs.zip"
              download
              className="block w-full rounded-xl bg-gradient-to-r from-orange-500 to-amber-400 py-3 text-center font-bold text-slate-950 hover:opacity-90"
            >
              ⬇️ دانلود نسخه Docker (zip)
            </a>
            <div className="mt-5">
              <CopyBox text={NODE_ENV_EXAMPLE} label="📋 محتوای .env.example — کپی و در سرور قرار دهید" />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <div className="mb-4 flex items-center gap-3">
              <span className="text-3xl">🐍</span>
              <div>
                <h3 className="font-bold text-white">نسخه Python (aiogram + FastAPI)</h3>
                <p className="text-xs text-slate-500">پیاده‌سازی کاملاً مستقل با فریم‌ورک پایتون</p>
              </div>
            </div>
            <ul className="mb-5 space-y-1.5 text-sm text-slate-400">
              <li>✅ ربات با aiogram 3 و پنل مدیریت با FastAPI</li>
              <li>✅ پشتیبانی از SQLite (پیش‌فرض) یا PostgreSQL</li>
              <li>✅ همراه با Dockerfile و docker-compose.yml اختصاصی</li>
            </ul>
            <a
              href="/downloads/telegram-bot-python.zip"
              download
              className="block w-full rounded-xl bg-gradient-to-r from-sky-500 to-emerald-400 py-3 text-center font-bold text-slate-950 hover:opacity-90"
            >
              ⬇️ دانلود نسخه Python (zip)
            </a>
            <div className="mt-5">
              <CopyBox text={PY_ENV_EXAMPLE} label="📋 محتوای .env.example — کپی و در سرور قرار دهید" />
            </div>
          </div>
        </div>

        <div className="mt-10 rounded-2xl border border-slate-800 bg-slate-900/60 p-6 text-sm text-slate-400">
          <h3 className="mb-2 font-bold text-white">راهنمای سریع دیپلوی</h3>
          <ol className="list-inside list-decimal space-y-1.5">
            <li>فایل zip مورد نظر را دانلود و از حالت فشرده خارج کنید، سپس در یک ریپازیتوری گیت‌هاب آپلود کنید.</li>
            <li>فایل <code className="text-orange-400">.env.example</code> را به <code className="text-orange-400">.env</code> کپی کرده و مقادیر آن را تغییر دهید.</li>
            <li>روی سرور با <code className="text-orange-400">docker compose up -d --build</code> اجرا کنید.</li>
            <li>وارد پنل ادمین شوید، توکن ربات تلگرام و کلید Gemini API را وارد و «فعال‌سازی وب‌هوک» را بزنید.</li>
            <li>ربات را به‌عنوان ادمین در کانال‌های منبع اضافه کنید و کانال‌های مقصد + فوتر را بسازید. همین! 🎉</li>
          </ol>
        </div>
      </section>

      <footer className="border-t border-slate-800 px-6 py-8 text-center text-xs text-slate-500">
        ساخته‌شده برای مدیریت حرفه‌ای کانال‌های تلگرامی فری‌فایر و قیمت طلا — هر دو نسخه مستقل و آماده پروداکشن.
      </footer>
    </main>
  );
}
