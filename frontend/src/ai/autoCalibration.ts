import type { NormalizedLandmarkList } from '@mediapipe/pose'
import { LM } from './realPoseTracker'

export interface CalibrationChecklist {
  personDetected: boolean
  faceVisible: boolean
  shouldersVisible: boolean
  torsoFramedCorrectly: boolean
  seatedDetected: boolean
  postureStabilized: boolean
  progressPercent: number
  guidanceMessage: string
}

export class AutoCalibrationEngine {
  private stabilityCounter = 0
  private readonly requiredStableFrames = 30
  private isWheelchairMode = false

  constructor(isWheelchairMode = false) {
    this.isWheelchairMode = isWheelchairMode
  }

  public setWheelchairMode(enabled: boolean) {
    this.isWheelchairMode = enabled
  }

  public evaluateFrame(landmarks: NormalizedLandmarkList | undefined): CalibrationChecklist {
    if (!landmarks || landmarks.length === 0) {
      this.stabilityCounter = 0
      return {
        personDetected: false,
        faceVisible: false,
        shouldersVisible: false,
        torsoFramedCorrectly: false,
        seatedDetected: false,
        postureStabilized: false,
        progressPercent: 0,
        guidanceMessage: 'Position yourself in front of the camera.',
      }
    }

    const nose = landmarks[LM.NOSE]
    const leftShoulder = landmarks[LM.LEFT_SHOULDER]
    const rightShoulder = landmarks[LM.RIGHT_SHOULDER]
    const leftHip = landmarks[LM.LEFT_HIP]
    const rightHip = landmarks[LM.RIGHT_HIP]
    const leftKnee = landmarks[LM.LEFT_KNEE]

    const faceVisible = (nose?.visibility ?? 0) > 0.6
    const shouldersVisible =
      (leftShoulder?.visibility ?? 0) > 0.6 && (rightShoulder?.visibility ?? 0) > 0.6
    const hipsVisible = (leftHip?.visibility ?? 0) > 0.5 && (rightHip?.visibility ?? 0) > 0.5

    const headNotCutOff = nose && nose.y > 0.05 && nose.y < 0.45
    const torsoFramedCorrectly = headNotCutOff && shouldersVisible

    let seatedDetected = this.isWheelchairMode
    if (!seatedDetected && leftHip && leftKnee && (leftKnee.visibility ?? 0) > 0.4) {
      const hipKneeDeltaY = Math.abs(leftKnee.y - leftHip.y)
      if (hipKneeDeltaY < 0.28) {
        seatedDetected = true
      }
    }

    let message = 'Hold steady...'
    if (!faceVisible) {
      message = 'Please face the camera directly.'
      this.stabilityCounter = 0
    } else if (nose.y < 0.08) {
      message = 'Tilt camera up or lower your position slightly.'
      this.stabilityCounter = 0
    } else if (!shouldersVisible) {
      message = 'Step back slightly so your upper body is clearly visible.'
      this.stabilityCounter = 0
    } else if (!hipsVisible && !this.isWheelchairMode) {
      message = 'Frame camera to include shoulders and waist.'
      this.stabilityCounter = 0
    } else {
      this.stabilityCounter++
      const remainingSec = Math.max(1, Math.ceil((this.requiredStableFrames - this.stabilityCounter) / 30))
      message = `Great framing! Hold still for ${remainingSec}s to calibrate baseline.`
    }

    const progress = Math.min(100, Math.round((this.stabilityCounter / this.requiredStableFrames) * 100))
    const postureStabilized = this.stabilityCounter >= this.requiredStableFrames

    return {
      personDetected: true,
      faceVisible,
      shouldersVisible,
      torsoFramedCorrectly,
      seatedDetected,
      postureStabilized,
      progressPercent: progress,
      guidanceMessage: message,
    }
  }

  public reset() {
    this.stabilityCounter = 0
  }
}
