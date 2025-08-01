
import { pgTable, text, timestamp, integer } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const usersTable = pgTable('users', {
  id: text('id').primaryKey(),
  email: text('email'),
  created_at: timestamp('created_at').defaultNow().notNull(),
});

export const chatSessionsTable = pgTable('chat_sessions', {
  id: text('id').primaryKey(),
  user_id: text('user_id'), // Nullable for anonymous users
  title: text('title').notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

export const messagesTable = pgTable('messages', {
  id: text('id').primaryKey(),
  session_id: text('session_id').notNull(),
  role: text('role').notNull(), // 'user' or 'assistant'
  content: text('content').notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
});

export const anonymousSessionsTable = pgTable('anonymous_sessions', {
  id: text('id').primaryKey(),
  session_token: text('session_token').notNull().unique(),
  message_count: integer('message_count').notNull().default(0),
  created_at: timestamp('created_at').defaultNow().notNull(),
  last_activity: timestamp('last_activity').defaultNow().notNull(),
});

// Relations
export const usersRelations = relations(usersTable, ({ many }) => ({
  chatSessions: many(chatSessionsTable),
}));

export const chatSessionsRelations = relations(chatSessionsTable, ({ one, many }) => ({
  user: one(usersTable, {
    fields: [chatSessionsTable.user_id],
    references: [usersTable.id],
  }),
  messages: many(messagesTable),
}));

export const messagesRelations = relations(messagesTable, ({ one }) => ({
  chatSession: one(chatSessionsTable, {
    fields: [messagesTable.session_id],
    references: [chatSessionsTable.id],
  }),
}));

// TypeScript types for the table schemas
export type User = typeof usersTable.$inferSelect;
export type NewUser = typeof usersTable.$inferInsert;

export type ChatSession = typeof chatSessionsTable.$inferSelect;
export type NewChatSession = typeof chatSessionsTable.$inferInsert;

export type Message = typeof messagesTable.$inferSelect;
export type NewMessage = typeof messagesTable.$inferInsert;

export type AnonymousSession = typeof anonymousSessionsTable.$inferSelect;
export type NewAnonymousSession = typeof anonymousSessionsTable.$inferInsert;

// Export all tables for proper query building
export const tables = {
  users: usersTable,
  chatSessions: chatSessionsTable,
  messages: messagesTable,
  anonymousSessions: anonymousSessionsTable,
};
