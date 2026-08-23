/**
 * RehabVision Browser Exercise State Machines
 * 10 Clinical rehabilitation state machines running 100% in-browser.
 */

import type { PoseLandmark, JointAngles, FormAnalysis } from './poseEngine'

export interface RepState {
  count: number
  phase: string
  phaseFrames: number
  maxAngleThisRep: number
  minAngleThisRep: number
  romHistory: number[]
  angleHistory: number[]
}

export abstract class ExerciseStateMachine {
  abstract name: string
  abstract targetReps: number
  abstract primaryJoint: string
  abstract repState: RepState

  abstract update(landmarks: PoseLandmark[], angles: JointAngles): [RepState, FormAnalysis, JointAngles]
  abstract getPrimaryAngle(angles: JointAngles): number

  computeRom(): number {
    if (!this.repState.romHistory.length) return 0.0
    return this.repState.romHistory.reduce((a, b) => a + b, 0) / this.repState.romHistory.length
  }
}

// 1. Arm / Shoulder Raise
export class ArmRaiseStateMachine extends ExerciseStateMachine {
  name = 'Arm / Shoulder Raise'
  targetReps = 10
  primaryJoint = 'shoulder'
  readonly UP_THRESHOLD = 75.0
  readonly DOWN_THRESHOLD = 35.0
  readonly TARGET_ROM = 90.0

  repState: RepState = {
    count: 0,
    phase: 'rest',
    phaseFrames: 0,
    maxAngleThisRep: 0,
    minAngleThisRep: 999,
    romHistory: [],
    angleHistory: [],
  }

  getPrimaryAngle(angles: JointAngles): number {
    const valid = [angles.left_shoulder_abduction, angles.right_shoulder_abduction].filter((a) => a > 5)
    return valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : 0.0
  }

  update(_landmarks: PoseLandmark[], angles: JointAngles): [RepState, FormAnalysis, JointAngles] {
    const primary = this.getPrimaryAngle(angles)
    const rs = this.repState
    rs.angleHistory.push(primary)
    if (rs.angleHistory.length > 30) rs.angleHistory = rs.angleHistory.slice(-30)
    rs.maxAngleThisRep = Math.max(rs.maxAngleThisRep, primary)

    if (rs.phase === 'rest' && primary >= this.UP_THRESHOLD) {
      rs.phase = 'up'
      rs.phaseFrames = 0
      rs.maxAngleThisRep = primary
    } else if (rs.phase === 'up') {
      rs.phaseFrames++
      if (primary < this.DOWN_THRESHOLD) {
        const rom = rs.maxAngleThisRep
        rs.romHistory.push(Math.min(100.0, (rom / this.TARGET_ROM) * 100.0))
        rs.count++
        rs.phase = 'rest'
        rs.maxAngleThisRep = 0.0
      }
    }

    const issues: string[] = []
    const positives: string[] = []
    let score = 100.0

    if (angles.trunk_lean > 18.0) {
      issues.push(`Torso lean ${Math.round(angles.trunk_lean)}° — maintain upright posture`)
      score -= 20
    }
    const avgElbow = (angles.left_elbow + angles.right_elbow) / 2
    if (avgElbow > 0 && avgElbow < 145.0) {
      issues.push(`Elbow flexion detected (${Math.round(avgElbow)}°) — extend arms fully`)
      score -= 15
    }
    if (rs.phase === 'up' && primary < 80.0) {
      issues.push(`Raise arms higher (currently ${Math.round(primary)}°, target ≥90°)`)
      score -= 15
    }
    if (angles.shoulder_height_diff_pct > 12.0) {
      issues.push(`Shoulder asymmetry ${Math.round(angles.shoulder_height_diff_pct)}% detected`)
      score -= 10
    } else {
      positives.push('Bilateral shoulder alignment maintained')
    }

    if (rs.phase === 'up' && primary >= 85.0) positives.push('Full 90° shoulder abduction reached')
    if (angles.trunk_lean < 10.0) positives.push('Good upright trunk stability')

    const form: FormAnalysis = {
      form_score: Math.max(0, Math.min(100, score)),
      issues,
      positive_feedback: positives,
      movement_quality: score >= 80 ? 'good' : score >= 60 ? 'moderate' : 'needs_improvement',
    }

    return [rs, form, angles]
  }
}

// 2. Seated Knee Extension
export class KneeExtensionStateMachine extends ExerciseStateMachine {
  name = 'Seated Knee Extension'
  targetReps = 10
  primaryJoint = 'knee'
  readonly EXTENSION_THRESHOLD = 145.0
  readonly FLEXION_THRESHOLD = 110.0
  readonly TARGET_ROM = 170.0

