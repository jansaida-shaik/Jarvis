import { prisma } from '@/lib/db';
import type { ToolResult } from './goals';

// ─────────────────────────────────────────────────────────────────────────────
// HANDLER: search_knowledge
// RAG integration — searches the user's knowledge base documents.
// This is the fix for the "dead RAG" gap identified in the audit.
// Results are returned with content snippets so the LLM can cite them.
// ─────────────────────────────────────────────────────────────────────────────
export async function search_knowledge(
  args: { query: string },
  userId: string
): Promise<ToolResult> {
  if (!args.query?.trim()) return { error: 'query is required to search knowledge base' };

  const queryTerms = args.query.toLowerCase().split(' ').filter(Boolean);

  // Fetch all indexed documents for this user
  const documents = await prisma.document.findMany({
    where:   { userId, isIndexed: true },
    orderBy: { createdAt: 'desc' },
    take:    100,
  });

  if (documents.length === 0) {
    return {
      results: [],
      message: 'Your knowledge base is empty. Add documents in the Knowledge Hub to enable this.',
    };
  }

  // Score documents by query term matches in title + content
  const scored = documents
    .map((doc) => {
      const searchable = `${doc.title} ${doc.content}`.toLowerCase();
      const score = queryTerms.filter((term) => searchable.includes(term)).length;
      return { ...doc, score };
    })
    .filter((doc) => doc.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  if (scored.length === 0) {
    return {
      results: [],
      message: `No documents in your knowledge base match "${args.query}".`,
    };
  }

  return {
    results: scored.map((doc) => ({
      id:      doc.id,
      title:   doc.title,
      // Return first 600 chars as a context snippet for the LLM to cite
      snippet: doc.content.slice(0, 600) + (doc.content.length > 600 ? '…' : ''),
      fileType: doc.fileType || 'text',
    })),
    message: `Found ${scored.length} relevant ${scored.length === 1 ? 'document' : 'documents'} in your knowledge base.`,
  };
}
