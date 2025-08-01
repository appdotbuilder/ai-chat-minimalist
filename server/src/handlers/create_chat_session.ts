
import { db } from '../db';
import { chatSessionsTable, anonymousSessionsTable } from '../db/schema';
import { type CreateChatSessionInput, type ChatSession } from '../schema';
import { eq, sql } from 'drizzle-orm';

export const createChatSession = async (input: CreateChatSessionInput): Promise<ChatSession> => {
  try {
    // Generate unique session ID
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const title = input.title || 'New Chat';
    const now = new Date();

    // Insert chat session record
    const result = await db.insert(chatSessionsTable)
      .values({
        id: sessionId,
        user_id: input.user_id || null,
        title: title,
        created_at: now,
        updated_at: now
      })
      .returning()
      .execute();

    const chatSession = result[0];

    // For anonymous users, create or update anonymous session tracking
    if (!input.user_id && input.session_token) {
      // Check if anonymous session exists
      const existingAnonymousSession = await db.select()
        .from(anonymousSessionsTable)
        .where(eq(anonymousSessionsTable.session_token, input.session_token))
        .execute();

      if (existingAnonymousSession.length === 0) {
        // Create new anonymous session
        await db.insert(anonymousSessionsTable)
          .values({
            id: `anon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            session_token: input.session_token,
            message_count: 0,
            created_at: now,
            last_activity: now
          })
          .execute();
      } else {
        // Update last activity for existing anonymous session
        await db.update(anonymousSessionsTable)
          .set({
            last_activity: now
          })
          .where(eq(anonymousSessionsTable.session_token, input.session_token))
          .execute();
      }
    }

    return chatSession;
  } catch (error) {
    console.error('Chat session creation failed:', error);
    throw error;
  }
};
