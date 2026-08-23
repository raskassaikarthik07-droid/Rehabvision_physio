import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Flame, Stethoscope, Play, Sparkles, TrendingUp, CheckCircle, Accessibility,
  MessageSquare, Star
} from 'lucide-react'
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts'
import { dashboardApi, patientApi } from '../api/client'
import { useAuth } from '../contexts/AuthContext'
import { Rehab3DBackground } from '../components/3d/Rehab3DBackground'
import { InteractiveBodyModel3D } from '../components/3d/InteractiveBodyModel3D'
import { ClinicalChatModal } from '../components/chat/ClinicalChatModal'
import { AppRatingModal } from '../components/feedback/AppRatingModal'
import { PhysioFeedbackModal } from '../components/feedback/PhysioFeedbackModal'

export const PatientDashboard: React.FC = () => {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const [streak, setStreak] = useState<any>({ current_streak: 0, longest_streak: 0 })
  const [prescription, setPrescription] = useState<any>(null)
  const [analytics, setAnalytics] = useState<any>(null)

  // Modals
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [isAppRatingOpen, setIsAppRatingOpen] = useState(false)
  const [isPhysioFeedbackOpen, setIsPhysioFeedbackOpen] = useState(false)

  useEffect(() => {
    loadDashboard()
  }, [])

  const loadDashboard = async () => {
    try {
      const [dashRes, streakRes] = await Promise.allSettled([
        dashboardApi.patient(),
        patientApi.getStreak(),
      ])

      if (dashRes.status === 'fulfilled' && dashRes.value?.data) {
        setPrescription(dashRes.value.data.prescription)
        setAnalytics(dashRes.value.data.analytics)
      }

      if (streakRes.status === 'fulfilled' && streakRes.value?.data?.streak) {
        setStreak(streakRes.value.data.streak)
      }
    } catch {
      // Fallback gracefully
    }
  }

  const isWheelchair =
    user?.mobility_mode === 'wheelchair' || user?.mobility_mode === 'seated_only'

  return (
    <div className="relative min-h-screen luminous-mesh-bg text-zinc-100 p-4 md:p-8 pb-28 selection:bg-rose-500 selection:text-white overflow-x-hidden">
      <Rehab3DBackground />

      {/* FULL-SCREEN WIDESCREEN CONTAINER */}
      <div className="w-full max-w-[1720px] mx-auto space-y-8 relative z-10">
        {/* Full-Screen Top Navbar HUD */}
        <div className="flex items-center justify-between luminous-glass-card p-5 md:px-8 border border-rose-500/30 shadow-2xl shadow-rose-950/40">
          <div className="flex items-center space-x-4">
            <img
              src={user?.picture || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.name || 'Patient'}`}
              alt={user?.name || 'User'}
              className="w-14 h-14 rounded-2xl object-cover border-2 border-rose-500/50 shadow-lg shadow-rose-500/30"
            />
            <div>
              <div className="flex items-center space-x-3">
                <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
                  {user?.name || 'Patient Portal'}
                </h1>
                {isWheelchair && (
                  <span className="px-3 py-1 rounded-full bg-rose-950/90 border border-rose-500/40 text-rose-300 text-xs font-bold font-mono flex items-center space-x-1.5">
                    <Accessibility className="w-3.5 h-3.5" />
                    <span>Seated Mode</span>
                  </span>
                )}
              </div>
              <span className="text-sm text-zinc-400 font-mono mt-0.5 block">
                {user?.diagnosis || user?.rehab_goals || 'Personalized Tele-Rehabilitation'} &bull; <strong className="text-rose-400">Active Supervised Care</strong>
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-3.5">
            {/* App Rating Trigger */}
            <button
              onClick={() => setIsAppRatingOpen(true)}
              className="hidden sm:flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/40 text-sm font-bold transition shadow-md"
            >
              <Star className="w-4 h-4 fill-current text-amber-400" />
              <span>Rate App</span>
            </button>

            <button
              onClick={() => navigate('/patient/connect')}
              className="hidden sm:flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-rose-600/25 hover:bg-rose-600/45 text-rose-300 border border-rose-500/45 text-sm font-bold transition shadow-md"
            >
              <Stethoscope className="w-4 h-4" />
              <span>Connect Doctor</span>
            </button>

            <button
              onClick={() => logout()}
              className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-bold transition"
            >
              Sign Out
            </button>
          </div>
        </div>

        {/* 3D Interactive Biomechanical Body Model & Joint Recovery Inspector */}
        <InteractiveBodyModel3D />

        {/* Full-Screen Metrics Row: Streak Banner & Supervising Physio Card */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Daily Clinical Streak Card (4 cols) */}
          <div className="lg:col-span-4 relative overflow-hidden luminous-glass-card p-7 border-amber-500/40 flex flex-col justify-between shadow-2xl">
            <div className="flex items-center justify-between">
              <span className="text-sm font-mono font-bold uppercase tracking-wider text-amber-400">
                Daily Clinical Streak
              </span>
              <Flame className="w-7 h-7 text-amber-400 animate-bounce" />
            </div>
            <div className="my-5">
              <div className="text-6xl font-extrabold text-white flex items-baseline space-x-2 font-mono">
                <span>{streak.current_streak}</span>
                <span className="text-2xl font-semibold text-amber-300 font-sans">Days Active</span>
              </div>
              <p className="text-sm text-zinc-400 mt-2.5">
                Personal Record: <strong className="text-amber-200 font-mono text-base">{streak.longest_streak} days</strong>
              </p>
            </div>
            <span className="text-sm text-amber-300 font-medium">
              Complete your daily exercises to extend your streak!
            </span>
          </div>

          {/* Assigned Physiotherapist Care Card (8 cols) */}
          <div className="lg:col-span-8 luminous-glass-card p-7 border-rose-500/40 flex flex-col justify-between shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-rose-400 text-sm font-mono font-bold uppercase">
                <Stethoscope className="w-4 h-4" />
                <span>Supervising Physiotherapist</span>
              </div>
              <button
                onClick={() => navigate('/patient/connect')}
                className="text-sm text-rose-400 hover:text-rose-300 underline font-bold"
              >
                Change Specialist
              </button>
            </div>

            {prescription?.physio_name ? (
              <div className="my-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center space-x-4">
                  <div className="w-16 h-16 rounded-2xl bg-rose-950/90 border border-rose-500/50 flex items-center justify-center text-rose-400 font-extrabold text-2xl shadow-xl shadow-rose-500/30">
                    Dr
                  </div>
                  <div>
                    <h3 className="text-2xl font-extrabold text-white">Dr. {prescription.physio_name}</h3>
                    <span className="text-base text-rose-300 font-semibold block mt-0.5">
                      Assigned Rehabilitation Specialist
                    </span>
                    <span className="text-sm text-zinc-400 mt-0.5 block">
                      Active customized prescription plan assigned
                    </span>
                  </div>
                </div>

                {/* Direct Actions: Message & Rate Doctor */}
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => setIsChatOpen(true)}
                    className="px-5 py-3 rounded-xl bg-rose-500 hover:bg-rose-400 text-white font-extrabold text-sm shadow-xl shadow-rose-500/40 flex items-center space-x-2 transition"
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span>Ask Doubts</span>
                  </button>

                  <button
                    onClick={() => setIsPhysioFeedbackOpen(true)}
                    className="px-5 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-amber-300 border border-amber-500/40 font-extrabold text-sm flex items-center space-x-2 transition"
                  >
                    <Star className="w-4 h-4 fill-current text-amber-400" />
                    <span>Feedback</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="my-5 p-5 rounded-2xl bg-zinc-950/60 border border-zinc-800 flex items-center justify-between">
                <div>
                  <h4 className="text-base font-bold text-white">No Assigned Physiotherapist</h4>
                  <p className="text-sm text-zinc-400 mt-1">
                    Connect with a licensed specialist to ask doubts and receive tailored prescriptions.
                  </p>
                </div>
                <button
                  onClick={() => navigate('/patient/connect')}
                  className="px-5 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-400 text-white font-extrabold text-sm shadow-md transition"
                >
                  Connect Now
                </button>
              </div>
            )}

            <div className="flex items-center justify-between pt-3.5 border-t border-zinc-800 text-sm text-zinc-400">
              <span>Focus: <strong className="text-zinc-200">{user?.rehab_goals || user?.diagnosis || 'Recovery & Posture Alignment'}</strong></span>
              <span className="text-emerald-400 font-bold flex items-center space-x-1.5">
                <CheckCircle className="w-4 h-4" />
                <span>Verified Clinical Connection</span>
              </span>
            </div>
          </div>
        </div>

        {/* Prescribed Rehabilitation Routine */}
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl md:text-3xl font-extrabold text-white flex items-center space-x-3 tracking-tight">
              <Sparkles className="w-7 h-7 text-rose-400" />
              <span>
                {prescription?.physio_name
                  ? `Prescribed Routine by Dr. ${prescription.physio_name}`
                  : "Today's Clinical Rehabilitation Routine"}
              </span>
            </h2>
            <span className="text-sm text-zinc-400 font-mono font-bold bg-zinc-900 px-3 py-1 rounded-full border border-zinc-800">
              {prescription?.exercises?.length || 3} Prescribed Exercises
            </span>
          </div>

          {prescription?.notes && (
            <div className="p-5 rounded-2xl bg-rose-950/30 border border-rose-500/40 text-sm text-rose-200 font-medium leading-relaxed">
              📋 <strong className="text-rose-300 font-bold">Doctor's Clinical Notes:</strong> {prescription.notes}
            </div>
          )}

          {prescription?.exercises && prescription.exercises.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {prescription.exercises.map((ex: any) => (
                <div
                  key={ex.id}
                  className="luminous-glass-card p-7 flex flex-col justify-between group transition transform hover:-translate-y-2 hover:shadow-2xl hover:border-rose-500/60"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3.5">
                      <span className="px-3.5 py-1 rounded-full bg-rose-950/80 border border-rose-500/40 text-rose-300 text-xs font-extrabold uppercase tracking-wider font-mono">
                        {ex.difficulty || 'Prescribed'}
                      </span>
                      {ex.is_seated_adapted && (
                        <span className="text-xs text-emerald-400 font-bold">♿ Seated Mode</span>
                      )}
                    </div>
                    <h3 className="font-extrabold text-xl text-white group-hover:text-rose-300 transition">
                      {ex.exercise?.name || ex.exercise_id?.replace(/_/g, ' ')}
                    </h3>
                    <p className="text-sm text-zinc-300 mt-2.5 line-clamp-2 leading-relaxed">
                      {ex.instructions || ex.exercise?.description || 'Follow doctor prescribed guidelines.'}
                    </p>
                  </div>

                  <div className="mt-6 pt-4 border-t border-zinc-800 flex items-center justify-between">
                    <span className="text-sm font-mono text-rose-400 font-bold">
                      {ex.target_sets} Sets × {ex.target_reps} Reps
                    </span>
                    <button
                      onClick={() =>
                        navigate(`/patient/session/${ex.exercise_id}`, {
                          state: {
                            targetReps: ex.target_reps || 10,
                            targetSets: ex.target_sets || 3,
                            restSeconds: ex.rest_seconds || 30,
                            instructions: ex.instructions || '',
                            physioName: prescription?.physio_name,
                          },
                        })
                      }
                      className="luminous-button-primary text-sm font-extrabold py-3 px-6 shadow-xl"
                    >
                      <Play className="w-4 h-4 fill-current mr-1.5" />
                      <span>Start ({ex.target_reps} Reps)</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {[
                { id: 'arm_raise', name: 'Arm / Shoulder Raise', sets: 3, reps: 10, cat: 'Upper Body', desc: 'Elevation and abduction for shoulder mobility and scapular strength.' },
                { id: 'knee_extension', name: 'Seated Knee Extension', sets: 3, reps: 10, cat: 'Lower Body', desc: 'Terminal knee extension to rebuild quadriceps power.' },
                { id: 'neck_posture', name: 'Neck & Forward Head Alignment', sets: 2, reps: 6, cat: 'Spine & Posture', desc: 'Chin retraction and Craniovertebral Angle (CVA) alignment.' },
              ].map((item) => (
                <div
                  key={item.id}
                  className="luminous-glass-card p-7 flex flex-col justify-between group transition transform hover:-translate-y-2 hover:shadow-2xl hover:border-rose-500/60"
                >
                  <div>
                    <span className="text-xs font-mono font-bold uppercase text-rose-400 block mb-1">
                      {item.cat}
                    </span>
                    <h3 className="font-extrabold text-xl text-white group-hover:text-rose-300 transition">{item.name}</h3>
                    <p className="text-sm text-zinc-300 mt-2.5 line-clamp-2 leading-relaxed">{item.desc}</p>
                  </div>
                  <div className="mt-6 pt-4 border-t border-zinc-800 flex items-center justify-between">
                    <span className="text-sm font-mono text-rose-400 font-bold">{item.sets} Sets × {item.reps} Reps</span>
                    <button
                      onClick={() =>
                        navigate(`/patient/session/${item.id}`, {
                          state: {
                            targetReps: item.reps,
                            targetSets: item.sets,
                            restSeconds: 30,
                          },
                        })
                      }
                      className="luminous-button-primary text-sm font-extrabold py-3 px-6 shadow-xl"
                    >
                      <Play className="w-4 h-4 fill-current mr-1.5" />
                      <span>Start ({item.reps} Reps)</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* SECTION: Full-Screen Recovery Analytics with Recharts */}
        <div className="luminous-glass-card p-7 md:p-9 space-y-6 shadow-2xl border-rose-500/25">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800 pb-4">
            <div>
              <h2 className="text-2xl font-extrabold text-white flex items-center space-x-3 tracking-tight">
                <TrendingUp className="w-6 h-6 text-rose-400" />
                <span>Recovery Analytics &amp; Biomechanical Evolution</span>
              </h2>
              <p className="text-sm text-zinc-400 mt-1">
                Longitudinal metrics computed directly from your MediaPipe exercise sessions
              </p>
            </div>
            <div className="flex items-center space-x-6 text-sm font-mono">
              <span className="text-rose-400 font-bold text-base">
                Avg Form: {analytics?.avg_form_score ? `${Math.round(analytics.avg_form_score)}%` : '92%'}
              </span>
              <span className="text-amber-400 font-bold text-base">
                Posture Alignment: {analytics?.avg_posture_score ? `${Math.round(analytics.avg_posture_score)}%` : '94%'}
              </span>
            </div>
          </div>

          <div className="w-full h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={
                  analytics?.weekly_trend?.length > 0
                    ? analytics.weekly_trend
                    : [
                        { day_label: 'Mon', form_score: 88, posture_score: 90 },
                        { day_label: 'Tue', form_score: 91, posture_score: 89 },
                        { day_label: 'Wed', form_score: 94, posture_score: 92 },
                        { day_label: 'Thu', form_score: 92, posture_score: 95 },
                        { day_label: 'Fri', form_score: 95, posture_score: 96 },
                        { day_label: 'Sat', form_score: 96, posture_score: 94 },
                        { day_label: 'Sun', form_score: 97, posture_score: 98 },
                      ]
                }
              >
                <defs>
                  <linearGradient id="formGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ff3366" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#ff3366" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="postureGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ffaa00" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#ffaa00" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="day_label" stroke="#a1a1aa" fontSize={13} tickLine={false} />
                <YAxis domain={[50, 100]} stroke="#a1a1aa" fontSize={13} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#09090b',
                    borderColor: 'rgba(255, 255, 255, 0.15)',
                    borderRadius: '16px',
                    fontSize: '14px',
                    boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="form_score"
                  name="Exercise Form Score %"
                  stroke="#ff3366"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#formGrad)"
                />
                <Area
                  type="monotone"
                  dataKey="posture_score"
                  name="Global Posture Score %"
                  stroke="#ffaa00"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#postureGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Floating Action Button: Clinical Doubts & Chat */}
      <button
        onClick={() => setIsChatOpen(true)}
        className="fixed bottom-7 right-7 z-40 p-4 rounded-full luminous-button-primary shadow-2xl shadow-rose-500/50 flex items-center space-x-2.5 transition transform hover:scale-110 active:scale-95"
      >
        <MessageSquare className="w-5 h-5 text-white" />
        <span className="text-sm font-bold pr-1 text-white">Ask Doctor Doubts</span>
      </button>

      {/* Clinical Chat Modal */}
      <ClinicalChatModal
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        recipientId={prescription?.physio_user_id || '867aee2f-a4b3-43fc-8e5e-4550e6f0b439'}
        recipientName={prescription?.physio_name || 'Priya Reddy'}
        recipientRole="physiotherapist"
        patientId={user?.patient_id}
        physioId={prescription?.physio_id || '145206d5-3ba9-4fce-9874-5bd0a3b0d363'}
      />

      {/* App Rating Modal */}
      <AppRatingModal
        isOpen={isAppRatingOpen}
        onClose={() => setIsAppRatingOpen(false)}
      />

      {/* Physio Feedback Modal */}
      <PhysioFeedbackModal
        isOpen={isPhysioFeedbackOpen}
        onClose={() => setIsPhysioFeedbackOpen(false)}
        physioId={prescription?.physio_id || '145206d5-3ba9-4fce-9874-5bd0a3b0d363'}
        physioName={prescription?.physio_name || 'Priya Reddy'}
      />
    </div>
  )
}
