import React, { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Activity, User, Stethoscope, ArrowRight } from 'lucide-react'
import { referenceApi } from '../api/client'
import { useAuth } from '../contexts/AuthContext'
import { CameraSnapshot } from '../components/CameraSnapshot'
import { Rehab3DBackground } from '../components/3d/Rehab3DBackground'

export const RegisterPage: React.FC = () => {
  const navigate = useNavigate()
  const { register } = useAuth()
  const [role, setRole] = useState<'patient' | 'physiotherapist'>('patient')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reference data
  const [bodyAreas, setBodyAreas] = useState<Array<{ id: string; name: string; display_name: string }>>([])
  const [specializations, setSpecializations] = useState<Array<{ id: string; name: string; display_name: string }>>([])

  // Form State
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [phone, setPhone] = useState('')
  const [picture, setPicture] = useState('')

  // Patient Fields
  const [age, setAge] = useState<number>(32)
  const [gender, setGender] = useState('Male')
  const [bodyAreaId, setBodyAreaId] = useState('')
  const [mobilityMode, setMobilityMode] = useState('standard')
  const [rehabGoals, setRehabGoals] = useState('')
  const [emergencyName, setEmergencyName] = useState('')
  const [emergencyPhone, setEmergencyPhone] = useState('')
  const [emergencyRelation, setEmergencyRelation] = useState('Spouse')

  // Physio Fields
  const [speciality, setSpeciality] = useState('')
  const [licenseNumber, setLicenseNumber] = useState('')
  const [bio, setBio] = useState('')
  const [selectedSpecs, setSelectedSpecs] = useState<string[]>([])

  useEffect(() => {
    referenceApi.getBodyAreas().then((res) => {
      setBodyAreas(res.data.body_areas || [])
      if (res.data.body_areas?.length > 0) {
        setBodyAreaId(res.data.body_areas[0].id)
      }
    }).catch(() => {})

    referenceApi.getSpecializations().then((res) => {
      setSpecializations(res.data.specializations || [])
    }).catch(() => {})
  }, [])

  const toggleSpec = (specName: string) => {
    if (selectedSpecs.includes(specName)) {
      setSelectedSpecs(selectedSpecs.filter((s) => s !== specName))
    } else {
      setSelectedSpecs([...selectedSpecs, specName])
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const payload: any = {
        email,
        password,
        name,
        phone,
        picture,
        role,
      }

      if (role === 'patient') {
        payload.age = Number(age)
        payload.gender = gender
        payload.body_area_id = bodyAreaId || undefined
        payload.mobility_mode = mobilityMode
        payload.rehab_goals = rehabGoals
        payload.emergency_contact_name = emergencyName
        payload.emergency_contact_phone = emergencyPhone
        payload.emergency_relationship = emergencyRelation
      } else {
        payload.speciality = speciality || 'Senior Rehabilitation Specialist'
        payload.license_number = licenseNumber
        payload.bio = bio
        payload.specialization_names = selectedSpecs
      }

      const loggedUser = await register(payload)

      if (loggedUser?.role === 'physiotherapist') {
        navigate('/physio/dashboard', { replace: true })
      } else {
        navigate('/patient/dashboard', { replace: true })
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Registration failed. Please check your details.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen luminous-mesh-bg text-slate-100 flex items-center justify-center p-4 md:p-8 overflow-x-hidden">
      <Rehab3DBackground />

      <div className="relative w-full max-w-2xl luminous-glass-card p-6 md:p-10 z-10 my-8 border border-cyan-500/30 shadow-2xl shadow-cyan-950/80">
        {/* Header Branding */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="flex items-center space-x-2 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-300 text-[11px] font-mono font-bold mb-3">
            <Activity className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
            <span>CLINICAL ONBOARDING &bull; REHABVISION</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">
            Create Your Clinical Account
          </h1>
          <p className="text-zinc-400 text-xs mt-1">
            Precision tele-rehabilitation powered by real-time computer vision AI
          </p>
        </div>

        {/* Role Toggle Selector */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-zinc-950/80 rounded-2xl border border-zinc-800 mb-6">
          <button
            type="button"
            onClick={() => setRole('patient')}
            className={`flex items-center justify-center space-x-2 py-2.5 rounded-xl font-bold text-xs transition ${
              role === 'patient'
                ? 'bg-gradient-to-r from-rose-500 to-red-600 text-white font-extrabold shadow-md shadow-rose-500/30'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <User className="w-4 h-4" />
            <span>Patient Portal</span>
          </button>
          <button
            type="button"
            onClick={() => setRole('physiotherapist')}
            className={`flex items-center justify-center space-x-2 py-2.5 rounded-xl font-bold text-xs transition ${
              role === 'physiotherapist'
                ? 'bg-gradient-to-r from-rose-500 to-red-600 text-white font-extrabold shadow-md shadow-rose-500/30'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Stethoscope className="w-4 h-4" />
            <span>Physiotherapist</span>
          </button>
        </div>

        {error && (
          <div className="mb-6 p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-medium animate-fadeIn">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Photo Snapshot & Core Credentials */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center bg-zinc-950/60 p-5 rounded-2xl border border-zinc-800">
            <CameraSnapshot
              onCapture={(dataUrl) => setPicture(dataUrl)}
              initialImage={picture}
              label="Live Profile Photo Snapshot"
            />

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-zinc-300 uppercase tracking-wider mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sarah Jenkins"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-zinc-100 text-xs focus:outline-none focus:border-rose-400 transition"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-zinc-300 uppercase tracking-wider mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  placeholder="sarah@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-zinc-100 text-xs focus:outline-none focus:border-rose-400 transition"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-zinc-300 uppercase tracking-wider mb-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  placeholder="+91 98765 43210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-zinc-100 text-xs focus:outline-none focus:border-rose-400 transition"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-zinc-300 uppercase tracking-wider mb-1">
                  Password
                </label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-zinc-100 text-xs focus:outline-none focus:border-rose-400 transition"
                />
              </div>
            </div>
          </div>

          {/* Role-Specific Configuration Fields */}
          {role === 'patient' ? (
            <div className="space-y-4 bg-zinc-950/60 p-5 rounded-2xl border border-zinc-800">
              <span className="text-xs font-mono text-rose-400 uppercase font-bold tracking-wider block">
                Clinical Profile &amp; Mobility Adaptation
              </span>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] text-zinc-400 mb-1">Age</label>
                  <input
                    type="number"
                    min={10}
                    max={100}
                    value={age}
                    onChange={(e) => setAge(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-xs text-zinc-100"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-zinc-400 mb-1">Gender</label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-xs text-zinc-100"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] text-zinc-400 mb-1">Mobility Mode</label>
                  <select
                    value={mobilityMode}
                    onChange={(e) => setMobilityMode(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-xs text-zinc-100"
                  >
                    <option value="standard">Standard Standing</option>
                    <option value="wheelchair">Wheelchair Seated</option>
                    <option value="seated_only">Seated Only</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] text-zinc-400 mb-1">Primary Injury Focus Area</label>
                <select
                  value={bodyAreaId}
                  onChange={(e) => setBodyAreaId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-xs text-zinc-100"
                >
                  {bodyAreas.map((ba) => (
                    <option key={ba.id} value={ba.id}>
                      {ba.display_name || ba.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] text-zinc-400 mb-1">Rehabilitation Goals &amp; Diagnosis</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Post-op ACL reconstruction, restore knee extension ROM."
                  value={rehabGoals}
                  onChange={(e) => setRehabGoals(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-xs text-zinc-100 resize-none"
                />
              </div>

              {/* Emergency Contact */}
              <div className="pt-3 border-t border-zinc-800 grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] text-zinc-400 mb-1">Emergency Contact Name</label>
                  <input
                    type="text"
                    placeholder="Contact Name"
                    value={emergencyName}
                    onChange={(e) => setEmergencyName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-xs text-zinc-100"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-zinc-400 mb-1">Emergency Phone</label>
                  <input
                    type="tel"
                    placeholder="+91 98765 00000"
                    value={emergencyPhone}
                    onChange={(e) => setEmergencyPhone(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-xs text-zinc-100"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-zinc-400 mb-1">Relationship</label>
                  <input
                    type="text"
                    placeholder="e.g. Spouse / Parent"
                    value={emergencyRelation}
                    onChange={(e) => setEmergencyRelation(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-xs text-zinc-100"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4 bg-zinc-950/60 p-5 rounded-2xl border border-zinc-800">
              <span className="text-xs font-mono text-rose-400 uppercase font-bold tracking-wider block">
                Practitioner Credentials &amp; Specializations
              </span>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-zinc-400 mb-1">Medical License / Practitioner ID</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. PT-98234 or 2510030295"
                    value={licenseNumber}
                    onChange={(e) => setLicenseNumber(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-xs text-zinc-100"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-zinc-400 mb-1">Clinical Title / Specialty</label>
                  <input
                    type="text"
                    placeholder="e.g. Senior Orthopedic Specialist"
                    value={speciality}
                    onChange={(e) => setSpeciality(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-xs text-zinc-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] text-zinc-400 mb-1.5">Specializations</label>
                <div className="flex flex-wrap gap-2">
                  {specializations.map((spec) => {
                    const active = selectedSpecs.includes(spec.name)
                    return (
                      <button
                        key={spec.id}
                        type="button"
                        onClick={() => toggleSpec(spec.name)}
                        className={`px-3 py-1 rounded-xl text-xs font-semibold border transition ${
                          active
                            ? 'bg-rose-500/20 border-rose-500 text-rose-300'
                            : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        {spec.display_name || spec.name}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <label className="block text-[11px] text-zinc-400 mb-1">Clinical Bio &amp; Practice Focus</label>
                <textarea
                  rows={2}
                  placeholder="Tell patients about your clinical experience and telemetry supervision methodology..."
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-xs text-zinc-100 resize-none"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full luminous-button-primary py-3.5 font-bold text-xs flex items-center justify-center space-x-2 transition disabled:opacity-50"
          >
            <span>{loading ? 'Creating Account...' : 'Complete Registration & Enter'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="mt-6 text-center text-xs text-zinc-400">
          Already have an account?{' '}
          <Link to="/login" className="text-rose-400 hover:text-rose-300 font-semibold underline">
            Sign In Here
          </Link>
        </div>
      </div>
    </div>
  )
}
