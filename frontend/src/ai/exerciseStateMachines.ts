import type { BiomechanicalAngles } from './realPoseTracker'

export type MovementPhase = 'REST' | 'START' | 'MOVING' | 'PEAK' | 'RETURN' | 'REP_COMPLETED'

export interface RepetitionUpdate {
  repetitionCount: number
  currentPhase: MovementPhase
  primaryAngle: number
  primaryAngleLabel: string
  formScore: number
  romPercent: number
  peakAngle: number
  feedbackMessages: string[]
  isRepCompletedThisFrame: boolean
}

export interface ExerciseRules {
  id: string
  name: string
  getPrimaryAngle: (angles: BiomechanicalAngles) => number
  primaryAngleLabel: string
  restAngle: number
  peakThresholdAngle: number
  targetROM: number
  direction: 'increasing' | 'decreasing'
  validationFn: (angles: BiomechanicalAngles) => { score: number; issues: string[] }
}

export class ExerciseStateMachine {
  private rules: ExerciseRules
  private currentPhase: MovementPhase = 'REST'
  private repCount = 0
  private peakAngleObserved = 0
  private currentRepFormScores: number[] = []
  private currentRepIssues: Set<string> = new Set()
  private lastPhaseChangeTime = Date.now()
  private minPhaseHoldMs = 80

  constructor(exerciseId: string) {
    this.rules = this.getRulesForExercise(exerciseId)
    this.reset()
  }

  public reset() {
    this.currentPhase = 'REST'
    this.repCount = 0
    this.peakAngleObserved = this.rules.restAngle
    this.currentRepFormScores = []
    this.currentRepIssues.clear()
    this.lastPhaseChangeTime = Date.now()
  }

  public processFrame(angles: BiomechanicalAngles): RepetitionUpdate {
    const rawAngle = this.rules.getPrimaryAngle(angles)
    const now = Date.now()
    const elapsedInPhase = now - this.lastPhaseChangeTime
    let repCompleted = false

    const { score: frameFormScore, issues: frameIssues } = this.rules.validationFn(angles)
    this.currentRepFormScores.push(frameFormScore)
    frameIssues.forEach((issue) => this.currentRepIssues.add(issue))

    if (this.rules.direction === 'increasing') {
      if (rawAngle > this.peakAngleObserved) {
        this.peakAngleObserved = rawAngle
      }
    } else {
      if (rawAngle < this.peakAngleObserved) {
        this.peakAngleObserved = rawAngle
      }
    }

    switch (this.currentPhase) {
      case 'REST':
        if (this.isMovingAwayFromRest(rawAngle) && elapsedInPhase >= this.minPhaseHoldMs) {
          this.currentPhase = 'MOVING'
          this.lastPhaseChangeTime = now
        }
        break

      case 'MOVING':
        if (this.hasReachedPeak(rawAngle) && elapsedInPhase >= this.minPhaseHoldMs) {
          this.currentPhase = 'PEAK'
          this.lastPhaseChangeTime = now
        } else if (this.isBackNearRest(rawAngle) && elapsedInPhase >= this.minPhaseHoldMs * 2) {
          this.currentPhase = 'REST'
          this.lastPhaseChangeTime = now
        }
        break

      case 'PEAK':
        if (this.isReturningToRest(rawAngle) && elapsedInPhase >= this.minPhaseHoldMs) {
          this.currentPhase = 'RETURN'
          this.lastPhaseChangeTime = now
        }
        break

      case 'RETURN':
        if (this.isBackNearRest(rawAngle) && elapsedInPhase >= this.minPhaseHoldMs) {
          this.repCount++
          this.currentPhase = 'REP_COMPLETED'
          this.lastPhaseChangeTime = now
          repCompleted = true
        }
        break

      case 'REP_COMPLETED':
        if (elapsedInPhase >= 100) {
          this.currentPhase = 'REST'
          this.peakAngleObserved = this.rules.restAngle
          this.currentRepFormScores = []
          this.currentRepIssues.clear()
          this.lastPhaseChangeTime = now
        }
        break
    }

    const avgScore =
      this.currentRepFormScores.length > 0
        ? this.currentRepFormScores.reduce((a, b) => a + b, 0) / this.currentRepFormScores.length
        : frameFormScore

    let romPercent = 0
    if (this.rules.direction === 'increasing') {
      const achievedDelta = Math.max(0, this.peakAngleObserved - this.rules.restAngle)
      romPercent = Math.min(100, Math.round((achievedDelta / this.rules.targetROM) * 100))
    } else {
      const achievedDelta = Math.max(0, this.rules.restAngle - this.peakAngleObserved)
      romPercent = Math.min(100, Math.round((achievedDelta / this.rules.targetROM) * 100))
    }

    return {
      repetitionCount: this.repCount,
      currentPhase: this.currentPhase,
      primaryAngle: Math.round(rawAngle * 10) / 10,
      primaryAngleLabel: this.rules.primaryAngleLabel,
      formScore: Math.round(avgScore),
      romPercent,
      peakAngle: Math.round(this.peakAngleObserved * 10) / 10,
      feedbackMessages: Array.from(this.currentRepIssues),
      isRepCompletedThisFrame: repCompleted,
    }
  }

  private isMovingAwayFromRest(angle: number): boolean {
    if (this.rules.direction === 'increasing') {
      return angle >= this.rules.restAngle + 10
    }
    return angle <= this.rules.restAngle - 10
  }

  private hasReachedPeak(angle: number): boolean {
    if (this.rules.direction === 'increasing') {
      return angle >= this.rules.peakThresholdAngle
    }
    return angle <= this.rules.peakThresholdAngle
  }

