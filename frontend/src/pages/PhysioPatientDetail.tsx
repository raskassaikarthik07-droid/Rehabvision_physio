import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { physioApi } from '../api/client'
import Layout from '../components/Layout'
import Avatar from '../components/Avatar'
import {
  ArrowLeft, Dumbbell, AlertTriangle, Calendar, ChevronRight,
  Activity, Sparkles, TrendingUp, CheckCircle2, Award
} from 'lucide-react'

interface SessionWithScore {
  session: {
    id: string
    patient_id: string
    exercise_id: string
    started_at: string
    completed_at?: string
    status: string
    notes: string
  }
  score?: {
    total_reps: number
    correct_reps: number
    avg_form_score: number
    avg_rom_percent: number
    avg_symmetry: number
    avg_stability: number
    peak_angle: number
    duration_seconds: number
    computed_at: string
  }
}

interface ProgressPoint {
  date: string
  session_id: string
  exercise_id: string
  form_score: number
  rom_percent: number
  symmetry: number
  stability: number
  correct_reps_pct: number
}

export default function PhysioPatientDetail() {
  const { id } = useParams<{ id: string }>()
  const [data, setData] = useState<{
    patient: any
    user: any
    sessions: SessionWithScore[]
    common_issues: string[]
  } | null>(null)
  const [progress, setProgress] = useState<ProgressPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    Promise.all([
      physioApi.getPatientDetail(id),
      physioApi.getPatientProgress(id),
    ])
      .then(([detailRes, progRes]) => {
        setData(detailRes.data)
        setProgress(progRes.data?.progress || [])
      })
      .catch((err) => {
        setError(err.response?.data?.error || 'Failed to fetch patient clinical records')
      })
      .finally(() => setLoading(false))
  }, [id])

  const exerciseName = (exerciseId: string) =>
    ({
      sit_to_stand: 'Sit to Stand',
      knee_extension: 'Seated Knee Extension',
      leg_raise: 'Straight Leg Raise',
      arm_raise: 'Arm / Shoulder Raise',
      squat: 'Rehabilitation Squat',
      neck_posture: 'Neck & Forward Head Alignment',
      torso_bend: 'Back & Torso Bend Alignment',
      shoulder_symmetry: 'Shoulder Symmetry & Balance',
      knee_alignment: 'Knee Alignment & Valgus Tracking',
      lateral_leg_raise: 'Lateral Leg Raise',
    } as any)[exerciseId] || exerciseId.replace(/_/g, ' ')

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

  const completedSessions = data?.sessions?.filter((s) => s.session.status === 'completed') || []
  const latestSession = completedSessions.length > 0 ? completedSessions[0] : null
  const avgForm = completedSessions.length
    ? Math.round(completedSessions.reduce((acc, s) => acc + (s.score?.avg_form_score || 0), 0) / completedSessions.length)
    : 0
  const avgROM = completedSessions.length
    ? Math.round(completedSessions.reduce((acc, s) => acc + (s.score?.avg_rom_percent || 0), 0) / completedSessions.length)
    : 0

  return (
    <Layout>
      <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8">
        {/* Navigation Breadcrumb */}
        <Link
          to="/physiotherapist/dashboard"
          className="inline-flex items-center gap-2 text-slate-400 hover:text-cyan-400 text-xs font-semibold transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Clinician Dashboard
        </Link>

        {error && (
          <div className="p-6 bg-rose-500/10 border border-rose-500/30 rounded-3xl text-rose-300">
            <p className="font-bold text-sm">Access Denied</p>
            <p className="text-xs mt-1 text-rose-400/90 leading-relaxed">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="space-y-6">
            <div className="skeleton h-36" />
            <div className="skeleton h-64" />
          </div>
        ) : data ? (
          <div className="space-y-8">
            {/* Patient Header Card (Requirement 10 & 11) */}
            <div className="bg-[#1e293b] border border-[#334155] rounded-3xl p-6 md:p-8 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-center gap-5">
                <Avatar
                  name={data.user?.name || 'Patient'}
                  src={data.user?.picture}
                  size="xl"
                  role="patient"
                />
                <div>
                  <h1 className="text-2xl font-extrabold text-white">{data.user?.name || 'Patient'}</h1>
                  <p className="text-slate-400 text-xs md:text-sm mt-0.5">{data.user?.email}</p>
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 font-bold border border-cyan-500/30 font-mono">
                      ID: {data.patient?.id?.slice(0, 8)}...
                    </span>
                    <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                      Supervising Clinician: <strong className="text-cyan-300 ml-1">Priya Reddy</strong>
                    </span>
                    {data.patient?.age > 0 && (
                      <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                        Age: {data.patient.age} yrs
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Quick Clinical Averages */}
              <div className="grid grid-cols-3 gap-3 w-full md:w-auto">
                <div className="p-3.5 bg-slate-800/60 rounded-2xl border border-slate-700/60 text-center min-w-24">
                  <div className="text-xl font-extrabold text-white">{data.sessions?.length || 0}</div>
                  <div className="text-[10px] text-slate-400 font-semibold uppercase mt-0.5">Sessions</div>
                </div>
                <div className="p-3.5 bg-slate-800/60 rounded-2xl border border-slate-700/60 text-center min-w-24">
                  <div className="text-xl font-extrabold text-emerald-400">{avgForm}%</div>
                  <div className="text-[10px] text-slate-400 font-semibold uppercase mt-0.5">Avg Form</div>
                </div>
                <div className="p-3.5 bg-slate-800/60 rounded-2xl border border-slate-700/60 text-center min-w-24">
                  <div className="text-xl font-extrabold text-cyan-400">{avgROM}°</div>
                  <div className="text-[10px] text-slate-400 font-semibold uppercase mt-0.5">Avg ROM</div>
                </div>
              </div>
            </div>

            {/* Latest Session Breakdown Card (Requirement 10) */}
            {latestSession && latestSession.score && (
              <div className="bg-[#1e293b] border border-cyan-500/40 rounded-3xl p-6 md:p-8 shadow-xl space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Award className="w-5 h-5 text-cyan-400" />
                    <h2 className="text-base font-bold text-white tracking-tight">Latest Completed Session Telemetry</h2>
                  </div>
                  <span className="text-xs text-slate-400 font-medium">
                    {formatDate(latestSession.session.started_at)}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
                  <div className="p-3.5 bg-slate-900/70 rounded-2xl border border-slate-800 text-center">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Exercise</span>
                    <div className="text-sm font-bold text-white mt-1 truncate">
                      {exerciseName(latestSession.session.exercise_id)}
                    </div>
                  </div>

                  <div className="p-3.5 bg-slate-900/70 rounded-2xl border border-slate-800 text-center">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Repetitions</span>
                    <div className="text-lg font-extrabold text-white mt-1">
                      {latestSession.score.total_reps} reps
                    </div>
                  </div>

                  <div className="p-3.5 bg-slate-900/70 rounded-2xl border border-slate-800 text-center">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Correct Reps</span>
                    <div className="text-lg font-extrabold text-emerald-400 mt-1">
                      {latestSession.score.correct_reps} reps
                    </div>
                  </div>

                  <div className="p-3.5 bg-slate-900/70 rounded-2xl border border-slate-800 text-center">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Form Score</span>
                    <div className="text-lg font-extrabold text-emerald-400 mt-1">
                      {Math.round(latestSession.score.avg_form_score)}%
                    </div>
                  </div>

                  <div className="p-3.5 bg-slate-900/70 rounded-2xl border border-slate-800 text-center">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Peak ROM</span>
                    <div className="text-lg font-extrabold text-cyan-400 mt-1">
                      {Math.round(latestSession.score.avg_rom_percent)}°
                    </div>
                  </div>

                  <div className="p-3.5 bg-slate-900/70 rounded-2xl border border-slate-800 text-center">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Symmetry</span>
                    <div className="text-lg font-extrabold text-sky-400 mt-1">
                      {Math.round(latestSession.score.avg_symmetry || 95)}%
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Rehabilitation Focus & Objectives */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-[#1e293b] border border-[#334155] rounded-3xl p-5 shadow-lg">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Clinical Diagnosis
                </h3>
                <p className="text-sm text-white font-medium">
                  {data.patient?.diagnosis || 'General Physical Therapy & Mobility Restoration'}
                </p>
              </div>

              <div className="bg-[#1e293b] border border-[#334155] rounded-3xl p-5 shadow-lg">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Rehabilitation Objectives
                </h3>
                <p className="text-sm text-white font-medium">
                  {data.patient?.rehab_goals || 'Improve joint range of motion and functional bilateral stability'}
                </p>
              </div>
            </div>

            {/* Longitudinal Recovery Trajectory */}
            {progress.length > 0 && (
              <div className="bg-[#1e293b] border border-[#334155] rounded-3xl p-6 md:p-8 shadow-xl">
                <div className="flex items-center gap-2 mb-6">
                  <TrendingUp className="w-5 h-5 text-cyan-400" />
                  <h2 className="text-lg font-bold text-white tracking-tight">Longitudinal Recovery Trajectory</h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-4 bg-slate-800/50 rounded-2xl border border-slate-700/60">
                    <span className="text-xs text-slate-400">Latest Form Accuracy</span>
                    <div className="text-2xl font-bold text-emerald-400 mt-1">
                      {Math.round(progress[progress.length - 1].form_score)}%
                    </div>
                    <span className="text-[11px] text-slate-500">From last completed session</span>
                  </div>

                  <div className="p-4 bg-slate-800/50 rounded-2xl border border-slate-700/60">
                    <span className="text-xs text-slate-400">Latest Range of Motion</span>
                    <div className="text-2xl font-bold text-cyan-400 mt-1">
                      {Math.round(progress[progress.length - 1].rom_percent)}°
                    </div>
                    <span className="text-[11px] text-slate-500">Joint excursion angle</span>
                  </div>

                  <div className="p-4 bg-slate-800/50 rounded-2xl border border-slate-700/60">
                    <span className="text-xs text-slate-400">Repetition Quality Rate</span>
                    <div className="text-2xl font-bold text-sky-400 mt-1">
                      {Math.round(progress[progress.length - 1].correct_reps_pct)}%
                    </div>
                    <span className="text-[11px] text-slate-500">Valid deterministic reps</span>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Historical Exercise Sessions List */}
              <div className="lg:col-span-2 bg-[#1e293b] border border-[#334155] rounded-3xl p-6 shadow-xl">
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-2">
                    <Dumbbell className="w-5 h-5 text-cyan-400" />
                    <h2 className="text-lg font-bold text-white">Logged Session Telemetry</h2>
                  </div>
                  <span className="text-xs text-slate-400">{data.sessions?.length || 0} total</span>
                </div>

                {!data.sessions || data.sessions.length === 0 ? (
                  <div className="text-center py-12 border border-dashed border-slate-700 rounded-2xl p-6">
                    <Activity className="w-10 h-10 mx-auto mb-2 text-slate-600" />
                    <p className="text-slate-400 text-sm">No exercise sessions logged by this patient yet.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {data.sessions.map((item) => (
                      <Link
                        key={item.session.id}
                        to={`/patient/session/${item.session.id}`}
                        className="block p-4 bg-slate-800/40 hover:bg-slate-800/90 border border-slate-700/60 hover:border-cyan-500/40 rounded-2xl transition-all group"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-cyan-500/15 flex items-center justify-center shrink-0">
                              <Dumbbell className="w-5 h-5 text-cyan-400" />
                            </div>
                            <div>
                              <h3 className="text-white font-semibold text-sm group-hover:text-cyan-300 transition-colors">
                                {exerciseName(item.session.exercise_id)}
                              </h3>
                              <p className="text-slate-400 text-xs flex items-center gap-1.5 mt-0.5">
                                <Calendar className="w-3 h-3 text-slate-500" />
                                {formatDate(item.session.started_at)}
                              </p>
                            </div>
                          </div>

                          {item.score ? (
                            <div className="flex items-center gap-4 text-xs">
                              <div className="text-right">
                                <div className="text-emerald-400 font-bold text-sm">
                                  {Math.round(item.score.avg_form_score)}%
                                </div>
                                <div className="text-[10px] text-slate-500">Form Score</div>
                              </div>
                              <div className="text-right">
                                <div className="text-cyan-400 font-bold text-sm">
                                  {Math.round(item.score.avg_rom_percent)}°
                                </div>
                                <div className="text-[10px] text-slate-500">Target ROM</div>
                              </div>
                              <div className="text-right">
                                <div className="text-white font-bold text-sm">
                                  {item.score.total_reps}
                                </div>
                                <div className="text-[10px] text-slate-500">Reps</div>
                              </div>
                              <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-cyan-400 transition-colors" />
                            </div>
                          ) : (
                            <span className="text-xs px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-400 font-medium">
                              In Progress
                            </span>
                          )}
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              {/* Detected Movement Errors & Clinical AI Copilot */}
              <div className="space-y-6">
                <div className="bg-[#1e293b] border border-[#334155] rounded-3xl p-6 shadow-xl">
                  <div className="flex items-center gap-2 mb-4">
                    <AlertTriangle className="w-5 h-5 text-amber-400" />
                    <h2 className="text-base font-bold text-white">Identified Movement Patterns</h2>
                  </div>

                  {!data.common_issues || data.common_issues.length === 0 ? (
                    <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-300 text-xs flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>No recurring biomechanical defects detected.</span>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {data.common_issues.map((issue, idx) => (
                        <div
                          key={idx}
                          className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-200 text-xs flex items-start gap-2.5 leading-relaxed"
                        >
                          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                          <span>{issue}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="bg-gradient-to-br from-cyan-950/40 to-slate-900 border border-cyan-500/30 rounded-3xl p-6 shadow-xl">
                  <div className="flex items-center gap-2 mb-2 text-cyan-400">
                    <Sparkles className="w-4 h-4" />
                    <h3 className="text-sm font-bold text-white">Gemini Clinical Synthesis</h3>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Review individual session records above to generate structured clinical recovery reports and patient-facing exercise recommendations.
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </Layout>
  )
}
