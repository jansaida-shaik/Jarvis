'use client';

export type VoiceState = 'IDLE' | 'LISTENING' | 'THINKING' | 'SPEAKING';

export interface VoiceManagerOptions {
  onStateChange: (state: VoiceState) => void;
  onTranscriptChange: (text: string, isFinal: boolean) => void;
  onResponseChunk: (text: string) => void;
  onFinishedResponse: (text: string) => void;
  onError: (error: string) => void;
  mode?: 'general' | 'learning' | 'career' | 'decision';
  premiumVoice?: boolean;
}

export class VoiceManager {
  private state: VoiceState = 'IDLE';
  private recognition: any = null;
  private synthesisQueue: string[] = [];
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private isSynthesisSpeaking = false;
  private conversationId: string | null = null;
  private options: VoiceManagerOptions;
  
  // Track continuous listening flag
  private isSessionActive = false;
  private lastTranscript = '';
  private currentResponseText = '';

  constructor(options: VoiceManagerOptions) {
    this.options = options;
    this.initSpeechRecognition();
  }

  private initSpeechRecognition() {
    if (typeof window === 'undefined') return;

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      this.options.onError('Web Speech Recognition API is not supported in this browser. Please use Chrome or Safari.');
      return;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.continuous = false; // We want phrase-by-phrase recognition for natural pause detection
    this.recognition.interimResults = true;
    this.recognition.lang = 'en-US';

    this.recognition.onstart = () => {
      this.lastTranscript = '';
      this.setState('LISTENING');
    };

    this.recognition.onresult = (event: any) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }

      const activeTranscript = finalTranscript || interimTranscript;
      this.options.onTranscriptChange(activeTranscript, !!finalTranscript);
      
