
import { db } from '../db';
import { anonymousSessionsTable } from '../db/schema';
import { type CheckMessageLimitInput } from '../schema';
import { eq } from 'drizzle-orm';

const MESSAGE_LIMIT = 10; // This should be configurable

export const checkMessageLimit = async (input: CheckMessageLimitInput): Promise<{ canSendMessage: boolean; remainingMessages: number; messageCount: number }> => {
  try {
    // Try to find existing anonymous session
    const existingSessions = await db.select()
      .from(anonymousSessionsTable)
      .where(eq(anonymousSessionsTable.session_token, input.session_token))
      .execute();

    let messageCount = 0;

    if (existingSessions.length > 0) {
      // Use existing session's message count
      messageCount = existingSessions[0].message_count;
    } else {
      // Create new anonymous session record if it doesn't exist
      const sessionId = `anon_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
      
      await db.insert(anonymousSessionsTable)
        .values({
          id: sessionId,
          session_token: input.session_token,
          message_count: 0
        })
        .execute();
      
      messageCount = 0;
    }

    const remainingMessages = Math.max(0, MESSAGE_LIMIT - messageCount);
    const canSendMessage = messageCount < MESSAGE_LIMIT;

    return {
      canSendMessage,
      remainingMessages,
      messageCount
    };
  } catch (error) {
    console.error('Message limit check failed:', error);
    throw error;
  }
};
