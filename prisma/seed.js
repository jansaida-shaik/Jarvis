const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Delete all existing data to prevent primary key collisions
  await prisma.agentActivity.deleteMany({});
  await prisma.message.deleteMany({});
  await prisma.conversation.deleteMany({});
  await prisma.document.deleteMany({});
  await prisma.learningSession.deleteMany({});
  await prisma.learningPlan.deleteMany({});
  await prisma.skill.deleteMany({});
  await prisma.memory.deleteMany({});
  await prisma.note.deleteMany({});
  await prisma.task.deleteMany({});
  await prisma.project.deleteMany({});
  await prisma.milestone.deleteMany({});
  await prisma.goal.deleteMany({});
  await prisma.user.deleteMany({});

  const passwordHash = bcrypt.hashSync('password123', 10);

  const user = await prisma.user.create({
    data: {
      email: 'jansaida1234@gmail.com',
      name: 'Jan',
      passwordHash,
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&h=256&q=80',
    },
  });

  console.log(`Created user: ${user.email}`);

  // Create Cognitive Profile
  console.log('Seeding Cognitive Profile...');
  const profile = await prisma.cognitiveProfile.create({
    data: {
      userId: user.id,
    },
  });

  const entriesData = [
    { layer: 'IDENTITY', key: 'name', value: JSON.stringify('Jan'), confidenceScore: 1.0, source: 'USER_MANUAL' },
    { layer: 'IDENTITY', key: 'current_role', value: JSON.stringify('Senior Full Stack Engineer'), confidenceScore: 1.0, source: 'USER_MANUAL' },
    { layer: 'IDENTITY', key: 'background', value: JSON.stringify('Senior Software Engineer with experience in TypeScript, React, and local LLM integrations.'), confidenceScore: 0.9, source: 'AI_CHAT_HEURISTIC' },
    
    { layer: 'SKILLS', key: 'technical_skills', value: JSON.stringify(['Next.js', 'TypeScript', 'React', 'Prisma', 'PostgreSQL', 'SQLite']), confidenceScore: 0.95, source: 'AI_CHAT_HEURISTIC' },
    { layer: 'SKILLS', key: 'soft_skills', value: JSON.stringify(['Mentoring', 'System Design', 'Problem Solving']), confidenceScore: 0.8, source: 'AI_CHAT_HEURISTIC' },
    
    { layer: 'LEARNING', key: 'learning_goals', value: JSON.stringify(['Master Advanced Neural Architectures', 'Integrate Vector Databases']), confidenceScore: 0.9, source: 'AI_CHAT_HEURISTIC' },
    { layer: 'LEARNING', key: 'learning_preferences', value: JSON.stringify('Hands-on coding projects and code reviews.'), confidenceScore: 0.8, source: 'USER_MANUAL' },

    { layer: 'CAREER', key: 'target_roles', value: JSON.stringify(['Lead Software Architect', 'Principal AI Engineer']), confidenceScore: 0.9, source: 'AI_CHAT_HEURISTIC' },
    { layer: 'CAREER', key: 'salary_goals', value: JSON.stringify('$180k+'), confidenceScore: 0.7, source: 'AI_CHAT_HEURISTIC' },

    { layer: 'PRODUCTIVITY', key: 'work_patterns', value: JSON.stringify('Peak productivity in late mornings. Prefers deep work focus blocks.'), confidenceScore: 0.75, source: 'AI_CHAT_HEURISTIC' },

    { layer: 'STRENGTHS', key: 'ai_observed_strengths', value: JSON.stringify(['Fast learner of modern frameworks', 'System design flexibility']), confidenceScore: 0.8, source: 'AI_CHAT_HEURISTIC' },
    { layer: 'WEAKNESS', key: 'productivity_blockers', value: JSON.stringify(['Procrastination during environment setup', 'Dependency locking issues']), confidenceScore: 0.75, source: 'AI_CHAT_HEURISTIC' },
  ];

  for (const entry of entriesData) {
    const createdEntry = await prisma.cognitiveProfileEntry.create({
      data: {
        profileId: profile.id,
        layer: entry.layer,
        key: entry.key,
        value: entry.value,
        confidenceScore: entry.confidenceScore,
        source: entry.source,
      },
    });

    // Seed initial history
    await prisma.cognitiveProfileHistory.create({
      data: {
        entryId: createdEntry.id,
        newValue: entry.value,
        newConfidence: entry.confidenceScore,
        changeType: 'CREATE',
        reason: 'Initial database seed.',
        source: entry.source,
      },
    });
  }

  // Create initial snapshot version 1
  const activeEntries = await prisma.cognitiveProfileEntry.findMany({
    where: { profileId: profile.id },
  });
  await prisma.cognitiveProfileVersion.create({
    data: {
      profileId: profile.id,
      version: 1,
      stateSnapshot: JSON.stringify(activeEntries),
      description: 'Initial profile state.',
    },
  });

  // Seed audit logs
  await prisma.cognitiveProfileAuditLog.createMany({
    data: [
      { userId: user.id, action: 'PROFILE_CREATED', details: 'Initialized Cognitive Profile space for user.' },
      { userId: user.id, action: 'AUTO_EXTRACTED', details: 'Extracted current_role "Senior Full Stack Engineer" from onboarding files.' },
      { userId: user.id, action: 'AUTO_EXTRACTED', details: 'Detected technical_skills [Next.js, TypeScript, React].' },
    ],
  });


  // Create Goals
  const goal1 = await prisma.goal.create({
    data: {
      userId: user.id,
      title: 'Build a Personal AI Operating System',
      description: 'Create a next-gen dashboard for life tracking, career growth, and AI memory.',
      category: 'CODING',
      status: 'ACTIVE',
      progress: 40,
      targetDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days from now
    },
  });

  await prisma.milestone.createMany({
    data: [
      { goalId: goal1.id, title: 'Design DB Schemas & Relations', status: 'COMPLETED', dueDate: new Date() },
      { goalId: goal1.id, title: 'Implement streaming chatbot interface', status: 'TODO', dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000) },
      { goalId: goal1.id, title: 'Establish pgvector long-term memory sync', status: 'TODO', dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
    ],
  });

  const goal2 = await prisma.goal.create({
    data: {
      userId: user.id,
      title: 'Master Advanced Neural Architectures',
      description: 'Fully understand transformer implementations, fine-tuning techniques, and agentic workflows.',
      category: 'LEARNING',
      status: 'ACTIVE',
      progress: 15,
      targetDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000), // 180 days from now
    },
  });

  await prisma.milestone.createMany({
    data: [
      { goalId: goal2.id, title: 'Complete Attention Mechanism math review', status: 'COMPLETED', dueDate: new Date() },
      { goalId: goal2.id, title: 'Build Transformer block from scratch in PyTorch', status: 'TODO', dueDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000) },
    ],
  });

  // Create Projects
  const project1 = await prisma.project.create({
    data: {
      userId: user.id,
      name: 'Jarvis Core Platform',
      description: 'Development of the Next.js personal OS interface, database layer, and agent routes.',
      status: 'IN_PROGRESS',
      startDate: new Date(),
    },
  });

  // Create Tasks
  await prisma.task.createMany({
    data: [
      { userId: user.id, projectId: project1.id, title: 'Integrate Prisma & Schema mappings', status: 'COMPLETED', priority: 'HIGH', dueDate: new Date() },
      { userId: user.id, projectId: project1.id, title: 'Design dark-mode glassmorphic navigation sidebar', status: 'IN_PROGRESS', priority: 'HIGH', dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000) },
      { userId: user.id, projectId: project1.id, title: 'Build streaming response route for AI chat', status: 'IN_PROGRESS', priority: 'URGENT', dueDate: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000) },
      { userId: user.id, projectId: project1.id, title: 'Write document PDF extraction engine', status: 'TODO', priority: 'MEDIUM', dueDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000) },
    ],
  });

  // Create Notes
  await prisma.note.create({
    data: {
      userId: user.id,
      projectId: project1.id,
      title: 'Architectural Decisions & Memory Fallback',
      content: 'Since local environments may not run Neon PostgreSQL, the database layer in `db.ts` uses raw try/catch blocks that automatically fallback to standard text scanning when vector operations fail. This ensures that the application runs locally without strict pgvector requirements.',
    },
  });

  // Create Memories
  await prisma.memory.createMany({
    data: [
      { userId: user.id, content: 'User prefers dark mode layouts with purple and cyan fluorescent highlights.', category: 'PERSONAL', sentiment: 'POSITIVE' },
      { userId: user.id, content: 'User is focusing on building a personal career coach assistant during Q3.', category: 'CAREER', sentiment: 'NEUTRAL' },
      { userId: user.id, content: 'User has high proficiency in Next.js, TypeScript, and React frameworks.', category: 'LEARNING', sentiment: 'POSITIVE' },
    ],
  });

  // Create Skills
  const skill1 = await prisma.skill.create({
    data: { userId: user.id, name: 'Next.js 16', category: 'TECHNICAL', proficiencyLevel: 'ADVANCED' },
  });
  const skill2 = await prisma.skill.create({
    data: { userId: user.id, name: 'TypeScript', category: 'TECHNICAL', proficiencyLevel: 'ADVANCED' },
  });
  const skill3 = await prisma.skill.create({
    data: { userId: user.id, name: 'Vector Embeddings', category: 'TECHNICAL', proficiencyLevel: 'BEGINNER' },
  });

  // Create Learning Plan & Sessions
  const plan = await prisma.learningPlan.create({
    data: {
      userId: user.id,
      title: 'AI Engineering and Vector Math',
      description: 'A study roadmap to understand embeddings, semantic retrievals, and RAG systems.',
      status: 'ACTIVE',
      recommendations: JSON.stringify([
        'Learn vector similarity search concepts (cosine, inner product).',
        'Experiment with pgvector and embedding libraries.',
        'Implement hybrid keyword-semantic retrievals.'
      ]),
    },
  });

  await prisma.learningSession.createMany({
    data: [
      { userId: user.id, skillId: skill3.id, planId: plan.id, durationMinutes: 45, notes: 'Read about vector indexing and compared flat index with HNSW.' },
      { userId: user.id, skillId: skill2.id, planId: plan.id, durationMinutes: 30, notes: 'Set up TypeScript declarations for pgvector queries.' },
    ],
  });

  // Create Document
  await prisma.document.create({
    data: {
      userId: user.id,
      title: 'Jarvis System Overview',
      content: 'Jarvis is designed as a single-user companion. It runs locally or on Vercel, utilizes Neon Postgres for production, and exposes dashboard metrics, interactive roadmaps, and chat panels.',
      fileType: 'TXT',
      isIndexed: true,
    },
  });

  // Create Conversation and Messages
  const conversation = await prisma.conversation.create({
    data: {
      userId: user.id,
      title: 'Initial Welcome & Onboarding',
    },
  });

  await prisma.message.createMany({
    data: [
      { conversationId: conversation.id, role: 'USER', content: 'Who are you and what can you do?' },
      { conversationId: conversation.id, role: 'ASSISTANT', content: 'I am your Jarvis Personal Operating System. I manage your goals, roadmaps, learning plans, project tasks, and memories. I remember details about you to help you work faster and learn smarter.' },
    ],
  });

  // Create Agent Activity
  await prisma.agentActivity.createMany({
    data: [
      { userId: user.id, agentType: 'PROJECT', activityType: 'TASK_SUGGESTION', status: 'SUCCESS', details: 'Suggested 2 tasks for Project "Jarvis Core Platform".' },
      { userId: user.id, agentType: 'LEARNING', activityType: 'PLAN_GENERATION', status: 'SUCCESS', details: 'Successfully generated AI Engineering roadmap.' },
    ],
  });

  console.log('Database seeded successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