  repState: RepState = {
    count: 0,
    phase: 'bent',
    phaseFrames: 0,
    maxAngleThisRep: 0,
    minAngleThisRep: 999,
    romHistory: [],
    angleHistory: [],
  }

  getPrimaryAngle(angles: JointAngles): number {
    const valid = [angles.left_knee, angles.right_knee].filter((a) => a > 30)
    return valid.length ? Math.max(...valid) : 90.0
  }

  update(_landmarks: PoseLandmark[], angles: JointAngles): [RepState, FormAnalysis, JointAngles] {
    const primary = this.getPrimaryAngle(angles)
    const rs = this.repState
    rs.angleHistory.push(primary)
    if (rs.angleHistory.length > 30) rs.angleHistory = rs.angleHistory.slice(-30)
    rs.maxAngleThisRep = Math.max(rs.maxAngleThisRep, primary)

    if (rs.phase === 'bent' && primary >= this.EXTENSION_THRESHOLD) {
      rs.phase = 'extended'
      rs.phaseFrames = 0
      rs.maxAngleThisRep = primary
    } else if (rs.phase === 'extended') {
      rs.phaseFrames++
      if (primary < this.FLEXION_THRESHOLD) {
        const rom = rs.maxAngleThisRep
        rs.romHistory.push(Math.min(100.0, (rom / this.TARGET_ROM) * 100.0))
        rs.count++
        rs.phase = 'bent'
        rs.maxAngleThisRep = 0.0
      }
    }

    const issues: string[] = []
    const positives: string[] = []
    let score = 100.0

    if (rs.phase === 'extended' && primary < 155.0) {
      issues.push(`Incomplete knee extension (${Math.round(primary)}° / target 170°)`)
      score -= 20
    }
    if (angles.trunk_lean > 20.0) {
      issues.push(`Leaning backward ${Math.round(angles.trunk_lean)}° during extension`)
      score -= 15
    }
    if (rs.phase === 'extended' && primary >= 165.0) positives.push('Full terminal knee extension achieved')
    if (angles.trunk_lean < 12.0) positives.push('Stable seated trunk posture')

    const form: FormAnalysis = {
      form_score: Math.max(0, Math.min(100, score)),
      issues,
      positive_feedback: positives,
      movement_quality: score >= 80 ? 'good' : score >= 60 ? 'moderate' : 'needs_improvement',
    }

    return [rs, form, angles]
  }
}

// 3. Sit to Stand
export class SitToStandStateMachine extends ExerciseStateMachine {
  name = 'Sit to Stand'
  targetReps = 5
  primaryJoint = 'hip_knee'
  readonly STAND_THRESHOLD = 140.0
  readonly SIT_THRESHOLD = 105.0
  readonly TARGET_ROM = 155.0

  repState: RepState = {
    count: 0,
    phase: 'seated',
    phaseFrames: 0,
    maxAngleThisRep: 0,
    minAngleThisRep: 999,
    romHistory: [],
    angleHistory: [],
  }

  getPrimaryAngle(angles: JointAngles): number {
    const valid = [angles.left_knee, angles.right_knee].filter((a) => a > 20)
    return valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : 90.0
  }

  update(_landmarks: PoseLandmark[], angles: JointAngles): [RepState, FormAnalysis, JointAngles] {
    const primary = this.getPrimaryAngle(angles)
    const rs = this.repState
    rs.angleHistory.push(primary)
    if (rs.angleHistory.length > 30) rs.angleHistory = rs.angleHistory.slice(-30)
    rs.maxAngleThisRep = Math.max(rs.maxAngleThisRep, primary)

    if (rs.phase === 'seated' && primary >= this.STAND_THRESHOLD) {
      rs.phase = 'standing'
      rs.phaseFrames = 0
      rs.maxAngleThisRep = primary
    } else if (rs.phase === 'standing') {
      rs.phaseFrames++
      if (primary < this.SIT_THRESHOLD) {
        rs.romHistory.push(Math.min(100.0, (rs.maxAngleThisRep / this.TARGET_ROM) * 100.0))
        rs.count++
        rs.phase = 'seated'
        rs.maxAngleThisRep = 0.0
      }
    }

    const issues: string[] = []
    const positives: string[] = []
    let score = 100.0

    if (angles.trunk_lean > 35.0) {
      issues.push(`Excessive forward trunk lean (${Math.round(angles.trunk_lean)}°)`)
      score -= 20
    }
    const valgus = Math.min(angles.knee_valgus_left, angles.knee_valgus_right)
    if (valgus < 165.0) {
      issues.push('Knee inward collapse (valgus) detected on ascent')
      score -= 20
    }
    if (rs.phase === 'standing' && primary >= 150.0) positives.push('Full upright hip and knee extension achieved')
    if (angles.trunk_lean < 25.0) positives.push('Controlled hip-hinge ascent mechanics')

    const form: FormAnalysis = {
      form_score: Math.max(0, Math.min(100, score)),
      issues,
      positive_feedback: positives,
      movement_quality: score >= 80 ? 'good' : score >= 60 ? 'moderate' : 'needs_improvement',
    }

    return [rs, form, angles]
  }
}