  private isReturningToRest(angle: number): boolean {
    if (this.rules.direction === 'increasing') {
      return angle <= this.peakAngleObserved - 8
    }
    return angle >= this.peakAngleObserved + 8
  }

  private isBackNearRest(angle: number): boolean {
    if (this.rules.direction === 'increasing') {
      return angle <= this.rules.restAngle + 18
    }
    return angle >= this.rules.restAngle - 18
  }

  private getRulesForExercise(id: string): ExerciseRules {
    switch (id) {
      case 'arm_raise':
        return {
          id: 'arm_raise',
          name: 'Arm / Shoulder Raise',
          // Dynamically track whichever arm (left or right) is active
          getPrimaryAngle: (a) => Math.max(a.leftShoulderAngle || 0, a.rightShoulderAngle || 0),
          primaryAngleLabel: 'Shoulder Elevation',
          restAngle: 20,
          peakThresholdAngle: 55, // Low barrier for responsive rep detection
          targetROM: 85,
          direction: 'increasing',
          validationFn: (a) => {
            const issues: string[] = []
            let score = 95
            if (a.shoulderBalanceDelta > 20) {
              issues.push('Avoid excessive shoulder shrugging')
              score -= 15
            }
            return { score: Math.max(30, score), issues }
          },
        }

      case 'knee_extension':
        return {
          id: 'knee_extension',
          name: 'Seated Knee Extension',
          // Track whichever knee is extending
          getPrimaryAngle: (a) => {
            const lk = a.leftKneeAngle || 0
            const rk = a.rightKneeAngle || 0
            // Knee extension moves from 90° (bent) towards 160° (extended)
            return Math.max(lk, rk)
          },
          primaryAngleLabel: 'Knee Extension',
          restAngle: 90,
          peakThresholdAngle: 125, // Responsive threshold for patients
          targetROM: 70,
          direction: 'increasing',
          validationFn: (a) => {
            const issues: string[] = []
            let score = 95
            if (a.trunkLeanAngle > 25) {
              issues.push('Keep torso upright against backrest')
              score -= 15
            }
            return { score: Math.max(30, score), issues }
          },
        }

      case 'sit_to_stand':
        return {
          id: 'sit_to_stand',
          name: 'Sit to Stand',
          getPrimaryAngle: (a) => a.sitToStandElevationAngle || Math.max(a.leftKneeAngle, a.rightKneeAngle, a.leftHipAngle, a.rightHipAngle),
          primaryAngleLabel: 'Stand Angle',
          restAngle: 90,
          peakThresholdAngle: 125,
          targetROM: 60,
          direction: 'increasing',
          validationFn: (a) => {
            const issues: string[] = []
            let score = 95
            const diff = Math.abs((a.leftKneeAngle || 0) - (a.rightKneeAngle || 0))
            if (diff > 25) {
              issues.push('Distribute weight symmetrically')
              score -= 10
            }
            return { score: Math.max(30, score), issues }
          },
        }

      case 'squat':
        return {
          id: 'squat',
          name: 'Rehabilitation Squat',
          getPrimaryAngle: (a) => Math.min(a.leftKneeAngle || 170, a.rightKneeAngle || 170),
          primaryAngleLabel: 'Knee Flexion',
          restAngle: 170,
          peakThresholdAngle: 130,
          targetROM: 60,
          direction: 'decreasing',
          validationFn: (a) => {
            const issues: string[] = []
            let score = 94
            if (a.trunkLeanAngle > 35) {
              issues.push('Avoid excessive forward torso lean')
              score -= 20
            }
            return { score: Math.max(25, score), issues }
          },
        }

      case 'leg_raise':
        return {
          id: 'leg_raise',
          name: 'Straight Leg Raise',
          getPrimaryAngle: (a) => Math.min(a.leftHipAngle || 175, a.rightHipAngle || 175),
          primaryAngleLabel: 'Hip Flexion Angle',
          restAngle: 175,
          peakThresholdAngle: 145,
          targetROM: 45,
          direction: 'decreasing',
          validationFn: () => ({ score: 92, issues: [] }),
        }

      case 'neck_posture':
        return {
          id: 'neck_posture',
          name: 'Neck & Forward Head Alignment',
          getPrimaryAngle: (a) => a.craniovertebralAngle || 45,
          primaryAngleLabel: 'CVA Angle',
          restAngle: 42,
          peakThresholdAngle: 50,
          targetROM: 12,
          direction: 'increasing',
          validationFn: () => ({ score: 90, issues: [] }),
        }

      case 'torso_bend':
        return {
          id: 'torso_bend',
          name: 'Back & Torso Bend Alignment',
          getPrimaryAngle: (a) => a.trunkLeanAngle || 0,
          primaryAngleLabel: 'Torso Lean',
          restAngle: 5,
          peakThresholdAngle: 25,
          targetROM: 25,
          direction: 'increasing',
          validationFn: () => ({ score: 90, issues: [] }),
        }

      case 'shoulder_symmetry':
        return {
          id: 'shoulder_symmetry',
          name: 'Shoulder Symmetry & Balance',
          getPrimaryAngle: (a) => a.shoulderBalanceDelta || 10,
          primaryAngleLabel: 'Shoulder Delta',
          restAngle: 15,
          peakThresholdAngle: 5,
          targetROM: 10,
          direction: 'decreasing',
          validationFn: () => ({ score: 95, issues: [] }),
        }

      default:
        return {
          id,
          name: 'Exercise Movement',
          getPrimaryAngle: (a) => Math.max(a.leftShoulderAngle || 0, a.rightShoulderAngle || 0),
          primaryAngleLabel: 'Joint Angle',
          restAngle: 20,
          peakThresholdAngle: 60,
          targetROM: 60,
          direction: 'increasing',
          validationFn: () => ({ score: 90, issues: [] }),
        }
    }
  }
}
