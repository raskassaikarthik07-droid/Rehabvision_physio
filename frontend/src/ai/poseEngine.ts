/**
 * RehabVision Browser AI Pose & Biomechanics Engine
 * Performs 100% client-side deterministic joint angle calculations,
 * symmetry scoring, stability tracking, and form analysis.
 */

export interface PoseLandmark {
  x: number
  y: number
  z?: number
  visibility: number
}

export interface JointAngles {
  left_shoulder_abduction: number
  right_shoulder_abduction: number
  left_elbow: number
  right_elbow: number
  left_knee: number
  right_knee: number
  left_hip: number
  right_hip: number
  trunk_lean: number
  neck_angle: number
  craniovertebral_angle: number
  shoulder_height_diff_pct: number
  knee_valgus_left: number
  knee_valgus_right: number
  left_hip_abduction: number
  right_hip_abduction: number
}

export interface FormAnalysis {
  form_score: number
  issues: string[]
  positive_feedback: string[]
  movement_quality: 'good' | 'moderate' | 'needs_improvement'
}

export interface BiomechanicalMetrics {
  joint_angles: JointAngles
  symmetry_score: number
  stability_score: number
  rom_percentage: number
  landmark_confidence: number
  timestamp: number
}

export interface AnalysisResult {
  rep_count: number
  phase: string
  primary_angle: number
  rom_percentage: number
  form_score: number
  symmetry_score: number
  stability_score: number
  landmark_confidence: number
  issues: string[]
  positive_feedback: string[]
  movement_quality: string
  joint_angles: JointAngles
  landmarks?: PoseLandmark[]
}

// MediaPipe landmark mapping
export const LANDMARK_INDEX = {
  nose: 0,
  left_eye_inner: 1, left_eye: 2, left_eye_outer: 3,
  right_eye_inner: 4, right_eye: 5, right_eye_outer: 6,
  left_ear: 7, right_ear: 8,
  mouth_left: 9, mouth_right: 10,
  left_shoulder: 11, right_shoulder: 12,
  left_elbow: 13, right_elbow: 14,
  left_wrist: 15, right_wrist: 16,
  left_pinky: 17, right_pinky: 18,
  left_index: 19, right_index: 20,
  left_thumb: 21, right_thumb: 22,
  left_hip: 23, right_hip: 24,
  left_knee: 25, right_knee: 26,
  left_ankle: 27, right_ankle: 28,
  left_heel: 29, right_heel: 30,
  left_foot_index: 31, right_foot_index: 32,
}

export function getLandmark(landmarks: PoseLandmark[], name: keyof typeof LANDMARK_INDEX): PoseLandmark | null {
  const idx = LANDMARK_INDEX[name]
  if (idx !== undefined && idx < landmarks.length) {
    const lm = landmarks[idx]
    if (lm && lm.visibility >= 0.25) return lm
  }
  return null
}

/**
 * 2D Planar angle at joint B formed by points A-B-C. Returns degrees [0, 180].
 */
export function calculateAngle(a: PoseLandmark, b: PoseLandmark, c: PoseLandmark): number {
  const ax = a.x - b.x
  const ay = a.y - b.y
  const cx = c.x - b.x
  const cy = c.y - b.y
  const dot = ax * cx + ay * cy
  const magA = Math.sqrt(ax * ax + ay * ay)
  const magC = Math.sqrt(cx * cx + cy * cy)
  if (magA < 1e-6 || magC < 1e-6) return 0.0
  const cosAngle = Math.max(-1.0, Math.min(1.0, dot / (magA * magC)))
  return (Math.acos(cosAngle) * 180.0) / Math.PI
}

/**
 * Angle of segment A->B relative to vertical axis (degrees [0, 90]).
 */
export function calculateAngleWithVertical(a: PoseLandmark, b: PoseLandmark): number {
  const dx = Math.abs(a.x - b.x)
  const dy = Math.abs(a.y - b.y) + 1e-6
  return (Math.atan2(dx, dy) * 180.0) / Math.PI
}

/**
 * Compute comprehensive clinical joint angles from 33 MediaPipe pose landmarks.
 */
