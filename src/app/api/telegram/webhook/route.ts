import { NextRequest } from "next/server";
import { getSettings } from "@/lib/settings";
import { handleChannelPost } from "@/lib/bot/engine";
import { sendMessage, TgMessage } from "@/lib/telegram";

export const dynamic = "force-dynamic";

interface TgUpdate {
  update_id: number;
  message?: TgMessage;
  channel_post?: TgMessage;
  edited_channel_post?: TgMessage;
}

async function handlePrivateMessage(botToken: string, message: TgMessage) {
  const text = (message.text || "").trim().toLowerCase();
  if (message.chat.type !== "private") return;
  if (text === "/start" || text === "/status" || text === "/help") {
    await sendMessage(botToken, {
      chat_id: message.chat.id,
      text:
        "👋 سلام!\nاین ربات به صورت خودکار پست‌های کانال‌های منبع را بررسی و در صورت مرتبط بودن با موضوع، بازنویسی‌شده در کانال مقصد منتشر می‌کند.\n\nمدیریت تنظیمات، کانال‌ها و گزارش‌ها از طریق پنل ادمین وب انجام می‌شود.",
    });
  }
}

export async function POST(req: NextRequest) {
  try {
    const settings = await getSettings();
    const secretHeader = req.headers.get("x-telegram-bot-api-secret-token");
    if (settings.webhookSecret && secretHeader !== settings.webhookSecret) {
      return Response.json({ ok: false, error: "invalid secret token" }, { status: 401 });
    }

    const update = (await req.json()) as TgUpdate;

    // Respond immediately; continue processing in the background so Telegram
    // never times out waiting for Gemini/network calls to finish.
    const post = update.channel_post ?? update.edited_channel_post;
    if (post) {
      void handleChannelPost(post).catch(() => {});
    } else if (update.message && settings.botToken) {
      void handlePrivateMessage(settings.botToken, update.message).catch(() => {});
    }

    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: true });
  }
}

export async function GET() {
  return Response.json({ ok: true, message: "Telegram webhook endpoint is alive." });
}
