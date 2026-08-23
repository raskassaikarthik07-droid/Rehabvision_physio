import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Users, Sparkles, Check, X, ChevronRight, Plus, Trash2, HeartPulse,
  ShieldCheck, Zap, MessageSquare, Star, Award, Bell
} from 'lucide-react'
import {
  dashboardApi, requestsApi, prescriptionsApi, exercisesApi, feedbackApi, notificationsApi
} from '../api/client'
import { useAuth } from '../contexts/AuthContext'
import { Rehab3DBackground } from '../components/3d/Rehab3DBackground'
import { InteractiveBodyModel3D } from '../components/3d/InteractiveBodyModel3D'
import { ClinicalChatModal } from '../components/chat/ClinicalChatModal'
import { AppRatingModal } from '../components/feedback/AppRatingModal'

const PRESET_PROTOCOLS = [
  {
    title: 'Knee & Lower Body Rehab (ACL / Post-Op)',
    notes: 'Strengthen quadriceps, restore knee flexion/extension range of motion and joint stability.',
    exercises: [
      { exercise_id: 'knee_extension', target_sets: 3, target_reps: 10, rest_seconds: 45, difficulty: 'beginner', is_seated_adapted: true, instructions: 'Full extension hold for 2s at peak.' },
      { exercise_id: 'leg_raise', target_sets: 3, target_reps: 10, rest_seconds: 45, difficulty: 'beginner', is_seated_adapted: false, instructions: 'Keep knee straight throughout lift.' },
      { exercise_id: 'sit_to_stand', target_sets: 2, target_reps: 8, rest_seconds: 60, difficulty: 'intermediate', is_seated_adapted: false, instructions: 'Symmetric weight distribution on both feet.' },
    ],
  },
  {
    title: 'Shoulder & Upper Body Mobility',
    notes: 'Improve glenohumeral range of motion and bilateral scapular stability.',
    exercises: [
      { exercise_id: 'arm_raise', target_sets: 3, target_reps: 12, rest_seconds: 45, difficulty: 'beginner', is_seated_adapted: true, instructions: 'Elevate arm smoothly without shrugging shoulders.' },
      { exercise_id: 'shoulder_symmetry', target_sets: 3, target_reps: 8, rest_seconds: 30, difficulty: 'beginner', is_seated_adapted: true, instructions: 'Maintain horizontal shoulder leveling.' },
      { exercise_id: 'neck_posture', target_sets: 2, target_reps: 5, rest_seconds: 30, difficulty: 'beginner', is_seated_adapted: true, instructions: 'Gentle chin tuck holding for 3s.' },
    ],
  },
  {
    title: 'Cervical & Spine Posture Alignment',
    notes: 'Correct forward head posture (CVA) and reduce thoracic kyphotic slouching.',
    exercises: [
      { exercise_id: 'neck_posture', target_sets: 3, target_reps: 8, rest_seconds: 30, difficulty: 'beginner', is_seated_adapted: true, instructions: 'Align ears directly above acromion process.' },
      { exercise_id: 'torso_bend', target_sets: 3, target_reps: 8, rest_seconds: 45, difficulty: 'intermediate', is_seated_adapted: true, instructions: 'Controlled trunk inclination with neutral spine.' },
      { exercise_id: 'shoulder_symmetry', target_sets: 2, target_reps: 10, rest_seconds: 30, difficulty: 'beginner', is_seated_adapted: true, instructions: 'Keep shoulders relaxed and symmetrical.' },
    ],
  },
  {
    title: 'Wheelchair & Seated Adaptive Protocol',
    notes: 'Zero standing requirements. 100% seated upper body and postural activation.',
    exercises: [
      { exercise_id: 'arm_raise', target_sets: 3, target_reps: 10, rest_seconds: 45, difficulty: 'beginner', is_seated_adapted: true, instructions: 'Raise arms within comfortable pain-free range.' },
      { exercise_id: 'knee_extension', target_sets: 3, target_reps: 10, rest_seconds: 45, difficulty: 'beginner', is_seated_adapted: true, instructions: 'Seated knee extension from chair.' },
      { exercise_id: 'neck_posture', target_sets: 2, target_reps: 6, rest_seconds: 30, difficulty: 'beginner', is_seated_adapted: true, instructions: 'Hold upright seated posture and retract chin.' },
    ],
  },
]

