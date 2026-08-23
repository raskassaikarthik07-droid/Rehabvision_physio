import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, KeyRound, Stethoscope, ArrowRight, CheckCircle2, Clock, XCircle, AlertCircle, Sparkles } from 'lucide-react'
import { referenceApi, requestsApi } from '../api/client'
import { Rehab3DBackground } from '../components/3d/Rehab3DBackground'

export const PhysioConnectPage: React.FC = () => {
  const navigate = useNavigate()
  const [tab, setTab] = useState<'invite_code' | 'directory'>('invite_code')
  const [inviteCode, setInviteCode] = useState('')
  const [specializations, setSpecializations] = useState<Array<{ id: string; name: string; display_name: string }>>([])
  const [selectedSpec, setSelectedSpec] = useState('')
  const [physios, setPhysios] = useState<any[]>([])
  const [myRequests, setMyRequests] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [rehabGoalNote, setRehabGoalNote] = useState('')

  useEffect(() => {
    loadData()
  }, [selectedSpec])

  const loadData = async () => {
    try {
      const [specRes, reqRes] = await Promise.all([
        referenceApi.getSpecializations(),
        requestsApi.listPatientRequests(),
      ])
      setSpecializations(specRes.data.specializations || [])
      setMyRequests(reqRes.data.requests || [])

      const physioRes = await referenceApi.searchPhysiotherapists({
        specialization: selectedSpec || undefined,
      })
      setPhysios(physioRes.data.physiotherapists || [])
    } catch (e) {}
  }

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inviteCode.trim()) return
    setError(null)
    setSuccess(null)
    setLoading(true)

    try {
      await requestsApi.create({
        request_type: 'invite_code',
        invite_code: inviteCode.trim(),
        rehab_goal_note: rehabGoalNote,
      })
      setSuccess('Connection request sent successfully to your physiotherapist!')
      setInviteCode('')
      setRehabGoalNote('')
      loadData()
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to submit request. Please check invite code.')
    } finally {
      setLoading(false)
    }
  }

  const handleDirectoryRequest = async (physioId: string) => {
    setError(null)
    setSuccess(null)
    setLoading(true)

    try {
      await requestsApi.create({
        physio_id: physioId,
        request_type: 'matching',
        rehab_goal_note: rehabGoalNote,
      })
      setSuccess('Connection request submitted! Your specialist will review and accept shortly.')
      loadData()
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to submit request.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8">
      <Rehab3DBackground />

      <div className="max-w-4xl mx-auto space-y-8 relative z-10">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/80 backdrop-blur-xl border border-cyan-500/30 p-6 rounded-3xl shadow-xl shadow-cyan-950/40">
          <div>
            <div className="flex items-center space-x-2 text-cyan-400 text-xs font-mono font-semibold uppercase mb-1">
              <Stethoscope className="w-4 h-4" />
              <span>Clinical Care Connection</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-white">
              Connect With Your Physiotherapist
            </h1>
            <p className="text-slate-400 text-xs md:text-sm mt-0.5">
              Connect via practitioner invite code or discover matching specialists by rehabilitation goal.
            </p>
          </div>
          <button
            onClick={() => navigate('/patient/dashboard')}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition self-start md:self-auto"
          >
            Back to Dashboard
          </button>
        </div>

        {/* Alerts */}
        {error && (
          <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        {/* Existing Requests Section */}
        {myRequests.length > 0 && (
          <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 p-5 rounded-3xl space-y-3">
            <h2 className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-400">
              Your Active Connection Requests ({myRequests.length})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {myRequests.map((req) => (
                <div
                  key={req.id}
                  className="bg-slate-950/70 border border-slate-800/80 p-3.5 rounded-2xl flex items-center justify-between"
                >
                  <div>
                    <span className="text-sm font-bold text-slate-100 block">
                      {req.physio_name || 'Assigned Specialist'}
                    </span>
                    <span className="text-xs text-slate-400">
                      Method: {req.request_type === 'invite_code' ? 'Direct Code' : 'Specialist Matching'}
                    </span>
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wider flex items-center space-x-1 ${
                      req.status === 'accepted'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                        : req.status === 'pending'
                        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                        : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                    }`}
                  >
                    {req.status === 'accepted' ? (
                      <CheckCircle2 className="w-3 h-3" />
                    ) : req.status === 'pending' ? (
                      <Clock className="w-3 h-3 animate-spin-slow" />
                    ) : (
                      <XCircle className="w-3 h-3" />
                    )}
                    <span>{req.status}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Flow Tabs */}
        <div className="grid grid-cols-2 gap-3 p-1.5 bg-slate-900/80 backdrop-blur-md rounded-2xl border border-slate-800">
          <button
            onClick={() => setTab('invite_code')}
            className={`flex items-center justify-center space-x-2 py-3 rounded-xl font-semibold text-sm transition ${
              tab === 'invite_code'
                ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/25'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <KeyRound className="w-4 h-4" />
            <span>Option A: Enter Physio Invite Code</span>
          </button>
          <button
            onClick={() => setTab('directory')}
            className={`flex items-center justify-center space-x-2 py-3 rounded-xl font-semibold text-sm transition ${
              tab === 'directory'
                ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/25'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Search className="w-4 h-4" />
            <span>Option B: Request By Specialization</span>
          </button>
        </div>

        {/* Tab 1: Invite Code Form */}
        {tab === 'invite_code' && (
          <div className="bg-slate-900/70 backdrop-blur-xl border border-cyan-500/20 p-6 md:p-8 rounded-3xl shadow-xl space-y-5">
            <div className="flex items-center space-x-2 text-cyan-400 font-bold text-base">
              <KeyRound className="w-5 h-5" />
              <span>Direct Practitioner Code</span>
            </div>
            <p className="text-xs text-slate-400">
              If your physiotherapist gave you an 8-character connection code (e.g. <span className="font-mono text-cyan-300">5A1BAA43</span>), enter it below.
            </p>

            <form onSubmit={handleInviteSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  8-Character Invite Code
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 5A1BAA43"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                  className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-700 text-cyan-300 font-mono font-bold tracking-widest text-base focus:outline-none focus:border-cyan-400 uppercase"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Personal Note or Rehab Context (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Need post-op ACL knee rehab guidance..."
                  value={rehabGoalNote}
                  onChange={(e) => setRehabGoalNote(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-slate-200 text-sm focus:outline-none focus:border-cyan-400"
                />
              </div>

              <button
                type="submit"
                disabled={loading || !inviteCode.trim()}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-sm shadow-lg shadow-cyan-500/25 flex items-center justify-center space-x-2 transition disabled:opacity-50"
              >
                <span>{loading ? 'Sending Request...' : 'Send Connection Request'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>
        )}

        {/* Tab 2: Specialist Matching Directory */}
        {tab === 'directory' && (
          <div className="space-y-5">
            <div className="flex items-center space-x-2 overflow-x-auto pb-2 scrollbar-none">
              <button
                onClick={() => setSelectedSpec('')}
                className={`px-3 py-1.5 rounded-full text-xs font-medium shrink-0 transition ${
                  selectedSpec === ''
                    ? 'bg-cyan-500 text-slate-950 font-bold shadow-md shadow-cyan-500/30'
                    : 'bg-slate-900 text-slate-300 border border-slate-800 hover:bg-slate-800'
                }`}
              >
                All Specialists
              </button>
              {specializations.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSelectedSpec(s.name)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium shrink-0 transition ${
                    selectedSpec === s.name
                      ? 'bg-cyan-500 text-slate-950 font-bold shadow-md shadow-cyan-500/30'
                      : 'bg-slate-900 text-slate-300 border border-slate-800 hover:bg-slate-800'
                  }`}
                >
                  {s.display_name}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {physios.map((ph) => (
                <div
                  key={ph.id}
                  className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 hover:border-cyan-500/40 p-5 rounded-3xl space-y-4 transition shadow-lg"
                >
                  <div className="flex items-center space-x-3.5">
                    <img
                      src={ph.user?.picture || `https://api.dicebear.com/7.x/avataaars/svg?seed=${ph.user?.name}`}
                      alt={ph.user?.name}
                      className="w-14 h-14 rounded-2xl object-cover border border-cyan-500/30"
                    />
                    <div>
                      <h3 className="font-bold text-base text-white">{ph.user?.name}</h3>
                      <span className="text-xs text-cyan-400 font-medium block">{ph.speciality}</span>
                      <span className="text-[11px] text-slate-500">License: {ph.license_number}</span>
                    </div>
                  </div>

                  {ph.bio && (
                    <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">{ph.bio}</p>
                  )}

                  {ph.specializations?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {ph.specializations.map((sp: any) => (
                        <span
                          key={sp.id}
                          className="px-2 py-0.5 rounded-md bg-cyan-950/70 border border-cyan-500/20 text-cyan-300 text-[10px] font-medium"
                        >
                          {sp.display_name}
                        </span>
                      ))}
                    </div>
                  )}

                  <button
                    onClick={() => handleDirectoryRequest(ph.id)}
                    disabled={loading}
                    className="w-full py-2.5 rounded-xl bg-cyan-600/30 hover:bg-cyan-500 text-cyan-300 hover:text-slate-950 border border-cyan-500/40 font-bold text-xs flex items-center justify-center space-x-1.5 transition disabled:opacity-50"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Request Care with Dr. {ph.user?.name?.split(' ')[1] || ph.user?.name}</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
