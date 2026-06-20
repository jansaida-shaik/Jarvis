const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  console.log('=== RUNTIME DATABASE BRANDING AUDIT ===\n');
  
  const tables = [
    { model: 'project', fields: ['name', 'description'] },
    { model: 'note', fields: ['title', 'content'] },
    { model: 'goal', fields: ['title', 'description'] },
    { model: 'milestone', fields: ['title', 'description'] },
    { model: 'memory', fields: ['content'] },
    { model: 'document', fields: ['title', 'content'] },
    { model: 'conversation', fields: ['title'] },
    { model: 'message', fields: ['content'] },
    { model: 'agentActivity', fields: ['details'] },
    { model: 'cognitiveProfileEntry', fields: ['value'] },
    { model: 'coachingInsight', fields: ['trigger', 'advice'] },
    { model: 'executiveInsight', fields: ['title', 'insight', 'recommendation'] },
    { model: 'executiveBriefing', fields: ['summary'] }
  ];

  let matches = [];

  for (const item of tables) {
    try {
      const records = await prisma[item.model].findMany();
      for (const record of records) {
        for (const field of item.fields) {
          const val = record[field];
          if (typeof val === 'string') {
            const lowerVal = val.toLowerCase();
            if (
              lowerVal.includes('jan ai') || 
              lowerVal.includes('jan assistant') || 
              lowerVal.includes('jan intelligence') || 
              lowerVal.includes('jan os') || 
              lowerVal.includes('jan cognitive')
            ) {
              matches.push({
                table: item.model,
                id: record.id || `${record.profileId}-${record.layer}-${record.key}`,
                field: field,
                value: val
              });
            }
          }
        }
      }
    } catch (err) {
      console.warn(`Could not scan table ${item.model}:`, err.message);
    }
  }

  console.log(`Found ${matches.length} database matches:\n`);
  console.log(JSON.stringify(matches, null, 2));

  await prisma.$disconnect();
}

run();
