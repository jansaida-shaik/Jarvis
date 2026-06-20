'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  MessageSquare,
  Send,
  Plus,
  Paperclip,
  Brain,
  Sparkles,
  ArrowUpRight,
  Loader2,
  Trash2,
  FileText,
  AlertTriangle,
  Trophy,
  Award,
  Star,
  CheckCircle,
  XCircle,
  Wrench
} from 'lucide-react';
import GlowingCard from '@/components/glowing-card';

interface ParsedCard {
  type: 'confirmation' | 'tool' | 'gamification';
  toolName?: string;
  args?: any;
  details?: any;
  result?: any;
  gamification?: any;
  raw: string;
}

export function parseMessageContent(content: string): { text: string; cards: ParsedCard[] } {
  if (!content) return { text: '', cards: [] };

  const cards: ParsedCard[] = [];
  const cardSegments: { start: number; end: number; type: string; content: string }[] = [];
  const length = content.length;
  let i = 0;

  while (i < length) {
    if (content[i] === '[') {
      const rest = content.slice(i);
      let matchedType = '';
      let headerLength = 0;
      if (rest.startsWith('[ConfirmationCard:')) {
        matchedType = 'ConfirmationCard';
        headerLength = '[ConfirmationCard:'.length;
      } else if (rest.startsWith('[ToolCard:')) {
        matchedType = 'ToolCard';
        headerLength = '[ToolCard:'.length;
      } else if (rest.startsWith('[GamificationCard:')) {
        matchedType = 'GamificationCard';
        headerLength = '[GamificationCard:'.length;
      }

      if (matchedType) {
        let braceCount = 0;
        let inQuote = false;
        let quoteChar = '';
        let foundEnd = -1;
        
        for (let j = i + headerLength; j < length; j++) {
          const char = content[j];
          if (inQuote) {
            if (char === quoteChar && content[j - 1] !== '\\') {
              inQuote = false;
            }
          } else {
            if (char === '"' || char === "'") {
              inQuote = true;
              quoteChar = char;
            } else if (char === '{' || char === '[') {
              braceCount++;
            } else if (char === '}' || char === ']') {
              if (char === ']' && braceCount === 0) {
                foundEnd = j;
                break;
              }
              if (braceCount > 0) {
                braceCount--;
              }
            }
          }
        }

        if (foundEnd !== -1) {
          const innerContent = content.slice(i + headerLength, foundEnd).trim();
          cardSegments.push({
            start: i,
            end: foundEnd + 1,
            type: matchedType,
            content: innerContent
          });
          i = foundEnd + 1;
          continue;
        }
      }
    }
    i++;
  }

  let offset = 0;
  let text = '';
  for (const segment of cardSegments) {
    text += content.slice(offset, segment.start);
    offset = segment.end;

    try {
      if (segment.type === 'ConfirmationCard') {
        const firstBrace = segment.content.indexOf('{');
        const toolName = segment.content.slice(0, firstBrace).trim();
        const restContent = segment.content.slice(firstBrace);
        
        let braceCount = 0;
        let inQuote = false;
        let quoteChar = '';
        let splitIndex = -1;
        for (let j = 0; j < restContent.length; j++) {
          const char = restContent[j];
          if (inQuote) {
            if (char === quoteChar && restContent[j - 1] !== '\\') {
              inQuote = false;
            }
          } else {
            if (char === '"' || char === "'") {
              inQuote = true;
              quoteChar = char;
            } else if (char === '{') {
              braceCount++;
            } else if (char === '}') {
              braceCount--;
              if (braceCount === 0) {
                splitIndex = j;
                break;
              }
            }
          }
        }

        if (splitIndex !== -1) {
          const argsStr = restContent.slice(0, splitIndex + 1);
          const detailsStr = restContent.slice(splitIndex + 1).trim();
          const args = JSON.parse(argsStr);
          const details = JSON.parse(detailsStr);
          cards.push({
            type: 'confirmation',
            toolName,
            args,
            details,
            raw: content.slice(segment.start, segment.end)
          });
        }
      } else if (segment.type === 'ToolCard') {
        const firstBrace = segment.content.indexOf('{');
        const toolName = segment.content.slice(0, firstBrace).trim();
        const resultStr = segment.content.slice(firstBrace).trim();
        const result = JSON.parse(resultStr);
        cards.push({
          type: 'tool',
          toolName,
          result,
          raw: content.slice(segment.start, segment.end)
        });
      } else if (segment.type === 'GamificationCard') {
        const gamification = JSON.parse(segment.content);
        cards.push({
          type: 'gamification',
          gamification,
          raw: content.slice(segment.start, segment.end)
        });
      }
    } catch (e) {
      console.error('Failed to parse card segment:', segment, e);
    }
  }
  text += content.slice(offset);

  return { text: text.trim(), cards };
}

