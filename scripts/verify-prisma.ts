import { prisma } from '../src/lib/prisma';

async function verify() {
  try {
    const user = await prisma.user.findFirst();
    if (user) {
      console.log('✅ Connected');
      console.log(`User found: ${user.email}`);
    } else {
      console.log('✅ Connected (No users found)');
    }
  } catch (error) {
    console.error('❌ Connection Failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

verify();
