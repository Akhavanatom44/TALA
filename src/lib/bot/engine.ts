import { db } from "@/db";
import { destinationChannels, processedPosts, sourceChannels } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import {
  TgMessage,
  buildInlineKeyboard,
  sendMediaGroup,
  sendMessage,
  sendPhoto,
  sendVideo,
  MediaGroupItem,
} from "@/lib/telegram";
import { analyzePost, DEFAULT_FREEFIRE_PROMPT, DEFAULT_GOLD_PROMPT } from "@/lib/gemini";
import { buildFinalCaption, containsBlacklistedKeyword, stripForeignLinksAndMentions } from "@/lib/sanitize";
import { getSettings } from "@/lib/settings";

type Purpose = "freefire" | "gold";

interface BufferedGroup {
  sourceChannelRowId: number;
  purpose: Purpose;
  items: TgMessage[];
  timer: ReturnType<typeof setTimeout>;
}

// Module-level in-memory buffer survives across requests within this
// long-running Node process (the app runs via `next start`, not serverless).
const albumBuffers = new Map<string, BufferedGroup>();
const ALBUM_FLUSH_DELAY_MS = 2000;

function extractMedia(message: TgMessage): { type: "photo" | "video"; fileId: string } | null {
  if (message.photo && message.photo.length > 0) {
    const largest = message.photo[message.photo.length - 1];
    return { type: "photo", fileId: largest.file_id };
  }
  if (message.video) {
    return { type: "video", fileId: message.video.file_id };
  }
  return null;
}

function chatIdCandidates(chat: { id: number; username?: string }): string[] {
  const list = [String(chat.id)];
  if (chat.username) list.push(`@${chat.username}`, chat.username);
  return list;
}

async function findSourceChannel(chat: { id: number; username?: string }) {
  const candidates = chatIdCandidates(chat);
  const rows = await db.select().from(sourceChannels).where(eq(sourceChannels.active, true));
  return rows.find((row) => candidates.includes(row.chatId)) ?? null;
}

async function getActiveDestination(purpose: Purpose) {
  const rows = await db
    .select()
    .from(destinationChannels)
    .where(and(eq(destinationChannels.purpose, purpose), eq(destinationChannels.active, true)));
  return rows[0] ?? null;
}

async function markSeen(sourceId: number) {
  await db
    .update(sourceChannels)
    .set({ totalSeen: sql`${sourceChannels.totalSeen} + 1`, lastMessageAt: new Date() })
    .where(eq(sourceChannels.id, sourceId));
}

async function markPosted(sourceId: number) {
  await db
    .update(sourceChannels)
    .set({ totalPosted: sql`${sourceChannels.totalPosted} + 1` })
    .where(eq(sourceChannels.id, sourceId));
}

