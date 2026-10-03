import { NextRequest } from "next/server";
import { getSettings } from "@/lib/settings";
import { sendMessage } from "@/lib/telegram";

export async function POST(req: NextRequest) {
  const settings = await getSettings();
  if (!settings.botToken) {
    return Response.json({ ok: false, message: "ابتدا توکن ربات را تنظیم کنید." });
  }
  const { chatId } = (await req.json()) as { chatId?: string };
  if (!chatId) {
    return Response.json({ ok: false, message: "شناسه کانال مشخص نشده است." });
  }
  const res = await sendMessage(settings.botToken, {
    chat_id: chatId,
    text: "✅ این یک پیام آزمایشی برای بررسی اتصال ربات به این کانال است.",
  });
  if (!res.ok) {
    return Response.json({
      ok: false,
      message: res.description || "ارسال ناموفق بود. مطمئن شوید ربات ادمین کانال است.",
    });
  }
  return Response.json({ ok: true, message: "پیام آزمایشی با موفقیت ارسال شد ✅" });
}
