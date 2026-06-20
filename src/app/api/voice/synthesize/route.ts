import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'dummy-key-to-prevent-sdk-crash',
});

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { text, voice = 'alloy' } = await request.json();
    if (!text) {
      return NextResponse.json({ message: 'Text is required' }, { status: 400 });
    }

    const hasApiKey = process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'dummy-key-to-prevent-sdk-crash';

    if (hasApiKey) {
      // Call OpenAI TTS API
      const mp3 = await openai.audio.speech.create({
        model: 'tts-1',
        voice: voice,
        input: text,
      });

      // Get readable audio stream
      const responseStream = mp3.body;

      return new Response(responseStream, {
        headers: {
          'Content-Type': 'audio/mpeg',
        },
      });
    } else {
      // If no API key, clients should fall back to client-side window.speechSynthesis,
      // but if they make a request here, we return a 400 with instructions.
      return NextResponse.json({ 
        message: 'No OpenAI API Key set. Use Web Speech Synthesis client-side.',
        fallbackLocal: true
      }, { status: 400 });
    }

  } catch (error: any) {
    console.error('Synthesis route error:', error);
    return NextResponse.json({ message: error.message || 'Internal error' }, { status: 500 });
  }
}
