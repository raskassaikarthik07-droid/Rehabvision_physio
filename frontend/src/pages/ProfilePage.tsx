import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { patientApi } from '../api/client'
import Layout from '../components/Layout'
import Avatar from '../components/Avatar'
import { Mail, Shield, Calendar, Target, CheckCircle2, AlertCircle, Save } from 'lucide-react'

export default function ProfilePage() {
  const { user, refreshUser } = useAuth()
  const isPatient = user?.role === 'patient'

  const [name, setName] = useState(user?.name || '')
  const [phone, setPhone] = useState(user?.phone || '')
  const [age, setAge] = useState<number | ''>(user?.age || '')
  const [diagnosis, setDiagnosis] = useState(user?.diagnosis || '')
  const [rehabGoals, setRehabGoals] = useState(user?.rehab_goals || '')

  const [isEditing, setIsEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setMsg(null)
    try {
      if (isPatient) {
        await patientApi.updateProfile({
          name: name.trim(),
          phone: phone.trim(),
          age: typeof age === 'number' ? age : undefined,
          diagnosis: diagnosis.trim(),
          rehab_goals: rehabGoals.trim(),
        })
      }
      await refreshUser()
      setMsg({ type: 'success', text: 'Profile updated successfully!' })
      setIsEditing(false)
    } catch (err: any) {
      setMsg({ type: 'error', text: err.response?.data?.error || 'Failed to update profile' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Layout>
      <div className="p-6 md:p-8 max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">User Profile & Clinical Identity</h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Secure identity record and rehabilitation metadata
            </p>
          </div>
          {isPatient && !isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="px-4 py-2 bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/30 rounded-xl text-xs font-semibold cursor-pointer transition-all"
            >
              Edit Profile
            </button>
          )}
        </div>

        {msg && (
          <div
            className={`p-4 rounded-2xl flex items-center gap-2.5 text-xs ${
              msg.type === 'success'
                ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/15 border border-rose-500/30 text-rose-300'
            }`}
          >
            {msg.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{msg.text}</span>
          </div>
        )}

        <div className="bg-[#1e293b] border border-[#334155] rounded-3xl p-6 md:p-8 shadow-xl space-y-6">
          <div className="flex items-center gap-5 pb-6 border-b border-slate-700/60">
            <Avatar
              name={user?.name || ''}
              src={user?.picture}
              size="xl"
              role={user?.role === 'physiotherapist' ? 'physiotherapist' : 'patient'}
            />
            <div>
              <h2 className="text-xl font-bold text-white">{user?.name}</h2>
              <p className="text-xs text-slate-400 mt-0.5">{user?.email}</p>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-sky-500/15 text-sky-300 font-bold border border-sky-500/30">
                  {user?.role?.toUpperCase()}
                </span>
                <span className="text-[11px] text-slate-500">
                  ID: {user?.id?.slice(0, 8)}...
                </span>
              </div>
            </div>
          </div>

          {isEditing ? (
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Full Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-900/80 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-sky-500 transition-colors"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Phone Number</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-900/80 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-sky-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Age</label>
                  <input
                    type="number"
                    min={5}
                    max={120}
                    value={age}
                    onChange={(e) => setAge(e.target.value ? parseInt(e.target.value) : '')}
                    className="w-full px-4 py-3 bg-slate-900/80 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-sky-500 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Clinical Diagnosis</label>
                <input
                  type="text"
                  value={diagnosis}
                  onChange={(e) => setDiagnosis(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-900/80 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-sky-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Rehabilitation Goals</label>
                <textarea
                  rows={3}
                  value={rehabGoals}
                  onChange={(e) => setRehabGoals(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-900/80 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-sky-500 transition-colors"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 text-slate-400 hover:text-white text-xs font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-1.5 px-5 py-2.5 bg-sky-500 hover:bg-sky-400 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  {saving ? 'Saving...' : 'Save Profile'}
                </button>
              </div>
            </form>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center gap-3 p-4 bg-slate-900/60 rounded-2xl border border-slate-800">
                <Mail className="w-5 h-5 text-sky-400 shrink-0" />
                <div>
                  <p className="text-[11px] font-semibold text-slate-400">Account Email</p>
                  <p className="text-white text-sm font-medium">{user?.email}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 bg-slate-900/60 rounded-2xl border border-slate-800">
                <Shield className="w-5 h-5 text-cyan-400 shrink-0" />
                <div>
                  <p className="text-[11px] font-semibold text-slate-400">Security Role</p>
                  <p className="text-white text-sm font-medium capitalize">{user?.role}</p>
                </div>
              </div>

              {isPatient ? (
                <>
                  <div className="flex items-center gap-3 p-4 bg-slate-900/60 rounded-2xl border border-slate-800">
                    <Calendar className="w-5 h-5 text-emerald-400 shrink-0" />
                    <div>
                      <p className="text-[11px] font-semibold text-slate-400">Age & Gender</p>
                      <p className="text-white text-sm font-medium">
                        {user?.age ? `${user.age} years` : 'Not set'} &bull; {user?.gender || 'Not specified'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-4 bg-slate-900/60 rounded-2xl border border-slate-800">
                    <Target className="w-5 h-5 text-amber-400 shrink-0" />
                    <div>
                      <p className="text-[11px] font-semibold text-slate-400">Diagnosis Focus</p>
                      <p className="text-white text-sm font-medium truncate max-w-[200px]">
                        {user?.diagnosis || 'General Physical Therapy'}
                      </p>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-3 p-4 bg-slate-900/60 rounded-2xl border border-slate-800">
                    <Shield className="w-5 h-5 text-emerald-400 shrink-0" />
                    <div>
                      <p className="text-[11px] font-semibold text-slate-400">Speciality</p>
                      <p className="text-white text-sm font-medium">
                        {user?.speciality || 'Physical Therapy Specialist'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-4 bg-slate-900/60 rounded-2xl border border-slate-800">
                    <Target className="w-5 h-5 text-cyan-400 shrink-0" />
                    <div>
                      <p className="text-[11px] font-semibold text-slate-400">License Number</p>
                      <p className="text-white text-sm font-medium">
                        {user?.license_number || 'PT-LIC-2026'}
                      </p>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          <div className="p-4 bg-slate-800/40 border border-slate-700/60 rounded-2xl text-slate-400 text-xs">
            ⚕️ RehabVision is an AI-assisted movement tracking system. Patient data is encrypted and accessible strictly by assigned healthcare providers.
          </div>
        </div>
      </div>
    </Layout>
  )
}
