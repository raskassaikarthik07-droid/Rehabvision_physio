export type VoiceCommand =
  | 'START'
  | 'PAUSE'
  | 'RESUME'
  | 'STOP'
  | 'NEXT'
  | 'REPEAT'
  | 'EMERGENCY'

export interface VoiceControlListener {
  onCommand: (command: VoiceCommand) => void
  onStatusChange: (isListening: boolean) => void
  onError?: (error: string) => void
}

export class VoiceControlService {
  private recognition: any = null
  private isListening = false
  private listener: VoiceControlListener | null = null

  constructor() {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (SpeechRecognition) {
      try {
        this.recognition = new SpeechRecognition()
        this.recognition.continuous = true
        this.recognition.interimResults = false
        this.recognition.lang = 'en-US'

        this.recognition.onresult = (event: any) => {
          const lastResult = event.results[event.results.length - 1]
          if (lastResult.isFinal) {
            const transcript = lastResult[0].transcript.trim().toLowerCase()
            this.handleTranscript(transcript)
          }
        }

        this.recognition.onend = () => {
          if (this.isListening) {
            try {
              this.recognition.start()
            } catch (e) {
              // Ignore restart error
            }
          }
        }

        this.recognition.onerror = (event: any) => {
          if (this.listener?.onError) {
            this.listener.onError(event.error)
          }
        }
      } catch (e) {
        console.warn('[VoiceControl] Speech recognition not supported')
      }
    }
  }

  public setListener(listener: VoiceControlListener) {
    this.listener = listener
  }

  public start() {
    if (!this.recognition || this.isListening) return
    try {
      this.isListening = true
      this.recognition.start()
      this.listener?.onStatusChange(true)
    } catch (e) {
      console.warn('[VoiceControl] Start failed:', e)
    }
  }

  public stop() {
    if (!this.recognition || !this.isListening) return
    try {
      this.isListening = false
      this.recognition.stop()
      this.listener?.onStatusChange(false)
    } catch (e) {
      console.warn('[VoiceControl] Stop failed:', e)
    }
  }

  public isSupported(): boolean {
    return this.recognition !== null
  }

  private handleTranscript(transcript: string) {
    if (transcript.includes('start')) {
      this.listener?.onCommand('START')
      this.playChime()
    } else if (transcript.includes('pause') || transcript.includes('hold on') || transcript.includes('wait')) {
      this.listener?.onCommand('PAUSE')
      this.playChime()
    } else if (transcript.includes('resume') || transcript.includes('continue') || transcript.includes('go on')) {
      this.listener?.onCommand('RESUME')
      this.playChime()
    } else if (transcript.includes('stop') || transcript.includes('finish') || transcript.includes('end session')) {
      this.listener?.onCommand('STOP')
      this.playChime()
    } else if (transcript.includes('next') || transcript.includes('skip')) {
      this.listener?.onCommand('NEXT')
      this.playChime()
    } else if (transcript.includes('repeat') || transcript.includes('help')) {
      this.listener?.onCommand('REPEAT')
      this.playChime()
    } else if (transcript.includes('emergency') || transcript.includes('help me') || transcript.includes('pain')) {
      this.listener?.onCommand('EMERGENCY')
      this.playAlarm()
    }
  }

  private playChime() {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(587.33, ctx.currentTime) // D5
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1) // A5
      gain.gain.setValueAtTime(0.15, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start()
      osc.stop(ctx.currentTime + 0.3)
    } catch (e) {
      // Audio context may be restricted before user gesture
    }
  }

  private playAlarm() {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sawtooth'
      osc.frequency.setValueAtTime(440, ctx.currentTime)
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.15)
      gain.gain.setValueAtTime(0.3, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start()
      osc.stop(ctx.currentTime + 0.5)
    } catch (e) {}
  }
}