export const PhysioDashboard: React.FC = () => {
  const navigate = useNavigate()
  const { logout } = useAuth()
  const [physio, setPhysio] = useState<any>(null)
  const [patients, setPatients] = useState<any[]>([])
  const [pendingRequests, setPendingRequests] = useState<any[]>([])
  const [reviews, setReviews] = useState<any[]>([])

  // Notifications State
  const [notifications, setNotifications] = useState<any[]>([])
  const [isNotifOpen, setIsNotifOpen] = useState(false)
  const [latestMessageToast, setLatestMessageToast] = useState<any | null>(null)

  // AI Prescription Modal State
  const [selectedPatientForRx, setSelectedPatientForRx] = useState<any | null>(null)
  const [rxTitle, setRxTitle] = useState('Personalized Rehabilitation Protocol')
  const [rxNotes, setRxNotes] = useState('')
  const [rxExercises, setRxExercises] = useState<any[]>([])
  const [isGeneratingAI, setIsGeneratingAI] = useState(false)
  const [isSavingRx, setIsSavingRx] = useState(false)
  const [allExercises, setAllExercises] = useState<any[]>([])

  // Chat & Rating Modals
  const [chatPatient, setChatPatient] = useState<any | null>(null)
  const [isAppRatingOpen, setIsAppRatingOpen] = useState(false)

  useEffect(() => {
    loadDashboard()
    loadNotifications()
    exercisesApi.list().then((res) => setAllExercises(res.data.exercises || []))

    const notifTimer = setInterval(loadNotifications, 3000)
    return () => clearInterval(notifTimer)
  }, [])

  const loadNotifications = async () => {
    try {
      const res = await notificationsApi.list()
      const list = res.data.notifications || []
      setNotifications(list)

      // Find unread message notifications
      const unreadMsg = list.find((n: any) => !n.read && n.type === 'message')
      if (unreadMsg && (!latestMessageToast || latestMessageToast.id !== unreadMsg.id)) {
        setLatestMessageToast(unreadMsg)
      }
    } catch {}
  }

  const loadDashboard = async () => {
    try {
      const res = await dashboardApi.physiotherapist()
      setPhysio(res.data.physiotherapist)
      setPatients(res.data.assigned_patients || [])
      setPendingRequests(res.data.pending_requests || [])

      if (res.data.physiotherapist?.id) {
        feedbackApi.getPhysioFeedback(res.data.physiotherapist.id).then((fbRes) => {
          setReviews(fbRes.data.feedbacks || [])
        }).catch(() => {})
      }
    } catch {
      // Catch error
    }
  }

  const handleAcceptRequest = async (id: string) => {
    try {
      await requestsApi.acceptRequest(id)
      loadDashboard()
    } catch {
      alert('Failed to accept request.')
    }
  }

  const handleRejectRequest = async (id: string) => {
    const reason = prompt('Reason for rejection (optional):') || 'Capacity reached'
    try {
      await requestsApi.rejectRequest(id, reason)
      loadDashboard()
    } catch {
      alert('Failed to reject request.')
    }
  }

  const openPrescriptionStudio = (patient: any) => {
    setSelectedPatientForRx(patient)
    setRxTitle(`Rehabilitation Plan for ${patient.name}`)
    setRxNotes(`Clinical focus: ${patient.diagnosis || patient.rehab_goals || 'Recovery'}`)
    applyPreset(PRESET_PROTOCOLS[0])
  }

  const applyPreset = (preset: typeof PRESET_PROTOCOLS[0]) => {
    setRxTitle(preset.title)
    setRxNotes(preset.notes)
    setRxExercises(
      preset.exercises.map((ex) => ({
        exercise_id: ex.exercise_id,
        target_sets: ex.target_sets,
        target_reps: ex.target_reps,
        rest_seconds: ex.rest_seconds,
        difficulty: ex.difficulty,
        is_seated_adapted: ex.is_seated_adapted,
        instructions: ex.instructions,
        safety_notes: 'Maintain smooth tempo without joint pain',
        form_criteria: 'Target optimal range of motion',
      }))
    )
  }

  const handleGenerateAIPrescription = async (patientId: string) => {
    setIsGeneratingAI(true)
    try {
      const res = await prescriptionsApi.suggestAI(patientId)
      if (res.data.exercises?.length > 0) {
        setRxExercises(res.data.exercises)
        if (res.data.title) setRxTitle(res.data.title)
      }
    } catch {
      alert('AI generator unavailable, applying clinical template.')
    } finally {
      setIsGeneratingAI(false)
    }
  }

  const handleSavePrescription = async () => {
    if (!selectedPatientForRx || rxExercises.length === 0) return
    setIsSavingRx(true)
    try {
      await prescriptionsApi.create({
        patient_id: selectedPatientForRx.patient_id,
        title: rxTitle,
        notes: rxNotes,
        ai_suggested: true,
        exercises: rxExercises.map((ex) => ({
          exercise_id: ex.exercise_id,
          target_reps: Number(ex.target_reps) || 10,
          target_sets: Number(ex.target_sets) || 3,
          rest_seconds: Number(ex.rest_seconds) || 45,
          difficulty: ex.difficulty || 'beginner',
          instructions: ex.instructions || '',
          safety_notes: ex.safety_notes || '',
          form_criteria: ex.form_criteria || '',
          is_seated_adapted: Boolean(ex.is_seated_adapted),
        })),
      })
      alert(`Prescription successfully assigned to ${selectedPatientForRx.name}!`)
      setSelectedPatientForRx(null)
      loadDashboard()
    } catch {
      alert('Failed to save prescription.')
    } finally {
      setIsSavingRx(false)
    }
  }

  const removeRxExercise = (index: number) => {
    setRxExercises(rxExercises.filter((_, i) => i !== index))
  }

  const addDefaultExercise = () => {
    setRxExercises([
      ...rxExercises,
      {
        exercise_id: allExercises[0]?.id || 'arm_raise',
        target_reps: 10,
        target_sets: 3,
        rest_seconds: 45,
        difficulty: 'beginner',
        instructions: 'Controlled range of motion',
        safety_notes: 'Keep core stable',
        form_criteria: 'Target 90 degrees',
        is_seated_adapted: false,
      },
    ])
  }

  const unreadCount = notifications.filter((n) => !n.read).length

  const openChatForNotification = (notif: any) => {
    const matched = patients.find((p) => notif.title.includes(p.name) || notif.message.includes(p.name))
    if (matched) {
      setChatPatient(matched)
    } else if (patients.length > 0) {
      setChatPatient(patients[0])
    }
    notificationsApi.markRead(notif.id).then(() => loadNotifications())
    setIsNotifOpen(false)
    setLatestMessageToast(null)
  }

  const avgRating =
    reviews.length > 0
      ? (reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1)
      : '5.0'

  return (
    <div className="relative min-h-screen luminous-mesh-bg text-zinc-100 p-4 md:p-8 pb-28 selection:bg-rose-500 selection:text-white overflow-x-hidden">
      <Rehab3DBackground />

      {/* Floating Incoming Message Toast Banner */}
      {latestMessageToast && (
        <div className="fixed top-7 right-7 z-50 max-w-md bg-gradient-to-r from-rose-950 via-zinc-900 to-amber-950 border-2 border-rose-400 p-5 rounded-3xl shadow-2xl shadow-rose-500/30 flex items-start space-x-3.5 animate-slideIn">
          <div className="p-2.5 rounded-2xl bg-rose-500/20 text-rose-400 shrink-0">
            <MessageSquare className="w-6 h-6 animate-bounce" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-rose-300 uppercase">
                Incoming Patient Doubt
              </span>
              <button
                onClick={() => setLatestMessageToast(null)}
                className="text-zinc-400 hover:text-white text-sm"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <h4 className="text-sm font-bold text-white mt-1">{latestMessageToast.title}</h4>
            <p className="text-sm text-zinc-300 line-clamp-2 mt-1">"{latestMessageToast.message}"</p>
            <button
              onClick={() => openChatForNotification(latestMessageToast)}
              className="mt-2.5 px-4 py-1.5 rounded-xl bg-rose-500 hover:bg-rose-400 text-white font-bold text-xs transition shadow-md"
            >
              Reply & Solve Doubt
            </button>
          </div>
        </div>
      )}

      {/* FULL-SCREEN WIDESCREEN CONTAINER */}
      <div className="w-full max-w-[1720px] mx-auto space-y-8 relative z-10">
        {/* Full-Screen Physio Header HUD */}
        <div className="relative z-40 flex flex-col md:flex-row md:items-center justify-between gap-4 luminous-glass-card p-6 md:px-8 border-rose-500/30 shadow-2xl shadow-rose-950/40">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-rose-500 via-red-500 to-amber-500 p-0.5 shadow-xl shadow-rose-500/30">
              <div className="w-full h-full bg-zinc-950 rounded-2xl flex items-center justify-center text-rose-300 font-extrabold text-2xl">
                Dr
              </div>
            </div>
            <div>
              <div className="flex items-center space-x-3">
                <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
                  Dr. {physio?.user?.name || 'Physiotherapist'}
                </h1>
                <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/40 text-emerald-400 text-xs font-bold uppercase tracking-wider flex items-center space-x-1.5 font-mono">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Licensed Specialist</span>
                </span>
                <span className="px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/40 text-amber-300 text-xs font-bold flex items-center space-x-1.5 font-mono">
                  <Star className="w-3.5 h-3.5 fill-current text-amber-400" />
                  <span>{avgRating} ({reviews.length} Reviews)</span>
                </span>
              </div>
              <p className="text-sm text-zinc-400 font-mono mt-1">
                License: <span className="text-rose-400 font-bold">{physio?.license_number || 'PT-ACTIVE'}</span> | Invite Code:{' '}
                <span className="text-amber-400 font-bold tracking-wider">{physio?.invite_code || '5A1BAA43'}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3.5 relative">
            {/* Notification Bell Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsNotifOpen(!isNotifOpen)}
                className="relative p-3 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-rose-500 text-white text-xs font-extrabold flex items-center justify-center animate-pulse shadow-md">
                    {unreadCount}
                  </span>
                )}
              </button>

              {isNotifOpen && (
                <>
                  {/* Backdrop click outside to close */}
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsNotifOpen(false)}
                  />

                  <div className="absolute right-0 top-14 w-80 md:w-96 bg-zinc-900/95 backdrop-blur-2xl border-2 border-rose-500/50 rounded-3xl shadow-2xl shadow-rose-950 p-5 space-y-4 z-50 animate-fadeIn">
                    <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                      <div className="flex items-center space-x-2">
                        <Bell className="w-5 h-5 text-rose-400" />
                        <span className="text-sm font-extrabold text-white">Clinical Notifications</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs text-rose-400 font-mono bg-rose-950/80 px-2.5 py-0.5 rounded-full border border-rose-500/30 font-bold">
                          {unreadCount} unread
                        </span>
                        {unreadCount > 0 && (
                          <button
                            onClick={async () => {
                              try {
                                await notificationsApi.markAllRead()
                                loadNotifications()
                              } catch {}
                            }}
                            className="text-xs text-zinc-400 hover:text-rose-300 underline font-mono transition"
                          >
                            Mark all read
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="max-h-80 overflow-y-auto space-y-2.5 pr-1">
                      {notifications.length === 0 ? (
                        <div className="p-6 text-center text-sm text-zinc-400">
                          No notifications yet.
                        </div>
                      ) : (
                        [...notifications]
                          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                          .map((n) => (
                            <div
                              key={n.id}
                              onClick={() => openChatForNotification(n)}
                              className={`p-4 rounded-2xl text-xs cursor-pointer transition border ${
                                n.read
                                  ? 'bg-zinc-950/80 border-zinc-800 text-zinc-400 hover:bg-zinc-800/80'
                                  : 'bg-rose-950/60 border-rose-500/40 text-zinc-100 hover:bg-rose-950/90 shadow-md'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-2">
                                  {!n.read && <span className="w-2.5 h-2.5 rounded-full bg-rose-400 animate-ping" />}
                                  <span className="font-bold text-white text-sm">{n.title}</span>
                                </div>
                                <span className="text-xs text-zinc-400 font-mono">
                                  {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                              <p className="text-xs text-zinc-300 mt-1.5 line-clamp-2 leading-relaxed">
                                "{n.message}"
                              </p>
                              <span className="text-xs text-rose-400 font-bold block mt-2 hover:underline">
                                💬 Click to open patient chat &rarr;
                              </span>
                            </div>
                          ))
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            <button
              onClick={() => setIsAppRatingOpen(true)}
              className="px-4 py-2.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/40 text-sm font-bold transition flex items-center space-x-1.5"
            >
              <Star className="w-4 h-4 fill-current text-amber-400" />
              <span>Rate App</span>
            </button>

            <button
              onClick={() => logout()}
              className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-bold transition"
            >
              Sign Out
            </button>
          </div>
        </div>

        {/* 3D Interactive Biomechanical Model & Joint Recovery Inspector */}
        <InteractiveBodyModel3D />

        {/* Section 1: Pending Care Requests Queue */}
        <div className="luminous-glass-card p-7 md:p-9 space-y-5 shadow-2xl border-rose-500/20">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3.5">
            <div className="flex items-center space-x-3">
              <Users className="w-6 h-6 text-amber-400" />
              <h2 className="text-2xl font-extrabold text-white tracking-tight">
                Pending Patient Intake Requests ({pendingRequests.length})
              </h2>
            </div>
            <span className="text-sm text-zinc-400 font-mono">Review &amp; Authorize Connection</span>
          </div>

          {pendingRequests.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {pendingRequests.map((req) => (
                <div
                  key={req.id}
                  className="bg-zinc-950/70 border border-zinc-800 hover:border-rose-500/40 p-6 rounded-3xl space-y-4 transition"
                >
                  <div className="flex items-center space-x-4">
                    <img
                      src={req.patient_picture || `https://api.dicebear.com/7.x/avataaars/svg?seed=${req.patient_name}`}
                      alt={req.patient_name}
                      className="w-14 h-14 rounded-2xl object-cover border border-rose-500/30"
                    />
                    <div>
                      <h3 className="font-extrabold text-base text-white">{req.patient_name}</h3>
                      <span className="text-sm text-rose-400 block font-semibold">
                        Focus: {req.body_area_name || 'General Rehabilitation'}
                      </span>
                      <span className="text-xs text-zinc-500">
                        Method: {req.request_type === 'invite_code' ? 'Direct Invite Code' : 'Matching'}
                      </span>
                    </div>
                  </div>

                  {req.rehab_goal_note && (
                    <p className="text-sm text-zinc-300 bg-zinc-900/80 p-3 rounded-2xl border border-zinc-800 leading-relaxed">
                      "{req.rehab_goal_note}"
                    </p>
                  )}

                  <div className="flex items-center space-x-2.5 pt-2">
                    <button
                      onClick={() => handleAcceptRequest(req.id)}
                      className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold text-sm shadow-md shadow-emerald-500/20 flex items-center justify-center space-x-2 transition"
                    >
                      <Check className="w-4 h-4" />
                      <span>Accept Patient</span>
                    </button>
                    <button
                      onClick={() => handleRejectRequest(req.id)}
                      className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-rose-900/40 text-zinc-400 hover:text-rose-300 font-bold text-sm border border-zinc-700 transition"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-7 text-center text-zinc-400 text-sm bg-zinc-950/40 rounded-2xl border border-zinc-800/60">
              No pending connection requests. Give your invite code (<strong className="text-rose-300 text-base">{physio?.invite_code || '5A1BAA43'}</strong>) to patients to connect.
            </div>
          )}
        </div>

        {/* Section 2: Real Assigned Patients Care Panel */}
        <div className="luminous-glass-card p-7 md:p-9 space-y-5 shadow-2xl border-rose-500/20">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3.5">
            <div className="flex items-center space-x-3">
              <HeartPulse className="w-6 h-6 text-rose-400" />
              <h2 className="text-2xl font-extrabold text-white tracking-tight">Active Assigned Patients ({patients.length})</h2>
            </div>
            <span className="text-sm text-zinc-400 font-mono">Prescribe Routines, Solve Doubts &amp; Monitor Telemetry</span>
          </div>

          {patients.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {patients.map((pat) => (
                <div
                  key={pat.patient_id}
                  className="bg-zinc-950/80 border border-zinc-800 hover:border-rose-500/50 p-7 rounded-3xl space-y-4 transition flex flex-col justify-between shadow-xl"
                >
                  <div>
                    <div className="flex items-center space-x-4 mb-4">
                      <img
                        src={pat.picture || `https://api.dicebear.com/7.x/avataaars/svg?seed=${pat.name}`}
                        alt={pat.name}
                        className="w-15 h-15 rounded-2xl object-cover border-2 border-rose-500/40 shadow-lg shadow-rose-500/20"
                      />
                      <div>
                        <h3 className="font-extrabold text-lg text-white">{pat.name}</h3>
                        <span className="text-sm text-rose-300 font-semibold block">
                          {pat.diagnosis || pat.rehab_goals || 'Rehabilitation Care'}
                        </span>
                        <span className="text-xs text-zinc-400">
                          {pat.age ? `${pat.age} yrs | ` : ''}{pat.mobility_mode === 'wheelchair' ? 'Wheelchair Seated' : 'Active'}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 p-3.5 bg-zinc-900/80 rounded-2xl border border-zinc-800 text-center text-sm font-mono mb-4">
                      <div>
                        <span className="text-xs text-zinc-500 block">Avg Form</span>
                        <span className="font-extrabold text-rose-400 text-base">
                          {pat.avg_form_score ? `${Math.round(pat.avg_form_score)}%` : 'New'}
                        </span>
                      </div>
                      <div>
                        <span className="text-xs text-zinc-500 block">Sessions</span>
                        <span className="font-extrabold text-emerald-400 text-base">{pat.session_count || 0}</span>
                      </div>
                    </div>

                    {pat.emergency_contact && (
                      <div className="text-xs text-zinc-400 border-t border-zinc-800 pt-2.5">
                        Emergency: <span className="text-zinc-200 font-semibold">{pat.emergency_contact.contact_name}</span> ({pat.emergency_contact.contact_phone})
                      </div>
                    )}
                  </div>

                  <div className="space-y-2 pt-4 border-t border-zinc-800">
                    <div className="flex items-center space-x-2.5">
                      <button
                        onClick={() => openPrescriptionStudio(pat)}
                        className="flex-1 py-3 rounded-xl luminous-button-primary font-extrabold text-sm shadow-lg shadow-rose-500/30 flex items-center justify-center space-x-2 transition"
                      >
                        <Sparkles className="w-4 h-4" />
                        <span>Prescribe</span>
                      </button>

                      <button
                        onClick={() => setChatPatient(pat)}
                        className="py-3 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-rose-300 border border-rose-500/40 font-bold text-sm flex items-center space-x-1.5 transition"
                      >
                        <MessageSquare className="w-4 h-4" />
                        <span>Doubts</span>
                      </button>

                      <button
                        onClick={() => navigate(`/physio/patient/${pat.patient_id}`)}
                        className="p-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-9 text-center text-zinc-400 text-sm bg-zinc-950/40 rounded-2xl border border-zinc-800/60 space-y-3">
              <Users className="w-10 h-10 text-rose-500/60 mx-auto" />
              <h3 className="text-base font-extrabold text-zinc-200">No Patients Assigned Yet</h3>
              <p className="max-w-md mx-auto leading-relaxed">
                When a registered patient enters your practitioner invite code (<strong>{physio?.invite_code || '5A1BAA43'}</strong>), their connection request will appear above for instant authorization.
              </p>
            </div>
          )}
        </div>

        {/* Section 3: Patient Feedback & Clinical Reviews Panel */}
        <div className="luminous-glass-card p-7 md:p-9 space-y-5 shadow-2xl border-rose-500/20">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3.5">
            <div className="flex items-center space-x-3">
              <Award className="w-6 h-6 text-amber-400" />
              <h2 className="text-2xl font-extrabold text-white tracking-tight">Clinical Feedback &amp; Ratings ({reviews.length})</h2>
            </div>
            <span className="text-base text-amber-300 font-extrabold font-mono">Rating: {avgRating} ★ / 5.0</span>
          </div>

          {reviews.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {reviews.map((rev) => (
                <div key={rev.id} className="p-6 rounded-3xl bg-zinc-950/80 border border-zinc-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-base text-white">{rev.patient_name || 'Verified Patient'}</span>
                    <div className="flex items-center space-x-1 text-amber-400">
                      {Array.from({ length: rev.rating }).map((_, i) => (
                        <Star key={i} className="w-4 h-4 fill-current" />
                      ))}
                    </div>
                  </div>
                  {rev.comments && (
                    <p className="text-sm text-zinc-300 italic leading-relaxed">"{rev.comments}"</p>
                  )}
                  <div className="flex items-center justify-between text-xs text-zinc-500 font-mono pt-3 border-t border-zinc-800">
                    <span>Satisfaction: {rev.treatment_satisfaction}★ | Responsiveness: {rev.responsiveness}★</span>
                    <span>{new Date(rev.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-7 text-center text-zinc-400 text-sm bg-zinc-950/40 rounded-2xl border border-zinc-800/60">
              No patient feedback submitted yet. Your patient clinical ratings and comments will appear here.
            </div>
          )}
        </div>
      </div>

      {/* AI & 1-Click Prescription Studio Modal */}
      {selectedPatientForRx && (
        <div className="fixed inset-0 z-50 bg-zinc-950/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="relative w-full max-w-4xl bg-zinc-900 border border-rose-500/40 rounded-3xl p-7 md:p-9 shadow-2xl shadow-rose-950/80 space-y-6 my-8">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
              <div>
                <div className="flex items-center space-x-2 text-rose-400 text-xs font-mono font-bold uppercase">
                  <Sparkles className="w-4 h-4" />
                  <span>Clinical Prescription Studio</span>
                </div>
                <h2 className="text-2xl font-extrabold text-white tracking-tight mt-1">
                  Prescribe Plan for {selectedPatientForRx.name}
                </h2>
              </div>
              <button
                onClick={() => setSelectedPatientForRx(null)}
                className="p-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick 1-Click Protocol Presets */}
            <div className="space-y-3">
              <span className="text-sm font-extrabold text-rose-300 uppercase tracking-wider flex items-center space-x-1.5">
                <Zap className="w-4 h-4 text-amber-400" />
                <span>1-Click Clinical Recovery Protocols</span>
              </span>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {PRESET_PROTOCOLS.map((proto, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => applyPreset(proto)}
                    className="p-3.5 rounded-2xl bg-zinc-950 border border-zinc-800 hover:border-rose-500/60 text-left transition hover:bg-rose-950/20 group"
                  >
                    <span className="text-sm font-extrabold text-zinc-200 group-hover:text-rose-300 block">
                      {proto.title.split(' ')[0]} {proto.title.split(' ')[1]}
                    </span>
                    <span className="text-xs text-zinc-500 block truncate mt-0.5">{proto.notes}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-zinc-300 mb-1.5">Plan Title</label>
                  <input
                    type="text"
                    value={rxTitle}
                    onChange={(e) => setRxTitle(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-zinc-950 border border-zinc-700 text-zinc-100 text-sm focus:border-rose-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-zinc-300 mb-1.5">Clinical Instructions &amp; Notes</label>
                  <input
                    type="text"
                    value={rxNotes}
                    onChange={(e) => setRxNotes(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-zinc-950 border border-zinc-700 text-zinc-100 text-sm focus:border-rose-400"
                  />
                </div>
              </div>

              {/* Exercises List */}
              <div className="space-y-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-extrabold text-zinc-300 uppercase tracking-wider">
                    Assigned Exercises ({rxExercises.length})
                  </span>
                  <div className="flex items-center space-x-2.5">
                    <button
                      type="button"
                      onClick={() => handleGenerateAIPrescription(selectedPatientForRx.patient_id)}
                      disabled={isGeneratingAI}
                      className="px-4 py-2 rounded-xl bg-rose-600/20 hover:bg-rose-600/40 text-rose-300 border border-rose-500/40 text-sm font-bold flex items-center space-x-1.5"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>{isGeneratingAI ? 'Generating...' : 'Gemini AI Auto-Plan'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={addDefaultExercise}
                      className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-bold flex items-center space-x-1.5"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add Exercise</span>
                    </button>
                  </div>
                </div>

                <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                  {rxExercises.map((ex, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 flex items-center justify-between gap-3 text-sm"
                    >
                      <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-3 items-center">
                        <select
                          value={ex.exercise_id}
                          onChange={(e) => {
                            const updated = [...rxExercises]
                            updated[idx].exercise_id = e.target.value
                            setRxExercises(updated)
                          }}
                          className="px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-zinc-100 text-sm font-medium"
                        >
                          {allExercises.map((ae) => (
                            <option key={ae.id} value={ae.id}>
                              {ae.name}
                            </option>
                          ))}
                        </select>

                        <div className="flex items-center space-x-2">
                          <span className="text-zinc-400">Sets:</span>
                          <input
                            type="number"
                            min={1}
                            max={10}
                            value={ex.target_sets}
                            onChange={(e) => {
                              const updated = [...rxExercises]
                              updated[idx].target_sets = Number(e.target.value)
                              setRxExercises(updated)
                            }}
                            className="w-16 px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-center font-bold"
                          />
                        </div>

                        <div className="flex items-center space-x-2">
                          <span className="text-zinc-400">Reps:</span>
                          <input
                            type="number"
                            min={1}
                            max={50}
                            value={ex.target_reps}
                            onChange={(e) => {
                              const updated = [...rxExercises]
                              updated[idx].target_reps = Number(e.target.value)
                              setRxExercises(updated)
                            }}
                            className="w-16 px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-center font-bold"
                          />
                        </div>

                        <label className="flex items-center space-x-2 cursor-pointer text-zinc-300">
                          <input
                            type="checkbox"
                            checked={ex.is_seated_adapted}
                            onChange={(e) => {
                              const updated = [...rxExercises]
                              updated[idx].is_seated_adapted = e.target.checked
                              setRxExercises(updated)
                            }}
                            className="rounded bg-zinc-900 border-zinc-700 text-rose-500"
                          />
                          <span>Seated Mode</span>
                        </label>
                      </div>

                      <button
                        onClick={() => removeRxExercise(idx)}
                        className="p-2 rounded-xl bg-zinc-900 hover:bg-rose-950 text-zinc-500 hover:text-rose-400 transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end space-x-3.5 pt-4 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setSelectedPatientForRx(null)}
                className="px-5 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSavePrescription}
                disabled={isSavingRx || rxExercises.length === 0}
                className="luminous-button-primary text-sm font-bold py-3 px-7 shadow-lg transition disabled:opacity-50"
              >
                <Check className="w-4 h-4 mr-1.5" />
                <span>{isSavingRx ? 'Assigning...' : 'Approve & Assign Prescription'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clinical Doubts Chat Modal */}
      {chatPatient && (
        <ClinicalChatModal
          isOpen={Boolean(chatPatient)}
          onClose={() => setChatPatient(null)}
          recipientId={chatPatient.user_id}
          recipientName={chatPatient.name}
          recipientRole="patient"
          patientId={chatPatient.patient_id}
          physioId={physio?.id}
        />
      )}

      {/* App Rating Modal */}
      <AppRatingModal
        isOpen={isAppRatingOpen}
        onClose={() => setIsAppRatingOpen(false)}
      />
    </div>
  )
}
