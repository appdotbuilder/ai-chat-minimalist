
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { trpc } from '@/utils/trpc';
import { useState, useEffect, useCallback, useRef } from 'react';
import type { Message, ChatSession } from '../../server/src/schema';

interface MessageLimitInfo {
  canSendMessage: boolean;
  remainingMessages: number;
  messageCount: number;
}

function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [backendError, setBackendError] = useState<string | null>(null);
  const [messageLimitInfo, setMessageLimitInfo] = useState<MessageLimitInfo>({
    canSendMessage: true,
    remainingMessages: 10,
    messageCount: 0
  });
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when messages change
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Initialize anonymous session on app load
  const initializeAnonymousSession = useCallback(async () => {
    try {
      setBackendError(null);
      const result = await trpc.createAnonymousSession.mutate();
      setSessionToken(result.sessionToken);
      
      // Check initial message limit
      try {
        const limitInfo = await trpc.checkMessageLimit.query({ 
          session_token: result.sessionToken 
        });
        setMessageLimitInfo(limitInfo);
      } catch (limitError) {
        console.warn('Could not check message limit:', limitError);
        // Use default values if limit check fails
      }
    } catch (error) {
      console.error('Failed to initialize anonymous session:', error);
      setBackendError('Backend connection failed. Using demo mode.');
      // Set a fallback session token for demo purposes
      setSessionToken('demo_session_token');
    }
  }, []);

  // Load user sessions
  const loadSessions = useCallback(async () => {
    if (!sessionToken || sessionToken === 'demo_session_token') return;
    
    try {
      const result = await trpc.getUserSessions.query({ 
        session_token: sessionToken 
      });
      setSessions(result);
    } catch (error) {
      console.error('Failed to load sessions:', error);
    }
  }, [sessionToken]);

  // Load chat history for current session
  const loadChatHistory = useCallback(async () => {
    if (!currentSessionId || !sessionToken || sessionToken === 'demo_session_token') return;
    
    try {
      const result = await trpc.getChatHistory.query({
        session_id: currentSessionId,
        session_token: sessionToken
      });
      setMessages(result);
    } catch (error) {
      console.error('Failed to load chat history:', error);
    }
  }, [currentSessionId, sessionToken]);

  // Initialize app
  useEffect(() => {
    initializeAnonymousSession();
  }, [initializeAnonymousSession]);

  // Load sessions when sessionToken is available
  useEffect(() => {
    if (sessionToken && sessionToken !== 'demo_session_token') {
      loadSessions();
    }
  }, [sessionToken, loadSessions]);

  // Load chat history when session changes
  useEffect(() => {
    loadChatHistory();
  }, [loadChatHistory]);

  // Demo mode message handler
  const handleDemoMessage = (content: string) => {
    const userMessage: Message = {
      id: `demo_user_${Date.now()}`,
      session_id: currentSessionId || 'demo_session',
      role: 'user',
      content: content,
      created_at: new Date()
    };

    const aiMessage: Message = {
      id: `demo_ai_${Date.now()}`,
      session_id: currentSessionId || 'demo_session',
      role: 'assistant',
      content: '🤖 This is a demo response! The backend is not connected, so I can\'t provide real AI responses. Once the backend is set up, you\'ll get actual AI-powered conversations here!',
      created_at: new Date()
    };

    setMessages((prev: Message[]) => [...prev, userMessage, aiMessage]);
    
    // Update message count in demo mode
    setMessageLimitInfo((prev: MessageLimitInfo) => ({
      ...prev,
      messageCount: prev.messageCount + 1,
      remainingMessages: Math.max(0, prev.remainingMessages - 1),
      canSendMessage: prev.remainingMessages > 1
    }));
  };

  // Create new chat session
  const createNewChat = async () => {
    if (!sessionToken) return;
    
    if (sessionToken === 'demo_session_token') {
      // Demo mode - create local session
      const demoSession: ChatSession = {
        id: `demo_session_${Date.now()}`,
        user_id: null,
        title: 'Demo Chat',
        created_at: new Date(),
        updated_at: new Date()
      };
      setSessions((prev: ChatSession[]) => [demoSession, ...prev]);
      setCurrentSessionId(demoSession.id);
      setMessages([]);
      setTimeout(() => inputRef.current?.focus(), 100);
      return;
    }
    
    try {
      const newSession = await trpc.createChatSession.mutate({
        session_token: sessionToken,
        title: 'New Chat'
      });
      
      setSessions((prev: ChatSession[]) => [newSession, ...prev]);
      setCurrentSessionId(newSession.id);
      setMessages([]);
      
      // Focus input after creating new chat
      setTimeout(() => inputRef.current?.focus(), 100);
    } catch (error) {
      console.error('Failed to create new chat:', error);
    }
  };

  // Select existing session
  const selectSession = (sessionId: string) => {
    setCurrentSessionId(sessionId);
  };

  // Send message
  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || !sessionToken || isLoading) return;

    // Demo mode handling
    if (sessionToken === 'demo_session_token') {
      if (!messageLimitInfo.canSendMessage) return;
      
      // Create demo session if none exists
      if (!currentSessionId) {
        const demoSession: ChatSession = {
          id: `demo_session_${Date.now()}`,
          user_id: null,
          title: inputValue.length > 30 ? inputValue.substring(0, 30) + '...' : inputValue,
          created_at: new Date(),
          updated_at: new Date()
        };
        setSessions((prev: ChatSession[]) => [demoSession, ...prev]);
        setCurrentSessionId(demoSession.id);
      }

      const messageContent = inputValue;
      setInputValue('');
      setIsLoading(true);

      // Simulate AI response delay
      setTimeout(() => {
        handleDemoMessage(messageContent);
        setIsLoading(false);
      }, 1000);
      return;
    }

    // Real backend handling
    let sessionId = currentSessionId;
    if (!sessionId) {
      try {
        const newSession = await trpc.createChatSession.mutate({
          session_token: sessionToken,
          title: inputValue.length > 30 ? inputValue.substring(0, 30) + '...' : inputValue
        });
        sessionId = newSession.id;
        setCurrentSessionId(sessionId);
        setSessions((prev: ChatSession[]) => [newSession, ...prev]);
      } catch (error) {
        console.error('Failed to create session:', error);
        return;
      }
    }

    const messageContent = inputValue;
    setInputValue('');
    setIsLoading(true);

    try {
      const result = await trpc.sendMessage.mutate({
        session_id: sessionId,
        content: messageContent,
        session_token: sessionToken
      });

      // Add both user message and AI response
      setMessages((prev: Message[]) => [...prev, result.userMessage, result.aiResponse]);
      
      // Update message limit info
      const limitInfo = await trpc.checkMessageLimit.query({ 
        session_token: sessionToken 
      });
      setMessageLimitInfo(limitInfo);

    } catch (error) {
      console.error('Failed to send message:', error);
      // Re-add the input value if sending failed
      setInputValue(messageContent);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <Button onClick={createNewChat} className="w-full" disabled={!sessionToken}>
            ✨ New Chat
          </Button>
        </div>
        
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-2">
            {sessions.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">
                No chat sessions yet.<br />
                Start a new conversation! 💬
              </p>
            ) : (
              sessions.map((session: ChatSession) => (
                <Card
                  key={session.id}
                  className={`cursor-pointer transition-colors hover:bg-gray-50 ${
                    currentSessionId === session.id ? 'ring-2 ring-blue-500' : ''
                  }`}
                  onClick={() => selectSession(session.id)}
                >
                  <CardContent className="p-3">
                    <h3 className="font-medium text-sm truncate">{session.title}</h3>
                    <p className="text-xs text-gray-500 mt-1">
                      {session.updated_at.toLocaleDateString()}
                    </p>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </ScrollArea>

        {/* Backend status and message limit info */}
        <div className="p-4 border-t border-gray-200">
          {backendError && (
            <Alert variant="destructive" className="mb-2">
              <AlertDescription className="text-xs">
                ⚠️ Demo Mode: Backend not available
              </AlertDescription>
            </Alert>
          )}
          
          <Alert className="mb-2">
            <AlertDescription className="text-xs">
              💭 Anonymous mode: {messageLimitInfo.remainingMessages} messages remaining
            </AlertDescription>
          </Alert>
          
          {!messageLimitInfo.canSendMessage && (
            <Alert variant="destructive">
              <AlertDescription className="text-xs">
                Message limit reached. Create an account to continue chatting! 🚀
              </AlertDescription>
            </Alert>
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Chat Header */}
        <div className="bg-white border-b border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold text-gray-800">
              {currentSessionId ? 
                sessions.find((s: ChatSession) => s.id === currentSessionId)?.title || 'Chat' 
                : 'AI Assistant'
              } 🤖
            </h1>
            <div className="flex items-center space-x-2">
              <Badge variant="outline" className="text-xs">
                Anonymous User
              </Badge>
              {backendError && (
                <Badge variant="secondary" className="text-xs">
                  Demo Mode
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Messages Area */}
        <ScrollArea className="flex-1 p-4">
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-gray-500">
                <div className="text-4xl mb-4">💬</div>
                <h2 className="text-lg font-medium mb-2">Welcome to AI Chat!</h2>
                <p className="text-sm mb-2">
                  Start a conversation by typing a message below.
                </p>
                {backendError && (
                  <p className="text-xs text-orange-600">
                    Currently in demo mode - responses are simulated.
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4 max-w-4xl mx-auto">
              {messages.map((message: Message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[70%] rounded-lg px-4 py-2 ${
                      message.role === 'user'
                        ? 'bg-blue-500 text-white'
                        : 'bg-white border border-gray-200 text-gray-800'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    <p className={`text-xs mt-1 ${
                      message.role === 'user' ? 'text-blue-100' : 'text-gray-500'
                    }`}>
                      {message.created_at.toLocaleTimeString([], { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </p>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-white border border-gray-200 rounded-lg px-4 py-2 max-w-[70%]">
                    <div className="flex items-center space-x-2">
                      <div className="animate-pulse flex space-x-1">
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                      </div>
                      <span className="text-xs text-gray-500">
                        {backendError ? 'Generating demo response...' : 'AI is thinking...'}
                      </span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </ScrollArea>

        <Separator />

        {/* Message Input */}
        <div className="bg-white p-4">
          <form onSubmit={sendMessage} className="flex space-x-2 max-w-4xl mx-auto">
            <Input
              ref={inputRef}
              value={inputValue}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInputValue(e.target.value)}
              placeholder={
                messageLimitInfo.canSendMessage 
                  ? backendError 
                    ? "Type a message (demo mode)..." 
                    : "Type your message..."
                  : "Message limit reached. Create an account to continue."
              }
              disabled={isLoading || !messageLimitInfo.canSendMessage}
              className="flex-1"
            />
            <Button 
              type="submit" 
              disabled={!inputValue.trim() || isLoading || !messageLimitInfo.canSendMessage}
            >
              {isLoading ? '⏳' : '📤'}
            </Button>
          </form>
          
          {!messageLimitInfo.canSendMessage && (
            <div className="text-xs text-center text-gray-500 mt-2">
              🔒 Create an account to send unlimited messages
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
