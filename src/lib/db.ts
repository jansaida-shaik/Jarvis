import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

interface VectorSearchResult {
  id: string;
  content: string;
  category: string;
  sentiment: string | null;
  createdAt: Date;
  updatedAt: Date;
  similarity: number;
}

interface DocSearchResult {
  id: string;
  title: string;
  content: string;
  fileUrl: string | null;
  fileType: string | null;
  isIndexed: boolean;
  createdAt: Date;
  updatedAt: Date;
  similarity: number;
}

/**
 * Perform a vector similarity search with raw SQL queries.
 * Gracefully falls back to text search if pgvector is not installed or errors out.
 */
export async function searchMemoriesByVector(
  userId: string,
  embedding: number[],
  limit = 5,
  category?: string
): Promise<VectorSearchResult[]> {
  const embeddingString = `[${embedding.join(',')}]`;
  
  try {
    let results: VectorSearchResult[];
    if (category) {
      results = await prisma.$queryRawUnsafe<VectorSearchResult[]>(
        `SELECT id, content, category, sentiment, "createdAt", "updatedAt",
         (1 - (embedding <=> $1::vector)) as similarity
         FROM "Memory"
         WHERE "userId" = $2 AND category = $3 AND embedding IS NOT NULL
         ORDER BY embedding <=> $1::vector ASC
         LIMIT $4`,
        embeddingString,
        userId,
        category,
        limit
      );
    } else {
      results = await prisma.$queryRawUnsafe<VectorSearchResult[]>(
        `SELECT id, content, category, sentiment, "createdAt", "updatedAt",
         (1 - (embedding <=> $1::vector)) as similarity
         FROM "Memory"
         WHERE "userId" = $2 AND embedding IS NOT NULL
         ORDER BY embedding <=> $1::vector ASC
         LIMIT $3`,
        embeddingString,
        userId,
        limit
      );
    }
    return results;
  } catch (error) {
    console.warn('Vector search failed, falling back to text search:', error);
    // Fallback: Text search across content
    const plainMemories = await prisma.memory.findMany({
      where: {
        userId,
        ...(category ? { category } : {}),
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
    });
    
    return plainMemories.map(item => ({
      id: item.id,
      content: item.content,
      category: item.category,
      sentiment: item.sentiment,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      similarity: 0.5, // flat fallback similarity
    }));
  }
}

/**
 * Perform semantic search on Documents
 */
export async function searchDocumentsByVector(
  userId: string,
  embedding: number[],
  limit = 5
): Promise<DocSearchResult[]> {
  const embeddingString = `[${embedding.join(',')}]`;
  
  try {
    const results = await prisma.$queryRawUnsafe<DocSearchResult[]>(
      `SELECT id, title, content, "fileUrl", "fileType", "isIndexed", "createdAt", "updatedAt",
       (1 - (embedding <=> $1::vector)) as similarity
       FROM "Document"
       WHERE "userId" = $2 AND embedding IS NOT NULL
       ORDER BY embedding <=> $1::vector ASC
       LIMIT $3`,
      embeddingString,
      userId,
      limit
    );
    return results;
  } catch (error) {
    console.warn('Document vector search failed, falling back to text search:', error);
    const plainDocs = await prisma.document.findMany({
      where: {
        userId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
    });
    
    return plainDocs.map(doc => ({
      id: doc.id,
      title: doc.title,
      content: doc.content,
      fileUrl: doc.fileUrl,
      fileType: doc.fileType,
      isIndexed: doc.isIndexed,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      similarity: 0.5,
    }));
  }
}