export function cleanStreamingText(text: string): string {
  if (!text) return '';
  const cardIndicators = ['[ConfirmationCard:', '[ToolCard:', '[GamificationCard:'];
  let firstIndex = -1;
  for (const indicator of cardIndicators) {
    const idx = text.indexOf(indicator);
    if (idx !== -1 && (firstIndex === -1 || idx < firstIndex)) {
      firstIndex = idx;
    }
  }
  
  if (firstIndex !== -1) {
    return text.slice(0, firstIndex).trim();
  }
  return text;
}

function getToolDisplayName(toolName: string) {
  const mapping: Record<string, string> = {
    'goal.create': 'Goal Initiated',
    'goal.update': 'Goal Updated',
    'goal.delete': 'Goal Removed',
    'milestone.create': 'Milestone Created',
    'milestone.complete': 'Milestone Completed',
    'task.create': 'Task Created',
    'task.update': 'Task Updated',
    'task.complete': 'Task Completed',
    'project.create': 'Project Created',
    'project.delete': 'Project Removed',
    'project.create_note': 'Project Note Added',
    'project.delete_note': 'Project Note Removed',
    'memory.save': 'Memory Index Updated',
    'memory.search': 'Memory Database Query',
    'memory.delete': 'Memory Entry Removed',
    'knowledge.search': 'Knowledge Index Searched',
    'learning.create_plan': 'Learning Program Created',
    'learning.log_session': 'Learning Study Logged',
    'executive.generate_weekly_briefing': 'Executive Digest Compiled',
  };
  return mapping[toolName] || `Tool Execution: ${toolName}`;
}

interface Message {
  id?: string;
  role: string;
  content: string;
  createdAt?: string;
}

interface Conversation {
  id: string;
  title: string;
  updatedAt: string;
  messages: Message[];
}

