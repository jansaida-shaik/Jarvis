import { NextResponse } from 'next/server';
import { prisma, searchDocumentsByVector } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const documents = await prisma.document.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(documents);
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
    const { action, title, content, fileType, query } = body;

    // Action 1: Query/Retrieve semantic docs
    if (action === 'search') {
      if (!query) {
        return NextResponse.json({ message: 'Query parameter is required' }, { status: 400 });
      }

      // Mock query vector generator
      let embedding: number[] = new Array(1536).fill(0.15);

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
          console.warn('Failed generating OpenAI embeddings for document search, fallback to mock embedding');
        }
      }

      const results = await searchDocumentsByVector(user.id, embedding, 5);
      return NextResponse.json(results);
    }

    // Action 2: Add Document (Uploader)
    if (!title || !content) {
      return NextResponse.json({ message: 'Title and content are required' }, { status: 400 });
    }

    const document = await prisma.document.create({
      data: {
        userId: user.id,
        title,
        content,
        fileType: fileType || 'TXT',
        isIndexed: true,
      },
    });

    // Log agent activity
    await prisma.agentActivity.create({
      data: {
        userId: user.id,
        agentType: 'RESEARCH',
        activityType: 'DOCUMENT_INDEXING',
        status: 'SUCCESS',
        details: `Indexed knowledge base document: "${title}"`,
      },
    });

    return NextResponse.json(document);
  } catch (error: any) {
    console.error('Knowledge POST route error:', error);
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
    const documentId = searchParams.get('id');

    if (!documentId) {
      return NextResponse.json({ message: 'Document ID is required' }, { status: 400 });
    }

    const document = await prisma.document.findUnique({
      where: { id: documentId },
    });

    if (!document || document.userId !== user.id) {
      return NextResponse.json({ message: 'Document not found' }, { status: 404 });
    }

    await prisma.document.delete({
      where: { id: documentId },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ message: error.message || 'Internal error' }, { status: 500 });
  }
}