async function waitForRateLimit(purpose: Purpose, minIntervalSeconds: number) {
  if (!minIntervalSeconds || minIntervalSeconds <= 0) return;
  const settings = await getSettings();
  const last = purpose === "freefire" ? settings.lastPostedAtFreefire : settings.lastPostedAtGold;
  if (!last) return;
  const elapsedMs = Date.now() - new Date(last).getTime();
  const waitMs = minIntervalSeconds * 1000 - elapsedMs;
  if (waitMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
}

async function touchLastPosted(purpose: Purpose) {
  const settings = await getSettings();
  const { updateSettings } = await import("@/lib/settings");
  if (purpose === "freefire") {
    await updateSettings({ lastPostedAtFreefire: new Date() });
  } else {
    await updateSettings({ lastPostedAtGold: new Date() });
  }
  void settings;
}

interface ClaimResult {
  claimed: boolean;
  rowId?: number;
}

async function claimMessage(
  sourceChannelRowId: number,
  sourceMessageId: number,
  purpose: Purpose,
  originalText: string,
  mediaGroupId: string | null,
  mediaType: string | null,
): Promise<ClaimResult> {
  try {
    const [row] = await db
      .insert(processedPosts)
      .values({
        sourceChannelId: sourceChannelRowId,
        sourceMessageId,
        purpose,
        originalText,
        mediaGroupId: mediaGroupId ?? undefined,
        mediaType: mediaType ?? undefined,
        status: "pending_review",
      })
      .onConflictDoNothing({ target: [processedPosts.sourceChannelId, processedPosts.sourceMessageId] })
      .returning({ id: processedPosts.id });
    if (!row) return { claimed: false };
    return { claimed: true, rowId: row.id };
  } catch {
    return { claimed: false };
  }
}

async function finalizeRow(
  rowId: number,
  patch: Partial<typeof processedPosts.$inferInsert>,
) {
  await db.update(processedPosts).set(patch).where(eq(processedPosts.id, rowId));
}

async function runAnalysis(purpose: Purpose, text: string) {
  const settings = await getSettings();
  const apiKey = settings.geminiApiKey;
  const blacklistHit = containsBlacklistedKeyword(text, settings.blacklistKeywords);
  if (blacklistHit) {
    return { relevant: false, rewrittenText: "", reason: `کلمه ممنوعه یافت شد: ${blacklistHit}` };
  }
  const preCleaned = stripForeignLinksAndMentions(text || "");
  if (!apiKey) {
    // Without Gemini configured we cannot safely judge relevance; skip.
    return { relevant: false, rewrittenText: "", reason: "کلید Gemini تنظیم نشده است" };
  }
  const prompt =
    purpose === "freefire"
      ? settings.freefirePrompt || DEFAULT_FREEFIRE_PROMPT
      : settings.goldPrompt || DEFAULT_GOLD_PROMPT;
  const result = await analyzePost({ apiKey, model: settings.geminiModel, prompt, text: preCleaned });
  const finalText = stripForeignLinksAndMentions(result.rewrittenText);
  return { relevant: result.relevant, rewrittenText: finalText, reason: result.reason };
}

async function publishSingle(opts: {
  rowId: number;
  purpose: Purpose;
  caption: string;
  media: { type: "photo" | "video"; fileId: string } | null;
  sourceChannelRowId: number;
}) {
  const { rowId, purpose, caption, media, sourceChannelRowId } = opts;
  const settings = await getSettings();
  const destination = await getActiveDestination(purpose);
  if (!settings.botToken || !destination) {
    await finalizeRow(rowId, { status: "error", reason: "مقصد یا توکن ربات تنظیم نشده است" });
    return;
  }

  await waitForRateLimit(purpose, settings.minPostIntervalSeconds);

  const keyboard = buildInlineKeyboard(destination.buttonText, destination.buttonUrl);
  const finalCaption = buildFinalCaption(caption, destination.footerText);

  try {
    let res;
    if (media?.type === "photo") {
      res = await sendPhoto(settings.botToken, {
        chat_id: destination.chatId,
        photo: media.fileId,
        caption: finalCaption,
        reply_markup: keyboard,
      });
    } else if (media?.type === "video") {
      res = await sendVideo(settings.botToken, {
        chat_id: destination.chatId,
        video: media.fileId,
        caption: finalCaption,
        reply_markup: keyboard,
      });
    } else {
      res = await sendMessage(settings.botToken, {
        chat_id: destination.chatId,
        text: finalCaption,
        disable_web_page_preview: destination.disableLinkPreview,
        reply_markup: keyboard,
      });
    }

    if (!res.ok) {
      await finalizeRow(rowId, { status: "error", reason: res.description || "خطای تلگرام" });
      return;
    }

    await finalizeRow(rowId, {
      status: "posted",
      rewrittenText: finalCaption,
      destinationChatId: destination.chatId,
      destinationMessageId: String(res.result?.message_id ?? ""),
    });
    await markPosted(sourceChannelRowId);
    await touchLastPosted(purpose);
  } catch (err) {
    await finalizeRow(rowId, {
      status: "error",
      reason: err instanceof Error ? err.message : "خطای ناشناخته",
    });
  }
}

async function publishAlbum(opts: {
  rowId: number;
  purpose: Purpose;
  caption: string;
  mediaItems: { type: "photo" | "video"; fileId: string }[];
  sourceChannelRowId: number;
}) {
  const { rowId, purpose, caption, mediaItems, sourceChannelRowId } = opts;
  const settings = await getSettings();
  const destination = await getActiveDestination(purpose);
  if (!settings.botToken || !destination) {
    await finalizeRow(rowId, { status: "error", reason: "مقصد یا توکن ربات تنظیم نشده است" });
    return;
  }

  await waitForRateLimit(purpose, settings.minPostIntervalSeconds);

  const finalCaption = buildFinalCaption(caption, destination.footerText);
  const media: MediaGroupItem[] = mediaItems.map((item, idx) => ({
    type: item.type,
    media: item.fileId,
    ...(idx === 0 ? { caption: finalCaption, parse_mode: "HTML" } : {}),
  }));

  try {
    const res = await sendMediaGroup(settings.botToken, destination.chatId, media);
    if (!res.ok) {
      await finalizeRow(rowId, { status: "error", reason: res.description || "خطای تلگرام" });
      return;
    }
    await finalizeRow(rowId, {
      status: "posted",
      rewrittenText: finalCaption,
      destinationChatId: destination.chatId,
      destinationMessageId: (res.result ?? []).map((m) => m.message_id).join(","),
    });
    await markPosted(sourceChannelRowId);
    await touchLastPosted(purpose);
  } catch (err) {
    await finalizeRow(rowId, {
      status: "error",
      reason: err instanceof Error ? err.message : "خطای ناشناخته",
    });
  }
}

async function processSingleMessage(sourceRow: typeof sourceChannels.$inferSelect, message: TgMessage) {
  await markSeen(sourceRow.id);
  const purpose = sourceRow.purpose as Purpose;
  const text = message.caption || message.text || "";
  const media = extractMedia(message);

  const claim = await claimMessage(sourceRow.id, message.message_id, purpose, text, null, media?.type ?? null);
  if (!claim.claimed || !claim.rowId) return;

  try {
    const analysis = await runAnalysis(purpose, text);
    if (!analysis.relevant) {
      await finalizeRow(claim.rowId, { status: "skipped", reason: analysis.reason || "نامرتبط تشخیص داده شد" });
      return;
    }

    const settings = await getSettings();
    const autoPublish = purpose === "freefire" ? settings.autoPublishFreefire : settings.autoPublishGold;

    if (!autoPublish) {
      await finalizeRow(claim.rowId, {
        status: "pending_review",
        rewrittenText: analysis.rewrittenText,
        payload: JSON.stringify({ media }),
      });
      return;
    }

    await publishSingle({
      rowId: claim.rowId,
      purpose,
      caption: analysis.rewrittenText,
      media,
      sourceChannelRowId: sourceRow.id,
    });
  } catch (err) {
    await finalizeRow(claim.rowId, {
      status: "error",
      reason: err instanceof Error ? err.message : "خطای ناشناخته",
    });
  }
}

async function processAlbum(sourceRow: typeof sourceChannels.$inferSelect, groupId: string, items: TgMessage[]) {
  await markSeen(sourceRow.id);
  const purpose = sourceRow.purpose as Purpose;
  const sorted = [...items].sort((a, b) => a.message_id - b.message_id);
  const firstMessageId = sorted[0].message_id;
  const text = sorted.map((m) => m.caption).find((c) => c && c.trim().length > 0) || "";
  const mediaItems = sorted.map(extractMedia).filter((m): m is { type: "photo" | "video"; fileId: string } => !!m);

  const claim = await claimMessage(sourceRow.id, firstMessageId, purpose, text, groupId, "album");
  if (!claim.claimed || !claim.rowId) return;

  try {
    const analysis = await runAnalysis(purpose, text);
    if (!analysis.relevant) {
      await finalizeRow(claim.rowId, { status: "skipped", reason: analysis.reason || "نامرتبط تشخیص داده شد" });
      return;
    }

    const settings = await getSettings();
    const autoPublish = purpose === "freefire" ? settings.autoPublishFreefire : settings.autoPublishGold;

    if (!autoPublish) {
      await finalizeRow(claim.rowId, {
        status: "pending_review",
        rewrittenText: analysis.rewrittenText,
        payload: JSON.stringify({ mediaItems }),
      });
      return;
    }

    if (mediaItems.length === 0) {
      await finalizeRow(claim.rowId, { status: "skipped", reason: "آلبوم بدون رسانه قابل ارسال" });
      return;
    }

    await publishAlbum({
      rowId: claim.rowId,
      purpose,
      caption: analysis.rewrittenText,
      mediaItems,
      sourceChannelRowId: sourceRow.id,
    });
  } catch (err) {
    await finalizeRow(claim.rowId, {
      status: "error",
      reason: err instanceof Error ? err.message : "خطای ناشناخته",
    });
  }
}

function scheduleAlbumFlush(key: string) {
  const group = albumBuffers.get(key);
  if (!group) return;
  clearTimeout(group.timer);
  group.timer = setTimeout(() => {
    const finalGroup = albumBuffers.get(key);
    albumBuffers.delete(key);
    if (!finalGroup) return;
    db.select()
      .from(sourceChannels)
      .where(eq(sourceChannels.id, finalGroup.sourceChannelRowId))
      .then((rows) => {
        const row = rows[0];
        if (!row) return;
        void processAlbum(row, key, finalGroup.items);
      });
  }, ALBUM_FLUSH_DELAY_MS);
}

export async function approvePendingPost(rowId: number) {
  const [row] = await db.select().from(processedPosts).where(eq(processedPosts.id, rowId));
  if (!row || row.status !== "pending_review") return { ok: false, message: "پست یافت نشد یا قبلاً پردازش شده" };
  const purpose = row.purpose as Purpose;
  const payload = row.payload ? JSON.parse(row.payload) : {};

  if (!row.sourceChannelId) return { ok: false, message: "کانال مبدا نامعتبر است" };

  if (payload.mediaItems) {
    await publishAlbum({
      rowId: row.id,
      purpose,
      caption: row.rewrittenText || "",
      mediaItems: payload.mediaItems,
      sourceChannelRowId: row.sourceChannelId,
    });
  } else {
    await publishSingle({
      rowId: row.id,
      purpose,
      caption: row.rewrittenText || "",
      media: payload.media ?? null,
      sourceChannelRowId: row.sourceChannelId,
    });
  }
  return { ok: true };
}

export async function rejectPendingPost(rowId: number) {
  await finalizeRow(rowId, { status: "rejected", reason: "رد شده توسط ادمین" });
  return { ok: true };
}

export async function handleChannelPost(message: TgMessage) {
  const sourceRow = await findSourceChannel({ id: message.chat.id, username: message.chat.username });
  if (!sourceRow) return;

  if (message.media_group_id) {
    const key = `${sourceRow.id}:${message.media_group_id}`;
    const existing = albumBuffers.get(key);
    if (existing) {
      existing.items.push(message);
    } else {
      albumBuffers.set(key, {
        sourceChannelRowId: sourceRow.id,
        purpose: sourceRow.purpose as Purpose,
        items: [message],
        timer: setTimeout(() => {}, 0),
      });
    }
    scheduleAlbumFlush(key);
    return;
  }

  await processSingleMessage(sourceRow, message);
}
