import { emergencyApi } from '../api/client'

export type EmergencyStage = 0 | 1 | 2 | 3

export interface EmergencyState {
  stage: EmergencyStage
  timeUndetectedMs: number
  countdownSeconds: number
  isActiveWarning: boolean
  isEscalated: boolean
}

export class EmergencyProtocolManager {
  private currentStage: EmergencyStage = 0
  private lastFaceDetectedTime = Date.now()
  private isFaceCurrentlyDetected = true
  private sessionId: string | null = null
  private stage1Logged = false
  private stage2Logged = false
  private stage3Logged = false
  private onStateChange: ((state: EmergencyState) => void) | null = null

  constructor(sessionId: string | null = null) {
    this.sessionId = sessionId
  }

  public setSessionId(sessionId: string) {
    this.sessionId = sessionId
  }

  public setOnStateChange(cb: (state: EmergencyState) => void) {
    this.onStateChange = cb
  }

  public reportFacePresence(detected: boolean) {
    const now = Date.now()
    if (detected) {
      this.lastFaceDetectedTime = now
      this.isFaceCurrentlyDetected = true

      // If user regained detection in Stage 1 without needing manual dismissal
      if (this.currentStage === 1) {
        this.acknowledgeSafe()
      }
    } else {
      this.isFaceCurrentlyDetected = false
    }

    this.tick()
  }

  public acknowledgeSafe() {
    this.currentStage = 0
    this.lastFaceDetectedTime = Date.now()
    this.isFaceCurrentlyDetected = true
    this.stage1Logged = false
    this.stage2Logged = false
    this.stage3Logged = false
    this.emitState()
  }

  public manualPanic(notes = 'Manual patient panic trigger') {
    this.currentStage = 3
    this.emitState()
    emergencyApi.recordEvent({
      session_id: this.sessionId || undefined,
      stage: 3,
      event_type: 'manual_panic',
      detection_state: 'user_triggered',
      escalation_state: 'escalated',
      notes,
    }).catch(() => {})
  }

  private tick() {
    const now = Date.now()
    const elapsedSinceDetection = now - this.lastFaceDetectedTime

    if (this.isFaceCurrentlyDetected) {
      if (this.currentStage > 0 && this.currentStage < 2) {
        this.acknowledgeSafe()
      }
      return
    }

    // Stage 1: Face missing for >= 3,000 ms (3 seconds)
    if (elapsedSinceDetection >= 3000 && this.currentStage < 1) {
      this.currentStage = 1
      if (!this.stage1Logged) {
        this.stage1Logged = true
        emergencyApi.recordEvent({
          session_id: this.sessionId || undefined,
          stage: 1,
          event_type: 'face_loss',
          detection_state: 'face_undetected_3s',
          escalation_state: 'triggered',
          notes: 'Stage 1 safety check presented to patient',
        }).catch(() => {})
      }
    }

    // Stage 2: Face missing for >= 6,000 ms (6 seconds)
    if (elapsedSinceDetection >= 6000 && this.currentStage < 2) {
      this.currentStage = 2
      if (!this.stage2Logged) {
        this.stage2Logged = true
        emergencyApi.recordEvent({
          session_id: this.sessionId || undefined,
          stage: 2,
          event_type: 'face_loss',
          detection_state: 'face_undetected_6s',
          escalation_state: 'escalated',
          notes: 'Stage 2 unacknowledged patient alert triggered',
        }).catch(() => {})
      }
    }

    // Stage 3: Face missing for >= 9,000 ms (9 seconds)
    if (elapsedSinceDetection >= 9000 && this.currentStage < 3) {
      this.currentStage = 3
      if (!this.stage3Logged) {
        this.stage3Logged = true
        emergencyApi.recordEvent({
          session_id: this.sessionId || undefined,
          stage: 3,
          event_type: 'face_loss',
          detection_state: 'face_undetected_9s',
          escalation_state: 'escalated',
          notes: 'Stage 3 full escalation dispatched to emergency contacts and physiotherapist',
        }).catch(() => {})
      }
    }

    this.emitState()
  }

  private emitState() {
    const elapsed = Date.now() - this.lastFaceDetectedTime
    const countdown = Math.max(0, Math.ceil((9000 - elapsed) / 1000))

    if (this.onStateChange) {
      this.onStateChange({
        stage: this.currentStage,
        timeUndetectedMs: elapsed,
        countdownSeconds: countdown,
        isActiveWarning: this.currentStage >= 1,
        isEscalated: this.currentStage >= 2,
      })
    }
  }
}
