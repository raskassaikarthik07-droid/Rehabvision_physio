import { useRef, useEffect, useState, useCallback } from 'react'
import { Play, Pause, RotateCcw, Activity } from 'lucide-react'

interface Props {
  exerciseId: string
  slug?: string
  name?: string
  targetRom?: number
  targetReps?: number
  category?: string
  className?: string
  aspectRatio?: 'video' | 'square' | 'wide'
  showControls?: boolean
  autoPlay?: boolean
  interactive?: boolean
}

export default function ExerciseMovementViewer({
  exerciseId,
  targetRom = 90,
  targetReps = 10,
  className = '',
  aspectRatio = 'video',
  showControls = true,
  autoPlay = true,
  interactive = true,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animIdRef = useRef<number | null>(null)
  const startTimeRef = useRef<number>(Date.now())
  const [isPlaying, setIsPlaying] = useState<boolean>(autoPlay)
  const [phaseLabel, setPhaseLabel] = useState<string>('PREPARE')
  const [currentAngle, setCurrentAngle] = useState<number>(0)

  const handleRestart = useCallback(() => {
    startTimeRef.current = Date.now()
    setIsPlaying(true)
  }, [])

  const togglePlay = useCallback(() => {
    setIsPlaying((prev) => !prev)
  }, [])

  // Biomechanical Kinematic Animation Loop (6-second repetition cycle)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let isRunning = true

    const drawFrame = () => {
      if (!isRunning) return

      const w = canvas.width
      const h = canvas.height
      const elapsed = isPlaying ? (Date.now() - startTimeRef.current) / 1000 : 1.5
      const period = 6.0 // 6-second professional clinical cycle
      const cycleTime = elapsed % period
      const progress = cycleTime / period // 0.0 to 1.0

      // Compute smooth kinematic phase:
      // 0.0 - 0.2: Start position / Prepare
      // 0.2 - 0.5: Ascending / Active Movement
      // 0.5 - 0.65: Peak contraction hold
      // 0.65 - 0.95: Controlled return / Eccentric
      // 0.95 - 1.0: Rest / Reset
      let motion = 0.0
      let phaseText = 'START'

      if (progress < 0.2) {
        motion = 0.0
        phaseText = 'START POSITION'
      } else if (progress < 0.5) {
        const t = (progress - 0.2) / 0.3
        motion = 0.5 - 0.5 * Math.cos(t * Math.PI) // Smooth easeInOut
        phaseText = 'MOVE / EXTEND'
      } else if (progress < 0.65) {
        motion = 1.0
        phaseText = 'PEAK HOLD (1s)'
      } else if (progress < 0.95) {
        const t = (progress - 0.65) / 0.3
        motion = 0.5 + 0.5 * Math.cos(t * Math.PI) // Smooth return
        phaseText = 'CONTROLLED RETURN'
      } else {
        motion = 0.0
        phaseText = 'RESET'
      }

      setPhaseLabel(phaseText)

      // Clear Canvas & Background Grid
      ctx.fillStyle = '#090d16'
      ctx.fillRect(0, 0, w, h)

      // Draw subtle clinical alignment grid
      ctx.strokeStyle = 'rgba(30, 41, 59, 0.4)'
      ctx.lineWidth = 1
      const gridSize = 32
      for (let x = 0; x < w; x += gridSize) {
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, h)
        ctx.stroke()
      }
      for (let y = 0; y < h; y += gridSize) {
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(w, y)
        ctx.stroke()
      }

      // Ground reference line
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.25)'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(w * 0.1, h * 0.88)
      ctx.lineTo(w * 0.9, h * 0.88)
      ctx.stroke()

      // Exercise-specific Kinematic Figure Rendering
      renderExerciseMotion(ctx, w, h, exerciseId, motion, setCurrentAngle)

      animIdRef.current = requestAnimationFrame(drawFrame)
    }

    animIdRef.current = requestAnimationFrame(drawFrame)

    return () => {
      isRunning = false
      if (animIdRef.current) cancelAnimationFrame(animIdRef.current)
    }
  }, [exerciseId, isPlaying])

  return (
    <div
      className={`relative group/viewer rounded-2xl overflow-hidden bg-slate-950 border border-slate-700/80 shadow-inner select-none ${
        aspectRatio === 'video' ? 'aspect-video' : aspectRatio === 'wide' ? 'aspect-[21/9]' : 'aspect-square'
      } ${className}`}
    >
      {/* 60 FPS HTML5 Kinematic Canvas */}
      <canvas
        ref={canvasRef}
        width={640}
        height={360}
        className="w-full h-full object-cover"
      />

      {/* Top Floating Badge Strip */}
      <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none z-10">
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900/85 text-sky-300 border border-slate-700/90 backdrop-blur-md text-[10px] font-extrabold uppercase tracking-wider shadow-lg">
          <Activity className="w-3 h-3 text-sky-400 animate-pulse" />
          <span>6s Video Demo</span>
        </div>

        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 backdrop-blur-md text-[10px] font-bold shadow-lg">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
          <span>{phaseLabel}</span>
        </div>
      </div>

      {/* Bottom Telemetry & Target Bar */}
      <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between pointer-events-none z-10">
        <div className="px-2.5 py-1 rounded-lg bg-slate-950/80 text-slate-300 border border-slate-800 backdrop-blur-md text-[11px] font-medium">
          Target: <strong className="text-white font-bold">{targetReps} Reps</strong> &bull; <strong className="text-cyan-300 font-bold">{targetRom}° ROM</strong>
        </div>

        {currentAngle > 0 && (
          <div className="px-2.5 py-1 rounded-lg bg-sky-950/80 text-sky-300 border border-sky-700/60 backdrop-blur-md text-[11px] font-mono font-bold">
            Live Angle: {Math.round(currentAngle)}°
          </div>
        )}
      </div>

      {/* Hover Interactive Video Controls */}
      {showControls && interactive && (
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 via-transparent to-slate-950/40 opacity-0 group-hover/viewer:opacity-100 transition-opacity flex items-center justify-center gap-3 z-20">
          <button
            onClick={togglePlay}
            aria-label={isPlaying ? 'Pause demonstration' : 'Play demonstration'}
            className="w-11 h-11 rounded-full bg-sky-500 hover:bg-sky-400 text-white flex items-center justify-center shadow-xl shadow-sky-500/30 transition-transform hover:scale-110 cursor-pointer"
          >
            {isPlaying ? <Pause className="w-5 h-5 fill-white" /> : <Play className="w-5 h-5 fill-white ml-0.5" />}
          </button>

          <button
            onClick={handleRestart}
            aria-label="Replay exercise demonstration"
            className="w-9 h-9 rounded-full bg-slate-800/90 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-600 flex items-center justify-center shadow-lg transition-transform hover:scale-110 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  )
}

/**
 * Core Biomechanical Kinematic Figure Renderer
 */
function renderExerciseMotion(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  id: string,
  motion: number, // 0.0 to 1.0
  onAngleUpdate: (ang: number) => void
) {
  const primaryColor = '#38bdf8' // Cyan-blue neon
  const accentColor = '#34d399' // Emerald green for correct movement
  const boneColor = '#e2e8f0' // Clean bone white
  const jointColor = '#0284c7' // Solid joint blue

  const drawBone = (x1: number, y1: number, x2: number, y2: number, color = boneColor, width = 4) => {
    ctx.strokeStyle = color
    ctx.lineWidth = width
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(x1, y1)
    ctx.lineTo(x2, y2)
    ctx.stroke()
  }

  const drawJoint = (x: number, y: number, r = 5, color = jointColor, ring = true) => {
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
    if (ring) {
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 1.5
      ctx.stroke()
    }
  }

  const drawHead = (x: number, y: number, r = 14) => {
    ctx.fillStyle = '#0f172a'
    ctx.strokeStyle = boneColor
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
  }

  const drawAngleArc = (cx: number, cy: number, r: number, startAngle: number, endAngle: number, label: string) => {
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.8)'
    ctx.lineWidth = 2
    ctx.setLineDash([3, 3])
    ctx.beginPath()
    ctx.arc(cx, cy, r, startAngle, endAngle)
    ctx.stroke()
    ctx.setLineDash([])

    // Label
    ctx.fillStyle = '#38bdf8'
    ctx.font = 'bold 10px monospace'
    const midAngle = (startAngle + endAngle) / 2
    const tx = cx + (r + 12) * Math.cos(midAngle)
    const ty = cy + (r + 12) * Math.sin(midAngle)
    ctx.fillText(label, tx - 10, ty + 3)
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 1. STRAIGHT LEG RAISE (Supine Lying View)
  // ──────────────────────────────────────────────────────────────────────────
  if (id === 'leg_raise' || id === 'straight-leg-raise') {
    const hipX = w * 0.38
    const hipY = h * 0.72
    const headX = w * 0.20
    const headY = h * 0.68

    // Mat / Surface
    ctx.strokeStyle = '#334155'
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.moveTo(w * 0.12, h * 0.78)
    ctx.lineTo(w * 0.88, h * 0.78)
    ctx.stroke()

    // Torso & Head
    drawHead(headX, headY, 13)
    drawBone(headX + 13, headY + 3, hipX, hipY, boneColor, 5)

    // Resting stationary leg (bent knee for lumbar support)
    const statKneeX = hipX + 45
    const statKneeY = hipY - 28
    const statFootX = hipX + 75
    const statFootY = hipY + 4
    drawBone(hipX, hipY, statKneeX, statKneeY, '#64748b', 3)
    drawBone(statKneeX, statKneeY, statFootX, statFootY, '#64748b', 3)
    drawJoint(statKneeX, statKneeY, 4, '#475569')

    // Exercising straight leg raising to 45 degrees
    const maxLegAngle = (45 * Math.PI) / 180
    const curLegAngle = motion * maxLegAngle
    const legLen = 110
    const footX = hipX + legLen * Math.cos(-curLegAngle)
    const footY = hipY + legLen * Math.sin(-curLegAngle)
    const midKneeX = hipX + (legLen * 0.52) * Math.cos(-curLegAngle)
    const midKneeY = hipY + (legLen * 0.52) * Math.sin(-curLegAngle)

    drawBone(hipX, hipY, footX, footY, accentColor, 5)
    drawJoint(hipX, hipY, 6, primaryColor)
    drawJoint(midKneeX, midKneeY, 5, accentColor)
    drawJoint(footX, footY, 4, '#38bdf8')

    // 45° Target Motion Arc
    drawAngleArc(hipX, hipY, 55, 0, -curLegAngle, `${Math.round(motion * 45)}°`)
    onAngleUpdate(motion * 45)
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 2. SEATED KNEE EXTENSION (Chair Side Profile)
  // ──────────────────────────────────────────────────────────────────────────
  else if (id === 'knee_extension' || id === 'knee-extension') {
    const hipX = w * 0.44
    const hipY = h * 0.54
    const kneeX = hipX + 65
    const kneeY = hipY + 5

    // Chair
    ctx.strokeStyle = '#475569'
    ctx.lineWidth = 4
    ctx.strokeRect(hipX - 25, hipY + 5, 45, 60) // Chair seat & back

    // Upright Torso & Head
    const headX = hipX - 8
    const headY = hipY - 70
    drawHead(headX, headY, 13)
    drawBone(headX, headY + 13, hipX, hipY, boneColor, 5)

    // Thigh (Horizontal)
    drawBone(hipX, hipY, kneeX, kneeY, boneColor, 5)

    // Lower Leg Extending from 90° (downward) to 170° (straight forward)
    const startAngle = Math.PI / 2 // 90° straight down
    const endAngle = (10 * Math.PI) / 180 // ~10° elevation above horizon (170° total extension)
    const curKneeAngle = startAngle - motion * (startAngle - endAngle)
    const shinLen = 65
    const ankleX = kneeX + shinLen * Math.cos(curKneeAngle)
    const ankleY = kneeY + shinLen * Math.sin(curKneeAngle)

    drawBone(kneeX, kneeY, ankleX, ankleY, accentColor, 5)
    drawJoint(hipX, hipY, 6, primaryColor)
    drawJoint(kneeX, kneeY, 6, accentColor)
    drawJoint(ankleX, ankleY, 4, '#38bdf8')

    const angleDeg = Math.round(90 + motion * 80)
    drawAngleArc(kneeX, kneeY, 35, startAngle, curKneeAngle, `${angleDeg}°`)
    onAngleUpdate(angleDeg)
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 3. SIT TO STAND (Chair Side/Frontal Transition)
  // ──────────────────────────────────────────────────────────────────────────
  else if (id === 'sit_to_stand' || id === 'sit-to-stand') {
    const groundY = h * 0.85
    const feetX = w * 0.52
    const feetY = groundY

    // Chair
    ctx.strokeStyle = '#475569'
    ctx.lineWidth = 3
    ctx.strokeRect(feetX - 60, groundY - 50, 35, 50)

    // Transition from Seated (motion=0) to Full Standing (motion=1)
    const hipSeatedY = groundY - 50
    const hipStandingY = groundY - 105
    const hipY = hipSeatedY - motion * (hipSeatedY - hipStandingY)
    const hipX = feetX - 25 + motion * 20

    const torsoLean = (1 - motion) * 15 // Leans forward on ascent
    const headX = hipX - 5 + (torsoLean * 0.6)
    const headY = hipY - 65

    const kneeX = feetX - 5 + motion * 3
    const kneeY = groundY - 45 - motion * 5

    drawHead(headX, headY, 13)
    drawBone(headX, headY + 13, hipX, hipY, boneColor, 5)
    drawBone(hipX, hipY, kneeX, kneeY, boneColor, 5)
    drawBone(kneeX, kneeY, feetX, feetY, accentColor, 5)

    drawJoint(hipX, hipY, 6, primaryColor)
    drawJoint(kneeX, kneeY, 6, accentColor)
    drawJoint(feetX, feetY, 5, '#64748b')

    const currentExt = Math.round(95 + motion * 65)
    onAngleUpdate(currentExt)
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 4. ARM / SHOULDER RAISE (Frontal View 0° to 90° Abduction)
  // ──────────────────────────────────────────────────────────────────────────
  else if (id === 'arm_raise' || id === 'arm-shoulder-raise') {
    const cx = w * 0.50
    const cy = h * 0.42

    drawHead(cx, cy - 55, 14)
    drawBone(cx, cy - 40, cx, cy + 50, boneColor, 6) // Spine

    // Shoulders
    const shL = { x: cx - 28, y: cy - 25 }
    const shR = { x: cx + 28, y: cy - 25 }
    drawBone(shL.x, shL.y, shR.x, shR.y, boneColor, 5)

    // Arms raising from side (down) to horizontal (90°)
    const armAngle = (motion * 90 * Math.PI) / 180
    const armLen = 65

    const handLX = shL.x - armLen * Math.sin(armAngle)
    const handLY = shL.y + armLen * Math.cos(armAngle)
    const handRX = shR.x + armLen * Math.sin(armAngle)
    const handRY = shR.y + armLen * Math.cos(armAngle)

    drawBone(shL.x, shL.y, handLX, handLY, accentColor, 5)
    drawBone(shR.x, shR.y, handRX, handRY, accentColor, 5)

    drawJoint(shL.x, shL.y, 6, primaryColor)
    drawJoint(shR.x, shR.y, 6, primaryColor)
    drawJoint(handLX, handLY, 4, accentColor)
    drawJoint(handRX, handRY, 4, accentColor)

    // Legs
    drawBone(cx, cy + 50, cx - 20, cy + 120, '#64748b', 4)
    drawBone(cx, cy + 50, cx + 20, cy + 120, '#64748b', 4)

    drawAngleArc(shR.x, shR.y, 40, Math.PI / 2, Math.PI / 2 - armAngle, `${Math.round(motion * 90)}°`)
    onAngleUpdate(motion * 90)
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 5. REHABILITATION SQUAT (Side/Frontal Flexion)
  // ──────────────────────────────────────────────────────────────────────────
  else if (id === 'squat') {
    const groundY = h * 0.85
    const cx = w * 0.50

    // Descent calculation
    const drop = motion * 40
    const hipY = groundY - 85 + drop
    const hipX = cx - 18 - motion * 12
    const kneeX = cx + 8
    const kneeY = groundY - 45 + drop * 0.3
    const footX = cx - 5
    const footY = groundY

    const headX = hipX + 15 + motion * 8
    const headY = hipY - 60

    drawHead(headX, headY, 13)
    drawBone(headX, headY + 13, hipX, hipY, boneColor, 5)
    drawBone(hipX, hipY, kneeX, kneeY, accentColor, 5)
    drawBone(kneeX, kneeY, footX, footY, accentColor, 5)

    drawJoint(hipX, hipY, 6, primaryColor)
    drawJoint(kneeX, kneeY, 6, accentColor)
    drawJoint(footX, footY, 5, '#64748b')

    const squatAngle = Math.round(175 - motion * 75)
    onAngleUpdate(squatAngle)
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 6. NECK & FORWARD HEAD ALIGNMENT (Side Profile Retraction)
  // ──────────────────────────────────────────────────────────────────────────
  else if (id === 'neck_posture' || id === 'neck-posture' || id === 'neck-forward-head-alignment') {
    const shoulderX = w * 0.52
    const shoulderY = h * 0.52

    // Forward shift (motion 0 = text neck posture; motion 1 = neutral optimal alignment)
    const forwardShift = (1 - motion) * 35
    const earX = shoulderX - 10 + forwardShift
    const earY = shoulderY - 50

    // Vertical plum reference line (Ideal ear over shoulder)
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)'
    ctx.lineWidth = 1.5
    ctx.setLineDash([4, 4])
    ctx.beginPath()
    ctx.moveTo(shoulderX, h * 0.15)
    ctx.lineTo(shoulderX, h * 0.85)
    ctx.stroke()
    ctx.setLineDash([])

    // Spine & Torso
    drawBone(shoulderX, shoulderY, shoulderX, shoulderY + 80, boneColor, 6)

    // Cervical spine alignment
    const statusColor = motion > 0.6 ? accentColor : '#f59e0b'
    drawBone(shoulderX, shoulderY, earX, earY, statusColor, 5)
    drawHead(earX + 5, earY - 10, 15)

    drawJoint(shoulderX, shoulderY, 6, primaryColor)
    drawJoint(earX, earY, 5, statusColor)

    const cva = Math.round(42 + motion * 12)
    ctx.fillStyle = statusColor
    ctx.font = 'bold 11px monospace'
    ctx.fillText(`CVA: ${cva}° (${motion > 0.6 ? 'OPTIMAL' : 'FORWARD HEAD'})`, w * 0.28, h * 0.82)
    onAngleUpdate(cva)
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 7. BACK & TORSO BEND ALIGNMENT (45° Hip Hinge)
  // ──────────────────────────────────────────────────────────────────────────
  else if (id === 'torso_bend' || id === 'torso-bend' || id === 'back-bend') {
    const hipX = w * 0.48
    const hipY = h * 0.56

    // Legs
    drawBone(hipX, hipY, hipX, h * 0.85, '#64748b', 5)

    // Torso inclination from vertical 0° to 45°
    const bendAngle = (motion * 45 * Math.PI) / 180
    const spineLen = 70
    const shX = hipX + spineLen * Math.sin(bendAngle)
    const shY = hipY - spineLen * Math.cos(bendAngle)
    const headX = shX + 18 * Math.sin(bendAngle)
    const headY = shY - 18 * Math.cos(bendAngle)

    drawBone(hipX, hipY, shX, shY, accentColor, 5)
    drawHead(headX, headY, 13)

    drawJoint(hipX, hipY, 6, primaryColor)
    drawJoint(shX, shY, 5, accentColor)

    drawAngleArc(hipX, hipY, 45, -Math.PI / 2, -Math.PI / 2 + bendAngle, `${Math.round(motion * 45)}°`)
    onAngleUpdate(motion * 45)
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 8. SHOULDER SYMMETRY & BALANCE
  // ──────────────────────────────────────────────────────────────────────────
  else if (id === 'shoulder_symmetry' || id === 'shoulder-symmetry') {
    const cx = w * 0.50
    const cy = h * 0.48

    // Level reference line
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)'
    ctx.lineWidth = 1.5
    ctx.setLineDash([4, 4])
    ctx.beginPath()
    ctx.moveTo(w * 0.2, cy - 25)
    ctx.lineTo(w * 0.8, cy - 25)
    ctx.stroke()
    ctx.setLineDash([])

    drawHead(cx, cy - 60, 14)
    drawBone(cx, cy - 45, cx, cy + 50, boneColor, 6)

    // Shoulders leveling
    const tilt = (1 - motion) * 12
    const shL = { x: cx - 35, y: cy - 25 + tilt }
    const shR = { x: cx + 35, y: cy - 25 - tilt }
    drawBone(shL.x, shL.y, shR.x, shR.y, accentColor, 5)
    drawBone(shL.x, shL.y, shL.x, shL.y + 60, '#64748b', 4)
    drawBone(shR.x, shR.y, shR.x, shR.y + 60, '#64748b', 4)

    drawJoint(shL.x, shL.y, 6, accentColor)
    drawJoint(shR.x, shR.y, 6, accentColor)

    const sym = Math.round(85 + motion * 14)
    onAngleUpdate(sym)
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 9. KNEE ALIGNMENT & VALGUS
  // ──────────────────────────────────────────────────────────────────────────
  else if (id === 'knee_alignment' || id === 'knee-alignment') {
    const cx = w * 0.50
    const hipY = h * 0.38
    const groundY = h * 0.85

    // Hip
    const hipL = { x: cx - 25, y: hipY }
    const hipR = { x: cx + 25, y: hipY }
    drawBone(hipL.x, hipL.y, hipR.x, hipR.y, boneColor, 5)

    // Neutral tracking vs Valgus inward collapse
    const valgusShift = (1 - motion) * 14
    const kneeLX = cx - 25 + valgusShift
    const kneeRX = cx + 25 - valgusShift
    const kneeY = h * 0.62

    const footLX = cx - 25
    const footRX = cx + 25

    drawBone(hipL.x, hipL.y, kneeLX, kneeY, accentColor, 5)
    drawBone(kneeLX, kneeY, footLX, groundY, accentColor, 5)
    drawBone(hipR.x, hipR.y, kneeRX, kneeY, accentColor, 5)
    drawBone(kneeRX, kneeY, footRX, groundY, accentColor, 5)

    drawJoint(kneeLX, kneeY, 6, accentColor)
    drawJoint(kneeRX, kneeY, 6, accentColor)
    drawJoint(footLX, groundY, 4, '#64748b')
    drawJoint(footRX, groundY, 4, '#64748b')

    const frontalAngle = Math.round(162 + motion * 13)
    onAngleUpdate(frontalAngle)
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 10. LATERAL LEG RAISE (Hip Abduction 0° to 40°)
  // ──────────────────────────────────────────────────────────────────────────
  else {
    const cx = w * 0.44
    const cy = h * 0.45

    drawHead(cx, cy - 55, 14)
    drawBone(cx, cy - 40, cx, cy + 45, boneColor, 6)

    // Standing support leg
    drawBone(cx - 10, cy + 45, cx - 10, h * 0.85, '#64748b', 5)

    // Abducting exercising leg
    const abductAngle = (motion * 38 * Math.PI) / 180
    const legLen = 85
    const footX = (cx + 10) + legLen * Math.sin(abductAngle)
    const footY = (cy + 45) + legLen * Math.cos(abductAngle)

    drawBone(cx + 10, cy + 45, footX, footY, accentColor, 5)
    drawJoint(cx + 10, cy + 45, 6, primaryColor)
    drawJoint(footX, footY, 5, accentColor)

    drawAngleArc(cx + 10, cy + 45, 45, Math.PI / 2, Math.PI / 2 - abductAngle, `${Math.round(motion * 38)}°`)
    onAngleUpdate(motion * 38)
  }
}
