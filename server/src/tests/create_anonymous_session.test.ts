
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { anonymousSessionsTable } from '../db/schema';
import { createAnonymousSession } from '../handlers/create_anonymous_session';
import { eq } from 'drizzle-orm';

describe('createAnonymousSession', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create an anonymous session', async () => {
    const result = await createAnonymousSession();

    // Verify returned structure
    expect(result.sessionToken).toBeDefined();
    expect(typeof result.sessionToken).toBe('string');
    expect(result.sessionToken).toMatch(/^anon_\d+_[a-z0-9]{16}$/);
    
    expect(result.session).toBeDefined();
    expect(result.session.id).toBeDefined();
    expect(result.session.session_token).toEqual(result.sessionToken);
    expect(result.session.message_count).toEqual(0);
    expect(result.session.created_at).toBeInstanceOf(Date);
    expect(result.session.last_activity).toBeInstanceOf(Date);
  });

  it('should save anonymous session to database', async () => {
    const result = await createAnonymousSession();

    // Query database to verify record was created
    const sessions = await db.select()
      .from(anonymousSessionsTable)
      .where(eq(anonymousSessionsTable.session_token, result.sessionToken))
      .execute();

    expect(sessions).toHaveLength(1);
    expect(sessions[0].id).toEqual(result.session.id);
    expect(sessions[0].session_token).toEqual(result.sessionToken);
    expect(sessions[0].message_count).toEqual(0);
    expect(sessions[0].created_at).toBeInstanceOf(Date);
    expect(sessions[0].last_activity).toBeInstanceOf(Date);
  });

  it('should generate unique session tokens', async () => {
    const result1 = await createAnonymousSession();
    const result2 = await createAnonymousSession();

    // Verify tokens are different
    expect(result1.sessionToken).not.toEqual(result2.sessionToken);
    expect(result1.session.id).not.toEqual(result2.session.id);

    // Verify both sessions exist in database
    const sessions = await db.select()
      .from(anonymousSessionsTable)
      .execute();

    expect(sessions).toHaveLength(2);
    const tokens = sessions.map(s => s.session_token);
    expect(tokens).toContain(result1.sessionToken);
    expect(tokens).toContain(result2.sessionToken);
  });

  it('should initialize default values correctly', async () => {
    const result = await createAnonymousSession();

    // Verify default message count
    expect(result.session.message_count).toEqual(0);
    
    // Verify timestamps are recent (within last minute)
    const now = new Date();
    const oneMinuteAgo = new Date(now.getTime() - 60000);
    
    expect(result.session.created_at).toBeInstanceOf(Date);
    expect(result.session.created_at.getTime()).toBeGreaterThan(oneMinuteAgo.getTime());
    expect(result.session.created_at.getTime()).toBeLessThanOrEqual(now.getTime());
    
    expect(result.session.last_activity).toBeInstanceOf(Date);
    expect(result.session.last_activity.getTime()).toBeGreaterThan(oneMinuteAgo.getTime());
    expect(result.session.last_activity.getTime()).toBeLessThanOrEqual(now.getTime());
  });
});
