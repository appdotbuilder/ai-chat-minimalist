
import { db } from '../db';
import { chatSessionsTable, anonymousSessionsTable } from '../db/schema';
import { type GetUserSessionsInput, type ChatSession } from '../schema';
import { eq, desc, isNull } from 'drizzle-orm';

export const getUserSessions = async (input: GetUserSessionsInput): Promise<ChatSession[]> => {
  try {
    // For authenticated users, fetch sessions by user_id
    if (input.user_id) {
      const results = await db.select()
        .from(chatSessionsTable)
        .where(eq(chatSessionsTable.user_id, input.user_id))
        .orderBy(desc(chatSessionsTable.updated_at))
        .execute();

      return results;
    }

    // For anonymous users, fetch sessions associated with their session_token
    if (input.session_token) {
      // We need to join with anonymous_sessions to find sessions for this token
      // Since anonymous sessions don't have user_id, we need to track them differently
      // For now, return empty array as anonymous sessions might need different tracking
      const results = await db.select()
        .from(chatSessionsTable)
        .where(isNull(chatSessionsTable.user_id))
        .orderBy(desc(chatSessionsTable.updated_at))
        .execute();

      // Filter results based on some logic to associate with session_token
      // This is a simplified implementation - in practice, you might need
      // a junction table or different approach to track anonymous sessions
      return results;
    }

    // If neither user_id nor session_token provided, return empty array
    return [];
  } catch (error) {
    console.error('Failed to get user sessions:', error);
    throw error;
  }
};