// 4. Straight Leg Raise
export class LegRaiseStateMachine extends ExerciseStateMachine {
  name = 'Straight Leg Raise'
  targetReps = 8
  primaryJoint = 'hip'
  readonly UP_THRESHOLD = 32.0
  readonly DOWN_THRESHOLD = 15.0
  readonly TARGET_ROM = 45.0

  repState: RepState = {
    count: 0,
    phase: 'rest',
    phaseFrames: 0,
    maxAngleThisRep: 0,
    minAngleThisRep: 999,
    romHistory: [],
    angleHistory: [],
  }

  getPrimaryAngle(angles: JointAngles): number {
    const valid = [angles.left_hip_abduction, angles.right_hip_abduction].filter((a) => a > 2)
    return valid.length ? Math.max(...valid) : 0.0
  }

  update(_landmarks: PoseLandmark[], angles: JointAngles): [RepState, FormAnalysis, JointAngles] {
    const primary = this.getPrimaryAngle(angles)
    const rs = this.repState
    rs.angleHistory.push(primary)
    if (rs.angleHistory.length > 30) rs.angleHistory = rs.angleHistory.slice(-30)
    rs.maxAngleThisRep = Math.max(rs.maxAngleThisRep, primary)

    if (rs.phase === 'rest' && primary >= this.UP_THRESHOLD) {
      rs.phase = 'up'
      rs.phaseFrames = 0
      rs.maxAngleThisRep = primary
    } else if (rs.phase === 'up') {
      rs.phaseFrames++
      if (primary < this.DOWN_THRESHOLD) {
        rs.romHistory.push(Math.min(100.0, (rs.maxAngleThisRep / this.TARGET_ROM) * 100.0))
        rs.count++
        rs.phase = 'rest'
        rs.maxAngleThisRep = 0.0
      }
    }

    const issues: string[] = []
    const positives: string[] = []
    let score = 100.0

    const kneeAngle = Math.min(angles.left_knee, angles.right_knee)
    if (kneeAngle > 30 && kneeAngle < 155.0) {
      issues.push('Knee bending during straight leg raise — lock quadriceps')
      score -= 25
    }
    if (rs.phase === 'up' && primary < 38.0) {
      issues.push(`Raise leg closer to 45° (currently ${Math.round(primary)}°)`)
      score -= 15
    }
    if (rs.phase === 'up' && primary >= 42.0) positives.push('Full 45° straight leg elevation reached')
    if (kneeAngle >= 165.0) positives.push('Excellent straight knee lock maintained')

    const form: FormAnalysis = {
      form_score: Math.max(0, Math.min(100, score)),
      issues,
      positive_feedback: positives,
      movement_quality: score >= 80 ? 'good' : score >= 60 ? 'moderate' : 'needs_improvement',
    }

    return [rs, form, angles]
  }
}

// 5. Rehabilitation Squat
export class SquatStateMachine extends ExerciseStateMachine {
  name = 'Rehabilitation Squat'
  targetReps = 10
  primaryJoint = 'knee'
  readonly SQUAT_DEPTH_THRESHOLD = 125.0
  readonly STAND_THRESHOLD = 160.0
  readonly TARGET_ROM = 100.0

  repState: RepState = {
    count: 0,
    phase: 'standing',
    phaseFrames: 0,
    maxAngleThisRep: 0,
    minAngleThisRep: 180,
    romHistory: [],
    angleHistory: [],
  }

  getPrimaryAngle(angles: JointAngles): number {
    const valid = [angles.left_knee, angles.right_knee].filter((a) => a > 30)
    return valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : 175.0
  }