export default function ChatPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeChatId = searchParams.get('id');

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [prompt, setPrompt] = useState('');
  const [streamingText, setStreamingText] = useState('');
  const [loading, setLoading] = useState(false);
  const [sidebarLoading, setSidebarLoading] = useState(true);

  // Custom Card confirmations/dismissals state
  const [confirmedCards, setConfirmedCards] = useState<Record<string, boolean>>({});
  const [dismissedConfirmations, setDismissedConfirmations] = useState<Record<string, boolean>>({});

  // File upload state
  const [attachedFile, setAttachedFile] = useState<{ name: string; type: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Submit confirmed tool execution from UI buttons
  const submitConfirm = async (toolName: string, args: any) => {
    setLoading(true);
    setErrorState(null);

    const query = `/confirm ${toolName} ${JSON.stringify(args)}`;

    // Optimistically add user message to panel
    const newUserMessage: Message = { role: 'USER', content: `/confirm ${toolName} ${JSON.stringify(args)}` };
    setMessages((prev) => [...prev, newUserMessage]);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: query,
          conversationId: activeChatId || undefined,
        }),
      });

      if (!res.ok) {
        throw new Error('Chat failed');
      }

      const returnedChatId = res.headers.get('X-Conversation-Id');

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let assistantResponse = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const textChunk = decoder.decode(value, { stream: true });
          assistantResponse += textChunk;
          setStreamingText(assistantResponse);
        }
      }

      setMessages((prev) => [...prev, { role: 'ASSISTANT', content: assistantResponse }]);
      setStreamingText('');

      if (returnedChatId && returnedChatId !== activeChatId) {
        router.push(`/chat?id=${returnedChatId}`);
      } else {
        fetchConversations();
      }
    } catch (err) {
      console.error(err);
      setErrorState('Connection issues with AI Core. Check .env database settings.');
    } finally {
      setLoading(false);
    }
  };

  const renderToolDetails = (toolName: string, result: any) => {
    if (!result || typeof result !== 'object') return null;

    const cleanKeys = Object.keys(result).filter(
      key => !['success', 'gamification', 'memoryLogged', 'confirmationRequired'].includes(key)
    );

    if (cleanKeys.length === 0) return null;

    return (
      <div className="grid grid-cols-2 gap-2.5 mt-1 bg-black/20 p-2.5 rounded-xl border border-[rgba(255,255,255,0.03)] font-mono text-[10px]">
        {cleanKeys.map(key => {
          const val = result[key];
          const displayVal = typeof val === 'object' && val !== null ? JSON.stringify(val) : String(val);
          const displayKey = key
            .replace(/([A-Z])/g, ' $1')
            .replace(/[_\-]/g, ' ')
            .toLowerCase()
            .replace(/^\w/, c => c.toUpperCase());

          return (
            <div key={key} className="flex flex-col gap-0.5">
              <span className="text-slate-500 font-semibold">{displayKey}</span>
              <span className="text-slate-200 truncate font-medium text-xs" title={displayVal}>{displayVal}</span>
            </div>
          );
        })}
      </div>
    );
  };

  const renderCardComponent = (card: ParsedCard, cardKey: string) => {
    if (card.type === 'confirmation') {
      return (
        <div key={cardKey} className="glass glow-border border-amber-500/20 bg-amber-500/5 shadow-[0_0_20px_-3px_rgba(245,158,11,0.15)] rounded-2xl p-4 mt-3 flex flex-col gap-3 relative overflow-hidden">
          <div className="absolute -right-8 -top-8 w-16 h-16 rounded-full bg-amber-500/5 blur-xl pointer-events-none" />
          <div className="flex items-center gap-3 border-b border-[rgba(255,255,255,0.04)] pb-2.5">
            <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400">
              <AlertTriangle size={16} className="animate-pulse" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-mono font-bold text-amber-400 uppercase tracking-wider">Safety Authorization Guard</span>
              <h4 className="text-sm font-semibold text-white">{card.details?.title || 'Destructive Action Confirmation'}</h4>
            </div>
          </div>
          <p className="text-xs text-slate-300 font-medium leading-relaxed">
            {card.details?.message || 'Are you sure you want to perform this action?'}
          </p>
          
          {confirmedCards[cardKey] ? (
            <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-semibold font-mono bg-emerald-500/10 border border-emerald-500/20 py-2 px-3 rounded-lg justify-center">
              <CheckCircle size={14} /> AUTHORIZED & RUNNING
            </div>
          ) : dismissedConfirmations[cardKey] ? (
            <div className="flex items-center gap-1.5 text-xs text-slate-400 font-semibold font-mono bg-slate-500/5 border border-slate-500/10 py-2 px-3 rounded-lg justify-center">
              <XCircle size={14} /> ACTION CANCELLED
            </div>
          ) : (
            <div className="flex items-center gap-2.5 mt-1 justify-end">
              <button
                type="button"
                onClick={() => {
                  setDismissedConfirmations(prev => ({ ...prev, [cardKey]: true }));
                }}
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-slate-200 bg-[rgba(255,255,255,0.02)] hover:bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.08)] cursor-pointer transition-all"
              >
                No, Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmedCards(prev => ({ ...prev, [cardKey]: true }));
                  submitConfirm(card.toolName!, card.args);
                }}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-amber-500 to-orange-600 hover:brightness-110 border border-amber-500/30 cursor-pointer shadow-[0_0_15px_-3px_rgba(245,158,11,0.4)] transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                Yes, Execute
              </button>
            </div>
          )}
        </div>
      );
    } else if (card.type === 'tool') {
      return (
        <div key={cardKey} className="glass glow-border border-cyan-500/20 bg-cyan-500/5 shadow-[0_0_20px_-3px_rgba(6,182,212,0.15)] rounded-2xl p-4 mt-3 flex flex-col gap-3 relative overflow-hidden">
          <div className="absolute -right-8 -top-8 w-16 h-16 rounded-full bg-cyan-500/5 blur-xl pointer-events-none" />
          <div className="flex items-center gap-3 border-b border-[rgba(255,255,255,0.04)] pb-2.5">
            <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400">
              <Wrench size={16} />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-mono font-bold text-cyan-400 uppercase tracking-wider">Active Command Center</span>
              <h4 className="text-sm font-semibold text-white">{getToolDisplayName(card.toolName!)}</h4>
            </div>
          </div>
          {renderToolDetails(card.toolName!, card.result)}
        </div>
      );
    } else if (card.type === 'gamification') {
      return (
        <div key={cardKey} className="glass glow-border border-yellow-500/20 bg-yellow-500/5 shadow-[0_0_20px_-3px_rgba(234,179,8,0.15)] rounded-2xl p-4 mt-3 flex flex-col gap-3 relative overflow-hidden">
          <div className="absolute -right-8 -top-8 w-16 h-16 rounded-full bg-yellow-500/5 blur-xl pointer-events-none" />
          <div className="flex items-center gap-3 border-b border-[rgba(255,255,255,0.04)] pb-2.5">
            <div className="p-1.5 rounded-lg bg-yellow-500/10 text-yellow-400">
              <Trophy size={16} className="animate-bounce" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-mono font-bold text-yellow-400 uppercase tracking-wider">Synergy Mastery System</span>
              <h4 className="text-sm font-semibold text-white">{card.gamification?.message || 'XP Awarded!'}</h4>
            </div>
          </div>
          
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-bold font-mono text-yellow-400 glow-text">+{card.gamification?.xpEarned || card.gamification?.xp || 0} XP</span>
            <span className="text-[10px] font-mono text-slate-500 font-medium">New Total: {card.gamification?.newXp || 0} XP</span>
          </div>

          {card.gamification?.levelUp && (
            <div className="flex items-center gap-2.5 p-2 bg-gradient-to-r from-yellow-500/20 via-amber-500/10 to-transparent border border-yellow-500/30 rounded-xl mt-1 animate-pulse">
              <Award size={18} className="text-yellow-400 shrink-0" />
              <div className="flex flex-col">
                <span className="text-xs font-bold text-yellow-300">LEVEL UP ACHIEVED!</span>
                <span className="text-[10px] font-medium text-slate-300">You advanced to Level {card.gamification?.newLevel || 1}!</span>
              </div>
            </div>
          )}

          {(card.gamification?.badgeUnlocked || card.gamification?.badge) && (
            <div className="flex items-center gap-2.5 p-2 bg-gradient-to-r from-indigo-500/20 via-purple-500/10 to-transparent border border-indigo-500/30 rounded-xl mt-1">
              <Star size={18} className="text-indigo-400 shrink-0" />
              <div className="flex flex-col">
                <span className="text-xs font-bold text-indigo-300">NEW BADGE UNLOCKED</span>
                <span className="text-[10px] font-medium text-slate-300">Unlocked badge: "{card.gamification?.badgeUnlocked || card.gamification?.badge}"</span>
              </div>
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingText]);

  // Load conversations list
  const fetchConversations = async () => {
    try {
      const res = await fetch('/api/chat');
      if (!res.ok) throw new Error('Failed to load conversations');
      const data = await res.json();
      setConversations(data);

      // If there is an activeChatId query param, select it
      if (activeChatId) {
        const found = data.find((c: Conversation) => c.id === activeChatId);
        if (found) {
          setMessages(found.messages);
        }
      } else {
        setMessages([]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSidebarLoading(false);
    }
  };

  useEffect(() => {
    fetchConversations();
  }, [activeChatId]);

  const handleStartNewChat = () => {
    router.push('/chat');
    setMessages([]);
    setPrompt('');
    setStreamingText('');
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() && !attachedFile) return;

    const userQuery = prompt;
    let fullQuery = userQuery;
    
    // Append attachment info to mock it
    if (attachedFile) {
      fullQuery = `[Attachment: ${attachedFile.name} (${attachedFile.type})]\n${userQuery}`;
    }

    setPrompt('');
    setAttachedFile(null);
    setLoading(true);
    setErrorState(null);

    // Optimistically add user message to panel
    const newUserMessage: Message = { role: 'USER', content: fullQuery };
    setMessages((prev) => [...prev, newUserMessage]);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: fullQuery,
          conversationId: activeChatId || undefined,
        }),
      });

      if (!res.ok) {
        throw new Error('Chat failed');
      }

      // Read custom header for new conversation redirection
      const returnedChatId = res.headers.get('X-Conversation-Id');

      // Setup reader for streaming
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let assistantResponse = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const textChunk = decoder.decode(value, { stream: true });
          assistantResponse += textChunk;
          setStreamingText(assistantResponse);
        }
      }

      // Add finished assistant message
      setMessages((prev) => [...prev, { role: 'ASSISTANT', content: assistantResponse }]);
      setStreamingText('');

      // If a new chat was created, push state to URL
      if (returnedChatId && returnedChatId !== activeChatId) {
        router.push(`/chat?id=${returnedChatId}`);
      } else {
        fetchConversations();
      }
    } catch (err) {
      console.error(err);
      setErrorState('Connection issues with AI Core. Check .env database settings.');
    } finally {
      setLoading(false);
    }
  };

  const [errorState, setErrorState] = useState<string | null>(null);

  const handleFileAttachClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAttachedFile({
        name: file.name,
        type: file.type || 'text/plain',
      });
    }
  };

  const removeAttachment = () => {
    setAttachedFile(null);
  };

  const handleSuggestionClick = (suggestion: string) => {
    setPrompt(suggestion);
  };

  return (
    <div className="flex h-[calc(100vh-130px)] rounded-3xl overflow-hidden glass border border-[rgba(99,102,241,0.12)]">
      {/* Conversations Sidebar (Left Panel) */}
      <aside className="w-80 border-r border-[rgba(99,102,241,0.12)] flex flex-col justify-between bg-black/20 shrink-0">
        <div>
          <div className="p-4 border-b border-[rgba(255,255,255,0.04)] flex items-center justify-between">
            <span className="text-xs font-mono font-bold text-slate-400 tracking-wider">CHRONICLE SYNC</span>
            <button
              onClick={handleStartNewChat}
              className="flex items-center gap-1 text-[11px] font-semibold text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/15 px-3 py-1.5 rounded-lg border border-indigo-500/20 cursor-pointer transition-all active:scale-95"
            >
              <Plus size={12} /> New
            </button>
          </div>

          <div className="p-2.5 flex flex-col gap-1 overflow-y-auto max-h-[calc(100vh-220px)]">
            {sidebarLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 size={16} className="animate-spin text-slate-500" />
              </div>
            ) : conversations.length === 0 ? (
              <div className="text-[11px] font-mono text-slate-500 text-center py-8">No indexed logs.</div>
            ) : (
              conversations.map((chat) => {
                const isActive = chat.id === activeChatId;
                return (
                  <button
                    key={chat.id}
                    onClick={() => router.push(`/chat?id=${chat.id}`)}
                    className={`text-left p-3 rounded-xl transition-all flex items-center gap-3 group border border-transparent cursor-pointer ${
                      isActive
                        ? 'bg-[rgba(99,102,241,0.08)] border-[rgba(99,102,241,0.2)] text-indigo-300'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-[rgba(255,255,255,0.02)]'
                    }`}
                  >
                    <MessageSquare size={14} className={isActive ? 'text-indigo-400' : 'text-slate-500'} />
                    <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                      <span className="text-xs font-semibold truncate block">
                        {chat.title}
                      </span>
                      <span className="text-[9px] font-mono text-slate-500">
                        {new Date(chat.updatedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className="p-4 border-t border-[rgba(255,255,255,0.04)] bg-black/40 flex items-center justify-between">
          <span className="text-[10px] text-slate-500 font-mono">Status: Connected</span>
          <div className="flex items-center gap-1">
            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            <span className="text-[10px] text-emerald-400 font-mono font-semibold uppercase">READY</span>
          </div>
        </div>
      </aside>

      {/* Message Panel (Right Panel) */}
      <section className="flex-1 flex flex-col justify-between bg-black/5">
        
        {/* Messages Scroll Area */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
          {messages.length === 0 && !streamingText ? (
            /* Blank state greetings */
            <div className="max-w-2xl mx-auto w-full flex flex-col justify-center items-center gap-8 my-auto text-center">
              <div className="w-16 h-16 rounded-3xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center animate-pulse-glow shadow-indigo-500/10">
                <Brain className="text-indigo-400" size={32} />
              </div>
              <div className="flex flex-col gap-2.5">
                <h2 className="text-xl font-bold text-white tracking-wide">AI operating system Console</h2>
                <p className="text-sm text-slate-400 max-w-md mx-auto leading-relaxed">
                  I act as your career coach, learning tracker, and repository agent. I save details from our chat into your long-term memory system.
                </p>
              </div>

              {/* Suggestions Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 w-full mt-4">
                {[
                  { title: 'Goal Advice', desc: 'How can I achieve my active growth goals?', prompt: 'Draft a milestones roadmap for my active goals.' },
                  { title: 'Learn Skill', desc: 'Build a learning plan for vector schemas.', prompt: 'Create a structured study guide to learn Vector databases.' },
                  { title: 'Audit Memories', desc: 'What have you remembered about me?', prompt: 'Search my memory index and tell me what preferences you have saved.' },
                  { title: 'Project Management', desc: 'Scan task list and suggest changes.', prompt: 'Audit my project tasks and list the top priority actions.' },
                ].map((sug, i) => (
                  <button
                    key={i}
                    onClick={() => handleSuggestionClick(sug.prompt)}
                    className="glass rounded-2xl p-4 border border-[rgba(255,255,255,0.04)] hover:bg-[rgba(99,102,241,0.04)] hover:border-[rgba(99,102,241,0.2)] text-left cursor-pointer transition-all duration-200 group flex items-start justify-between gap-3"
                  >
                    <div className="flex flex-col gap-1 min-w-0">
                      <span className="text-xs font-semibold text-indigo-300 group-hover:text-indigo-200 flex items-center gap-1.5">
                        <Sparkles size={11} />
                        {sug.title}
                      </span>
                      <span className="text-[11px] text-slate-400 truncate block font-medium">{sug.desc}</span>
                    </div>
                    <ArrowUpRight size={14} className="text-slate-600 group-hover:text-indigo-400 shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* Active message thread */
            <div className="max-w-3xl mx-auto w-full flex flex-col gap-6 pb-4">
              {errorState && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-300 text-xs p-3.5 rounded-xl font-mono">
                  {errorState}
                </div>
              )}

              {messages.map((msg, i) => {
                const isUser = msg.role === 'USER';
                let displayContent = msg.content;
                let cards: ParsedCard[] = [];

                if (isUser) {
                  if (msg.content.startsWith('/confirm ')) {
                    const parts = msg.content.trim().split(/\s+/);
                    const toolName = parts[1] || '';
                    displayContent = `Confirmed execution: ${toolName}`;
                  }
                } else {
                  const parsed = parseMessageContent(msg.content);
                  displayContent = parsed.text;
                  cards = parsed.cards;
                }

                return (
                  <div key={i} className={`flex gap-4 ${isUser ? 'justify-end' : 'justify-start'}`}>
                    {!isUser && (
                      <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0">
                        <Brain size={16} className="text-indigo-400" />
                      </div>
                    )}
                    <div className="flex flex-col gap-1.5 max-w-[80%]">
                      <span className="text-[9px] font-mono tracking-widest text-slate-500 font-bold uppercase">
                        {isUser ? 'USER' : 'SYSTEM OS'}
                      </span>
                      <div
                        className={`p-4 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                          isUser
                            ? 'bg-gradient-to-tr from-indigo-500/20 to-purple-500/10 border border-indigo-500/30 text-white rounded-tr-none'
                            : 'glass border border-[rgba(255,255,255,0.06)] text-slate-200 rounded-tl-none font-medium'
                        }`}
                      >
                        {displayContent}
                      </div>

                      {/* Render Parsed Visual Cards */}
                      {!isUser && cards.map((card, cardIdx) => renderCardComponent(card, `${i}-${cardIdx}`))}
                    </div>
                  </div>
                );
              })}

              {/* Streaming Content */}
              {streamingText && (() => {
                const streamingCleanedText = cleanStreamingText(streamingText);
                const { cards: streamingCards } = parseMessageContent(streamingText);

                return (
                  <div className="flex gap-4 justify-start">
                    <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0">
                      <Brain size={16} className="text-indigo-400" />
                    </div>
                    <div className="flex flex-col gap-1.5 max-w-[80%]">
                      <span className="text-[9px] font-mono tracking-widest text-slate-500 font-bold uppercase">
                        SYSTEM OS (Streaming)
                      </span>
                      <div className="p-4 rounded-2xl text-sm leading-relaxed glass border border-indigo-500/20 text-indigo-100 rounded-tl-none font-medium relative">
                        {streamingCleanedText}
                        <span className="inline-block w-1.5 h-4 ml-1 bg-indigo-400 animate-pulse" />
                      </div>
                      
                      {/* Render Completed Streaming Cards */}
                      {streamingCards.map((card, cardIdx) => renderCardComponent(card, `streaming-${cardIdx}`))}
                    </div>
                  </div>
                );
              })()}

              {loading && !streamingText && (
                <div className="flex gap-4 justify-start">
                  <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0">
                    <Loader2 size={16} className="animate-spin text-indigo-400" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[9px] font-mono tracking-widest text-slate-500 font-bold uppercase">
                      Computing response...
                    </span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input Bar Section */}
        <div className="p-4 border-t border-[rgba(255,255,255,0.04)] bg-black/20">
          <form onSubmit={handleSend} className="max-w-3xl mx-auto w-full flex flex-col gap-2">
            
            {/* Attachment preview bar */}
            {attachedFile && (
              <div className="flex items-center justify-between gap-4 px-3 py-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-300">
                <div className="flex items-center gap-2 font-semibold">
                  <FileText size={14} />
                  <span>{attachedFile.name}</span>
                  <span className="text-[10px] text-indigo-400 font-mono">({attachedFile.type})</span>
                </div>
                <button
                  type="button"
                  onClick={removeAttachment}
                  className="text-red-400 hover:text-red-300 cursor-pointer"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            )}

            <div className="relative flex items-center">
              {/* Attachment trigger button */}
              <button
                type="button"
                onClick={handleFileAttachClick}
                className="absolute left-3 p-1.5 rounded-lg text-slate-500 hover:text-indigo-400 hover:bg-slate-800/50 cursor-pointer transition-colors"
                title="Attach PDF or Text File"
              >
                <Paperclip size={16} />
              </button>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".txt,.pdf,.md,.json"
                className="hidden"
              />

              <input
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={attachedFile ? "Ask about attached file..." : "Message your career coach, roadmap planner, or project supervisor..."}
                className="w-full pl-11 pr-14 py-3.5 bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.08)] rounded-2xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/60 transition-colors"
              />

              {/* Submit send button */}
              <button
                type="submit"
                disabled={loading || (!prompt.trim() && !attachedFile)}
                className="absolute right-3 p-2 rounded-xl bg-indigo-500 text-white cursor-pointer shadow hover:scale-105 transition-transform disabled:opacity-30 disabled:scale-100"
              >
                <Send size={14} />
              </button>
            </div>
          </form>
        </div>
      </section>
    </div>
  );
}
