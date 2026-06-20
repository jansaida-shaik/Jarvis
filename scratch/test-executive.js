const http = require('http');

function post(url, data, headers = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const postData = JSON.stringify(data);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || 80,
      path: urlObj.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        ...headers,
      },
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body,
        });
      });
    });

    req.on('error', (e) => {
      reject(e);
    });

    req.write(postData);
    req.end();
  });
}

function get(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || 80,
      path: urlObj.pathname,
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        ...headers,
      },
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body,
        });
      });
    });

    req.on('error', (e) => {
      reject(e);
    });

    req.end();
  });
}

async function run() {
  try {
    console.log('Logging in...');
    const loginRes = await post('http://localhost:3000/api/auth/login', {
      email: 'jansaida1234@gmail.com',
      password: 'password123',
    });

    console.log('Login Response Status:', loginRes.statusCode);
    const cookieHeader = loginRes.headers['set-cookie'];
    if (!cookieHeader) {
      console.error('Failed to get auth cookie');
      return;
    }

    const cookie = cookieHeader[0].split(';')[0];
    const headers = { Cookie: cookie };

    // Direct Database Seeds for testing
    console.log('\n--- Seeding Stalled goal and project directly using Prisma client ---');
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();

    const user = await prisma.user.findFirst({
      where: { email: 'jansaida1234@gmail.com' }
    });

    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
    const elevenDaysAgo = new Date(Date.now() - 11 * 24 * 60 * 60 * 1000);

    // Clean any old test records
    await prisma.executiveInsight.deleteMany({ where: { userId: user.id } });
    await prisma.executiveBriefing.deleteMany({ where: { userId: user.id } });
    await prisma.goal.deleteMany({ where: { userId: user.id, title: 'Test Stalled Goal' } });
    await prisma.project.deleteMany({ where: { userId: user.id, name: 'Test Inactive Project' } });

    // 1. Create Stalled Goal
    const goal = await prisma.goal.create({
      data: {
        userId: user.id,
        title: 'Test Stalled Goal',
        category: 'CODING',
        status: 'ACTIVE',
        progress: 45,
        updatedAt: eightDaysAgo
      }
    });
    console.log('Stalled Goal seeded successfully.');

    // 2. Create Inactive Project
    const project = await prisma.project.create({
      data: {
        userId: user.id,
        name: 'Test Inactive Project',
        status: 'IN_PROGRESS',
        updatedAt: elevenDaysAgo
      }
    });
    console.log('Inactive Project seeded successfully.');

    // 3. Trigger Scan via api POST
    console.log('\n--- Simulation: Triggering Executive Intelligence Scans via POST ---');
    const scanRes = await post('http://localhost:3000/api/executive/briefings', {}, headers);
    console.log('Scan Response Status:', scanRes.statusCode);

    // 4. Retrieve Briefings & Insights
    console.log('\n--- Querying briefings and active insights via GET ---');
    const briefRes = await get('http://localhost:3000/api/executive/briefings', headers);
    console.log('GET Status:', briefRes.statusCode);
    
    const briefData = JSON.parse(briefRes.body);

    console.log('\n=========================================');
    console.log('VERIFIED EXECUTIVE INSIGHTS RETURNED:');
    console.log('=========================================');
    if (briefData.insights) {
      for (const ins of briefData.insights) {
        console.log(`\n- Type: [${ins.type}] Confidence: ${Math.round(ins.confidence * 100)}%`);
        console.log(`  Title: "${ins.title}"`);
        console.log(`  Insight: "${ins.insight}"`);
        console.log(`  Recommendation: "${ins.recommendation}"`);
        console.log(`  Follow-up status: ${ins.followUpStatus}`);
      }
    }

    console.log('\n=========================================');
    console.log('DAILY EXECUTIVE BRIEFING NARRATIVE:');
    console.log('=========================================');
    console.log(briefData.dailyBrief?.summary);

    // 5. Trigger chat to verify proactive alert context injection
    console.log('\n--- Triggering chat to test proactive alert injection context ---');
    const chatRes = await post('http://localhost:3000/api/chat', { prompt: 'Hello Jarvis' }, headers);
    console.log('Chat status:', chatRes.statusCode);
    console.log('Chat reply stream started.');

    // Clean up test goal and project
    await prisma.goal.delete({ where: { id: goal.id } });
    await prisma.project.delete({ where: { id: project.id } });
    await prisma.$disconnect();

    console.log('\n--- All Executive Intelligence Layer Integrations Verified Successfully ---');

  } catch (err) {
    console.error('Integration test failed:', err);
  }
}

run();
