import { PrismaClient } from '../../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import fs from 'fs';
import path from 'path';

// Self-contained .env loader to ensure DATABASE_URL is always available
if (!process.env.DATABASE_URL) {
  try {
    const searchPaths = [
      path.resolve(/*turbopackIgnore: true*/ process.cwd(), '.env'),
      path.resolve(/*turbopackIgnore: true*/ __dirname, '../../.env'),
      path.resolve(/*turbopackIgnore: true*/ __dirname, '../../../.env'),
      path.resolve(/*turbopackIgnore: true*/ __dirname, '../../../../.env')
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
              if (key === 'JWT_SECRET' && !process.env.JWT_SECRET) {
                process.env.JWT_SECRET = value;
              }
              if (key === 'OPENAI_API_KEY' && !process.env.OPENAI_API_KEY) {
                process.env.OPENAI_API_KEY = value;
              }
            }
          }
        }
        break;
      }
    }
  } catch (err) {
    console.warn('Failed to load environment variables from .env fallback:', err);
  }
}

const connectionString = process.env.DATABASE_URL;

const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
