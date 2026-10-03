import { db } from "@/db";
import { botSettings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { randomBytes } from "crypto";
import { DEFAULT_FREEFIRE_PROMPT, DEFAULT_GOLD_PROMPT } from "@/lib/gemini";

export type BotSettings = typeof botSettings.$inferSelect;

export async function getSettings(): Promise<BotSettings> {
  const rows = await db.select().from(botSettings).limit(1);
  if (rows[0]) return rows[0];

  const [created] = await db
    .insert(botSettings)
    .values({
      geminiModel: "gemini-2.5-flash",
      webhookSecret: randomBytes(24).toString("hex"),
      freefirePrompt: DEFAULT_FREEFIRE_PROMPT,
      goldPrompt: DEFAULT_GOLD_PROMPT,
    })
    .returning();
  return created;
}

export async function updateSettings(patch: Partial<typeof botSettings.$inferInsert>) {
  const current = await getSettings();
  const [updated] = await db
    .update(botSettings)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(botSettings.id, current.id))
    .returning();
  return updated;
}
