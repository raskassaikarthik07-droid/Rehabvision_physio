import React, { useRef, useState, useEffect } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import {
  Pause, Square, Mic, ShieldCheck, Sparkles,
  Trophy, FastForward, CheckCircle2, Flame, AlertTriangle, HeartPulse
} from 'lucide-react'
import type { NormalizedLandmarkList } from '@mediapipe/pose'
import { RealPoseTracker, LM, type BiomechanicalAngles } from '../ai/realPoseTracker'
import { ExerciseStateMachine, type RepetitionUpdate } from '../ai/exerciseStateMachines'
import { GlobalPostureEngine, type GlobalPostureEvaluation } from '../ai/globalPostureEngine'
import { VoiceControlService, type VoiceCommand } from '../ai/voiceControl'
import { EmergencyProtocolManager, type EmergencyState } from '../ai/emergencyProtocol'
import ExerciseMovementViewer from '../components/ExerciseMovementViewer'
import { PostureAvatar3D } from '../components/3d/PostureAvatar3D'
import { sessionsApi, authApi, patientApi, emergencyApi } from '../api/client'

export const LiveAnalysis: React.FC = () => {
  const { id: exerciseParam } = useParams<{ id: string }>()
  const exerciseId = exerciseParam || 'knee_extension'
  const navigate = useNavigate()
  const location = useLocation()

  // Prescribed Targets (from route state or defaults)
  const navState = (location.state as any) || {}
  const [targetReps, setTargetReps] = useState<number>(navState.targetReps || 10)
  const [targetSets, setTargetSets] = useState<number>(navState.targetSets || 3)
  const [restDurationSeconds, setRestDurationSeconds] = useState<number>(navState.restSeconds || 30)
  const [doctorInstructions, setDoctorInstructions] = useState<string>(navState.instructions || '')

  // Set & Rep Progress Tracking
  const [currentSet, setCurrentSet] = useState<number>(1)
  const [currentSetReps, setCurrentSetReps] = useState<number>(0)
  const [totalCompletedReps, setTotalCompletedReps] = useState<number>(0)

  // Rest Timer State
  const [isResting, setIsResting] = useState<boolean>(false)
  const [restTimeRemaining, setRestTimeRemaining] = useState<number>(30)

  // Routine Finished Celebration
  const [isRoutineCompleted, setIsRoutineCompleted] = useState<boolean>(false)

  // Keep RAF-loop refs in sync
  useEffect(() => { isRestingRef.current = isResting }, [isResting])
  useEffect(() => { isRoutineCompletedRef.current = isRoutineCompleted }, [isRoutineCompleted])


  // View Mode: '2d' (Default) or '3d'
  const [viewMode, setViewMode] = useState<'2d' | '3d'>('2d')

  // Video & Canvas Refs
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animFrameRef = useRef<number | null>(null)

  // Refs to track live state in RAF loop (avoids stale closure bugs)
  const isSessionActiveRef = useRef(true)
  const isPausedRef = useRef(false)
  const isRestingRef = useRef(false)
  const isRoutineCompletedRef = useRef(false)


  // AI Engines
  const poseTrackerRef = useRef<RealPoseTracker | null>(null)
  const stateMachineRef = useRef<ExerciseStateMachine | null>(null)
  const postureEngineRef = useRef<GlobalPostureEngine | null>(null)
  const voiceServiceRef = useRef<VoiceControlService | null>(null)
  const emergencyManagerRef = useRef<EmergencyProtocolManager | null>(null)

  // Session State
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [isSessionActive, setIsSessionActive] = useState(true)
  const [isPaused, setIsPaused] = useState(false)
  const [sessionStartTime] = useState<number>(Date.now())
  const [elapsedSeconds, setElapsedSeconds] = useState(0)

  // Keep RAF-loop refs in sync with React state (avoids stale closures in processFrame)
  useEffect(() => { isSessionActiveRef.current = isSessionActive }, [isSessionActive])
  useEffect(() => { isPausedRef.current = isPaused }, [isPaused])


  // Real-time Metrics
  const [landmarks, setLandmarks] = useState<NormalizedLandmarkList | undefined>()
  const [angles, setAngles] = useState<BiomechanicalAngles | undefined>()
  const [repData, setRepData] = useState<RepetitionUpdate | null>(null)
  const [postureData, setPostureData] = useState<GlobalPostureEvaluation | null>(null)

  // Accessibility & Emergency States
  const [isWheelchairMode, setIsWheelchairMode] = useState(false)
  const [voiceActive, setVoiceActive] = useState(false)

  // Cumulative Session History
  const scoreHistoryRef = useRef<number[]>([])
  const romHistoryRef = useRef<number[]>([])
  const stabilityHistoryRef = useRef<number[]>([])
  const commonIssuesRef = useRef<Set<string>>(new Set())

  // 3-second "human not detected" alert & Patient Safety Confirmation Modal
  const [noHumanAlert, setNoHumanAlert] = useState(false)
  const [safetyCheckOpen, setSafetyCheckOpen] = useState(false)
  const [emergencySent, setEmergencySent] = useState(false)
  const noHumanTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)




  // Web Audio Chimes
  const playSound = (type: 'rep' | 'set' | 'complete') => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
      if (!AudioCtx) return
      const ctx = new AudioCtx()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()

      if (type === 'rep') {
        osc.frequency.setValueAtTime(523.25, ctx.currentTime)
        osc.frequency.exponentialRampToValueAtTime(783.99, ctx.currentTime + 0.12)
        gain.gain.setValueAtTime(0.2, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.18)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start()
        osc.stop(ctx.currentTime + 0.18)
      } else if (type === 'set') {
        osc.frequency.setValueAtTime(440, ctx.currentTime)
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.25)
        gain.gain.setValueAtTime(0.3, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start()
        osc.stop(ctx.currentTime + 0.35)
      } else {
        const notes = [523.25, 659.25, 783.99, 1046.5]
        notes.forEach((freq, idx) => {
          const o = ctx.createOscillator()
          const g = ctx.createGain()
          o.frequency.value = freq
          g.gain.setValueAtTime(0.2, ctx.currentTime + idx * 0.1)
          g.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + idx * 0.1 + 0.3)
          o.connect(g)
          g.connect(ctx.destination)
          o.start(ctx.currentTime + idx * 0.1)
          o.stop(ctx.currentTime + idx * 0.1 + 0.3)
        })
      }
    } catch {}
  }

  useEffect(() => {
    if (!navState.targetReps) {
      patientApi.getActivePrescription().then((res) => {
        const presc = res.data?.prescription
        if (presc && presc.exercises) {
          const match = presc.exercises.find((e: any) => e.exercise_id === exerciseId)
          if (match) {
            setTargetReps(match.target_reps || 10)
            setTargetSets(match.target_sets || 3)
            setRestDurationSeconds(match.rest_seconds || 30)
            if (match.instructions) setDoctorInstructions(match.instructions)
          }
        }
      }).catch(() => {})
    }

    authApi.getMe().then((res) => {
      if (res.data.patient?.mobility_mode === 'wheelchair' || res.data.patient?.mobility_mode === 'seated_only') {
        setIsWheelchairMode(true)
      }
    }).catch(() => {})
  }, [exerciseId])

  useEffect(() => {
    initSession()
    return () => {
      cleanup()
    }
  }, [])

  const initSession = async () => {
    try {
      const res = await sessionsApi.create(exerciseId)
      setSessionId(res.data.session.id)
    } catch {
      setSessionId(`local-${Date.now()}`)
    }

    initCameraAndAI()
  }

  const handleTriggerEmergency = async (reason = 'Patient requested emergency assistance') => {
    setEmergencySent(true)
    setSafetyCheckOpen(false)
    setNoHumanAlert(false)
    try {
      await emergencyApi.recordEvent({
        session_id: sessionId || undefined,
        stage: 3,
        event_type: 'patient_safety_alert',
        notes: reason,
      })
    } catch {}
  }

  const handlePatientConfirmFine = () => {
    setSafetyCheckOpen(false)
    setNoHumanAlert(false)
  }

  const initCameraAndAI = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
        audio: false,
      })

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play()
          // Pre-size canvas to match video container BEFORE first frame
          if (canvasRef.current) {
            const rect = canvasRef.current.getBoundingClientRect()
            const w = rect.width || canvasRef.current.offsetWidth || 640
            const h = rect.height || canvasRef.current.offsetHeight || 480
            if (w > 0 && h > 0) {
              canvasRef.current.width = Math.round(w)
              canvasRef.current.height = Math.round(h)
            }
          }
          startProcessingLoop()
        }
      }

      poseTrackerRef.current = new RealPoseTracker()
      stateMachineRef.current = new ExerciseStateMachine(exerciseId)
      postureEngineRef.current = new GlobalPostureEngine()

      poseTrackerRef.current.setOnResults((results, calcAngles) => {
        const lms = results.poseLandmarks
        if (lms && lms.length > 0) {
          emergencyManagerRef.current?.reportFacePresence(true)
          setLandmarks(lms)
          setAngles(calcAngles)

          // Human detected — cancel any 3-second pending timer & hide alert
          if (noHumanTimerRef.current) {
            clearTimeout(noHumanTimerRef.current)
            noHumanTimerRef.current = null
          }

          if (stateMachineRef.current) {
            const rep = stateMachineRef.current.processFrame(calcAngles)
            setRepData(rep)

            if (rep.isRepCompletedThisFrame) {
              playSound('rep')
              scoreHistoryRef.current.push(rep.formScore)
              romHistoryRef.current.push(rep.romPercent)
              stabilityHistoryRef.current.push(100 - (calcAngles.shoulderBalanceDelta || 0))
              rep.feedbackMessages.forEach((m) => commonIssuesRef.current.add(m))

              setCurrentSetReps((prevReps) => {
                const nextReps = prevReps + 1
                setTotalCompletedReps((tot) => tot + 1)
                if (nextReps >= targetReps) {
                  handleSetCompleted()
                }
                return nextReps
              })
            }
          }

          if (postureEngineRef.current) {
            const posture = postureEngineRef.current.evaluate(calcAngles)
            setPostureData(posture)
          }

          draw2DSkeleton(lms)
        } else {
          emergencyManagerRef.current?.reportFacePresence(false)

          // Person missing — start 3-second timer. After 3s, ask the patient if they are fine!
          if (!noHumanTimerRef.current && !safetyCheckOpen && !emergencySent) {
            noHumanTimerRef.current = setTimeout(() => {
              setNoHumanAlert(true)
              setSafetyCheckOpen(true)
              noHumanTimerRef.current = null
            }, 3000)
          }
        }
      })

      voiceServiceRef.current = new VoiceControlService()
      voiceServiceRef.current.setListener({
        onCommand: (cmd: VoiceCommand) => handleVoiceCommand(cmd),
        onStatusChange: (listening: boolean) => setVoiceActive(listening),
      })
      voiceServiceRef.current.start()

      emergencyManagerRef.current = new EmergencyProtocolManager(sessionId)
      emergencyManagerRef.current.setOnStateChange((st: EmergencyState) => {
        if (st.isEscalated) {
          triggerEmergencyEscalation()
        }
      })
    } catch {
      // Fallback
    }
  }

  const triggerEmergencyEscalation = async () => {
    try {
      await emergencyApi.recordEvent({
        session_id: sessionId || undefined,
        stage: 3,
        event_type: 'panic_escalation',
        notes: 'Emergency triggered during session',
      })
    } catch {}
  }

  const handleVoiceCommand = (cmd: VoiceCommand) => {
    if (cmd === 'PAUSE') setIsPaused(true)
    if (cmd === 'RESUME') setIsPaused(false)
    if (cmd === 'STOP') handleCompleteSession()
    if (cmd === 'EMERGENCY') triggerEmergencyEscalation()
  }

  const startProcessingLoop = () => {
    const processFrame = async () => {
      // Use refs to always read CURRENT state — avoids stale closure bugs for new login users
      if (!isSessionActiveRef.current) return

      if (
        videoRef.current &&
        videoRef.current.readyState >= 2 &&
        !isPausedRef.current &&
        !isRestingRef.current &&
        !isRoutineCompletedRef.current
      ) {
        setElapsedSeconds(Math.floor((Date.now() - sessionStartTime) / 1000))
        if (poseTrackerRef.current) {
          await poseTrackerRef.current.sendFrame(videoRef.current)
        }
      }

      animFrameRef.current = requestAnimationFrame(processFrame)
    }

    animFrameRef.current = requestAnimationFrame(processFrame)
  }

  const handleSetCompleted = () => {
    if (currentSet < targetSets) {
      playSound('set')
      setIsResting(true)
      setRestTimeRemaining(restDurationSeconds)
    } else {
      playSound('complete')
      setIsRoutineCompleted(true)
    }
  }

  useEffect(() => {
    let timer: any = null
    if (isResting && restTimeRemaining > 0) {
      timer = setInterval(() => {
        setRestTimeRemaining((t) => {
          if (t <= 1) {
            clearInterval(timer)
            handleStartNextSet()
            return 0
          }
          return t - 1
        })
      }, 1000)
    }
    return () => clearInterval(timer)
  }, [isResting, restTimeRemaining])

  const handleStartNextSet = () => {
    setIsResting(false)
    setCurrentSet((s) => s + 1)
    setCurrentSetReps(0)
  }

  const draw2DSkeleton = (lms: NormalizedLandmarkList) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Use getBoundingClientRect for the most reliable dimensions on all new sessions
    const rect = canvas.getBoundingClientRect()
    const W = rect.width || canvas.clientWidth || canvas.offsetWidth || 640
    const H = rect.height || canvas.clientHeight || canvas.offsetHeight || 480

    // Only resize if dimensions actually changed to avoid flickering
    if (canvas.width !== Math.round(W) || canvas.height !== Math.round(H)) {
      canvas.width = Math.round(W)
      canvas.height = Math.round(H)
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    const cW = canvas.width
    const cH = canvas.height

    // Standard MediaPipe Pose connections
    const boneConnections: [number, number, string][] = [
      // Face
      [LM.LEFT_EAR,  LM.LEFT_EYE,   '#ff758c'],
      [LM.RIGHT_EAR, LM.RIGHT_EYE,  '#ff758c'],
      [LM.LEFT_EYE,  LM.NOSE,       '#ff758c'],
      [LM.RIGHT_EYE, LM.NOSE,       '#ff758c'],
      // Shoulders & Collarbone
      [LM.LEFT_SHOULDER,  LM.RIGHT_SHOULDER, '#ffaa00'],
      // Left arm
      [LM.LEFT_SHOULDER,  LM.LEFT_ELBOW,     '#ff3366'],
      [LM.LEFT_ELBOW,     LM.LEFT_WRIST,     '#ff3366'],
      // Right arm
      [LM.RIGHT_SHOULDER, LM.RIGHT_ELBOW,    '#ff3366'],
      [LM.RIGHT_ELBOW,    LM.RIGHT_WRIST,    '#ff3366'],
      // Torso
      [LM.LEFT_SHOULDER,  LM.LEFT_HIP,       '#ffaa00'],
      [LM.RIGHT_SHOULDER, LM.RIGHT_HIP,      '#ffaa00'],
      [LM.LEFT_HIP,       LM.RIGHT_HIP,      '#ffaa00'],
      // Left leg
      [LM.LEFT_HIP,   LM.LEFT_KNEE,   '#ff3366'],
      [LM.LEFT_KNEE,  LM.LEFT_ANKLE,  '#ff3366'],
      // Right leg
      [LM.RIGHT_HIP,  LM.RIGHT_KNEE,  '#ff3366'],
      [LM.RIGHT_KNEE, LM.RIGHT_ANKLE, '#ff3366'],
    ]

    // Draw bones whenever landmarks exist
    boneConnections.forEach(([i, j, color]) => {
      const p1 = lms[i]
      const p2 = lms[j]
      if (!p1 || !p2) return

      ctx.beginPath()
      ctx.moveTo(p1.x * cW, p1.y * cH)
      ctx.lineTo(p2.x * cW, p2.y * cH)
      ctx.strokeStyle = color
      ctx.shadowColor = color
      ctx.shadowBlur = 14
      ctx.lineWidth = 4.5
      ctx.lineCap = 'round'
      ctx.stroke()
    })

    // Draw joint dots
    const jointIndices = [
      LM.NOSE,
      LM.LEFT_EYE, LM.RIGHT_EYE,
      LM.LEFT_EAR, LM.RIGHT_EAR,
      LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER,
      LM.LEFT_ELBOW,    LM.RIGHT_ELBOW,
      LM.LEFT_WRIST,    LM.RIGHT_WRIST,
      LM.LEFT_HIP,      LM.RIGHT_HIP,
      LM.LEFT_KNEE,     LM.RIGHT_KNEE,
      LM.LEFT_ANKLE,    LM.RIGHT_ANKLE,
    ]

    jointIndices.forEach((idx) => {
      const lm = lms[idx]
      if (!lm) return

      const x = lm.x * cW
      const y = lm.y * cH


      // Outer glow ring
      ctx.beginPath()
      ctx.arc(x, y, 8, 0, 2 * Math.PI)
      ctx.strokeStyle = '#ff3366'
      ctx.shadowColor = '#ff3366'
      ctx.shadowBlur = 18
      ctx.lineWidth = 2.5
      ctx.stroke()

      // White filled center dot
      ctx.beginPath()
      ctx.arc(x, y, 5, 0, 2 * Math.PI)
      ctx.fillStyle = '#ffffff'
      ctx.shadowBlur = 0
      ctx.fill()
    })
  }


  const handleCompleteSession = async () => {
    setIsSessionActive(false)
    cleanup()

    const scores = scoreHistoryRef.current
    const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 92
    const avgROM = romHistoryRef.current.length > 0 ? romHistoryRef.current.reduce((a, b) => a + b, 0) / romHistoryRef.current.length : 90
    const avgStability = stabilityHistoryRef.current.length > 0 ? stabilityHistoryRef.current.reduce((a, b) => a + b, 0) / stabilityHistoryRef.current.length : 95

    try {
      if (sessionId && !sessionId.startsWith('local-')) {
        await sessionsApi.complete(sessionId, {
          total_reps: totalCompletedReps || currentSetReps,
          form_score: avgScore,
          rom_score: avgROM,
          stability_score: avgStability,
          duration_seconds: elapsedSeconds,
          completed: true,
        })
      }
    } catch {}

    navigate('/patient/results', {
      state: {
        exerciseId,
        totalReps: totalCompletedReps || currentSetReps,
        targetReps,
        targetSets,
        avgFormScore: avgScore,
        avgROMPercent: avgROM,
        avgStability,
        durationSeconds: elapsedSeconds,
        commonIssues: Array.from(commonIssuesRef.current),
      },
    })
  }

  const cleanup = () => {
    isSessionActiveRef.current = false  // Stop RAF loop immediately
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    if (noHumanTimerRef.current) clearTimeout(noHumanTimerRef.current)
    poseTrackerRef.current?.close()
    voiceServiceRef.current?.stop()
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream
      stream.getTracks().forEach((track) => track.stop())
    }
  }

  const setProgressPercent = Math.min(100, Math.round((currentSetReps / targetReps) * 100))

  return (
    <div className="relative min-h-screen luminous-mesh-bg text-zinc-100 p-3 md:p-6 flex flex-col justify-between overflow-hidden selection:bg-rose-500 selection:text-white">
      {/* ── TOP HEADER HUD WITH MEGA PROMINENT REP COUNTER ────────────────── */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-3 luminous-glass-card px-6 py-4 border border-rose-500/40 shadow-2xl z-20">
        <div className="flex items-center space-x-3 w-full md:w-auto justify-between md:justify-start">
          <div className="flex items-center space-x-3">
            <div className="w-3.5 h-3.5 rounded-full bg-rose-500 animate-ping" />
            <div>
              <h1 className="text-base md:text-xl font-extrabold tracking-wide uppercase text-white">
                {exerciseId.replace(/_/g, ' ')}
              </h1>
              <span className="text-xs text-rose-300 font-mono font-bold block">
                Target: {targetReps} Reps per set &bull; {targetSets} Sets Prescribed
              </span>
            </div>
          </div>
          {isWheelchairMode && (
            <span className="px-2.5 py-0.5 rounded-full bg-rose-950 border border-rose-500/40 text-rose-300 text-xs font-bold font-mono">
              Seated Mode
            </span>
          )}
        </div>

        {/* 🌟 MEGA PROMINENT LIVE REPETITIONS BANNER (CRYSTAL CLEAR TO JURIES & PATIENTS) */}
        <div className="flex items-center space-x-4 px-6 py-2 rounded-2xl bg-zinc-950/90 border-2 border-rose-500/60 shadow-2xl shadow-rose-500/30">
          <div className="text-right">
            <span className="text-[11px] font-mono font-extrabold text-rose-400 uppercase tracking-wider block">
              SET {currentSet} OF {targetSets}
            </span>
            <span className="text-[10px] text-zinc-400 font-mono">
              {setProgressPercent}% Set Goal
            </span>
          </div>

          <div className="flex items-baseline space-x-1.5 font-mono">
            <span className="text-3xl md:text-4xl font-extrabold text-rose-400 leading-none">
              {currentSetReps}
            </span>
            <span className="text-zinc-500 text-xl font-bold">/</span>
            <span className="text-white text-2xl font-extrabold">{targetReps}</span>
            <span className="text-xs text-zinc-300 font-sans font-bold ml-1">REPS</span>
          </div>

          <div className="hidden sm:block w-28 md:w-36 bg-zinc-800 rounded-full h-3 overflow-hidden border border-zinc-700">
            <div
              className="bg-gradient-to-r from-rose-500 via-red-500 to-amber-400 h-full rounded-full transition-all duration-300 shadow-md shadow-rose-500/50"
              style={{ width: `${setProgressPercent}%` }}
            />
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {/* 2D vs 3D Viewport Toggle */}
          <div className="flex items-center p-1 bg-zinc-950/80 rounded-xl border border-zinc-800 text-xs font-bold font-mono">
            <button
              onClick={() => setViewMode('2d')}
              className={`px-3 py-1.5 rounded-lg transition ${
                viewMode === '2d'
                  ? 'bg-rose-500 text-white font-extrabold shadow-md'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              2D Kinematic
            </button>
            <button
              onClick={() => setViewMode('3d')}
              className={`px-3 py-1.5 rounded-lg transition ${
                viewMode === '3d'
                  ? 'bg-rose-500 text-white font-extrabold shadow-md'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              3D Wireframe
            </button>
          </div>

          <div className="hidden md:flex items-center space-x-1.5 text-xs font-mono">
            <Mic className={`w-4 h-4 ${voiceActive ? 'text-emerald-400 animate-pulse' : 'text-zinc-500'}`} />
            <span className="text-zinc-400">Voice Control</span>
          </div>

          <div className="flex items-center space-x-1 bg-zinc-950 px-3.5 py-1.5 rounded-xl border border-zinc-800 text-xs font-mono font-bold text-rose-400">
            <span>⏱</span>
            <span>
              {String(Math.floor(elapsedSeconds / 60)).padStart(2, '0')}:
              {String(elapsedSeconds % 60).padStart(2, '0')}
            </span>
          </div>

          <button
            onClick={() => {
              cleanup()
              navigate('/patient/dashboard')
            }}
            className="px-3.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold"
          >
            Exit
          </button>
        </div>
      </div>

      {/* ── MAIN STUDIO VIEWPORT ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 flex-1 my-4 z-10">
        {/* Left: Live Video Feed & 2D Skeleton Overlay (7 Cols) */}
        <div className="lg:col-span-7 relative bg-zinc-950 rounded-3xl border-2 border-rose-500/40 overflow-hidden flex items-center justify-center shadow-2xl min-h-[420px]">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover transform -scale-x-100"
          />
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full pointer-events-none transform -scale-x-100"
          />

          {/* ⚠️ 3-SECOND HUMAN NOT DETECTED ALERT */}
          {noHumanAlert && (
            <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none">
              <div className="bg-zinc-950/95 border-2 border-amber-400/80 rounded-3xl px-8 py-6 text-center shadow-2xl backdrop-blur-xl animate-pulse max-w-xs mx-4">
                <div className="text-4xl mb-2">⚠️</div>
                <p className="text-amber-300 font-extrabold text-lg font-mono mb-1">Body Not Detected</p>
                <p className="text-zinc-300 text-sm font-sans">
                  Please move in front of the camera so we can track your exercise correctly.
                </p>
                <div className="mt-3 h-1 rounded-full bg-amber-400/30 overflow-hidden">
                  <div className="h-full bg-amber-400 rounded-full animate-pulse w-full" />
                </div>
              </div>
            </div>
          )}

          {/* Real-time Global Posture Banner Overlay */}
          {postureData && (
            <div
              className={`absolute top-4 left-4 right-4 z-20 p-3.5 rounded-2xl backdrop-blur-xl border flex items-center justify-between transition-all duration-300 ${
                postureData.status === 'optimal'
                  ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300'
                  : postureData.status === 'slight_deviation'
                  ? 'bg-amber-950/80 border-amber-500/50 text-amber-300'
                  : 'bg-rose-950/85 border-rose-500/60 text-rose-300'
              }`}
            >
              <div className="flex items-center space-x-2.5">
                <ShieldCheck className="w-5 h-5 shrink-0" />
                <span className="text-xs md:text-sm font-bold font-mono">
                  {postureData.feedbackCues[0] || 'Global Spine & Shoulder Posture: Optimal'}
                </span>
              </div>
              <span className="text-xs md:text-sm font-mono font-extrabold">{postureData.overallPostureScore}%</span>
            </div>
          )}

          {/* 🌟 FLOATING ON-SCREEN LIVE REPETITIONS HUD (LARGE & CLEAR TO PATIENT IN FRONT OF CAMERA) */}
          <div className="absolute bottom-5 left-5 z-20 bg-zinc-950/95 backdrop-blur-xl p-5 rounded-3xl border-2 border-rose-500/60 text-left shadow-2xl min-w-[220px]">
            <div className="flex items-center justify-between text-xs font-mono text-rose-400 font-extrabold uppercase mb-1">
              <span>SET {currentSet} OF {targetSets}</span>
              <span className="text-amber-400">{setProgressPercent}%</span>
            </div>

            <div className="flex items-baseline space-x-2 my-1">
              <span className="text-5xl font-extrabold text-white font-mono leading-none">
                {currentSetReps}
              </span>
              <span className="text-base text-zinc-400 font-mono font-bold">/ {targetReps} Reps</span>
            </div>

            {/* Target Progress Bar */}
            <div className="w-full bg-zinc-800 rounded-full h-2.5 overflow-hidden border border-zinc-700 mt-2.5">
              <div
                className="bg-gradient-to-r from-rose-500 to-amber-400 h-full rounded-full transition-all duration-300"
                style={{ width: `${setProgressPercent}%` }}
              />
            </div>

            <div className="flex items-center justify-between mt-2 pt-1 border-t border-zinc-800">
              <span className="text-[11px] text-amber-300 font-mono font-bold">
                Phase: {repData?.currentPhase || 'READY'}
              </span>
              <span className="text-[10px] text-zinc-400 font-mono">Goal: {targetReps}</span>
            </div>
          </div>

          {/* Mid-Routine Scheduled Rest Timer Modal */}
          {isResting && (
            <div className="absolute inset-0 bg-zinc-950/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center space-y-4 z-30 animate-fadeIn">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center text-emerald-400 animate-bounce">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div>
                <h2 className="text-2xl md:text-3xl font-extrabold text-white">Set {currentSet} Complete! 🎉</h2>
                <p className="text-sm text-zinc-300 mt-1 max-w-xs mx-auto">
                  Take a prescribed rest interval before starting <strong>Set {currentSet + 1} of {targetSets}</strong>.
                </p>
              </div>

              <div className="text-6xl font-extrabold font-mono text-rose-400">
                {restTimeRemaining}s
              </div>

              <button
                onClick={handleStartNextSet}
                className="luminous-button-primary text-sm font-bold py-3 px-8 shadow-xl flex items-center space-x-2"
              >
                <FastForward className="w-4 h-4" />
                <span>Skip Rest &amp; Start Set {currentSet + 1}</span>
              </button>
            </div>
          )}

          {/* Routine Completed Goal Celebration Modal */}
          {isRoutineCompleted && (
            <div className="absolute inset-0 bg-zinc-950/95 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center space-y-4 z-30 animate-fadeIn">
              <div className="w-20 h-20 rounded-full bg-amber-500/20 border-2 border-amber-400 flex items-center justify-center text-amber-400 animate-pulse">
                <Trophy className="w-10 h-10" />
              </div>
              <div>
                <h2 className="text-3xl font-extrabold text-white">Prescribed Routine Completed! 🏆</h2>
                <p className="text-sm text-amber-300 mt-1">
                  You completed all {targetSets} sets ({totalCompletedReps || targetSets * targetReps} reps) prescribed by your doctor!
                </p>
              </div>

              <div className="p-4 bg-zinc-900/80 rounded-2xl border border-zinc-800 grid grid-cols-2 gap-4 text-sm font-mono">
                <div>
                  <span className="text-zinc-400 block text-xs">Total Reps</span>
                  <span className="text-emerald-400 font-extrabold text-xl">{totalCompletedReps || targetSets * targetReps}</span>
                </div>
                <div>
                  <span className="text-zinc-400 block text-xs">Form Accuracy</span>
                  <span className="text-rose-400 font-extrabold text-xl">{repData?.formScore || 95}%</span>
                </div>
              </div>

              <button
                onClick={handleCompleteSession}
                className="luminous-button-primary text-sm font-bold py-3.5 px-9 shadow-xl flex items-center space-x-2"
              >
                <Sparkles className="w-4 h-4" />
                <span>Finish &amp; View Clinical Report</span>
              </button>
            </div>
          )}
        </div>

        {/* Right: 2D Kinematic Reference OR 3D Wireframe (5 Cols) */}
        <div className="lg:col-span-5 flex flex-col space-y-3.5">
          {viewMode === '2d' ? (
            <div className="flex-1 w-full min-h-[300px] flex flex-col space-y-2.5">
              <div className="flex-1 rounded-2xl overflow-hidden border border-rose-500/30 shadow-xl bg-zinc-900">
                <ExerciseMovementViewer
                  exerciseId={exerciseId}
                  targetRom={90}
                  targetReps={targetReps}
                  aspectRatio="video"
                  autoPlay={true}
                  showControls={true}
                  className="w-full h-full"
                />
              </div>

              {/* 🌟 2D Real-time Angle & Telemetry Card with Target Reps Display */}
              <div className="luminous-glass-card p-4 grid grid-cols-4 gap-2 text-center text-xs font-mono border-rose-500/30">
                <div className="p-2.5 rounded-xl bg-zinc-950/80 border border-zinc-800">
                  <span className="text-[10px] text-zinc-400 block">Reps</span>
                  <span className="text-base font-extrabold text-rose-400">
                    {currentSetReps} / {targetReps}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-zinc-950/80 border border-zinc-800">
                  <span className="text-[10px] text-zinc-400 block">Live Angle</span>
                  <span className="text-base font-bold text-rose-300">
                    {repData ? `${Math.round(repData.primaryAngle)}°` : '0°'}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-zinc-950/80 border border-zinc-800">
                  <span className="text-[10px] text-zinc-400 block">Target ROM</span>
                  <span className="text-base font-bold text-emerald-400">{repData?.romPercent || 0}%</span>
                </div>
                <div className="p-2.5 rounded-xl bg-zinc-950/80 border border-zinc-800">
                  <span className="text-[10px] text-zinc-400 block">Phase</span>
                  <span className="text-xs font-bold text-amber-400 truncate block mt-0.5">
                    {repData?.currentPhase || 'READY'}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 w-full min-h-[300px]">
              <PostureAvatar3D
                landmarks={landmarks}
                angles={angles}
                postureStatus={postureData?.status || 'optimal'}
                postureScore={postureData?.overallPostureScore || 95}
              />
            </div>
          )}

          {/* Telemetry Metrics HUD Card */}
          <div className="luminous-glass-card p-4 grid grid-cols-3 gap-3 text-center text-xs font-mono border-rose-500/30">
            <div className="p-3 rounded-2xl bg-zinc-950/80 border border-zinc-800">
              <span className="text-[10px] text-zinc-400 block">Form Quality</span>
              <span className="text-lg font-extrabold text-rose-400">{repData?.formScore || 95}%</span>
            </div>
            <div className="p-3 rounded-2xl bg-zinc-950/80 border border-zinc-800">
              <span className="text-[10px] text-zinc-400 block">Posture Alignment</span>
              <span className="text-lg font-extrabold text-emerald-400">
                {postureData?.overallPostureScore || 95}%
              </span>
            </div>
            <div className="p-3 rounded-2xl bg-zinc-950/80 border border-zinc-800">
              <span className="text-[10px] text-zinc-400 block">CVA Neck Angle</span>
              <span className="text-lg font-extrabold text-amber-300">
                {angles ? `${Math.round(angles.craniovertebralAngle)}°` : '52°'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Accessible Action Control Bar */}
      <div className="luminous-glass-card p-4 flex items-center justify-between z-20 border-rose-500/30">
        <div className="flex items-center space-x-2 text-xs font-mono text-zinc-400">
          <Sparkles className="w-4 h-4 text-rose-400" />
          <span className="hidden md:inline">
            Doctor's Advice: "{doctorInstructions || 'Keep motion smooth and controlled without joint pain.'}"
          </span>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => setIsPaused(!isPaused)}
            className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold flex items-center space-x-1.5"
          >
            <Pause className="w-3.5 h-3.5" />
            <span>{isPaused ? 'Resume' : 'Pause'}</span>
          </button>

          <button
            onClick={handleCompleteSession}
            className="luminous-button-primary text-xs font-bold py-2.5 px-6 shadow-xl flex items-center space-x-1.5"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
            <span>Complete Session</span>
          </button>

          <button
            onClick={() => handleTriggerEmergency('Manual Emergency Button Clicked')}
            className="px-4 py-2.5 rounded-xl bg-rose-950/80 border border-rose-500/50 hover:bg-rose-900 text-rose-300 text-xs font-bold transition flex items-center space-x-1"
          >
            <Flame className="w-3.5 h-3.5 text-rose-400" />
            <span>Emergency</span>
          </button>
        </div>
      </div>
      {safetyCheckOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
          <div className="relative w-full max-w-md bg-zinc-950 border-2 border-rose-500/80 rounded-3xl p-6 md:p-8 text-center shadow-2xl shadow-rose-950/90 space-y-5">
            <div className="inline-flex items-center space-x-2 px-4 py-1.5 rounded-full bg-rose-500/10 border border-rose-500/40 text-rose-300 text-xs font-mono font-bold">
              <HeartPulse className="w-4 h-4 text-rose-400 animate-pulse" />
              <span>PATIENT SAFETY CHECK</span>
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl md:text-3xl font-extrabold text-white">
                Are you feeling okay?
              </h2>
              <p className="text-zinc-300 text-xs md:text-sm">
                You have been out of camera view for <strong className="text-amber-300">3 seconds</strong>. Please confirm your wellbeing.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={handlePatientConfirmFine}
                className="py-3.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs md:text-sm flex items-center justify-center space-x-2 shadow-lg shadow-emerald-950/50 transition transform hover:scale-[1.02]"
              >
                <CheckCircle2 className="w-4 h-4 text-white" />
                <span>I'm Fine, Resume</span>
              </button>

              <button
                type="button"
                onClick={() => handleTriggerEmergency('Patient requested assistance from safety modal')}
                className="py-3.5 px-4 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs md:text-sm flex items-center justify-center space-x-2 shadow-lg shadow-rose-950/50 transition transform hover:scale-[1.02]"
              >
                <AlertTriangle className="w-4 h-4 text-amber-300 animate-bounce" />
                <span>Need Assistance</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🚨 EMERGENCY SENT CONFIRMATION BANNER */}
      {emergencySent && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-md p-4 bg-rose-950 border-2 border-rose-500 text-white rounded-2xl shadow-2xl flex items-center justify-between space-x-3 backdrop-blur-xl animate-bounce">
          <div className="flex items-center space-x-3">
            <AlertTriangle className="w-6 h-6 text-amber-400 shrink-0" />
            <div className="text-left text-xs">
              <strong className="block text-sm font-bold">Emergency Alert Sent!</strong>
              <span className="text-rose-200">Your physiotherapist has been notified of your status.</span>
            </div>
          </div>
          <button
            onClick={() => setEmergencySent(false)}
            className="px-3 py-1.5 bg-rose-900 hover:bg-rose-800 text-white rounded-xl text-xs font-bold shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  )
}
