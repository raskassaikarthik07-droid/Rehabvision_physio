import React, { useState, useEffect, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Activity, Lock, Mail, ArrowRight, UserCheck, Stethoscope, Sparkles, Heart, Zap, Shield } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { Rehab3DBackground } from '../components/3d/Rehab3DBackground'

// ─── Live Animated Canvas Wallpaper ─────────────────────────────────────────
const LiveWallpaper: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animId: number
    let t = 0

    const particles = Array.from({ length: 80 }, () => ({
      x: Math.random() * 800,
      y: Math.random() * 900,
      r: Math.random() * 2.5 + 0.5,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      alpha: Math.random() * 0.7 + 0.2,
      color: Math.random() > 0.5 ? '#ff3366' : '#ffaa00',
    }))

    const resize = () => {
      canvas.width = canvas.clientWidth || 800
      canvas.height = canvas.clientHeight || 900
      particles.forEach((p) => {
        p.x = Math.random() * canvas.width
        p.y = Math.random() * canvas.height
      })
    }
    resize()
    window.addEventListener('resize', resize)

    const draw = () => {
      t += 0.012
      const W = canvas.width
      const H = canvas.height

      ctx.clearRect(0, 0, W, H)

      // Dark obsidian bg
      const bg = ctx.createLinearGradient(0, 0, W, H)
      bg.addColorStop(0, '#0a0005')
      bg.addColorStop(0.5, '#12000a')
      bg.addColorStop(1, '#050010')
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, W, H)

      // Animated grid lines
      ctx.lineWidth = 1
      for (let x = 0; x < W; x += 60) {
        ctx.beginPath()
        ctx.strokeStyle = 'rgba(255,51,102,0.05)'
        ctx.moveTo(x + Math.sin(t + x * 0.01) * 5, 0)
        ctx.lineTo(x + Math.sin(t + x * 0.01) * 5, H)
        ctx.stroke()
      }
      for (let y = 0; y < H; y += 60) {
        ctx.beginPath()
        ctx.strokeStyle = 'rgba(255,170,0,0.04)'
        ctx.moveTo(0, y + Math.cos(t + y * 0.01) * 5)
        ctx.lineTo(W, y + Math.cos(t + y * 0.01) * 5)
        ctx.stroke()
      }

      // Pulse rings
      for (let i = 0; i < 4; i++) {
        const phase = (t * 0.5 + i * 0.85) % 3
        const radius = phase * Math.min(W, H) * 0.45
        const alpha = Math.max(0, 1 - phase / 3) * 0.2
        ctx.beginPath()
        ctx.arc(W * 0.5, H * 0.45, radius, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(255,51,102,${alpha})`
        ctx.lineWidth = 2
        ctx.stroke()
      }

      // Particles
      particles.forEach((p) => {
        p.x += p.vx
        p.y += p.vy
        if (p.x < 0) p.x = W
        if (p.x > W) p.x = 0
        if (p.y < 0) p.y = H
        if (p.y > H) p.y = 0
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = p.color + Math.floor(p.alpha * 255).toString(16).padStart(2, '0')
        ctx.shadowColor = p.color
        ctx.shadowBlur = 8
        ctx.fill()
        ctx.shadowBlur = 0
      })

      // EKG waveform
      ctx.beginPath()
      ctx.strokeStyle = '#ff3366'
      ctx.shadowColor = '#ff3366'
      ctx.shadowBlur = 10
      ctx.lineWidth = 2.5
      for (let x = 0; x < W; x++) {
        const pct = x / W
        let y = H * 0.82
        if (pct > 0.36 && pct < 0.41)
          y -= 38 * Math.sin(((pct - 0.36) / 0.05) * Math.PI)
        else if (pct > 0.41 && pct < 0.47)
          y += 16 * Math.sin(((pct - 0.41) / 0.06) * Math.PI)
        else if (pct > 0.62 && pct < 0.67)
          y -= 12 * Math.sin(((pct - 0.62) / 0.05) * Math.PI)
        else
          y += Math.sin(pct * 6 * Math.PI + t * 4) * 3
        if (x === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()
      ctx.shadowBlur = 0

      // Floating metric labels
      const labels = [
        { text: 'KNEE ROM: 142°',     x: W * 0.08, y: H * 0.15 },
        { text: 'CVA: 52°',           x: W * 0.62, y: H * 0.22 },
        { text: 'FORM SCORE: 94%',    x: W * 0.07, y: H * 0.56 },
        { text: 'SESSION: SET 2/3',   x: W * 0.54, y: H * 0.63 },
        { text: 'REPS: 7 / 10',       x: W * 0.20, y: H * 0.72 },
      ]
      labels.forEach(({ text, x, y }, i) => {
        const pulse = Math.sin(t * 1.1 + i * 1.3) * 0.15 + 0.72
        ctx.globalAlpha = pulse
        ctx.font = 'bold 11px "Space Grotesk", monospace'
        ctx.fillStyle = '#ff758c'
        ctx.fillText(text, x, y)
        ctx.globalAlpha = 1
      })

      // Center brand
      ctx.textAlign = 'center'
      ctx.font = 'bold 42px "Outfit", sans-serif'
      const grad = ctx.createLinearGradient(W * 0.5 - 110, 0, W * 0.5 + 110, 0)
      grad.addColorStop(0, '#ff3366')
      grad.addColorStop(1, '#ffaa00')
      ctx.fillStyle = grad
      ctx.shadowColor = '#ff336699'
      ctx.shadowBlur = 24
      ctx.fillText('RehabVision', W * 0.5, H * 0.43)
      ctx.shadowBlur = 0
      ctx.font = '13px "Plus Jakarta Sans", sans-serif'
      ctx.fillStyle = 'rgba(255,255,255,0.4)'
      ctx.fillText('AI-Powered Physiotherapy Platform', W * 0.5, H * 0.48)
      ctx.textAlign = 'left'

      animId = requestAnimationFrame(draw)
    }

    draw()
    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
}

// ─── Login Page ───────────────────────────────────────────────────────────────
export const LoginPage: React.FC = () => {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'patient' | 'physiotherapist'>('patient')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const loggedUser = await login({ identifier: identifier.trim(), password, role })
      if (loggedUser?.role === 'physiotherapist') {
        navigate('/physio/dashboard', { replace: true })
      } else {
        navigate('/patient/dashboard', { replace: true })
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Invalid credentials. Please verify and try again.')
    } finally {
      setLoading(false)
    }
  }

  const fillCredentials = (id: string, pass: string, r: 'patient' | 'physiotherapist') => {
    setIdentifier(id)
    setPassword(pass)
    setRole(r)
  }

  return (
    <div className="relative min-h-screen w-full flex overflow-hidden bg-zinc-950 selection:bg-rose-500 selection:text-white">

      {/* ── LEFT: Live Wallpaper Panel (hidden on small screens) ── */}
      <div className="hidden lg:flex relative flex-1 overflow-hidden">
        <LiveWallpaper />
        <Rehab3DBackground />
        {/* Bottom chips */}
        <div className="absolute bottom-10 left-0 right-0 flex justify-center gap-4 z-20 pointer-events-none">
          {[
            { icon: <Heart className="w-4 h-4" />, label: 'Live AI Analysis' },
            { icon: <Zap className="w-4 h-4" />, label: 'Real-time Tracking' },
            { icon: <Shield className="w-4 h-4" />, label: 'Clinical Grade' },
          ].map(({ icon, label }) => (
            <div key={label} className="flex items-center space-x-2 px-4 py-2 rounded-full bg-zinc-950/70 border border-rose-500/30 text-rose-300 text-xs font-bold backdrop-blur-md">
              {icon}<span>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── RIGHT: Login Card Panel ───────────────────────────── */}
      <div className="relative w-full lg:w-[540px] xl:w-[600px] flex items-center justify-center bg-zinc-950 border-l border-rose-500/20 z-10 p-8 md:p-14 lg:p-12 xl:p-16">
        <div className="absolute inset-0 bg-gradient-to-br from-rose-950/15 via-zinc-950 to-zinc-950 pointer-events-none" />

        {/* On mobile, show Rehab3D as background */}
        <div className="absolute inset-0 lg:hidden opacity-30 pointer-events-none">
          <Rehab3DBackground />
        </div>

        <div className="relative w-full max-w-md space-y-7">
          {/* Brand Header */}
          <div className="text-center space-y-3">
            <div className="inline-flex items-center space-x-2 px-4 py-1.5 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-mono font-bold">
              <Activity className="w-4 h-4 text-rose-400 animate-pulse" />
              <span>CLINICAL REHABILITATION PORTAL</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-white leading-tight">
              Welcome<br />
              <span className="bg-gradient-to-r from-rose-400 to-amber-400 bg-clip-text text-transparent">Back</span>
            </h1>
            <p className="text-zinc-400 text-sm">Sign in to your RehabVision account</p>
          </div>

          {/* Role Toggle */}
          <div className="grid grid-cols-2 gap-2 p-1.5 bg-zinc-900/80 rounded-2xl border border-zinc-800">
            <button
              type="button"
              onClick={() => setRole('patient')}
              className={`py-3 rounded-xl font-bold text-sm transition flex items-center justify-center space-x-2 ${
                role === 'patient'
                  ? 'bg-gradient-to-r from-rose-500 to-red-600 text-white shadow-md shadow-rose-500/30'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <UserCheck className="w-4 h-4" />
              <span>Patient Portal</span>
            </button>
            <button
              type="button"
              onClick={() => setRole('physiotherapist')}
              className={`py-3 rounded-xl font-bold text-sm transition flex items-center justify-center space-x-2 ${
                role === 'physiotherapist'
                  ? 'bg-gradient-to-r from-rose-500 to-red-600 text-white shadow-md shadow-rose-500/30'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Stethoscope className="w-4 h-4" />
              <span>Physiotherapist</span>
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm font-medium">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-zinc-300 mb-2">
                {role === 'physiotherapist' ? 'Email or License ID' : 'Email Address'}
              </label>
              <div className="relative">
                <Mail className="w-5 h-5 text-zinc-400 absolute left-4 top-3.5" />
                <input
                  type="text"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder={role === 'physiotherapist' ? 'License ID or email' : 'e.g. raskas.saikarthik@klh.edu.in'}
                  className="w-full pl-12 pr-4 py-3.5 rounded-xl bg-zinc-900 border border-zinc-700 text-zinc-100 text-sm focus:outline-none focus:border-rose-400 transition placeholder:text-zinc-600"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-zinc-300 mb-2">Password</label>
              <div className="relative">
                <Lock className="w-5 h-5 text-zinc-400 absolute left-4 top-3.5" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-12 pr-4 py-3.5 rounded-xl bg-zinc-900 border border-zinc-700 text-zinc-100 text-sm focus:outline-none focus:border-rose-400 transition placeholder:text-zinc-600"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-rose-500 via-red-500 to-rose-600 hover:from-rose-400 hover:to-red-500 text-white py-4 rounded-xl font-extrabold text-base flex items-center justify-center space-x-2 shadow-xl shadow-rose-500/30 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span>{loading ? 'Authenticating...' : 'Sign In to Portal'}</span>
              <ArrowRight className="w-5 h-5" />
            </button>
          </form>

          {/* Quick Test Credentials */}
          <div className="pt-4 border-t border-zinc-800 space-y-3">
            <span className="text-xs font-mono text-zinc-400 uppercase font-bold flex items-center space-x-1.5">
              <Sparkles className="w-3.5 h-3.5 text-rose-400" />
              <span>1-Click Test Access:</span>
            </span>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => fillCredentials('priya.reddy@rehabvision.io', '@1234', 'physiotherapist')}
                className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-rose-500/50 text-zinc-300 hover:text-rose-300 text-left transition"
              >
                <strong className="block text-white text-sm">Dr. Priya Reddy</strong>
                <span className="text-xs text-zinc-500 font-mono">Physiotherapist</span>
              </button>
              <button
                type="button"
                onClick={() => fillCredentials('raskas.saikarthik@klh.edu.in', 'Password123!', 'patient')}
                className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-rose-500/50 text-zinc-300 hover:text-rose-300 text-left transition"
              >
                <strong className="block text-white text-sm">Sai Karthik</strong>
                <span className="text-xs text-zinc-500 font-mono">Patient</span>
              </button>
            </div>
          </div>

          <div className="text-center text-sm text-zinc-400">
            New to RehabVision?{' '}
            <Link to="/register" className="text-rose-400 hover:text-rose-300 font-bold underline">
              Create an Account
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

