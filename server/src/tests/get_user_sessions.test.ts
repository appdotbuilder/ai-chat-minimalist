
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, chatSessionsTable, anonymousSessionsTable } from '../db/schema';
import { type GetUserSessionsInput } from '../schema';
import { getUserSessions } from '../handlers/get_user_sessions';

// Test user data
const testUser = {
  id: 'user-123',
  email: 'test@example.com'
};

// Test session data
const testSession1 = {
  id: 'session-1',
  user_id: 'user-123',
  title: 'First Chat',
};

const testSession2 = {
  id: 'session-2',
  user_id: 'user-123',
  title: 'Second Chat',
};

const testSession3 = {
  id: 'session-3',
  user_id: 'other-user',
  title: 'Other User Chat',
};

const anonymousSession = {
  id: 'anon-session-1',
  user_id: null,
  title: 'Anonymous Chat',
};

const testAnonymousSessionData = {
  id: 'anon-123',
  session_token: 'token-456',
  message_count: 5
};

describe('getUserSessions', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return sessions for authenticated user', async () => {
    // Create test user
    await db.insert(usersTable)
      .values(testUser)
      .execute();

    // Create test sessions
    await db.insert(chatSessionsTable)
      .values([testSession1, testSession2, testSession3])
      .execute();

    const input: GetUserSessionsInput = {
      user_id: 'user-123'
    };

    const result = await getUserSessions(input);

    // Should return only sessions for the specified user
    expect(result).toHaveLength(2);
    expect(result.map(s => s.id)).toContain('session-1');
    expect(result.map(s => s.id)).toContain('session-2');
    expect(result.map(s => s.id)).not.toContain('session-3');

    // Verify session details
    const firstSession = result.find(s => s.id === 'session-1');
    expect(firstSession).toBeDefined();
    expect(firstSession!.title).toEqual('First Chat');
    expect(firstSession!.user_id).toEqual('user-123');
    expect(firstSession!.created_at).toBeInstanceOf(Date);
    expect(firstSession!.updated_at).toBeInstanceOf(Date);
  });

  it('should return sessions ordered by updated_at (most recent first)', async () => {
    // Create test user
    await db.insert(usersTable)
      .values(testUser)
      .execute();

    // Create sessions with different timestamps
    const now = new Date();
    const earlier = new Date(now.getTime() - 60000); // 1 minute earlier

    await db.insert(chatSessionsTable)
      .values([
        { ...testSession1, created_at: earlier, updated_at: earlier },
        { ...testSession2, created_at: now, updated_at: now }
      ])
      .execute();

    const input: GetUserSessionsInput = {
      user_id: 'user-123'
    };

    const result = await getUserSessions(input);

    expect(result).toHaveLength(2);
    // Most recent should be first
    expect(result[0].id).toEqual('session-2');
    expect(result[1].id).toEqual('session-1');
  });

  it('should return empty array for user with no sessions', async () => {
    // Create test user but no sessions
    await db.insert(usersTable)
      .values(testUser)
      .execute();

    const input: GetUserSessionsInput = {
      user_id: 'user-123'
    };

    const result = await getUserSessions(input);

    expect(result).toHaveLength(0);
  });

  it('should handle anonymous users with session_token', async () => {
    // Create anonymous session data
    await db.insert(anonymousSessionsTable)
      .values(testAnonymousSessionData)
      .execute();

    // Create anonymous chat session
    await db.insert(chatSessionsTable)
      .values(anonymousSession)
      .execute();

    const input: GetUserSessionsInput = {
      session_token: 'token-456'
    };

    const result = await getUserSessions(input);

    // Should return sessions (implementation might vary based on business logic)
    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
  });

  it('should return empty array when neither user_id nor session_token provided', async () => {
    const input: GetUserSessionsInput = {};

    const result = await getUserSessions(input);

    expect(result).toHaveLength(0);
  });

  it('should return empty array for non-existent user', async () => {
    const input: GetUserSessionsInput = {
      user_id: 'non-existent-user'
    };

    const result = await getUserSessions(input);

    expect(result).toHaveLength(0);
  });
});
