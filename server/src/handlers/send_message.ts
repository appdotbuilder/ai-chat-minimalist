
import { db } from '../db';
import { messagesTable, chatSessionsTable, anonymousSessionsTable } from '../db/schema';
import { type SendMessageInput, type Message } from '../schema';
import { eq, sql } from 'drizzle-orm';

const MESSAGE_LIMIT = 10; // Anonymous users limited to 10 messages per session

export const sendMessage = async (input: SendMessageInput): Promise<{ userMessage: Message; aiResponse: Message }> => {
  try {
    // Check message limit for anonymous users
    if (input.session_token) {
      const anonymousSession = await db.select()
        .from(anonymousSessionsTable)
        .where(eq(anonymousSessionsTable.session_token, input.session_token))
        .execute();

      if (anonymousSession.length === 0) {
        throw new Error('Anonymous session not found');
      }

      if (anonymousSession[0].message_count >= MESSAGE_LIMIT) {
        throw new Error('Message limit exceeded for anonymous users');
      }
    }

    // Generate message IDs
    const userMessageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const aiMessageId = `msg_${Date.now() + 1}_${Math.random().toString(36).substr(2, 9)}`;
    
    const now = new Date();

    // Save user message
    const userMessageResult = await db.insert(messagesTable)
      .values({
        id: userMessageId,
        session_id: input.session_id,
        role: 'user',
        content: input.content,
        created_at: now
      })
      .returning()
      .execute();

    // Generate AI response (placeholder implementation)
    const aiResponseContent = `AI Response to: "${input.content}". This is a placeholder AI response.`;
    
    // Save AI response
    const aiMessageResult = await db.insert(messagesTable)
      .values({
        id: aiMessageId,
        session_id: input.session_id,
        role: 'assistant',
        content: aiResponseContent,
        created_at: new Date(now.getTime() + 1000) // Slightly later timestamp
      })
      .returning()
      .execute();

    // Update chat session's updated_at timestamp
    await db.update(chatSessionsTable)
      .set({ updated_at: now })
      .where(eq(chatSessionsTable.id, input.session_id))
      .execute();

    // Update anonymous session message count if applicable
    if (input.session_token) {
      await db.update(anonymousSessionsTable)
        .set({ 
          message_count: sql`${anonymousSessionsTable.message_count} + 1`,
          last_activity: now
        })
        .where(eq(anonymousSessionsTable.session_token, input.session_token))
        .execute();
    }

    // Convert database results to proper Message types
    const userMessage: Message = {
      ...userMessageResult[0],
      role: userMessageResult[0].role as 'user' | 'assistant'
    };
    
    const aiResponse: Message = {
      ...aiMessageResult[0],
      role: aiMessageResult[0].role as 'user' | 'assistant'
    };

    return { userMessage, aiResponse };
  } catch (error) {
    console.error('Send message failed:', error);
    throw error;
  }
};
