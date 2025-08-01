
import { z } from 'zod';

// Chat session schema
export const chatSessionSchema = z.object({
  id: z.string(),
  user_id: z.string().nullable(), // Nullable for anonymous users
  title: z.string(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type ChatSession = z.infer<typeof chatSessionSchema>;

// Message schema
export const messageSchema = z.object({
  id: z.string(),
  session_id: z.string(),
  role: z.enum(['user', 'assistant']),
  content: z.string(),
  created_at: z.coerce.date()
});

export type Message = z.infer<typeof messageSchema>;

// User schema for registered users
export const userSchema = z.object({
  id: z.string(),
  email: z.string().email().nullable(),
  created_at: z.coerce.date()
});

export type User = z.infer<typeof userSchema>;

// Anonymous session tracking schema
export const anonymousSessionSchema = z.object({
  id: z.string(),
  session_token: z.string(),
  message_count: z.number().int().nonnegative(),
  created_at: z.coerce.date(),
  last_activity: z.coerce.date()
});

export type AnonymousSession = z.infer<typeof anonymousSessionSchema>;

// Input schemas
export const createChatSessionInputSchema = z.object({
  user_id: z.string().nullable().optional(),
  session_token: z.string().optional(), // For anonymous users
  title: z.string().optional()
});

export type CreateChatSessionInput = z.infer<typeof createChatSessionInputSchema>;

export const sendMessageInputSchema = z.object({
  session_id: z.string(),
  content: z.string().min(1),
  session_token: z.string().optional() // For anonymous users
});

export type SendMessageInput = z.infer<typeof sendMessageInputSchema>;

export const getChatHistoryInputSchema = z.object({
  session_id: z.string(),
  user_id: z.string().nullable().optional(),
  session_token: z.string().optional()
});

export type GetChatHistoryInput = z.infer<typeof getChatHistoryInputSchema>;

export const getUserSessionsInputSchema = z.object({
  user_id: z.string().nullable().optional(),
  session_token: z.string().optional()
});

export type GetUserSessionsInput = z.infer<typeof getUserSessionsInputSchema>;

export const checkMessageLimitInputSchema = z.object({
  session_token: z.string()
});

export type CheckMessageLimitInput = z.infer<typeof checkMessageLimitInputSchema>;
