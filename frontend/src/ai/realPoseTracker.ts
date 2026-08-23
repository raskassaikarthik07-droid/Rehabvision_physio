import type { Results, NormalizedLandmarkList } from '@mediapipe/pose'

export const LM = {
  NOSE: 0,
  LEFT_EYE_INNER: 1,
  LEFT_EYE: 2,
  LEFT_EYE_OUTER: 3,
  RIGHT_EYE_INNER: 4,
  RIGHT_EYE: 5,
  RIGHT_EYE_OUTER: 6,
  LEFT_EAR: 7,
  RIGHT_EAR: 8,
  MOUTH_LEFT: 9,
  MOUTH_RIGHT: 10,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_PINKY: 17,
  RIGHT_PINKY: 18,
  LEFT_INDEX: 19,
  RIGHT_INDEX: 20,
  LEFT_THUMB: 21,
  RIGHT_THUMB: 22,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
  LEFT_HEEL: 29,
  RIGHT_HEEL: 30,
  LEFT_FOOT_INDEX: 31,
  RIGHT_FOOT_INDEX: 32,
} as const

export interface BiomechanicalAngles {
  leftKneeAngle: number
  rightKneeAngle: number
  leftShoulderAngle: number
  rightShoulderAngle: number
  leftHipAngle: number
  rightHipAngle: number
  leftElbowAngle: number
  rightElbowAngle: number
  craniovertebralAngle: number
  trunkLeanAngle: number
  shoulderBalanceDelta: number
  pelvicTiltDelta: number
  sitToStandElevationAngle: number
}

export class RealPoseTracker {
  private pose: any = null
  private isInitialized = false
  private isProcessingFrame = false
  private onResultsCallback: ((results: Results, angles: BiomechanicalAngles) => void) | null = null
  private initPromise: Promise<void> | null = null

  // Adaptive baseline for Sit-to-Stand vertical tracking
  private seatedBaselineY = 0.65
  private minObservedY = 0.25

  constructor() {
    this.initPromise = this.initPose()
  }

