
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, chatSessionsTable, messagesTable, anonymousSessionsTable } from '../db/schema';
import { type GetChatHistoryInput } from '../schema';
import { getChatHistory } from '../handlers/get_chat_history';

describe('getChatHistory', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return messages for a registered user session', async () => {
    // Create user
    const user = await db.insert(usersTable)
      .values({
        id: 'user-1',
        email: 'test@example.com'
      })
      .returning()
      .execute();

    // Create chat session
    const session = await db.insert(chatSessionsTable)
      .values({
        id: 'session-1',
        user_id: 'user-1',
        title: 'Test Chat'
      })
      .returning()
      .execute();

    // Create messages
    await db.insert(messagesTable)
      .values([
        {
          id: 'msg-1',
          session_id: 'session-1',
          role: 'user',
          content: 'Hello'
        },
        {
          id: 'msg-2',
          session_id: 'session-1',
          role: 'assistant',
          content: 'Hi there!'
        }
      ])
      .execute();

    const input: GetChatHistoryInput = {
      session_id: 'session-1',
      user_id: 'user-1'
    };

    const result = await getChatHistory(input);

    expect(result).toHaveLength(2);
    expect(result[0].content).toEqual('Hello');
    expect(result[0].role).toEqual('user');
    expect(result[1].content).toEqual('Hi there!');
    expect(result[1].role).toEqual('assistant');
    expect(result[0].created_at).toBeInstanceOf(Date);
    expect(result[1].created_at).toBeInstanceOf(Date);
  });

  it('should return messages for an anonymous session with valid token', async () => {
    // Create anonymous session
    await db.insert(anonymousSessionsTable)
      .values({
        id: 'anon-1',
        session_token: 'token-123',
        message_count: 1
      })
      .execute();

    // Create chat session (no user_id for anonymous)
    await db.insert(chatSessionsTable)
      .values({
        id: 'session-2',
        user_id: null,
        title: 'Anonymous Chat'
      })
      .execute();

    // Create message
    await db.insert(messagesTable)
      .values({
        id: 'msg-3',
        session_id: 'session-2',
        role: 'user',
        content: 'Anonymous message'
      })
      .execute();

    const input: GetChatHistoryInput = {
      session_id: 'session-2',
      session_token: 'token-123'
    };

    const result = await getChatHistory(input);

    expect(result).toHaveLength(1);
    expect(result[0].content).toEqual('Anonymous message');
    expect(result[0].role).toEqual('user');
  });

  it('should return messages ordered by creation time', async () => {
    // Create user and session
    await db.insert(usersTable)
      .values({
        id: 'user-2',
        email: 'test2@example.com'
      })
      .execute();

    await db.insert(chatSessionsTable)
      .values({
        id: 'session-3',
        user_id: 'user-2',
        title: 'Ordered Chat'
      })
      .execute();

    // Create messages with different timestamps
    const now = new Date();
    const earlier = new Date(now.getTime() - 60000); // 1 minute earlier
    const later = new Date(now.getTime() + 60000); // 1 minute later

    await db.insert(messagesTable)
      .values([
        {
          id: 'msg-later',
          session_id: 'session-3',
          role: 'assistant',
          content: 'Later message',
          created_at: later
        },
        {
          id: 'msg-earlier',
          session_id: 'session-3',
          role: 'user',
          content: 'Earlier message',
          created_at: earlier
        },
        {
          id: 'msg-middle',
          session_id: 'session-3',
          role: 'user',
          content: 'Middle message',
          created_at: now
        }
      ])
      .execute();

    const input: GetChatHistoryInput = {
      session_id: 'session-3',
      user_id: 'user-2'
    };

    const result = await getChatHistory(input);

    expect(result).toHaveLength(3);
    expect(result[0].content).toEqual('Earlier message');
    expect(result[1].content).toEqual('Middle message');
    expect(result[2].content).toEqual('Later message');
  });

  it('should throw error for non-existent session', async () => {
    const input: GetChatHistoryInput = {
      session_id: 'non-existent',
      user_id: 'user-1'
    };

    await expect(getChatHistory(input)).rejects.toThrow(/chat session not found/i);
  });

  it('should throw error when user tries to access another user\'s session', async () => {
    // Create two users
    await db.insert(usersTable)
      .values([
        { id: 'user-1', email: 'user1@example.com' },
        { id: 'user-2', email: 'user2@example.com' }
      ])
      .execute();

    // Create session for user-1
    await db.insert(chatSessionsTable)
      .values({
        id: 'session-1',
        user_id: 'user-1',
        title: 'User 1 Chat'
      })
      .execute();

    const input: GetChatHistoryInput = {
      session_id: 'session-1',
      user_id: 'user-2' // Different user trying to access
    };

    await expect(getChatHistory(input)).rejects.toThrow(/access denied/i);
  });

  it('should throw error for anonymous session without token', async () => {
    // Create anonymous session
    await db.insert(chatSessionsTable)
      .values({
        id: 'session-anon',
        user_id: null,
        title: 'Anonymous Chat'
      })
      .execute();

    const input: GetChatHistoryInput = {
      session_id: 'session-anon'
      // No session_token provided
    };

    await expect(getChatHistory(input)).rejects.toThrow(/session token required/i);
  });

  it('should throw error for invalid session token', async () => {
    // Create anonymous session
    await db.insert(chatSessionsTable)
      .values({
        id: 'session-anon',
        user_id: null,
        title: 'Anonymous Chat'
      })
      .execute();

    const input: GetChatHistoryInput = {
      session_id: 'session-anon',
      session_token: 'invalid-token'
    };

    await expect(getChatHistory(input)).rejects.toThrow(/invalid session token/i);
  });

  it('should return empty array for session with no messages', async () => {
    // Create user and session
    await db.insert(usersTable)
      .values({
        id: 'user-empty',
        email: 'empty@example.com'
      })
      .execute();

    await db.insert(chatSessionsTable)
      .values({
        id: 'session-empty',
        user_id: 'user-empty',
        title: 'Empty Chat'
      })
      .execute();

    const input: GetChatHistoryInput = {
      session_id: 'session-empty',
      user_id: 'user-empty'
    };

    const result = await getChatHistory(input);

    expect(result).toHaveLength(0);
    expect(Array.isArray(result)).toBe(true);
  });
});
