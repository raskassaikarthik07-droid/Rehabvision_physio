import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { EXERCISE_INSTRUCTIONS } from '../data/exerciseInstructions'
import Layout from '../components/Layout'
import ExerciseMovementViewer from '../components/ExerciseMovementViewer'
import {
  ArrowLeft, Play, CheckCircle2, AlertTriangle,
  Camera, Activity, Shield
} from 'lucide-react'

export default function ExerciseInstructions() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [cameraReady, setCameraReady] = useState(false)
  const [cameraChecking, setCameraChecking] = useState(true)

  const exercise = EXERCISE_INSTRUCTIONS[id || ''] || EXERCISE_INSTRUCTIONS['leg_raise']

  useEffect(() => {
    // Check camera availability
    navigator.mediaDevices?.getUserMedia({ video: true })
      .then((stream) => {
        setCameraReady(true)
        stream.getTracks().forEach((t) => t.stop())
      })
      .catch(() => setCameraReady(false))
      .finally(() => setCameraChecking(false))
  }, [])

  const requestCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true })
      setCameraReady(true)
      stream.getTracks().forEach((t) => t.stop())
    } catch {
      setCameraReady(false)
      alert('Please allow camera access in your browser to enable real-time movement tracking.')
    }
  }

  return (
    <Layout>
      <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-6">
        {/* Navigation Breadcrumb */}
        <Link
          to="/patient/exercises"
          className="inline-flex items-center gap-2 text-slate-400 hover:text-sky-400 text-xs font-semibold transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Exercise Library
        </Link>

        {/* Hero Header */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-sky-950/60 border border-slate-700/80 rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="px-3 py-1 rounded-full bg-sky-500/20 text-sky-300 text-xs font-bold border border-sky-500/30 uppercase tracking-wider">
                  Exercise Preparation &bull; Before You Begin
                </span>
                <span className="px-3 py-1 rounded-full bg-slate-800 text-slate-300 text-xs font-medium border border-slate-700">
                  Target: {exercise.targetReps} Repetitions
                </span>
              </div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
                {exercise.name}
              </h1>
              <p className="text-slate-300 text-sm mt-2 max-w-2xl leading-relaxed">
                {exercise.purpose}
              </p>
            </div>

            <button
              onClick={() => navigate(`/patient/exercises/${exercise.id}/live`)}
              className="flex items-center justify-center gap-2.5 px-7 py-4 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white rounded-2xl font-bold text-sm shadow-xl shadow-sky-500/25 transition-all cursor-pointer hover:scale-[1.02] shrink-0"
            >
              <Play className="w-4 h-4 fill-white" />
              START SESSION
            </button>
          </div>
        </div>

        {/* 5-8 Second Demonstration Video Card (Requirements 1, 2, 6, 7, 8, 9) */}
        <div className="bg-[#1e293b] border border-[#334155] rounded-3xl p-6 md:p-8 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
              <h2 className="text-base font-bold text-white tracking-tight">
                Bio-Mechanical Movement Demonstration
              </h2>
            </div>
            <span className="text-xs text-slate-400 font-mono">
              Target: {exercise.targetRom}° Range of Motion
            </span>
          </div>

          {/* Exercise Movement Viewer Component */}
          <div className="max-w-3xl mx-auto">
            <ExerciseMovementViewer
              exerciseId={exercise.id}
              slug={exercise.slug}
              name={exercise.name}
              targetReps={exercise.targetReps}
              targetRom={exercise.targetRom}
              category={exercise.category}
              className="shadow-2xl max-h-[420px]"
            />
          </div>
        </div>

        {/* Step-by-Step Instructions Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Starting Position & Steps */}
          <div className="bg-[#1e293b] border border-[#334155] rounded-3xl p-6 shadow-xl space-y-5">
            <div>
              <h3 className="text-sm font-bold text-sky-400 uppercase tracking-wider mb-3">
                Starting Position
              </h3>
              <ul className="space-y-2">
                {exercise.startingPosition.map((pos, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-xs text-slate-300 leading-relaxed">
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-400 mt-1.5 shrink-0" />
                    <span>{pos}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="pt-4 border-t border-slate-700/60">
              <h3 className="text-sm font-bold text-emerald-400 uppercase tracking-wider mb-3">
                How to Perform (Step-by-Step)
              </h3>
              <ol className="space-y-2.5">
                {exercise.steps.map((step, idx) => (
                  <li key={idx} className="flex items-start gap-3 text-xs text-slate-300 leading-relaxed">
                    <span className="w-5 h-5 rounded-full bg-slate-800 text-sky-300 font-bold text-[11px] flex items-center justify-center shrink-0 border border-slate-700">
                      {idx + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>

          {/* AI Tracking Points & Common Mistakes */}
          <div className="space-y-6">
            {/* AI Monitors */}
            <div className="bg-[#1e293b] border border-[#334155] rounded-3xl p-6 shadow-xl space-y-3">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-sky-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  RehabVision AI Monitors
                </h3>
              </div>
              <ul className="space-y-2">
                {exercise.aiMonitors.map((mon, idx) => (
                  <li key={idx} className="flex items-start gap-2.5 text-xs text-slate-300">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>{mon}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Common Mistakes */}
            <div className="bg-[#1e293b] border border-[#334155] rounded-3xl p-6 shadow-xl space-y-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Common Mistakes to Avoid
                </h3>
              </div>
              <ul className="space-y-2">
                {exercise.commonMistakes.map((mis, idx) => (
                  <li key={idx} className="flex items-start gap-2.5 text-xs text-amber-200/90 leading-relaxed">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 shrink-0" />
                    <span>{mis}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Camera Readiness Checklist & Launch Banner */}
        <div className="bg-[#1e293b] border border-[#334155] rounded-3xl p-6 md:p-8 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border shrink-0 ${
              cameraReady
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
            }`}>
              <Camera className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                {cameraChecking ? 'Checking camera availability...' : cameraReady ? 'Camera is Ready' : 'Camera Access Needed'}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {cameraReady
                  ? 'Your webcam is ready for deterministic client-side AI pose analysis.'
                  : 'Click below to allow camera permissions in your browser before starting.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {!cameraReady && !cameraChecking && (
              <button
                onClick={requestCamera}
                className="px-4 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold transition-all cursor-pointer"
              >
                Enable Camera
              </button>
            )}

            <button
              onClick={() => navigate(`/patient/exercises/${exercise.id}/live`)}
              className="flex items-center justify-center gap-2 px-8 py-3.5 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white rounded-2xl font-bold text-xs shadow-lg shadow-sky-500/25 transition-all cursor-pointer hover:scale-[1.02]"
            >
              <Play className="w-4 h-4 fill-white" />
              Start Live Session
            </button>
          </div>
        </div>

        {/* Safety Disclaimer */}
        <div className="p-4 bg-slate-800/40 border border-slate-700/60 rounded-2xl text-slate-400 text-xs flex items-center gap-3">
          <Shield className="w-4 h-4 text-slate-400 shrink-0" />
          <span>{exercise.safetyReminder}</span>
        </div>
      </div>
    </Layout>
  )
}
