
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { anonymousSessionsTable } from '../db/schema';
import { type CheckMessageLimitInput } from '../schema';
import { checkMessageLimit } from '../handlers/check_message_limit';
import { eq } from 'drizzle-orm';

const testInput: CheckMessageLimitInput = {
  session_token: 'test-session-token-123'
};

describe('checkMessageLimit', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create new anonymous session for new token', async () => {
    const result = await checkMessageLimit(testInput);

    expect(result.canSendMessage).toBe(true);
    expect(result.remainingMessages).toBe(10);
    expect(result.messageCount).toBe(0);

    // Verify session was created in database
    const sessions = await db.select()
      .from(anonymousSessionsTable)
      .where(eq(anonymousSessionsTable.session_token, testInput.session_token))
      .execute();

    expect(sessions).toHaveLength(1);
    expect(sessions[0].session_token).toBe(testInput.session_token);
    expect(sessions[0].message_count).toBe(0);
    expect(sessions[0].created_at).toBeInstanceOf(Date);
    expect(sessions[0].last_activity).toBeInstanceOf(Date);
  });

  it('should use existing session data', async () => {
    // Create existing session with 5 messages
    const sessionId = 'existing-session-id';
    await db.insert(anonymousSessionsTable)
      .values({
        id: sessionId,
        session_token: testInput.session_token,
        message_count: 5
      })
      .execute();

    const result = await checkMessageLimit(testInput);

    expect(result.canSendMessage).toBe(true);
    expect(result.remainingMessages).toBe(5);
    expect(result.messageCount).toBe(5);
  });

  it('should enforce message limit', async () => {
    // Create session at limit
    const sessionId = 'limit-session-id';
    await db.insert(anonymousSessionsTable)
      .values({
        id: sessionId,
        session_token: testInput.session_token,
        message_count: 10
      })
      .execute();

    const result = await checkMessageLimit(testInput);

    expect(result.canSendMessage).toBe(false);
    expect(result.remainingMessages).toBe(0);
    expect(result.messageCount).toBe(10);
  });

  it('should handle session over limit', async () => {
    // Create session over limit (edge case)
    const sessionId = 'over-limit-session-id';
    await db.insert(anonymousSessionsTable)
      .values({
        id: sessionId,
        session_token: testInput.session_token,
        message_count: 15
      })
      .execute();

    const result = await checkMessageLimit(testInput);

    expect(result.canSendMessage).toBe(false);
    expect(result.remainingMessages).toBe(0);
    expect(result.messageCount).toBe(15);
  });

  it('should handle different session tokens independently', async () => {
    const firstToken = 'token-1';
    const secondToken = 'token-2';

    // Create session for first token at limit
    await db.insert(anonymousSessionsTable)
      .values({
        id: 'session-1',
        session_token: firstToken,
        message_count: 10
      })
      .execute();

    // Check first token - should be at limit
    const firstResult = await checkMessageLimit({ session_token: firstToken });
    expect(firstResult.canSendMessage).toBe(false);
    expect(firstResult.messageCount).toBe(10);

    // Check second token - should be new session
    const secondResult = await checkMessageLimit({ session_token: secondToken });
    expect(secondResult.canSendMessage).toBe(true);
    expect(secondResult.messageCount).toBe(0);
    expect(secondResult.remainingMessages).toBe(10);
  });
});