      if (finalTranscript) {
        this.lastTranscript = finalTranscript;
        
        // Interrupt logic: If the AI is speaking and we get a final transcript from the user,
        // it means the user has interrupted the AI!
        if (this.state === 'SPEAKING') {
          console.log('User interruption detected via speech: ', finalTranscript);
          this.interrupt();
        }
      }
    };

    this.recognition.onerror = (event: any) => {
      // Ignore 'no-speech' error to prevent logs bloat in continuous loop
      if (event.error !== 'no-speech') {
        console.warn('Speech recognition error:', event.error);
        if (event.error === 'not-allowed') {
          this.options.onError('Microphone access denied.');
          this.stopSession();
        }
      }
    };

    this.recognition.onend = () => {
      // If user finished speaking and we have a captured transcript, submit to AI
      if (this.isSessionActive) {
        if (this.lastTranscript.trim()) {
          this.submitPrompt(this.lastTranscript);
        } else if (this.state === 'LISTENING') {
          // No speech detected, restart listening loop to keep session open
          this.restartListening();
        }
      }
    };
  }

  private setState(state: VoiceState) {
    this.state = state;
    this.options.onStateChange(state);
  }

  public getConversationId() {
    return this.conversationId;
  }

  public startSession(conversationId?: string) {
    if (this.isSessionActive) return;
    this.isSessionActive = true;
    this.conversationId = conversationId || null;
    this.stopAudioPlayback();
    this.restartListening();
  }

  public stopSession() {
    this.isSessionActive = false;
    this.stopAudioPlayback();
    if (this.recognition) {
      try {
        this.recognition.abort();
      } catch (e) {}
    }
    this.setState('IDLE');
  }

  public toggleSession() {
    if (this.isSessionActive) {
      this.stopSession();
    } else {
      this.startSession();
    }
  }

  private restartListening() {
    if (!this.isSessionActive || !this.recognition) return;
    this.stopAudioPlayback();
    this.setState('LISTENING');
    try {
      this.recognition.start();
    } catch (e) {
      // Recognition might already be running, ignore
    }
  }

  public interrupt() {
    console.log('Interrupting Jarvis synthesis playback...');
    this.stopAudioPlayback();
    this.setState('LISTENING');
    this.options.onTranscriptChange('', false);
    
    // Open mic for user immediately
    if (this.recognition) {
      try {
        this.recognition.abort();
        setTimeout(() => {
          if (this.isSessionActive) this.recognition.start();
        }, 100);
      } catch (e) {}
    }
  }

  private stopAudioPlayback() {
    if (typeof window === 'undefined') return;
    window.speechSynthesis.cancel();
    this.synthesisQueue = [];
    this.isSynthesisSpeaking = false;
    this.currentUtterance = null;
  }

  private async submitPrompt(promptText: string) {
    if (!this.isSessionActive) return;
    
    this.setState('THINKING');
    this.currentResponseText = '';
    this.options.onResponseChunk('');

    try {
      const response = await fetch('/api/voice/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: promptText,
          conversationId: this.conversationId || undefined,
          mode: this.options.mode || 'general',
        }),
      });

      if (!response.ok) {
        throw new Error('AI prompt request failed');
      }

      const returnedChatId = response.headers.get('X-Conversation-Id');
      if (returnedChatId) {
        this.conversationId = returnedChatId;
      }

      const reader = response.body?.getReader();
      const decoder = new TextEncoder();
      const textDecoder = new TextDecoder('utf-8');

      if (!reader) {
        throw new Error('Readable stream not supported');
      }

      this.setState('SPEAKING');

      // We read chunks from response and split them into sentences to play them with low latency
      let partialSentence = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const textChunk = textDecoder.decode(value, { stream: true });
        this.currentResponseText += textChunk;
        this.options.onResponseChunk(this.currentResponseText);

        // Process sentence boundaries (periods, question marks, exclamation points)
        partialSentence += textChunk;
        
        // Simple regex to split on sentence terminals followed by space or end
        const sentences = partialSentence.split(/(?<=[.?!])\s+/);
        
        // The last element might be incomplete, keep it in partialSentence
        if (sentences.length > 1) {
          partialSentence = sentences.pop() || '';
          // Queue all complete sentences for speaking
          for (const s of sentences) {
            const cleanText = this.cleanTextForVoice(s);
            if (cleanText.trim().length > 1) {
              this.enqueueSentence(cleanText);
            }
          }
        }
      }

      // Enqueue the last remaining chunk
      const finalCleanText = this.cleanTextForVoice(partialSentence);
      if (finalCleanText.trim().length > 1) {
        this.enqueueSentence(finalCleanText);
      }

      this.options.onFinishedResponse(this.currentResponseText);

    } catch (err: any) {
      console.error(err);
      this.options.onError(err.message || 'Failed connecting to Jarvis Voice API.');
      this.restartListening();
    }
  }

  // Clean markdown or structural punctuation out of responses for clean text-to-speech
  private cleanTextForVoice(text: string): string {
    return text
      .replace(/\*\*/g, '')
      .replace(/#/g, '')
      .replace(/-\s+/g, '')
      .replace(/`[^`]+`/g, (m) => m.slice(1, -1)) // Keep code content, strip backticks
      .trim();
  }

  private enqueueSentence(sentence: string) {
    this.synthesisQueue.push(sentence);
    if (!this.isSynthesisSpeaking) {
      this.speakNext();
    }
  }

  private speakNext() {
    if (typeof window === 'undefined') return;
    if (this.synthesisQueue.length === 0) {
      this.isSynthesisSpeaking = false;
      // Synthesizer queue finished! Go back to listening mode for continuous conversation
      if (this.isSessionActive && this.state === 'SPEAKING') {
        console.log('AI finished speaking. Restarting microphone listen loop.');
        this.restartListening();
      }
      return;
    }

    this.isSynthesisSpeaking = true;
    const text = this.synthesisQueue.shift() || '';

    // If options specify premiumVoice and key is set, we could theoretically fetch synthesized bytes.
    // However, native SpeechSynthesis runs completely client-side and is instantaneous.
    // We will use native speechSynthesis for ultimate low-latency streaming sentences.
    this.currentUtterance = new SpeechSynthesisUtterance(text);
    
    // Choose a premium sounding native voice if available (e.g. Google US English, Siri, etc.)
    const voices = window.speechSynthesis.getVoices();
    const englishVoice = voices.find(v => v.lang === 'en-US' && v.name.includes('Google')) ||
                         voices.find(v => v.lang.startsWith('en') && v.name.includes('Natural')) ||
                         voices.find(v => v.lang.startsWith('en'));
    if (englishVoice) {
      this.currentUtterance.voice = englishVoice;
    }

    this.currentUtterance.rate = 1.05; // Slightly faster for realistic pacing
    this.currentUtterance.pitch = 1.0;

    this.currentUtterance.onend = () => {
      this.currentUtterance = null;
      this.speakNext();
    };

    this.currentUtterance.onerror = (e) => {
      console.warn('Speech Synthesis utterance error:', e);
      this.currentUtterance = null;
      this.speakNext();
    };

    window.speechSynthesis.speak(this.currentUtterance);
  }

  // Allow set mode dynamically
  public setMode(mode: 'general' | 'learning' | 'career' | 'decision') {
    this.options.mode = mode;
  }
}
