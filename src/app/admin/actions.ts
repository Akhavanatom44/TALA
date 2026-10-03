"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { destinationChannels, processedPosts, sourceChannels } from "@/db/schema";
import { eq } from "drizzle-orm";
import { checkPassword, setSessionCookie, clearSessionCookie } from "@/lib/auth";
import { updateSettings } from "@/lib/settings";
import { approvePendingPost, rejectPendingPost } from "@/lib/bot/engine";

export async function loginAction(formData: FormData) {
  const password = String(formData.get("password") || "");
  if (!checkPassword(password)) {
    redirect("/admin/login?error=1");
  }
  await setSessionCookie();
  redirect("/admin");
}

export async function logoutAction() {
  await clearSessionCookie();
  redirect("/admin/login");
}

export async function saveSettingsAction(formData: FormData) {
  const botToken = String(formData.get("botToken") || "").trim();
  const geminiApiKey = String(formData.get("geminiApiKey") || "").trim();
  const geminiModel = String(formData.get("geminiModel") || "gemini-2.5-flash").trim();
  const publicBaseUrl = String(formData.get("publicBaseUrl") || "").trim();
  const freefirePrompt = String(formData.get("freefirePrompt") || "").trim();
  const goldPrompt = String(formData.get("goldPrompt") || "").trim();
  const blacklistKeywords = String(formData.get("blacklistKeywords") || "").trim();
  const minPostIntervalSeconds = Number(formData.get("minPostIntervalSeconds") || 0);
  const autoPublishFreefire = formData.get("autoPublishFreefire") === "on";
  const autoPublishGold = formData.get("autoPublishGold") === "on";

  await updateSettings({
    botToken: botToken || undefined,
    geminiApiKey: geminiApiKey || undefined,
    geminiModel: geminiModel || undefined,
    publicBaseUrl: publicBaseUrl || undefined,
    freefirePrompt: freefirePrompt || undefined,
    goldPrompt: goldPrompt || undefined,
    blacklistKeywords,
    minPostIntervalSeconds: Number.isFinite(minPostIntervalSeconds) ? minPostIntervalSeconds : 0,
    autoPublishFreefire,
    autoPublishGold,
  });

  revalidatePath("/admin/settings");
}

export async function addSourceChannelAction(formData: FormData) {
  const purpose = String(formData.get("purpose") || "freefire") as "freefire" | "gold";
  const chatId = String(formData.get("chatId") || "").trim();
  const title = String(formData.get("title") || "").trim();
  if (!chatId) return;

  await db
    .insert(sourceChannels)
    .values({ purpose, chatId, title: title || chatId, username: chatId.replace(/^@/, "") })
    .onConflictDoNothing();

  revalidatePath(`/admin/channels/${purpose}`);
}

export async function toggleSourceChannelAction(id: number, purpose: string, active: boolean) {
  await db.update(sourceChannels).set({ active }).where(eq(sourceChannels.id, id));
  revalidatePath(`/admin/channels/${purpose}`);
}

export async function deleteSourceChannelAction(id: number, purpose: string) {
  await db.delete(sourceChannels).where(eq(sourceChannels.id, id));
  revalidatePath(`/admin/channels/${purpose}`);
}

export async function saveDestinationAction(formData: FormData) {
  const purpose = String(formData.get("purpose") || "freefire") as "freefire" | "gold";
  const chatId = String(formData.get("chatId") || "").trim();
  const title = String(formData.get("title") || "").trim();
  const footerText = String(formData.get("footerText") || "").trim();
  const buttonText = String(formData.get("buttonText") || "").trim();
  const buttonUrl = String(formData.get("buttonUrl") || "").trim();
  const disableLinkPreview = formData.get("disableLinkPreview") === "on";
  const existingId = formData.get("id");

  if (existingId) {
    await db
      .update(destinationChannels)
      .set({ chatId, title, footerText, buttonText, buttonUrl, disableLinkPreview })
      .where(eq(destinationChannels.id, Number(existingId)));
  } else if (chatId) {
    await db.insert(destinationChannels).values({
      purpose,
      chatId,
      title,
      footerText,
      buttonText,
      buttonUrl,
      disableLinkPreview,
    });
  }

  revalidatePath(`/admin/channels/${purpose}`);
}

export async function deleteDestinationAction(id: number, purpose: string) {
  await db.delete(destinationChannels).where(eq(destinationChannels.id, id));
  revalidatePath(`/admin/channels/${purpose}`);
}

export async function approveReviewAction(id: number) {
  await approvePendingPost(id);
  revalidatePath("/admin/review");
  revalidatePath("/admin/logs");
}

export async function rejectReviewAction(id: number) {
  await rejectPendingPost(id);
  revalidatePath("/admin/review");
  revalidatePath("/admin/logs");
}

export async function deleteLogAction(id: number) {
  await db.delete(processedPosts).where(eq(processedPosts.id, id));
  revalidatePath("/admin/logs");
}
