import { loginAction } from "@/app/admin/actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="grid min-h-screen place-items-center bg-slate-950 px-6" dir="rtl">
      <div className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900 p-8 shadow-2xl">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-amber-400 text-2xl">
            🤖
          </div>
          <h1 className="text-xl font-bold text-white">ورود به پنل مدیریت</h1>
          <p className="mt-1 text-sm text-slate-400">ربات هوشمند بازنشر فری‌فایر و قیمت طلا</p>
        </div>
        <form action={loginAction} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm text-slate-300">رمز عبور ادمین</label>
            <input
              type="password"
              name="password"
              required
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white outline-none focus:border-orange-500"
              placeholder="••••••••"
            />
          </div>
          {error && (
            <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">
              رمز عبور اشتباه است یا ADMIN_PASSWORD تنظیم نشده است.
            </p>
          )}
          <button
            type="submit"
            className="w-full rounded-lg bg-gradient-to-r from-orange-500 to-amber-400 py-2.5 font-semibold text-slate-950 transition hover:opacity-90"
          >
            ورود
          </button>
        </form>
      </div>
    </main>
  );
}
