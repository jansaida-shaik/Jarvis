const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  console.log('=== RUNNING DATABASE BRANDING MIGRATION ===\n');

  try {
    const queries = [
      `UPDATE "Project" SET name = 'Jarvis Core Platform' WHERE name = 'Jan AI Core Platform'`,
      `UPDATE "Document" SET title = 'Jarvis System Overview' WHERE title = 'Jan AI System Overview'`,
      `UPDATE "Document" SET content = REPLACE(content, 'Jan AI', 'Jarvis') WHERE content LIKE '%Jan AI%'`,
      `UPDATE "Message" SET content = REPLACE(content, 'Jan AI', 'Jarvis') WHERE content LIKE '%Jan AI%'`,
      `UPDATE "AgentActivity" SET details = REPLACE(details, 'Jan AI', 'Jarvis') WHERE details LIKE '%Jan AI%'`,
      `UPDATE "ExecutiveInsight" SET title = REPLACE(title, 'Jan AI', 'Jarvis'), insight = REPLACE(insight, 'Jan AI', 'Jarvis') WHERE title LIKE '%Jan AI%' OR insight LIKE '%Jan AI%'`,
      `UPDATE "ExecutiveBriefing" SET summary = REPLACE(summary, 'Jan AI', 'Jarvis') WHERE summary LIKE '%Jan AI%'`
    ];

    for (const sql of queries) {
      console.log(`Executing: ${sql}`);
      const rowsAffected = await prisma.$executeRawUnsafe(sql);
      console.log(`Rows affected: ${rowsAffected}\n`);
    }

    console.log('Database migration completed successfully!');
  } catch (err) {
    console.error('Error during database migration:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

run();
