import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { exercisesApi } from '../api/client'
import { EXERCISE_INSTRUCTIONS } from '../data/exerciseInstructions'
import type { ExerciseInstructionData } from '../data/exerciseInstructions'
import Layout from '../components/Layout'
import ExerciseMovementViewer from '../components/ExerciseMovementViewer'
import {
  ArrowRight, Target, RotateCcw, Shield, Activity,
  Flame, Video, X, Play
} from 'lucide-react'

interface Exercise {
  id: string
  name: string
  category: string
  description: string
  target_joints: string
  primary_angle_label: string
  target_reps: number
  target_rom_degrees: number
}

export default function ExerciseSelect() {
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [selectedDemo, setSelectedDemo] = useState<ExerciseInstructionData | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    exercisesApi.list()
      .then((res) => setExercises(res.data.exercises || []))
      .finally(() => setLoading(false))
  }, [])

  const categoryLabels: Record<string, string> = {
    lower_body: 'LOWER LIMB',
    upper_body: 'UPPER BODY',
    posture: 'POSTURE & ALIGNMENT',
  }

  const difficultyLevels: Record<string, string> = {
    sit_to_stand: 'Beginner',
    knee_extension: 'Beginner',
    leg_raise: 'Beginner',
    arm_raise: 'Beginner',
    squat: 'Intermediate',
    neck_posture: 'Beginner',
    torso_bend: 'Intermediate',
    shoulder_symmetry: 'Beginner',
    knee_alignment: 'Intermediate',
    lateral_leg_raise: 'Intermediate',
  }

  const categories = [
    { id: 'all', label: 'All 10 Exercises' },
    { id: 'lower_body', label: 'Lower Limb' },
    { id: 'upper_body', label: 'Upper Body' },
    { id: 'posture', label: 'Posture & Alignment' },
  ]

  const filtered = selectedCategory === 'all'
    ? exercises
    : exercises.filter((e) => e.category === selectedCategory)

  return (
    <Layout>
      <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-3 py-1 rounded-full bg-sky-500/15 text-sky-300 text-xs font-bold border border-sky-500/30 uppercase tracking-wider flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-sky-400" />
                Prescribed Rehabilitation Protocols
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">Clinical Exercise Library</h1>
            <p className="text-slate-400 text-xs md:text-sm mt-0.5">
              Review video movement demonstrations and clinical guidelines before launching live AI tracking
            </p>
          </div>

          {/* Category Filter Tabs */}
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
                  selectedCategory === cat.id
                    ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/25'
                    : 'bg-slate-800/80 text-slate-400 hover:bg-slate-700 hover:text-white border border-slate-700/60'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => <div key={i} className="skeleton h-72" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((ex) => {
              const bodyArea = categoryLabels[ex.category] || 'REHABILITATION'
              const difficulty = difficultyLevels[ex.id] || 'Beginner'
              const instr = EXERCISE_INSTRUCTIONS[ex.id] || EXERCISE_INSTRUCTIONS['leg_raise']

              return (
                <div
                  key={ex.id}
                  className="bg-[#1e293b] border border-[#334155] hover:border-sky-500/60 rounded-3xl p-5 shadow-xl text-left transition-all hover:scale-[1.01] hover:shadow-sky-500/10 flex flex-col justify-between group overflow-hidden"
                >
                  <div>
                    {/* Live Movement Video / Kinematic Animation Viewer */}
                    <div className="mb-4">
                      <ExerciseMovementViewer
                        exerciseId={ex.id}
                        slug={instr?.slug}
                        name={ex.name}
                        targetReps={ex.target_reps}
                        targetRom={ex.target_rom_degrees}
                        category={ex.category}
                      />
                    </div>

                    {/* Title & Description */}
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md bg-sky-500/10 text-sky-300 border border-sky-500/25">
                        {bodyArea}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700 flex items-center gap-1">
                        <Flame className="w-3 h-3 text-amber-400" /> {difficulty}
                      </span>
                    </div>

                    <h3 className="text-white font-bold text-base group-hover:text-sky-300 transition-colors leading-snug mb-1 mt-2">
                      {ex.name}
                    </h3>
                    <p className="text-slate-400 text-xs mb-4 leading-relaxed line-clamp-2">
                      {ex.description}
                    </p>
                  </div>

                  <div>
                    <div className="grid grid-cols-2 gap-2 p-3 bg-slate-900/60 rounded-2xl border border-slate-800 text-xs text-slate-400 mb-3.5">
                      <div className="flex items-center gap-1.5">
                        <Target className="w-3.5 h-3.5 text-sky-400" />
                        <span>{ex.target_reps} reps target</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <RotateCcw className="w-3.5 h-3.5 text-cyan-400" />
                        <span>{ex.target_rom_degrees}° ROM</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setSelectedDemo(instr)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-semibold transition-all cursor-pointer border border-slate-700"
                      >
                        <Video className="w-3.5 h-3.5 text-cyan-400" />
                        Watch Demo
                      </button>

                      <button
                        onClick={() => navigate(`/patient/exercises/${ex.id}/instructions`)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-sky-500/20 cursor-pointer"
                      >
                        <span>Learn &amp; Start</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <div className="p-4 bg-slate-800/40 border border-slate-700/60 rounded-2xl text-slate-400 text-xs flex items-center gap-2">
          <Shield className="w-4 h-4 text-slate-400 shrink-0" />
          <span>
            RehabVision provides deterministic bio-mechanical movement tracking. Target ranges and posture feedback are clinical guidance references.
          </span>
        </div>
      </div>

      {/* Quick Movement Demonstration Modal */}
      {selectedDemo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4">
          <div className="bg-[#1e293b] border border-[#334155] rounded-3xl p-6 md:p-8 max-w-2xl w-full shadow-2xl space-y-5 relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setSelectedDemo(null)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white cursor-pointer p-1"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-sky-500/20 text-sky-300 text-[11px] font-bold uppercase tracking-wider border border-sky-500/30">
                Movement Demonstration
              </span>
              <span className="text-xs text-slate-400">
                Target: {selectedDemo.targetReps} Reps &bull; {selectedDemo.targetRom}° ROM
              </span>
            </div>

            <h2 className="text-xl md:text-2xl font-extrabold text-white">
              {selectedDemo.name}
            </h2>

            {/* Video Player */}
            <div className="mb-2">
              <ExerciseMovementViewer
                exerciseId={selectedDemo.id}
                slug={selectedDemo.slug}
                name={selectedDemo.name}
                targetReps={selectedDemo.targetReps}
                targetRom={selectedDemo.targetRom}
                category={selectedDemo.category}
              />
            </div>

            {/* Step-by-Step Instructions */}
            <div className="space-y-2.5">
              <h3 className="text-xs font-bold text-sky-400 uppercase tracking-wider">
                How to Perform Correctly
              </h3>
              <ol className="space-y-1.5">
                {selectedDemo.steps.map((step, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-xs text-slate-300 leading-relaxed">
                    <span className="w-4 h-4 rounded-full bg-sky-500/20 text-sky-300 font-bold text-[10px] flex items-center justify-center shrink-0 border border-sky-500/30 mt-0.5">
                      {i + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={() => setSelectedDemo(null)}
                className="px-4 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer text-center"
              >
                Close Demo
              </button>
              <button
                onClick={() => {
                  const eid = selectedDemo.id
                  setSelectedDemo(null)
                  navigate(`/patient/exercises/${eid}/instructions`)
                }}
                className="flex items-center justify-center gap-1.5 px-4 py-3 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-sky-500/20 cursor-pointer"
              >
                <span>Start Live Session</span>
                <Play className="w-3.5 h-3.5 fill-white" />
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