  private async initPose() {
    try {
      if (!(window as any).Pose) {
        await this.loadMediaPipeScript()
      }

      const PoseConstructor = (window as any).Pose
      if (PoseConstructor) {
        this.pose = new PoseConstructor({
          locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5.1675469404/${file}`,
        })

        this.pose.setOptions({
          modelComplexity: 1,
          smoothLandmarks: true,
          enableSegmentation: false,
          smoothSegmentation: false,
          minDetectionConfidence: 0.3,  // Very sensitive — detects partial bodies
          minTrackingConfidence: 0.3,
        })

        this.pose.onResults((results: Results) => {
          if (this.onResultsCallback) {
            const angles = results.poseLandmarks
              ? this.calculateBiomechanicalAngles(results.poseLandmarks)
              : this.getDefaultAngles()
            this.onResultsCallback(results, angles)
          }
        })

        this.isInitialized = true
        console.log('[RealPoseTracker] ✅ MediaPipe Pose initialized')
      }
    } catch (err) {
      console.warn('[RealPoseTracker] Pose init notice:', err)
    }
  }

  private loadMediaPipeScript(): Promise<void> {
    return new Promise((resolve) => {
      if ((window as any).Pose) {
        resolve()
        return
      }
      const script = document.createElement('script')
      script.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5.1675469404/pose.js'
      script.crossOrigin = 'anonymous'
      script.onload = () => resolve()
      script.onerror = () => resolve()
      document.head.appendChild(script)
    })
  }

  public setOnResults(callback: (results: Results, angles: BiomechanicalAngles) => void) {
    this.onResultsCallback = callback
  }

  public async sendFrame(videoElement: HTMLVideoElement): Promise<void> {
    // Wait for MediaPipe to finish initializing (CDN WASM can take 3-5s)
    if (!this.isInitialized && this.initPromise) {
      await this.initPromise
    }
    if (!this.pose || !this.isInitialized || this.isProcessingFrame || videoElement.readyState < 2) return
    this.isProcessingFrame = true
    try {
      await this.pose.send({ image: videoElement })
    } catch {
      // Catch dropped frames gracefully
    } finally {
      this.isProcessingFrame = false
    }
  }

  public close() {
    if (this.pose) {
      try {
        this.pose.close()
      } catch {}
      this.pose = null
      this.isInitialized = false
    }
  }

  public static calculateAngle(
    a: { x: number; y: number },
    b: { x: number; y: number },
    c: { x: number; y: number }
  ): number {
    const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x)
    let angle = Math.abs((radians * 180.0) / Math.PI)
    if (angle > 180.0) {
      angle = 360.0 - angle
    }
    return angle
  }

  public calculateBiomechanicalAngles(lm: NormalizedLandmarkList): BiomechanicalAngles {
    const leftHip = lm[LM.LEFT_HIP]
    const rightHip = lm[LM.RIGHT_HIP]
    const leftKnee = lm[LM.LEFT_KNEE]
    const rightKnee = lm[LM.RIGHT_KNEE]
    const leftAnkle = lm[LM.LEFT_ANKLE]
    const rightAnkle = lm[LM.RIGHT_ANKLE]

    const leftShoulder = lm[LM.LEFT_SHOULDER]
    const rightShoulder = lm[LM.RIGHT_SHOULDER]
    const leftElbow = lm[LM.LEFT_ELBOW]
    const rightElbow = lm[LM.RIGHT_ELBOW]
    const leftWrist = lm[LM.LEFT_WRIST]
    const rightWrist = lm[LM.RIGHT_WRIST]

    const leftEar = lm[LM.LEFT_EAR]
    const rightEar = lm[LM.RIGHT_EAR]
    const nose = lm[LM.NOSE]

    const leftKneeAngle = RealPoseTracker.calculateAngle(leftHip, leftKnee, leftAnkle)
    const rightKneeAngle = RealPoseTracker.calculateAngle(rightHip, rightKnee, rightAnkle)
    const leftShoulderAngle = RealPoseTracker.calculateAngle(leftHip, leftShoulder, leftElbow)
    const rightShoulderAngle = RealPoseTracker.calculateAngle(rightHip, rightShoulder, rightElbow)
    const leftHipAngle = RealPoseTracker.calculateAngle(leftShoulder, leftHip, leftKnee)
    const rightHipAngle = RealPoseTracker.calculateAngle(rightShoulder, rightHip, rightKnee)
    const leftElbowAngle = RealPoseTracker.calculateAngle(leftShoulder, leftElbow, leftWrist)
    const rightElbowAngle = RealPoseTracker.calculateAngle(rightShoulder, rightElbow, rightWrist)

    const avgEar = { x: ((leftEar?.x || 0) + (rightEar?.x || 0)) / 2, y: ((leftEar?.y || 0) + (rightEar?.y || 0)) / 2 }
    const avgShoulder = { x: ((leftShoulder?.x || 0) + (rightShoulder?.x || 0)) / 2, y: ((leftShoulder?.y || 0) + (rightShoulder?.y || 0)) / 2 }
    const cvaRad = Math.atan2(avgShoulder.y - avgEar.y, Math.abs(avgShoulder.x - avgEar.x))
    const craniovertebralAngle = (cvaRad * 180.0) / Math.PI

    const avgHip = { x: ((leftHip?.x || 0) + (rightHip?.x || 0)) / 2, y: ((leftHip?.y || 0) + (rightHip?.y || 0)) / 2 }
    const torsoDx = avgShoulder.x - avgHip.x
    const torsoDy = avgShoulder.y - avgHip.y
    const trunkLeanAngle = Math.abs(Math.atan2(torsoDx, -torsoDy) * (180.0 / Math.PI))

    const shoulderHeightDiff = Math.abs((leftShoulder?.y || 0) - (rightShoulder?.y || 0))
    const shoulderWidth = Math.max(0.05, Math.abs((leftShoulder?.x || 0) - (rightShoulder?.x || 0)))
    const shoulderBalanceDelta = Math.min(100, (shoulderHeightDiff / shoulderWidth) * 100)

    const hipHeightDiff = Math.abs((leftHip?.y || 0) - (rightHip?.y || 0))
    const hipWidth = Math.max(0.05, Math.abs((leftHip?.x || 0) - (rightHip?.x || 0)))
    const pelvicTiltDelta = Math.min(100, (hipHeightDiff / hipWidth) * 100)

    // ── SIT TO STAND ADAPTIVE KINEMATIC ELEVATION COMPUTATION ───────────────
    // Current upper body vertical position (shoulder or nose Y)
    const currentUpperBodyY = avgShoulder.y > 0 ? avgShoulder.y : nose ? nose.y : 0.5

    // Dynamically adjust baseline seated Y (when lower on camera)
    if (currentUpperBodyY > this.seatedBaselineY) {
      this.seatedBaselineY = currentUpperBodyY
    }
    if (currentUpperBodyY < this.minObservedY) {
      this.minObservedY = currentUpperBodyY
    }

    // Vertical delta: when standing up, currentUpperBodyY decreases (moves up towards top of frame Y=0)
    const verticalElevationDelta = Math.max(0, this.seatedBaselineY - currentUpperBodyY)
    const verticalElevationRatio = Math.min(1.0, verticalElevationDelta / 0.12) // 12% vertical shift = full stand

    // Vertical elevation angle mapped from 90° (sitting) to 165° (standing)
    const verticalAngle = 90 + verticalElevationRatio * 75

    // Check if full knee landmarks are visible
    const kneeVisible = (leftKnee?.visibility || 0) > 0.4 || (rightKnee?.visibility || 0) > 0.4
    const kneeAngle = Math.max(leftKneeAngle || 0, rightKneeAngle || 0)

    let sitToStandElevationAngle = verticalAngle
    if (kneeVisible && kneeAngle > 80) {
      // Blend knee angle with vertical displacement
      sitToStandElevationAngle = Math.max(verticalAngle, kneeAngle)
    }

    return {
      leftKneeAngle: isNaN(leftKneeAngle) ? 90 : leftKneeAngle,
      rightKneeAngle: isNaN(rightKneeAngle) ? 90 : rightKneeAngle,
      leftShoulderAngle: isNaN(leftShoulderAngle) ? 20 : leftShoulderAngle,
      rightShoulderAngle: isNaN(rightShoulderAngle) ? 20 : rightShoulderAngle,
      leftHipAngle: isNaN(leftHipAngle) ? 90 : leftHipAngle,
      rightHipAngle: isNaN(rightHipAngle) ? 90 : rightHipAngle,
      leftElbowAngle: isNaN(leftElbowAngle) ? 170 : leftElbowAngle,
      rightElbowAngle: isNaN(rightElbowAngle) ? 170 : rightElbowAngle,
      craniovertebralAngle: isNaN(craniovertebralAngle) ? 52 : Math.max(20, Math.min(90, craniovertebralAngle)),
      trunkLeanAngle: isNaN(trunkLeanAngle) ? 0 : Math.min(90, trunkLeanAngle),
      shoulderBalanceDelta: isNaN(shoulderBalanceDelta) ? 0 : shoulderBalanceDelta,
      pelvicTiltDelta: isNaN(pelvicTiltDelta) ? 0 : pelvicTiltDelta,
      sitToStandElevationAngle: Math.round(sitToStandElevationAngle),
    }
  }

  public getDefaultAngles(): BiomechanicalAngles {
    return {
      leftKneeAngle: 90,
      rightKneeAngle: 90,
      leftShoulderAngle: 20,
      rightShoulderAngle: 20,
      leftHipAngle: 90,
      rightHipAngle: 90,
      leftElbowAngle: 170,
      rightElbowAngle: 170,
      craniovertebralAngle: 52,
      trunkLeanAngle: 0,
      shoulderBalanceDelta: 0,
      pelvicTiltDelta: 0,
      sitToStandElevationAngle: 90,
    }
  }
}