  update(_landmarks: PoseLandmark[], angles: JointAngles): [RepState, FormAnalysis, JointAngles] {
    const primary = this.getPrimaryAngle(angles)
    const rs = this.repState
    rs.angleHistory.push(primary)
    if (rs.angleHistory.length > 30) rs.angleHistory = rs.angleHistory.slice(-30)
    rs.minAngleThisRep = Math.min(rs.minAngleThisRep, primary)

    if (rs.phase === 'standing' && primary <= this.SQUAT_DEPTH_THRESHOLD) {
      rs.phase = 'descending'
      rs.phaseFrames = 0
      rs.minAngleThisRep = primary
    } else if (rs.phase === 'descending') {
      rs.phaseFrames++
      if (primary >= this.STAND_THRESHOLD) {
        const depthAngle = 180.0 - rs.minAngleThisRep
        rs.romHistory.push(Math.min(100.0, (depthAngle / this.TARGET_ROM) * 100.0))
        rs.count++
        rs.phase = 'standing'
        rs.minAngleThisRep = 180.0
      }
    }

    const issues: string[] = []
    const positives: string[] = []
    let score = 100.0

    if (angles.trunk_lean > 35.0) {
      issues.push(`Excessive forward torso tilt (${Math.round(angles.trunk_lean)}°)`)
      score -= 20
    }
    const valgus = Math.min(angles.knee_valgus_left, angles.knee_valgus_right)
    if (valgus < 165.0) {
      issues.push('Knee valgus collapse detected — drive knees outwards')
      score -= 20
    }
    if (rs.phase === 'descending' && primary <= 110.0) positives.push('Optimal rehabilitation squat depth reached')
    if (valgus >= 170.0) positives.push('Optimal knee-over-toe frontal alignment')

    const form: FormAnalysis = {
      form_score: Math.max(0, Math.min(100, score)),
      issues,
      positive_feedback: positives,
      movement_quality: score >= 80 ? 'good' : score >= 60 ? 'moderate' : 'needs_improvement',
    }

    return [rs, form, angles]
  }
}

// 6. Neck Posture & Forward Head Alignment
export class NeckPostureStateMachine extends ExerciseStateMachine {
  name = 'Neck & Forward Head Alignment'
  targetReps = 1
  primaryJoint = 'cervical'

  repState: RepState = {
    count: 0,
    phase: 'calibrated',
    phaseFrames: 0,
    maxAngleThisRep: 0,
    minAngleThisRep: 999,
    romHistory: [],
    angleHistory: [],
  }

  getPrimaryAngle(angles: JointAngles): number {
    return angles.craniovertebral_angle || 52.0
  }

  update(_landmarks: PoseLandmark[], angles: JointAngles): [RepState, FormAnalysis, JointAngles] {
    const cva = this.getPrimaryAngle(angles)
    const rs = this.repState
    rs.angleHistory.push(cva)
    if (rs.angleHistory.length > 30) rs.angleHistory = rs.angleHistory.slice(-30)

    const issues: string[] = []
    const positives: string[] = []
    let score = 100.0

    if (cva < 48.0) {
      issues.push(`FORWARD HEAD POSITION DETECTED (CVA ${Math.round(cva)}° < 48°) — retract chin`)
      score -= 30
      rs.phase = 'forward_head'
    } else {
      positives.push(`GOOD POSTURE: Craniovertebral angle ${Math.round(cva)}° within optimal alignment`)
      rs.phase = 'optimal_alignment'
    }

    rs.romHistory = [Math.min(100, (cva / 54.0) * 100.0)]
    rs.count = rs.phase === 'optimal_alignment' ? 1 : 0

    const form: FormAnalysis = {
      form_score: Math.max(0, Math.min(100, score)),
      issues,
      positive_feedback: positives,
      movement_quality: score >= 80 ? 'good' : 'moderate',
    }

    return [rs, form, angles]
  }
}

// 7. Back & Torso Bend Alignment
export class TorsoBendStateMachine extends ExerciseStateMachine {
  name = 'Back & Torso Bend Alignment'
  targetReps = 5
  primaryJoint = 'torso'
  readonly BENT_THRESHOLD = 28.0
  readonly UPRIGHT_THRESHOLD = 12.0
  readonly TARGET_ROM = 45.0

  repState: RepState = {
    count: 0,
    phase: 'upright',
    phaseFrames: 0,
    maxAngleThisRep: 0,
    minAngleThisRep: 999,
    romHistory: [],
    angleHistory: [],
  }

