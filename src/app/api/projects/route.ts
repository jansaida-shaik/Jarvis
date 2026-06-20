import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const [projects, tasks, notes] = await Promise.all([
      prisma.project.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.task.findMany({
        where: { userId: user.id },
        orderBy: { updatedAt: 'desc' },
        include: {
          project: true,
        },
      }),
      prisma.note.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        include: {
          project: true,
        },
      }),
    ]);

    return NextResponse.json({
      projects,
      tasks,
      notes,
    });
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
    const { action, name, description, title, content, projectId, priority, dueDate, status } = body;

    // Action 1: Create a new project
    if (action === 'create-project') {
      if (!name) {
        return NextResponse.json({ message: 'Project name is required' }, { status: 400 });
      }

      const project = await prisma.project.create({
        data: {
          userId: user.id,
          name,
          description,
          status: 'IN_PROGRESS',
        },
      });

      return NextResponse.json(project);
    }

    // Action 2: Create a task in Kanban
    if (action === 'create-task') {
      if (!title) {
        return NextResponse.json({ message: 'Task title is required' }, { status: 400 });
      }

      const task = await prisma.task.create({
        data: {
          userId: user.id,
          projectId: projectId || null,
          title,
          description,
          status: status || 'TODO',
          priority: priority || 'MEDIUM',
          dueDate: dueDate ? new Date(dueDate) : null,
        },
      });

      return NextResponse.json(task);
    }

    // Action 3: Create a notes entry
    if (action === 'create-note') {
      if (!title || !content) {
        return NextResponse.json({ message: 'Title and content are required' }, { status: 400 });
      }

      const note = await prisma.note.create({
        data: {
          userId: user.id,
          projectId: projectId || null,
          title,
          content,
        },
      });

      return NextResponse.json(note);
    }

    return NextResponse.json({ message: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('Projects POST route error:', error);
    return NextResponse.json({ message: error.message || 'Internal error' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, taskId, status, priority } = body;

    // Action 1: Move task columns (e.g. TODO -> IN_PROGRESS -> COMPLETED)
    if (action === 'update-task-status') {
      if (!taskId || !status) {
        return NextResponse.json({ message: 'Task ID and status are required' }, { status: 400 });
      }

      const task = await prisma.task.findUnique({
        where: { id: taskId },
      });

      if (!task || task.userId !== user.id) {
        return NextResponse.json({ message: 'Task not found' }, { status: 404 });
      }

      const updatedTask = await prisma.task.update({
        where: { id: taskId },
        data: { status },
      });

      // Log agent action on completion
      if (status === 'COMPLETED') {
        await prisma.agentActivity.create({
          data: {
            userId: user.id,
            agentType: 'PROJECT',
            activityType: 'TASK_COMPLETION',
            status: 'SUCCESS',
            details: `Detected task completion: "${task.title}"`,
          },
        });
      }

      return NextResponse.json(updatedTask);
    }

    return NextResponse.json({ message: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('Projects PATCH route error:', error);
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
    const action = searchParams.get('action');
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ message: 'ID is required' }, { status: 400 });
    }

    if (action === 'delete-task') {
      await prisma.task.delete({
        where: { id },
      });
      return NextResponse.json({ success: true });
    }

    if (action === 'delete-note') {
      await prisma.note.delete({
        where: { id },
      });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ message: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ message: error.message || 'Internal error' }, { status: 500 });
  }
}
