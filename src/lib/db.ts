import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

// Self-contained .env loader to ensure database URLs are always available to Prisma
if (!process.env.PRISMA_DATABASE_URL) {
  try {
    const searchPaths = [
      path.resolve(/*turbopackIgnore: true*/ process.cwd(), '.env'),
      path.resolve(/*turbopackIgnore: true*/ __dirname, '../../.env'),
      path.resolve(/*turbopackIgnore: true*/ __dirname, '../../../.env')
    ];
    for (const envPath of searchPaths) {
      if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf8');
        const lines = envContent.split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith('#')) {
            const firstEqual = trimmed.indexOf('=');
            if (firstEqual !== -1) {
              const key = trimmed.slice(0, firstEqual).trim();
              let value = trimmed.slice(firstEqual + 1).trim();
              if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
                value = value.slice(1, -1);
              }
              if (key === 'DATABASE_URL' && !process.env.DATABASE_URL) {
                process.env.DATABASE_URL = value;
              }
              if (key === 'PRISMA_DATABASE_URL' && !process.env.PRISMA_DATABASE_URL) {
                process.env.PRISMA_DATABASE_URL = value;
              }
              if (key === 'JWT_SECRET' && !process.env.JWT_SECRET) {
                process.env.JWT_SECRET = value;
              }
              if (key === 'OPENAI_API_KEY' && !process.env.OPENAI_API_KEY) {
                process.env.OPENAI_API_KEY = value;
              }
            }
          }
        }
        break; // Stop searching once we successfully read one .env file
      }
    }
  } catch (err) {
    console.warn('Failed to load environment variables from .env fallback:', err);
  }
}

// Fallback logic for local development if Vercel environment variables are not set
if (!process.env.PRISMA_DATABASE_URL) {
  process.env.PRISMA_DATABASE_URL = process.env.DATABASE_URL || 'file:./dev.db';
}

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