  getPrimaryAngle(angles: JointAngles): number {
    return angles.trunk_lean || 0.0
  }

  update(_landmarks: PoseLandmark[], angles: JointAngles): [RepState, FormAnalysis, JointAngles] {
    const primary = this.getPrimaryAngle(angles)
    const rs = this.repState
    rs.angleHistory.push(primary)
    if (rs.angleHistory.length > 30) rs.angleHistory = rs.angleHistory.slice(-30)
    rs.maxAngleThisRep = Math.max(rs.maxAngleThisRep, primary)

    if (rs.phase === 'upright' && primary >= this.BENT_THRESHOLD) {
      rs.phase = 'bent'
      rs.phaseFrames = 0
      rs.maxAngleThisRep = primary
    } else if (rs.phase === 'bent') {
      rs.phaseFrames++
      if (primary <= this.UPRIGHT_THRESHOLD) {
        rs.romHistory.push(Math.min(100.0, (rs.maxAngleThisRep / this.TARGET_ROM) * 100.0))
        rs.count++
        rs.phase = 'upright'
        rs.maxAngleThisRep = 0.0
      }
    }

    const issues: string[] = []
    const positives: string[] = []
    let score = 100.0

    if (primary > 48.0) {
      issues.push(`EXCESSIVE FORWARD BEND DETECTED (Torso angle ${Math.round(primary)}° > 45°)`)
      score -= 25
    } else if (primary <= 45.0 && rs.phase === 'bent') {
      positives.push(`GOOD POSTURE: Controlled hip hinge (${Math.round(primary)}°)`)
    }

    if (rs.phase === 'upright') positives.push('Neutral upright spinal column maintained')

    const form: FormAnalysis = {
      form_score: Math.max(0, Math.min(100, score)),
      issues,
      positive_feedback: positives,
      movement_quality: score >= 80 ? 'good' : score >= 60 ? 'moderate' : 'needs_improvement',
    }

    return [rs, form, angles]
  }
}

// 8. Shoulder Symmetry & Balance
export class ShoulderSymmetryStateMachine extends ExerciseStateMachine {
  name = 'Shoulder Symmetry & Balance'
  targetReps = 10
  primaryJoint = 'shoulder_girdle'

  repState: RepState = {
    count: 0,
    phase: 'calibrating',
    phaseFrames: 0,
    maxAngleThisRep: 0,
    minAngleThisRep: 999,
    romHistory: [],
    angleHistory: [],
  }

  getPrimaryAngle(angles: JointAngles): number {
    return 100.0 - angles.shoulder_height_diff_pct
  }

  update(_landmarks: PoseLandmark[], angles: JointAngles): [RepState, FormAnalysis, JointAngles] {
    const diff = angles.shoulder_height_diff_pct
    const rs = this.repState
    rs.angleHistory.push(100 - diff)
    if (rs.angleHistory.length > 30) rs.angleHistory = rs.angleHistory.slice(-30)

    const issues: string[] = []
    const positives: string[] = []
    let score = 100.0

    if (diff > 8.0) {
      issues.push(`Shoulder imbalance (${Math.round(diff)}% delta) — level shoulder girdle`)
      score -= 25
      rs.phase = 'asymmetric'
    } else {
      positives.push('Optimal bilateral shoulder girdle symmetry')
      rs.phase = 'symmetric'
    }

    rs.romHistory = [Math.max(0, 100 - diff)]
    rs.count = rs.phase === 'symmetric' ? 10 : 5

    const form: FormAnalysis = {
      form_score: Math.max(0, Math.min(100, score)),
      issues,
      positive_feedback: positives,
      movement_quality: score >= 80 ? 'good' : 'moderate',
    }

    return [rs, form, angles]
  }
}

// 9. Knee Alignment & Valgus Tracking
export class KneeAlignmentStateMachine extends ExerciseStateMachine {
  name = 'Knee Alignment & Valgus Tracking'
  targetReps = 8
  primaryJoint = 'knee_frontal'

  repState: RepState = {
    count: 0,
    phase: 'neutral',
    phaseFrames: 0,
    maxAngleThisRep: 0,
    minAngleThisRep: 999,
    romHistory: [],
    angleHistory: [],
  }

  getPrimaryAngle(angles: JointAngles): number {
    return Math.min(angles.knee_valgus_left, angles.knee_valgus_right)
  }

