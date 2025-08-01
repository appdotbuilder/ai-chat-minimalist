
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { chatSessionsTable, messagesTable, anonymousSessionsTable, usersTable } from '../db/schema';
import { type SendMessageInput } from '../schema';
import { sendMessage } from '../handlers/send_message';
import { eq } from 'drizzle-orm';

// Test data
const testUserId = 'user_123';
const testSessionId = 'session_123';
const testSessionToken = 'anon_token_123';

const testInput: SendMessageInput = {
  session_id: testSessionId,
  content: 'Hello, how are you?'
};

describe('sendMessage', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  // Helper to create test data
  const createTestSession = async () => {
    await db.insert(usersTable)
      .values({
        id: testUserId,
        email: 'test@example.com',
        created_at: new Date()
      })
      .execute();

    await db.insert(chatSessionsTable)
      .values({
        id: testSessionId,
        user_id: testUserId,
        title: 'Test Chat',
        created_at: new Date(),
        updated_at: new Date()
      })
      .execute();
  };

  const createAnonymousSession = async () => {
    await db.insert(chatSessionsTable)
      .values({
        id: testSessionId,
        user_id: null,
        title: 'Anonymous Chat',
        created_at: new Date(),
        updated_at: new Date()
      })
      .execute();

    await db.insert(anonymousSessionsTable)
      .values({
        id: 'anon_123',
        session_token: testSessionToken,
        message_count: 0,
        created_at: new Date(),
        last_activity: new Date()
      })
      .execute();
  };

  it('should send message and get AI response for registered user', async () => {
    await createTestSession();

    const result = await sendMessage(testInput);

    // Validate response structure
    expect(result.userMessage).toBeDefined();
    expect(result.aiResponse).toBeDefined();

    // Validate user message
    expect(result.userMessage.session_id).toEqual(testSessionId);
    expect(result.userMessage.role).toEqual('user');
    expect(result.userMessage.content).toEqual('Hello, how are you?');
    expect(result.userMessage.id).toBeDefined();
    expect(result.userMessage.created_at).toBeInstanceOf(Date);

    // Validate AI response
    expect(result.aiResponse.session_id).toEqual(testSessionId);
    expect(result.aiResponse.role).toEqual('assistant');
    expect(result.aiResponse.content).toContain('AI Response to');
    expect(result.aiResponse.content).toContain('Hello, how are you?');
    expect(result.aiResponse.id).toBeDefined();
    expect(result.aiResponse.created_at).toBeInstanceOf(Date);

    // Ensure different message IDs
    expect(result.userMessage.id).not.toEqual(result.aiResponse.id);
  });

  it('should save messages to database', async () => {
    await createTestSession();

    const result = await sendMessage(testInput);

    // Check user message in database
    const userMessages = await db.select()
      .from(messagesTable)
      .where(eq(messagesTable.id, result.userMessage.id))
      .execute();

    expect(userMessages).toHaveLength(1);
    expect(userMessages[0].role).toEqual('user');
    expect(userMessages[0].content).toEqual('Hello, how are you?');

    // Check AI message in database
    const aiMessages = await db.select()
      .from(messagesTable)
      .where(eq(messagesTable.id, result.aiResponse.id))
      .execute();

    expect(aiMessages).toHaveLength(1);
    expect(aiMessages[0].role).toEqual('assistant');
    expect(aiMessages[0].content).toContain('AI Response to');
  });

  it('should update chat session updated_at timestamp', async () => {
    await createTestSession();

    const beforeUpdate = await db.select()
      .from(chatSessionsTable)
      .where(eq(chatSessionsTable.id, testSessionId))
      .execute();

    const originalUpdatedAt = beforeUpdate[0].updated_at;

    // Small delay to ensure timestamp difference
    await new Promise(resolve => setTimeout(resolve, 10));

    await sendMessage(testInput);

    const afterUpdate = await db.select()
      .from(chatSessionsTable)
      .where(eq(chatSessionsTable.id, testSessionId))
      .execute();

    expect(afterUpdate[0].updated_at > originalUpdatedAt).toBe(true);
  });

  it('should handle anonymous user messages and update message count', async () => {
    await createAnonymousSession();

    const anonymousInput: SendMessageInput = {
      ...testInput,
      session_token: testSessionToken
    };

    const result = await sendMessage(anonymousInput);

    // Validate messages were created
    expect(result.userMessage).toBeDefined();
    expect(result.aiResponse).toBeDefined();

    // Check anonymous session was updated
    const updatedSession = await db.select()
      .from(anonymousSessionsTable)
      .where(eq(anonymousSessionsTable.session_token, testSessionToken))
      .execute();

    expect(updatedSession).toHaveLength(1);
    expect(updatedSession[0].message_count).toEqual(1);
    expect(updatedSession[0].last_activity).toBeInstanceOf(Date);
  });

  it('should throw error when message limit exceeded for anonymous users', async () => {
    await createAnonymousSession();

    // Set message count to limit
    await db.update(anonymousSessionsTable)
      .set({ message_count: 10 })
      .where(eq(anonymousSessionsTable.session_token, testSessionToken))
      .execute();

    const anonymousInput: SendMessageInput = {
      ...testInput,
      session_token: testSessionToken
    };

    await expect(sendMessage(anonymousInput)).rejects.toThrow(/message limit exceeded/i);
  });

  it('should throw error when anonymous session token not found', async () => {
    await createTestSession();

    const invalidInput: SendMessageInput = {
      ...testInput,
      session_token: 'invalid_token'
    };

    await expect(sendMessage(invalidInput)).rejects.toThrow(/anonymous session not found/i);
  });

  it('should create messages with sequential timestamps', async () => {
    await createTestSession();

    const result = await sendMessage(testInput);

    expect(result.aiResponse.created_at >= result.userMessage.created_at).toBe(true);
  });
});
