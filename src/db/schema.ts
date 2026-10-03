import {
  bigint,
  boolean,
  integer,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const purposeEnum = pgEnum("purpose", ["freefire", "gold"]);

export const postStatusEnum = pgEnum("post_status", [
  "posted",
  "skipped",
  "error",
  "pending_review",
  "rejected",
]);

// Single-row table holding global bot configuration.
export const botSettings = pgTable("bot_settings", {
  id: serial("id").primaryKey(),
  botToken: text("bot_token"),
  botUsername: text("bot_username"),
  geminiApiKey: text("gemini_api_key"),
  geminiModel: text("gemini_model").default("gemini-2.5-flash").notNull(),
  webhookSecret: text("webhook_secret"),
  publicBaseUrl: text("public_base_url"),
  freefirePrompt: text("freefire_prompt"),
  goldPrompt: text("gold_prompt"),
  blacklistKeywords: text("blacklist_keywords"),
  autoPublishFreefire: boolean("auto_publish_freefire").default(true).notNull(),
  autoPublishGold: boolean("auto_publish_gold").default(true).notNull(),
  minPostIntervalSeconds: integer("min_post_interval_seconds").default(0).notNull(),
  lastPostedAtFreefire: timestamp("last_posted_at_freefire"),
  lastPostedAtGold: timestamp("last_posted_at_gold"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Destination channels: where approved/rewritten content gets published.
export const destinationChannels = pgTable("destination_channels", {
  id: serial("id").primaryKey(),
  purpose: purposeEnum("purpose").notNull(),
  chatId: text("chat_id").notNull(),
  title: text("title"),
  footerText: text("footer_text"),
  buttonText: text("button_text"),
  buttonUrl: text("button_url"),
  disableLinkPreview: boolean("disable_link_preview").default(false).notNull(),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Source channels that the bot (added as admin) listens to for new posts.
export const sourceChannels = pgTable("source_channels", {
  id: serial("id").primaryKey(),
  purpose: purposeEnum("purpose").notNull(),
  chatId: text("chat_id").notNull(),
  username: text("username"),
  title: text("title"),
  active: boolean("active").default(true).notNull(),
  totalSeen: integer("total_seen").default(0).notNull(),
  totalPosted: integer("total_posted").default(0).notNull(),
  lastMessageAt: timestamp("last_message_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  chatIdUnique: uniqueIndex("source_channels_chat_id_unique").on(table.chatId),
}));

// Audit log / dedup table for every source message that was seen.
export const processedPosts = pgTable("processed_posts", {
  id: serial("id").primaryKey(),
  sourceChannelId: integer("source_channel_id").references(() => sourceChannels.id, {
    onDelete: "cascade",
  }),
  sourceMessageId: bigint("source_message_id", { mode: "number" }).notNull(),
  mediaGroupId: text("media_group_id"),
  purpose: purposeEnum("purpose").notNull(),
  originalText: text("original_text"),
  rewrittenText: text("rewritten_text"),
  mediaType: text("media_type"),
  status: postStatusEnum("status").notNull().default("pending_review"),
  reason: text("reason"),
  destinationChatId: text("destination_chat_id"),
  destinationMessageId: text("destination_message_id"),
  payload: text("payload"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  dedupIndex: uniqueIndex("processed_posts_source_dedup").on(
    table.sourceChannelId,
    table.sourceMessageId,
  ),
}));
