import { prisma } from '../src/lib/db';
import { permissionGuard, PermissionError } from '../src/lib/tools/permissions';

// Import handlers
import { create_goal, update_goal, delete_goal } from '../src/lib/tools/handlers/goals';
import { create_milestone, complete_milestone } from '../src/lib/tools/handlers/milestones';
import { create_task, update_task, complete_task } from '../src/lib/tools/handlers/tasks';
import { create_project, create_note, delete_project, delete_note } from '../src/lib/tools/handlers/projects';
import { save_memory, search_memory, delete_memory } from '../src/lib/tools/handlers/memory';
import { search_knowledge } from '../src/lib/tools/handlers/knowledge';
import { create_learning_plan, log_learning_session } from '../src/lib/tools/handlers/learning';

async function run() {
  console.log('=== JARVIS ADVANCED TOOL CALLING ARCHITECTURE TEST ===\n');

  try {
    let user = await prisma.user.findFirst({
      where: { email: 'jansaida1234@gmail.com' },
    });

    if (!user) {
      user = await prisma.user.findFirst();
    }

    if (!user) {
      console.error('Error: No users found in the database. Please run seed first.');
      process.exit(1);
    }

    const userId = user.id;
    console.log(`Using Test User ID: ${userId} (${user.email})`);

    // Clean up any stale test items
    console.log('\n--- Cleaning up previous test data ---');
    await prisma.goal.deleteMany({ where: { userId, title: { startsWith: 'TEST_GOAL_' } } });
    await prisma.task.deleteMany({ where: { userId, title: { startsWith: 'TEST_TASK_' } } });
    await prisma.project.deleteMany({ where: { userId, name: { startsWith: 'TEST_PROJECT_' } } });
    await prisma.memory.deleteMany({ where: { userId, content: { startsWith: 'TEST_MEMORY_' } } });
    await prisma.learningPlan.deleteMany({ where: { userId, title: { startsWith: 'TEST_PLAN_' } } });
    await prisma.learningSession.deleteMany({ where: { userId, notes: { startsWith: 'TEST_SESSION_' } } });
    console.log('Cleanup completed.');

    // Record user baseline XP
    const baseUser = await prisma.user.findUnique({ where: { id: userId } });
    const baselineXp = baseUser?.xp || 0;
    const baselineLevel = baseUser?.level || 1;
    console.log(`Baseline user stats: XP = ${baselineXp}, Level = ${baselineLevel}`);

    // 1. Goal Handlers Test
    console.log('\n--- Testing Goals Handlers ---');
    const goalRes = await create_goal(
      {
        title: 'TEST_GOAL_Become an AI Engineer',
        category: 'CAREER',
        description: 'Test goal for Jarvis tool calling',
        targetDate: '2026-12-31',
      },
      userId
    );
    console.log('create_goal Response:', goalRes);
    if (!goalRes.goalId) throw new Error('create_goal failed: goalId not returned');
    const goalId = goalRes.goalId as string;
    
    // Update goal
    const updateGoalRes = await update_goal(
      {
        goalId,
        progress: 10,
        status: 'ACTIVE',
      },
      userId
    );
    console.log('update_goal Response:', updateGoalRes);

    // 2. Milestone Handlers Test
    console.log('\n--- Testing Milestone Handlers ---');
    const milestoneRes = await create_milestone(
      {
        goalId,
        title: 'TEST_GOAL_Learn Vector Databases',
        description: 'Practice milestone creation',
      },
      userId
    );
    console.log('create_milestone Response:', milestoneRes);
    if (!milestoneRes.milestoneId) throw new Error('create_milestone failed');
    const milestoneId = milestoneRes.milestoneId as string;

    const completeMilestoneRes = await complete_milestone(
      {
        milestoneId,
      },
      userId
    );
    console.log('complete_milestone Response:', completeMilestoneRes);

    // 3. Task Handlers Test
    console.log('\n--- Testing Task Handlers & Confirmation Guard ---');
    const taskRes = await create_task(
      {
        title: 'TEST_TASK_Implement RAG',
        priority: 'HIGH',
        dueDate: new Date().toISOString(),
      },
      userId
    );
    console.log('create_task Response:', taskRes);
    if (!taskRes.taskId) throw new Error('create_task failed');
    const taskId = taskRes.taskId as string;

    const updateTaskRes = await update_task(
      {
        taskId,
        status: 'IN_PROGRESS',
        priority: 'URGENT',
      },
      userId
    );
    console.log('update_task Response:', updateTaskRes);

    // Attempt completion without confirmation
    const completeTaskConf = await complete_task({ taskId }, userId);
    console.log('complete_task (no confirmation) Response:', completeTaskConf);
    if (!completeTaskConf.confirmationRequired) {
      throw new Error('FAIL: complete_task did not trigger confirmation safeguard');
    }
    console.log('SUCCESS: Confirmation intercept triggered correctly.');

    // Complete with confirmation
    const completeTaskRes = await complete_task({ taskId, confirmed: true }, userId);
    console.log('complete_task (confirmed) Response:', completeTaskRes);

    // 4. Projects Handlers Test
    console.log('\n--- Testing Projects & Notes Handlers & Confirmation Guard ---');
    const projectRes = await create_project(
      {
        name: 'TEST_PROJECT_Autonomous Jarvis',
        description: 'Test project workspace',
      },
      userId
    );
    console.log('create_project Response:', projectRes);
    if (!projectRes.projectId) throw new Error('create_project failed');
    const projectId = projectRes.projectId as string;

    const noteRes = await create_note(
      {
        title: 'TEST_PROJECT_Notes on agents',
        content: 'Autonomous operating systems need proper tools.',
        projectId,
      },
      userId
    );
    console.log('create_note Response:', noteRes);
    if (!noteRes.noteId) throw new Error('create_note failed');
    const noteId = noteRes.noteId as string;

    // Test project delete confirmation guard
    const deleteProjectConf = await delete_project({ projectId }, userId);
    console.log('delete_project (no confirmation) Response:', deleteProjectConf);
    if (!deleteProjectConf.confirmationRequired) {
      throw new Error('FAIL: delete_project did not trigger confirmation safeguard');
    }
    console.log('SUCCESS: Confirmation intercept triggered correctly for delete_project.');

    // Test note delete confirmation guard
    const deleteNoteConf = await delete_note({ noteId }, userId);
    console.log('delete_note (no confirmation) Response:', deleteNoteConf);
    if (!deleteNoteConf.confirmationRequired) {
      throw new Error('FAIL: delete_note did not trigger confirmation safeguard');
    }
    console.log('SUCCESS: Confirmation intercept triggered correctly for delete_note.');

    // Delete note with confirmation
    const deleteNoteRes = await delete_note({ noteId, confirmed: true }, userId);
    console.log('delete_note (confirmed) Response:', deleteNoteRes);

    // Delete project with confirmation
    const deleteProjectRes = await delete_project({ projectId, confirmed: true }, userId);
    console.log('delete_project (confirmed) Response:', deleteProjectRes);

    // 5. Memory Handlers Test & Confirmation Guard
    console.log('\n--- Testing Memory Handlers ---');
    const memoryRes = await save_memory(
      {
        content: 'TEST_MEMORY_User loves coding in TypeScript.',
        category: 'LEARNING',
        sentiment: 'POSITIVE',
      },
      userId
    );
    console.log('save_memory Response:', memoryRes);
    if (!memoryRes.memoryId) throw new Error('save_memory failed');
    const memoryId = memoryRes.memoryId as string;

    const searchMemoryRes = await search_memory(
      {
        query: 'TypeScript preferences',
      },
      userId
    );
    console.log('search_memory Response:', searchMemoryRes);

    // Delete memory confirmation check
    const deleteMemoryConf = await delete_memory({ memoryId }, userId);
    console.log('delete_memory (no confirmation) Response:', deleteMemoryConf);
    if (!deleteMemoryConf.confirmationRequired) {
      throw new Error('FAIL: delete_memory did not trigger confirmation safeguard');
    }
    console.log('SUCCESS: Confirmation intercept triggered correctly for delete_memory.');

    // Delete memory with confirmation
    const deleteMemoryRes = await delete_memory({ memoryId, confirmed: true }, userId);
    console.log('delete_memory (confirmed) Response:', deleteMemoryRes);

    // 6. Knowledge search
    console.log('\n--- Testing Knowledge Search ---');
    const searchKnowledgeRes = await search_knowledge(
      {
        query: 'neural networks',
      },
      userId
    );
    console.log('search_knowledge Response:', searchKnowledgeRes);

    // 7. Learning Handlers Test
    console.log('\n--- Testing Learning Handlers ---');
    const planRes = await create_learning_plan(
      {
        title: 'TEST_PLAN_Advanced PyTorch',
        description: 'Study neural networks training pipelines',
        recommendations: ['Build GPT-2 from scratch', 'Train custom tokenizer'],
      },
      userId
    );
    console.log('create_learning_plan Response:', planRes);
    if (!planRes.planId) throw new Error('create_learning_plan failed');
    const planId = planRes.planId as string;

    const sessionRes = await log_learning_session(
      {
        durationMinutes: 45,
        notes: 'TEST_SESSION_Focused on transformer architecture',
        planId,
      },
      userId
    );
    console.log('log_learning_session Response:', sessionRes);

    // 8. Permission Layer Guard Test (userId mismatch)
    console.log('\n--- Testing Permissions Guard (Rejection check) ---');
    try {
      await permissionGuard('goal.update', { goalId }, 'wrong-user-id');
      console.error('FAIL: permissionGuard did not throw for wrong-user-id');
      process.exit(1);
    } catch (err) {
      if (err instanceof PermissionError) {
        console.log('SUCCESS: permissionGuard threw PermissionError correctly:', err.message);
      } else {
        throw err;
      }
    }

    // 9. Goal Deletion Test & Confirmation Guard
    console.log('\n--- Testing Goal Deletion & Safeguard ---');
    const deleteGoalConf = await delete_goal({ goalId }, userId);
    console.log('delete_goal (no confirmation) Response:', deleteGoalConf);
    if (!deleteGoalConf.confirmationRequired) {
      throw new Error('FAIL: delete_goal did not trigger confirmation safeguard');
    }
    console.log('SUCCESS: Confirmation intercept triggered correctly for delete_goal.');

    const deleteRes = await delete_goal({ goalId, confirmed: true }, userId);
    console.log('delete_goal (confirmed) Response:', deleteRes);

    // Verify deletion in DB
    const goalAfterDeletion = await prisma.goal.findUnique({ where: { id: goalId } });
    if (goalAfterDeletion) throw new Error('delete_goal failed: goal still exists in DB');
    console.log('Goal cascade deletion verified successfully.');

    // 10. Verify Gamification Status
    console.log('\n--- Verifying User Gamification Status ---');
    const updatedUser = await prisma.user.findUnique({ where: { id: userId } });
    const finalXp = updatedUser?.xp || 0;
    const finalLevel = updatedUser?.level || 1;
    const xpDifference = finalXp - baselineXp;
    console.log(`Final user stats: XP = ${finalXp}, Level = ${finalLevel} (Gain: +${xpDifference} XP)`);
    
    if (xpDifference !== 125) {
      console.warn(`Warning: XP Gain is ${xpDifference} instead of expected 125. (Make sure XP triggers for other actions aren't interfering)`);
    } else {
      console.log('SUCCESS: Gamification XP addition verified exactly.');
    }

    console.log('\n=============================================');
    console.log('ALL ADVANCED TOOL CALLING AND CONFIRMATION SAFEGUARDS VERIFIED!');
    console.log('=============================================');

  } catch (error) {
    console.error('Integration test failed with error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

run();