export function computeJointAngles(landmarks: PoseLandmark[]): JointAngles {
  const angles: JointAngles = {
    left_shoulder_abduction: 0,
    right_shoulder_abduction: 0,
    left_elbow: 0,
    right_elbow: 0,
    left_knee: 0,
    right_knee: 0,
    left_hip: 0,
    right_hip: 0,
    trunk_lean: 0,
    neck_angle: 0,
    craniovertebral_angle: 0,
    shoulder_height_diff_pct: 0,
    knee_valgus_left: 180,
    knee_valgus_right: 180,
    left_hip_abduction: 0,
    right_hip_abduction: 0,
  }

  const lShoulder = getLandmark(landmarks, 'left_shoulder')
  const rShoulder = getLandmark(landmarks, 'right_shoulder')
  const lElbow = getLandmark(landmarks, 'left_elbow')
  const rElbow = getLandmark(landmarks, 'right_elbow')
  const lWrist = getLandmark(landmarks, 'left_wrist')
  const rWrist = getLandmark(landmarks, 'right_wrist')
  const lHip = getLandmark(landmarks, 'left_hip')
  const rHip = getLandmark(landmarks, 'right_hip')
  const lKnee = getLandmark(landmarks, 'left_knee')
  const rKnee = getLandmark(landmarks, 'right_knee')
  const lAnkle = getLandmark(landmarks, 'left_ankle')
  const rAnkle = getLandmark(landmarks, 'right_ankle')
  const lEar = getLandmark(landmarks, 'left_ear')
  const rEar = getLandmark(landmarks, 'right_ear')

  // Shoulder Abduction
  if (lHip && lShoulder && lElbow) angles.left_shoulder_abduction = calculateAngle(lHip, lShoulder, lElbow)
  if (rHip && rShoulder && rElbow) angles.right_shoulder_abduction = calculateAngle(rHip, rShoulder, rElbow)

  // Elbows
  if (lShoulder && lElbow && lWrist) angles.left_elbow = calculateAngle(lShoulder, lElbow, lWrist)
  if (rShoulder && rElbow && rWrist) angles.right_elbow = calculateAngle(rShoulder, rElbow, rWrist)

  // Knees
  if (lHip && lKnee && lAnkle) angles.left_knee = calculateAngle(lHip, lKnee, lAnkle)
  if (rHip && rKnee && rAnkle) angles.right_knee = calculateAngle(rHip, rKnee, rAnkle)

  // Hips
  if (lShoulder && lHip && lKnee) angles.left_hip = calculateAngle(lShoulder, lHip, lKnee)
  if (rShoulder && rHip && rKnee) angles.right_hip = calculateAngle(rShoulder, rHip, rKnee)

  // Trunk lean
  if (lShoulder && rShoulder && lHip && rHip) {
    const midShoulder: PoseLandmark = {
      x: (lShoulder.x + rShoulder.x) / 2,
      y: (lShoulder.y + rShoulder.y) / 2,
      visibility: (lShoulder.visibility + rShoulder.visibility) / 2,
    }
    const midHip: PoseLandmark = {
      x: (lHip.x + rHip.x) / 2,
      y: (lHip.y + rHip.y) / 2,
      visibility: (lHip.visibility + rHip.visibility) / 2,
    }
    angles.trunk_lean = calculateAngleWithVertical(midShoulder, midHip)
  }

  // Craniovertebral Angle (CVA)
  const ear = lEar || rEar
  const shoulder = lShoulder || rShoulder
  if (ear && shoulder) {
    const dx = Math.abs(ear.x - shoulder.x) + 1e-6
    const dy = Math.abs(ear.y - shoulder.y)
    angles.craniovertebral_angle = (Math.atan2(dy, dx) * 180.0) / Math.PI
  }

  // Shoulder Height Asymmetry %
  if (lShoulder && rShoulder) {
    const heightDiff = Math.abs(lShoulder.y - rShoulder.y)
    const shoulderDist = Math.sqrt(Math.pow(lShoulder.x - rShoulder.x, 2) + Math.pow(lShoulder.y - rShoulder.y, 2)) + 1e-6
    angles.shoulder_height_diff_pct = (heightDiff / shoulderDist) * 100.0
  }

  // Knee Valgus
  if (lHip && lKnee && lAnkle) angles.knee_valgus_left = calculateAngle(lHip, lKnee, lAnkle)
  if (rHip && rKnee && rAnkle) angles.knee_valgus_right = calculateAngle(rHip, rKnee, rAnkle)

  // Hip Abduction
  if (lHip && lKnee) angles.left_hip_abduction = calculateAngleWithVertical(lHip, lKnee)
  if (rHip && rKnee) angles.right_hip_abduction = calculateAngleWithVertical(rHip, rKnee)

  return angles
}

export function computeSymmetryScore(angles: JointAngles): number {
  const deltas: number[] = []
  if (angles.left_shoulder_abduction > 5 && angles.right_shoulder_abduction > 5) {
    deltas.push(Math.abs(angles.left_shoulder_abduction - angles.right_shoulder_abduction))
  }
  if (angles.left_knee > 5 && angles.right_knee > 5) {
    deltas.push(Math.abs(angles.left_knee - angles.right_knee))
  }
  if (angles.left_hip > 5 && angles.right_hip > 5) {
    deltas.push(Math.abs(angles.left_hip - angles.right_hip))
  }
  if (!deltas.length) return 100.0
  const avgDelta = deltas.reduce((a, b) => a + b, 0) / deltas.length
  return Math.max(0.0, Math.min(100.0, 100.0 - avgDelta * 1.5))
}

export function computeStabilityScore(angleHistory: number[]): number {
  if (angleHistory.length < 5) return 100.0
  const recent = angleHistory.slice(-10)
  const mean = recent.reduce((a, b) => a + b, 0) / recent.length
  const variance = recent.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / recent.length
  const std = Math.sqrt(variance)
  return Math.max(0.0, Math.min(100.0, 100.0 - std * 2.0))
}
