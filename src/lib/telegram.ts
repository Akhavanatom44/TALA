// Minimal Telegram Bot API client built on fetch — no extra dependency needed.

const API_BASE = "https://api.telegram.org";

export interface TelegramApiResult<T> {
  ok: boolean;
  result?: T;
  description?: string;
  error_code?: number;
}

async function call<T = unknown>(
  botToken: string,
  method: string,
  body?: Record<string, unknown>,
): Promise<TelegramApiResult<T>> {
  try {
    const res = await fetch(`${API_BASE}/bot${botToken}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
      cache: "no-store",
    });
    const json = (await res.json()) as TelegramApiResult<T>;
    return json;
  } catch (err) {
    return { ok: false, description: err instanceof Error ? err.message : "network error" };
  }
}

export interface TgChat {
  id: number;
  title?: string;
  username?: string;
  type: string;
}

export interface TgMessage {
  message_id: number;
  date: number;
  chat: TgChat;
  text?: string;
  caption?: string;
  media_group_id?: string;
  photo?: { file_id: string; file_unique_id: string; width: number; height: number }[];
  video?: { file_id: string; file_unique_id: string; mime_type?: string };
  animation?: { file_id: string; file_unique_id: string };
  document?: { file_id: string; file_unique_id: string; mime_type?: string };
}

export function getMe(botToken: string) {
  return call<{ id: number; username: string; first_name: string }>(botToken, "getMe");
}

export function setWebhook(botToken: string, url: string, secretToken: string) {
  return call(botToken, "setWebhook", {
    url,
    secret_token: secretToken,
    allowed_updates: ["message", "channel_post", "edited_channel_post"],
    drop_pending_updates: false,
  });
}

export function deleteWebhook(botToken: string) {
  return call(botToken, "deleteWebhook", { drop_pending_updates: false });
}

export function getWebhookInfo(botToken: string) {
  return call<{
    url: string;
    pending_update_count: number;
    last_error_message?: string;
    last_error_date?: number;
  }>(botToken, "getWebhookInfo");
}

interface SendCommon {
  chat_id: string | number;
  reply_markup?: {
    inline_keyboard: { text: string; url: string }[][];
  };
}

export function buildInlineKeyboard(buttonText?: string | null, buttonUrl?: string | null) {
  if (!buttonText || !buttonUrl) return undefined;
  return { inline_keyboard: [[{ text: buttonText, url: buttonUrl }]] };
}

export function sendMessage(
  botToken: string,
  params: SendCommon & { text: string; disable_web_page_preview?: boolean },
) {
  return call<TgMessage>(botToken, "sendMessage", {
    parse_mode: "HTML",
    ...params,
  });
}

export function sendPhoto(
  botToken: string,
  params: SendCommon & { photo: string; caption?: string },
) {
  return call<TgMessage>(botToken, "sendPhoto", { parse_mode: "HTML", ...params });
}

export function sendVideo(
  botToken: string,
  params: SendCommon & { video: string; caption?: string },
) {
  return call<TgMessage>(botToken, "sendVideo", { parse_mode: "HTML", ...params });
}

export function sendAnimation(
  botToken: string,
  params: SendCommon & { animation: string; caption?: string },
) {
  return call<TgMessage>(botToken, "sendAnimation", { parse_mode: "HTML", ...params });
}

export interface MediaGroupItem {
  type: "photo" | "video";
  media: string;
  caption?: string;
  parse_mode?: string;
}

export function sendMediaGroup(
  botToken: string,
  chatId: string | number,
  media: MediaGroupItem[],
) {
  return call<TgMessage[]>(botToken, "sendMediaGroup", { chat_id: chatId, media });
}
