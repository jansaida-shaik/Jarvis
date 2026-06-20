import { NextResponse } from 'next/server';
import { prisma, searchMemoriesByVector } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');

    const memories = await prisma.memory.findMany({
      where: {
        userId: user.id,
        ...(category ? { category } : {}),
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json(memories);
  } catch (error: any) {
    return NextResponse.json({ message: error.message || 'Internal error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, content, category, query } = body;

    // Action 1: Search memories using vector semantic similarity or keyword backup
    if (action === 'search') {
      if (!query) {
        return NextResponse.json({ message: 'Query string is required' }, { status: 400 });
      }

      // Generate a mock embedding representing the query string (e.g. 1536 float elements)
      // If they input real OpenAI key, we can generate a real embedding, otherwise use a placeholder
      let embedding: number[] = new Array(1536).fill(0.1);
      
      if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'dummy-key-to-prevent-sdk-crash') {
        try {
          const fetchEmbed = await fetch('https://api.openai.com/v1/embeddings', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            },
            body: JSON.stringify({
              input: query,
              model: 'text-embedding-3-small',
            }),
          });
          const embedData = await fetchEmbed.json();
          embedding = embedData.data[0].embedding;
        } catch (err) {
          console.warn('Failed generating OpenAI embeddings, fallback to mock embedding');
        }
      }

      const results = await searchMemoriesByVector(user.id, embedding, 5, category || undefined);
      return NextResponse.json(results);
    }

    // Action 2: Add memory node manually
    if (!content || !category) {
      return NextResponse.json({ message: 'Missing fields' }, { status: 400 });
    }

    const newMemory = await prisma.memory.create({
      data: {
        userId: user.id,
        content,
        category,
        sentiment: 'NEUTRAL',
      },
    });

    // Log activity
    await prisma.agentActivity.create({
      data: {
        userId: user.id,
        agentType: 'RESEARCH',
        activityType: 'MANUAL_MEMORY_ADD',
        status: 'SUCCESS',
        details: `Manually added memory node to ${category}: "${content.slice(0, 40)}..."`,
      },
    });

    return NextResponse.json(newMemory);
  } catch (error: any) {
    console.error('Memories POST route error:', error);
    return NextResponse.json({ message: error.message || 'Internal error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const memoryId = searchParams.get('id');

    if (!memoryId) {
      return NextResponse.json({ message: 'Memory ID is required' }, { status: 400 });
    }

    // Verify ownership
    const memory = await prisma.memory.findUnique({
      where: { id: memoryId },
    });

    if (!memory || memory.userId !== user.id) {
      return NextResponse.json({ message: 'Memory not found' }, { status: 404 });
    }

    await prisma.memory.delete({
      where: { id: memoryId },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ message: error.message || 'Internal error' }, { status: 500 });
  }
}
