
import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import 'dotenv/config';
import cors from 'cors';
import superjson from 'superjson';

import { 
  createChatSessionInputSchema,
  sendMessageInputSchema,
  getChatHistoryInputSchema,
  getUserSessionsInputSchema,
  checkMessageLimitInputSchema
} from './schema';

import { createChatSession } from './handlers/create_chat_session';
import { sendMessage } from './handlers/send_message';
import { getChatHistory } from './handlers/get_chat_history';
import { getUserSessions } from './handlers/get_user_sessions';
import { checkMessageLimit } from './handlers/check_message_limit';
import { createAnonymousSession } from './handlers/create_anonymous_session';

const t = initTRPC.create({
  transformer: superjson,
});

const publicProcedure = t.procedure;
const router = t.router;

const appRouter = router({
  healthcheck: publicProcedure.query(() => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }),
  
  // Create a new chat session
  createChatSession: publicProcedure
    .input(createChatSessionInputSchema)
    .mutation(({ input }) => createChatSession(input)),
  
  // Send a message and get AI response
  sendMessage: publicProcedure
    .input(sendMessageInputSchema)
    .mutation(({ input }) => sendMessage(input)),
  
  // Get chat history for a session
  getChatHistory: publicProcedure
    .input(getChatHistoryInputSchema)
    .query(({ input }) => getChatHistory(input)),
  
  // Get all sessions for a user
  getUserSessions: publicProcedure
    .input(getUserSessionsInputSchema)
    .query(({ input }) => getUserSessions(input)),
  
  // Check message limit for anonymous users
  checkMessageLimit: publicProcedure
    .input(checkMessageLimitInputSchema)
    .query(({ input }) => checkMessageLimit(input)),
  
  // Create anonymous session
  createAnonymousSession: publicProcedure
    .mutation(() => createAnonymousSession()),
});

export type AppRouter = typeof appRouter;

async function start() {
  const port = process.env['SERVER_PORT'] || 2022;
  const server = createHTTPServer({
    middleware: (req, res, next) => {
      cors()(req, res, next);
    },
    router: appRouter,
    createContext() {
      return {};
    },
  });
  server.listen(port);
  console.log(`TRPC server listening at port: ${port}`);
}

start();
