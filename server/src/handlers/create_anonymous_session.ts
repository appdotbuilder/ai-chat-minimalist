
import { db } from '../db';
import { anonymousSessionsTable } from '../db/schema';
import { type AnonymousSession } from '../schema';

export const createAnonymousSession = async (): Promise<{ sessionToken: string; session: AnonymousSession }> => {
  try {
    // Generate unique session token and ID with consistent length
    const randomPart = Math.random().toString(36).substr(2, 9) + Math.random().toString(36).substr(2, 7);
    const sessionToken = `anon_${Date.now()}_${randomPart}`;
    const sessionId = `anon_session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Insert anonymous session record
    const result = await db.insert(anonymousSessionsTable)
      .values({
        id: sessionId,
        session_token: sessionToken,
        message_count: 0
      })
      .returning()
      .execute();

    const session = result[0];
    
    return { 
      sessionToken, 
      session: {
        ...session,
        created_at: session.created_at,
        last_activity: session.last_activity
      }
    };
  } catch (error) {
    console.error('Anonymous session creation failed:', error);
    throw error;
  }
};
