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

    const hasApiKey = process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'dummy-key-to-prevent-sdk-crash';
    
    // Check if there is an audio file in the multipart form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ message: 'No audio file provided' }, { status: 400 });
    }

    if (hasApiKey) {
      // Send file to OpenAI Whisper
      const response = await openai.audio.transcriptions.create({
        file: file,
        model: 'whisper-1',
      });
      return NextResponse.json({ text: response.text });
    } else {
      // Mock Transcription Fallback
      // In local offline mode, speech recognition runs client-side using Web Speech API,
      // but if an audio file is uploaded, we mock a simple transcription.
      console.log('Offline mode transcription requested for file:', file.name, 'size:', file.size);
      return NextResponse.json({ 
        text: "I want to learn SQL joins", // Default mock response text
        mocked: true 
      });
    }

  } catch (error: any) {
    console.error('Transcription route error:', error);
    return NextResponse.json({ message: error.message || 'Internal error' }, { status: 500 });
  }
}
