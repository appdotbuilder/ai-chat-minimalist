
import { db } from '../db';
import { messagesTable, chatSessionsTable, anonymousSessionsTable } from '../db/schema';
import { type GetChatHistoryInput, type Message } from '../schema';
import { eq, and, asc } from 'drizzle-orm';

export const getChatHistory = async (input: GetChatHistoryInput): Promise<Message[]> => {
  try {
    // First, verify the session exists and user has access
    const session = await db.select()
      .from(chatSessionsTable)
      .where(eq(chatSessionsTable.id, input.session_id))
      .execute();

    if (session.length === 0) {
      throw new Error('Chat session not found');
    }

    const chatSession = session[0];

    // Check access permissions
    if (chatSession.user_id) {
      // Session belongs to a registered user
      if (!input.user_id || chatSession.user_id !== input.user_id) {
        throw new Error('Access denied: session belongs to another user');
      }
    } else {
      // Anonymous session - requires session token
      if (!input.session_token) {
        throw new Error('Session token required for anonymous sessions');
      }

      // Verify the session token exists and is valid
      const anonymousSession = await db.select()
        .from(anonymousSessionsTable)
        .where(eq(anonymousSessionsTable.session_token, input.session_token))
        .execute();

      if (anonymousSession.length === 0) {
        throw new Error('Invalid session token');
      }
    }

    // Retrieve all messages for the session, ordered by creation time
    const messages = await db.select()
      .from(messagesTable)
      .where(eq(messagesTable.session_id, input.session_id))
      .orderBy(asc(messagesTable.created_at))
      .execute();

    // Convert the raw database results to match the Message schema type
    return messages.map(message => ({
      id: message.id,
      session_id: message.session_id,
      role: message.role as 'user' | 'assistant', // Type assertion for role enum
      content: message.content,
      created_at: message.created_at
    }));
  } catch (error) {
    console.error('Get chat history failed:', error);
    throw error;
  }
};
