import { randomBytes } from "crypto";
import { getSettings, updateSettings } from "@/lib/settings";
import { setWebhook, deleteWebhook } from "@/lib/telegram";

export async function POST() {
  const settings = await getSettings();
  if (!settings.botToken) {
    return Response.json({ ok: false, message: "ابتدا توکن ربات را وارد و ذخیره کنید." });
  }
  if (!settings.publicBaseUrl) {
    return Response.json({ ok: false, message: "ابتدا آدرس عمومی سایت (Public Base URL) را وارد و ذخیره کنید." });
  }

  const secret = settings.webhookSecret || randomBytes(24).toString("hex");
  if (secret !== settings.webhookSecret) {
    await updateSettings({ webhookSecret: secret });
  }

  const base = settings.publicBaseUrl.replace(/\/$/, "");
  const url = `${base}/api/telegram/webhook`;
  const res = await setWebhook(settings.botToken, url, secret);

  if (!res.ok) {
    return Response.json({ ok: false, message: res.description || "تنظیم وب‌هوک ناموفق بود." });
  }
  return Response.json({ ok: true, message: `وب‌هوک با موفقیت فعال شد روی: ${url}` });
}

export async function DELETE() {
  const settings = await getSettings();
  if (!settings.botToken) {
    return Response.json({ ok: false, message: "ابتدا توکن ربات را وارد کنید." });
  }
  const res = await deleteWebhook(settings.botToken);
  if (!res.ok) {
    return Response.json({ ok: false, message: res.description || "حذف وب‌هوک ناموفق بود." });
  }
  return Response.json({ ok: true, message: "وب‌هوک حذف شد." });
}