  update(_landmarks: PoseLandmark[], angles: JointAngles): [RepState, FormAnalysis, JointAngles] {
    const valgus = this.getPrimaryAngle(angles)
    const rs = this.repState
    rs.angleHistory.push(valgus)
    if (rs.angleHistory.length > 30) rs.angleHistory = rs.angleHistory.slice(-30)

    const issues: string[] = []
    const positives: string[] = []
    let score = 100.0

    if (valgus < 165.0) {
      issues.push(`KNEE VALGUS (INWARD COLLAPSE) DETECTED (${Math.round(valgus)}° < 165°)`)
      score -= 30
      rs.phase = 'valgus_detected'
    } else {
      positives.push('Neutral knee joint frontal plane tracking')
      rs.phase = 'neutral_tracking'
    }

    rs.romHistory = [Math.min(100, (valgus / 175.0) * 100.0)]
    rs.count = rs.phase === 'neutral_tracking' ? 8 : 4

    const form: FormAnalysis = {
      form_score: Math.max(0, Math.min(100, score)),
      issues,
      positive_feedback: positives,
      movement_quality: score >= 80 ? 'good' : 'moderate',
    }

    return [rs, form, angles]
  }
}

// 10. Lateral Leg Raise
export class LateralLegRaiseStateMachine extends ExerciseStateMachine {
  name = 'Lateral Leg Raise'
  targetReps = 8
  primaryJoint = 'hip_abductor'
  readonly UP_THRESHOLD = 22.0
  readonly DOWN_THRESHOLD = 10.0
  readonly TARGET_ROM = 40.0

  repState: RepState = {
    count: 0,
    phase: 'rest',
    phaseFrames: 0,
    maxAngleThisRep: 0,
    minAngleThisRep: 999,
    romHistory: [],
    angleHistory: [],
  }

  getPrimaryAngle(angles: JointAngles): number {
    const valid = [angles.left_hip_abduction, angles.right_hip_abduction].filter((a) => a > 2)
    return valid.length ? Math.max(...valid) : 0.0
  }

  update(_landmarks: PoseLandmark[], angles: JointAngles): [RepState, FormAnalysis, JointAngles] {
    const primary = this.getPrimaryAngle(angles)
    const rs = this.repState
    rs.angleHistory.push(primary)
    if (rs.angleHistory.length > 30) rs.angleHistory = rs.angleHistory.slice(-30)
    rs.maxAngleThisRep = Math.max(rs.maxAngleThisRep, primary)

    if (rs.phase === 'rest' && primary >= this.UP_THRESHOLD) {
      rs.phase = 'up'
      rs.phaseFrames = 0
      rs.maxAngleThisRep = primary
    } else if (rs.phase === 'up') {
      rs.phaseFrames++
      if (primary < this.DOWN_THRESHOLD) {
        rs.romHistory.push(Math.min(100.0, (rs.maxAngleThisRep / this.TARGET_ROM) * 100.0))
        rs.count++
        rs.phase = 'rest'
        rs.maxAngleThisRep = 0.0
      }
    }

    const issues: string[] = []
    const positives: string[] = []
    let score = 100.0

    if (angles.trunk_lean > 18.0) {
      issues.push(`Compensatory trunk lean (${Math.round(angles.trunk_lean)}°) — isolate gluteus medius`)
      score -= 20
    }
    if (rs.phase === 'up' && primary >= 35.0) positives.push('Target 40° hip abduction achieved')
    if (angles.trunk_lean <= 10.0) positives.push('Pelvis and torso stability maintained')

    const form: FormAnalysis = {
      form_score: Math.max(0, Math.min(100, score)),
      issues,
      positive_feedback: positives,
      movement_quality: score >= 80 ? 'good' : score >= 60 ? 'moderate' : 'needs_improvement',
    }

    return [rs, form, angles]
  }
}

export function createStateMachine(exerciseId: string): ExerciseStateMachine {
  switch (exerciseId) {
    case 'arm_raise': return new ArmRaiseStateMachine()
    case 'knee_extension': return new KneeExtensionStateMachine()
    case 'sit_to_stand': return new SitToStandStateMachine()
    case 'leg_raise': return new LegRaiseStateMachine()
    case 'squat': return new SquatStateMachine()
    case 'neck_posture': return new NeckPostureStateMachine()
    case 'torso_bend': return new TorsoBendStateMachine()
    case 'shoulder_symmetry': return new ShoulderSymmetryStateMachine()
    case 'knee_alignment': return new KneeAlignmentStateMachine()
    case 'lateral_leg_raise': return new LateralLegRaiseStateMachine()
    default: return new LegRaiseStateMachine()
  }
}
