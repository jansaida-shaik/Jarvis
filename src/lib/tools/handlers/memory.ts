import { prisma } from '@/lib/db';
import type { ToolResult } from './goals';

// ─────────────────────────────────────────────────────────────────────────────
// HANDLER: memory.save
// ─────────────────────────────────────────────────────────────────────────────
export async function save_memory(
  args: {
    content:   string;
    category:  string;
    sentiment?: string;
  },
  userId: string
): Promise<ToolResult> {
  if (!args.content?.trim()) return { error: 'content is required to save a memory' };

  const validCategories = ['LEARNING', 'CAREER', 'PERSONAL', 'PROJECT', 'GENERAL'];
  const validSentiments = ['POSITIVE', 'NEUTRAL', 'NEGATIVE'];

  if (!validCategories.includes(args.category)) {
    return { error: `Invalid category "${args.category}". Must be one of: ${validCategories.join(', ')}` };
  }

  const sentiment = validSentiments.includes(args.sentiment || '') ? args.sentiment! : 'NEUTRAL';

  const memory = await prisma.memory.create({
    data: {
      userId,
      content:   args.content.trim(),
      category:  args.category,
      sentiment,
    },
  });

  return {
    memoryId:  memory.id,
    content:   memory.content,
    category:  memory.category,
    sentiment: memory.sentiment,
    message:   `Memory saved: "${args.content.slice(0, 60)}${args.content.length > 60 ? '…' : ''}"`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// HANDLER: memory.search
// ─────────────────────────────────────────────────────────────────────────────
export async function search_memory(
  args: {
    query:     string;
    category?: string;
  },
  userId: string
): Promise<ToolResult> {
  if (!args.query?.trim()) return { error: 'query is required to search memories' };

  const whereClause: Record<string, unknown> = { userId };
  if (args.category) whereClause.category = args.category;

  const queryTerms = args.query.toLowerCase().split(' ').filter(Boolean);

  const allMemories = await prisma.memory.findMany({
    where: whereClause,
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  const scored = allMemories
    .map((m) => {
      const contentLower = m.content.toLowerCase();
      const score = queryTerms.filter((term) => contentLower.includes(term)).length;
      return { ...m, score };
    })
    .filter((m) => m.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  if (scored.length === 0) {
    return {
      results: [],
      message: `No memories found matching "${args.query}".`,
    };
  }

  return {
    results: scored.map((m) => ({
      id:       m.id,
      content:  m.content,
      category: m.category,
      sentiment: m.sentiment,
    })),
    message: `Found ${scored.length} relevant ${scored.length === 1 ? 'memory' : 'memories'} matching "${args.query}".`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// HANDLER: memory.delete
// Destructive Action: Requires Confirmation
// ─────────────────────────────────────────────────────────────────────────────
export async function delete_memory(
  args: { memoryId: string; confirmed?: boolean },
  userId: string
): Promise<ToolResult> {
  const memory = await prisma.memory.findUnique({
    where: { id: args.memoryId },
  });

  if (!memory) return { error: `Memory node not found: ${args.memoryId}` };

  if (!args.confirmed) {
    return {
      confirmationRequired: true,
      toolName: 'memory.delete',
      args: { memoryId: args.memoryId },
      title: 'Memory Node',
      message: `I found the memory: "${memory.content}". This action will permanently remove it from your memories. Confirm?`,
    };
  }

  await prisma.memory.delete({ where: { id: args.memoryId } });

  return {
    deleted: true,
    memoryId: args.memoryId,
    content:  memory.content,
    message:  `Memory has been permanently deleted from your profile context.`,
  };
}
