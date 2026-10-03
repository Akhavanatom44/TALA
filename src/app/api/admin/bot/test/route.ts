import { getSettings } from "@/lib/settings";
import { getMe } from "@/lib/telegram";

export async function POST() {
  const settings = await getSettings();
  if (!settings.botToken) {
    return Response.json({ ok: false, message: "ابتدا توکن ربات را وارد و ذخیره کنید." });
  }
  const res = await getMe(settings.botToken);
  if (!res.ok || !res.result) {
    return Response.json({ ok: false, message: res.description || "اتصال ناموفق بود." });
  }
  return Response.json({ ok: true, message: `اتصال موفق ✅ ربات: @${res.result.username}` });
}
