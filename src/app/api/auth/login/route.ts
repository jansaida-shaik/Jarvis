import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { comparePassword, hashPassword, signToken } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json({ message: 'Missing fields' }, { status: 400 });
    }

    // Auto-seed backup logic: if no users exist in database, create the default user.
    let user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      // Check total users to decide if we auto-seed
      const userCount = await prisma.user.count();
      if (userCount === 0 && email === 'jansaida1234@gmail.com') {
        const passwordHash = await hashPassword('password123');
        user = await prisma.user.create({
          data: {
            email: 'jansaida1234@gmail.com',
            name: 'Jan',
            passwordHash,
            avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&h=256&q=80',
          },
        });
      } else {
        return NextResponse.json({ message: 'Invalid credentials' }, { status: 401 });
      }
    }

    const isMatch = await comparePassword(password, user.passwordHash);
    if (!isMatch) {
      return NextResponse.json({ message: 'Invalid credentials' }, { status: 401 });
    }

    const token = signToken({ userId: user.id, email: user.email });

    const response = NextResponse.json({
      success: true,
      user: { id: user.id, email: user.email, name: user.name },
    });

    // Set auth cookie (accessible client-side for LayoutShell verification and logout)
    response.cookies.set('auth_token', token, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: '/',
    });

    return response;
  } catch (error: any) {
    console.error('Login route error:', error);
    return NextResponse.json({ message: error.message || 'Internal error' }, { status: 500 });
  }
}
