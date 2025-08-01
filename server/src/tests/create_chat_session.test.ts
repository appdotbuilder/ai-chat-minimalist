
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { chatSessionsTable, anonymousSessionsTable, usersTable } from '../db/schema';
import { type CreateChatSessionInput } from '../schema';
import { createChatSession } from '../handlers/create_chat_session';
import { eq } from 'drizzle-orm';

describe('createChatSession', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a chat session for authenticated user', async () => {
    // Create prerequisite user
    const userId = 'user_123';
    await db.insert(usersTable)
      .values({
        id: userId,
        email: 'test@example.com',
        created_at: new Date()
      })
      .execute();

    const input: CreateChatSessionInput = {
      user_id: userId,
      title: 'Test Chat Session'
    };

    const result = await createChatSession(input);

    expect(result.id).toBeDefined();
    expect(result.user_id).toEqual(userId);
    expect(result.title).toEqual('Test Chat Session');
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should create a chat session for anonymous user', async () => {
    const input: CreateChatSessionInput = {
      user_id: null,
      session_token: 'anon_token_123',
      title: 'Anonymous Chat'
    };

    const result = await createChatSession(input);

    expect(result.id).toBeDefined();
    expect(result.user_id).toBeNull();
    expect(result.title).toEqual('Anonymous Chat');
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should generate default title when none provided', async () => {
    const input: CreateChatSessionInput = {
      user_id: null
    };

    const result = await createChatSession(input);

    expect(result.title).toEqual('New Chat');
  });

  it('should save chat session to database', async () => {
    const input: CreateChatSessionInput = {
      user_id: null,
      title: 'Database Test Chat'
    };

    const result = await createChatSession(input);

    const sessions = await db.select()
      .from(chatSessionsTable)
      .where(eq(chatSessionsTable.id, result.id))
      .execute();

    expect(sessions).toHaveLength(1);
    expect(sessions[0].title).toEqual('Database Test Chat');
    expect(sessions[0].user_id).toBeNull();
  });

  it('should create anonymous session tracking for new anonymous user', async () => {
    const sessionToken = 'new_anon_token_456';
    const input: CreateChatSessionInput = {
      user_id: null,
      session_token: sessionToken,
      title: 'New Anonymous Chat'
    };

    await createChatSession(input);

    const anonymousSessions = await db.select()
      .from(anonymousSessionsTable)
      .where(eq(anonymousSessionsTable.session_token, sessionToken))
      .execute();

    expect(anonymousSessions).toHaveLength(1);
    expect(anonymousSessions[0].session_token).toEqual(sessionToken);
    expect(anonymousSessions[0].message_count).toEqual(0);
    expect(anonymousSessions[0].created_at).toBeInstanceOf(Date);
    expect(anonymousSessions[0].last_activity).toBeInstanceOf(Date);
  });

  it('should update last activity for existing anonymous session', async () => {
    const sessionToken = 'existing_anon_token_789';
    
    // Create existing anonymous session
    const originalTime = new Date('2023-01-01T00:00:00Z');
    await db.insert(anonymousSessionsTable)
      .values({
        id: 'anon_existing',
        session_token: sessionToken,
        message_count: 5,
        created_at: originalTime,
        last_activity: originalTime
      })
      .execute();

    const input: CreateChatSessionInput = {
      user_id: null,
      session_token: sessionToken,
      title: 'Another Chat'
    };

    await createChatSession(input);

    const anonymousSessions = await db.select()
      .from(anonymousSessionsTable)
      .where(eq(anonymousSessionsTable.session_token, sessionToken))
      .execute();

    expect(anonymousSessions).toHaveLength(1);
    expect(anonymousSessions[0].message_count).toEqual(5); // Should remain unchanged
    expect(anonymousSessions[0].created_at).toEqual(originalTime); // Should remain unchanged
    expect(anonymousSessions[0].last_activity.getTime()).toBeGreaterThan(originalTime.getTime()); // Should be updated
  });

  it('should not create anonymous session tracking for authenticated users', async () => {
    // Create prerequisite user
    const userId = 'user_456';
    await db.insert(usersTable)
      .values({
        id: userId,
        email: 'user@example.com',
        created_at: new Date()
      })
      .execute();

    const input: CreateChatSessionInput = {
      user_id: userId,
      session_token: 'should_be_ignored',
      title: 'Authenticated Chat'
    };

    await createChatSession(input);

    // Verify no anonymous session was created
    const anonymousSessions = await db.select()
      .from(anonymousSessionsTable)
      .where(eq(anonymousSessionsTable.session_token, 'should_be_ignored'))
      .execute();

    expect(anonymousSessions).toHaveLength(0);
  });
});
