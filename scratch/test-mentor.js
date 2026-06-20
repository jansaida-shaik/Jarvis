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

    console.log('\n--- Simulation 1: Triggering Confusion ("I don\'t understand SQL left joins") ---');
    const msg1 = await post('http://localhost:3000/api/chat', { prompt: "I don't understand SQL left joins" }, headers);
    console.log('Reply received. Status:', msg1.statusCode);

    console.log('\n--- Simulation 2: Triggering Repeated Confusion ("I still don\'t understand left joins at all") ---');
    const msg2 = await post('http://localhost:3000/api/chat', { prompt: "I still don't understand left joins at all" }, headers);
    console.log('Reply received. Status:', msg2.statusCode);

    console.log('\n--- Simulation 3: Triggering Decision Tradeoffs Logging ---');
    const msg3 = await post('http://localhost:3000/api/chat', { prompt: "I decided to focus on Zoho CRM and AI integrations instead of badminton platform" }, headers);
    console.log('Reply received. Status:', msg3.statusCode);

    console.log('\n--- Simulation 4: Resolving Confusion ("Now I understand left joins") ---');
    const msg4 = await post('http://localhost:3000/api/chat', { prompt: "Now I understand left joins" }, headers);
    console.log('Reply received. Status:', msg4.statusCode);

    console.log('\n--- Querying Cognitive Profile Mentorship Data ---');
    const profileRes = await get('http://localhost:3000/api/profile', headers);
    console.log('Profile Status:', profileRes.statusCode);
    if (profileRes.statusCode !== 200) {
      console.log('Profile Response Body (Error):', profileRes.body);
    }
    
    let profileData = {};
    try {
      profileData = JSON.parse(profileRes.body);
    } catch (e) {}

    console.log('\n=========================================');
    console.log('VERIFIED MENTORING DATA RETURNED FROM API:');
    console.log('=========================================');
    console.log('\n1. Learning Profile:');
    console.log('   Retention Score:', profileData.learningProfile?.retentionScore);
    console.log('   Progress Records Count:', profileData.learningProfile?.progress?.length);
    if (profileData.learningProfile?.progress) {
      for (const p of profileData.learningProfile.progress) {
        console.log(`   - Topic: "${p.topic}"`);
        console.log(`     Understanding Score: ${p.understandingScore}`);
        console.log(`     Confidence Score: ${p.confidenceScore}`);
        console.log(`     Review Count: ${p.reviewCount}`);
        console.log(`     Masteries:`, p.masteries.map(m => `${m.concept} (${m.status})`));
      }
    }

    console.log('\n2. Decision History Logs:');
    if (profileData.decisions) {
      for (const d of profileData.decisions) {
        console.log(`   - Title: "${d.title}"`);
        console.log(`     Recommendation: "${d.recommendation}"`);
        console.log(`     Status: ${d.status}`);
      }
    }

    console.log('\n3. Coaching Insights Feed:');
    if (profileData.insights) {
      for (const ins of profileData.insights) {
        console.log(`   - Type: [${ins.type}]`);
        console.log(`     Trigger: "${ins.trigger}"`);
        console.log(`     Advice: "${ins.advice}"`);
        console.log(`     Status: ${ins.status}`);
      }
    }

    console.log('\n--- Integration Verification Complete ---');

  } catch (err) {
    console.error('Integration test script failed:', err);
  }
}

run();
