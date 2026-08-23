import type { BiomechanicalAngles } from './realPoseTracker'

export interface GlobalPostureEvaluation {
  overallPostureScore: number
  status: 'optimal' | 'slight_deviation' | 'needs_correction'
  headForwardPosture: boolean
  thoracicSlouched: boolean
  shoulderAsymmetry: boolean
  pelvicTiltAsymmetry: boolean
  cvaAngle: number
  trunkLeanAngle: number
  shoulderDelta: number
  feedbackCues: string[]
}

export class GlobalPostureEngine {
  private smoothingWindow: number[] = []
  private readonly windowSize = 8

  public evaluate(angles: BiomechanicalAngles): GlobalPostureEvaluation {
    const cva = angles.craniovertebralAngle
    const trunkLean = angles.trunkLeanAngle
    const shoulderDelta = angles.shoulderBalanceDelta
    const pelvicDelta = angles.pelvicTiltDelta

    const feedbackCues: string[] = []
    let postureScore = 100

    const headForwardPosture = cva < 48
    if (cva < 42) {
      feedbackCues.push('Head is leaning too far forward. Tuck your chin gently.')
      postureScore -= 25
    } else if (cva < 48) {
      feedbackCues.push('Keep ears aligned above your shoulders.')
      postureScore -= 12
    }

    const thoracicSlouched = trunkLean > 14
    if (trunkLean > 20) {
      feedbackCues.push('Your upper back is severely slouched. Straighten your spine.')
      postureScore -= 30
    } else if (trunkLean > 14) {
      feedbackCues.push('Engage core and lift your chest.')
      postureScore -= 15
    }

    const shoulderAsymmetry = shoulderDelta > 10
    if (shoulderDelta > 18) {
      feedbackCues.push('Shoulders are uneven. Keep both shoulders relaxed and level.')
      postureScore -= 20
    } else if (shoulderDelta > 10) {
      feedbackCues.push('Relax your shoulder elevation.')
      postureScore -= 10
    }

    const pelvicTiltAsymmetry = pelvicDelta > 14
    if (pelvicDelta > 14) {
      feedbackCues.push('Sit evenly on both sit-bones without leaning to one side.')
      postureScore -= 15
    }

    this.smoothingWindow.push(postureScore)
    if (this.smoothingWindow.length > this.windowSize) {
      this.smoothingWindow.shift()
    }
    const smoothedScore = Math.round(
      this.smoothingWindow.reduce((a, b) => a + b, 0) / this.smoothingWindow.length
    )

    let status: 'optimal' | 'slight_deviation' | 'needs_correction' = 'optimal'
    if (smoothedScore < 70) {
      status = 'needs_correction'
    } else if (smoothedScore < 85) {
      status = 'slight_deviation'
    }

    return {
      overallPostureScore: Math.max(10, smoothedScore),
      status,
      headForwardPosture,
      thoracicSlouched,
      shoulderAsymmetry,
      pelvicTiltAsymmetry,
      cvaAngle: cva,
      trunkLeanAngle: trunkLean,
      shoulderDelta,
      feedbackCues: Array.from(new Set(feedbackCues)),
    }
  }

  public reset() {
    this.smoothingWindow = []
  }
}
