import { Link, useNavigate } from 'react-router-dom'
import {
  Activity, ArrowRight, ShieldCheck, Sparkles, Stethoscope, Play,
  MessageSquare, CheckCircle, ChevronRight,
  Lock, Eye
} from 'lucide-react'
import { Rehab3DBackground } from '../components/3d/Rehab3DBackground'

export default function LandingPage() {
  const navigate = useNavigate()

  return (
    <div className="relative min-h-screen luminous-mesh-bg text-zinc-100 selection:bg-rose-500 selection:text-white overflow-x-hidden">
      <Rehab3DBackground />

      {/* Luminous Labs Header Navigation Bar */}
      <nav className="sticky top-0 z-50 bg-zinc-950/75 backdrop-blur-2xl border-b border-white/[0.08] px-6 lg:px-12 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-rose-500 via-red-500 to-amber-500 p-0.5 shadow-lg shadow-rose-500/25 flex items-center justify-center">
              <div className="w-full h-full bg-zinc-950 rounded-2xl flex items-center justify-center">
                <Activity className="w-5 h-5 text-rose-500 animate-pulse" />
              </div>
            </div>
            <div>
              <span className="font-extrabold text-lg tracking-tight text-white flex items-center gap-1.5">
                RehabVision <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-300">CLINICAL AI</span>
              </span>
            </div>
          </div>

          <div className="hidden md:flex items-center space-x-8 text-xs font-semibold text-zinc-300">
            <a href="#technology" className="hover:text-rose-400 transition">Biomechanical AI</a>
            <a href="#protocols" className="hover:text-rose-400 transition">Recovery Protocols</a>
            <a href="#providers" className="hover:text-rose-400 transition">Provider Suite</a>
            <a href="#security" className="hover:text-rose-400 transition">Clinical Security</a>
          </div>

          <div className="flex items-center space-x-3">
            <Link
              to="/login"
              className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-300 hover:text-white hover:bg-white/5 transition"
            >
              Sign In
            </Link>
            <Link
              to="/register"
              className="luminous-button-primary text-xs font-bold"
            >
              <span>Get Started</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
            </Link>
          </div>
        </div>
      </nav>

      {/* Flagship Hero Section */}
      <section className="relative pt-16 md:pt-28 pb-20 px-6 lg:px-12 max-w-7xl mx-auto text-center">
        {/* Luminous Red Light & NIR Ambient Light Orb */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-gradient-to-r from-rose-500/15 via-red-500/10 to-amber-500/12 blur-[130px] pointer-events-none rounded-full" />

        <div className="relative z-10 space-y-6 max-w-4xl mx-auto">
          <div className="inline-flex items-center space-x-2 px-4 py-1.5 rounded-full bg-zinc-900/90 border border-rose-500/30 shadow-lg shadow-rose-950/40 text-xs font-mono text-rose-300 animate-fadeIn">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
            <span>CLINICAL-GRADE TELE-REHABILITATION &amp; COMPUTER VISION</span>
          </div>

          <h1 className="text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight leading-[1.1] text-white">
            Precision Motion AI for{' '}
            <span className="luminous-gradient-text">
              Accelerated Recovery
            </span>
          </h1>

          <p className="text-base sm:text-xl text-zinc-400 max-w-2xl mx-auto leading-relaxed">
            Real-time on-device skeletal kinematics, scheduled repetition &amp; set tracking, intelligent physiotherapist guidance, and doctor-patient clinical doubts channel.
          </p>

          {/* Action CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
            <button
              onClick={() => navigate('/login')}
              className="w-full sm:w-auto luminous-button-primary text-sm px-8 py-3.5 font-bold shadow-xl shadow-rose-500/30 flex items-center justify-center space-x-2"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Start Patient Session</span>
            </button>
            <button
              onClick={() => navigate('/login')}
              className="w-full sm:w-auto luminous-button-secondary text-sm px-7 py-3.5 font-bold flex items-center justify-center space-x-2"
            >
              <Stethoscope className="w-4 h-4 text-rose-400" />
              <span>Physiotherapist Portal</span>
            </button>
          </div>

          {/* Key Validation Metrics Bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-12 max-w-3xl mx-auto">
            <div className="p-3.5 rounded-2xl bg-zinc-900/70 border border-white/[0.06] backdrop-blur-xl">
              <span className="text-2xl font-extrabold text-white font-mono block">99.4%</span>
              <span className="text-[11px] text-zinc-400 uppercase tracking-wider font-semibold">Joint Angle Accuracy</span>
            </div>
            <div className="p-3.5 rounded-2xl bg-zinc-900/70 border border-white/[0.06] backdrop-blur-xl">
              <span className="text-2xl font-extrabold text-rose-400 font-mono block">&lt; 15ms</span>
              <span className="text-[11px] text-zinc-400 uppercase tracking-wider font-semibold">On-Device Latency</span>
            </div>
            <div className="p-3.5 rounded-2xl bg-zinc-900/70 border border-white/[0.06] backdrop-blur-xl">
              <span className="text-2xl font-extrabold text-emerald-400 font-mono block">100%</span>
              <span className="text-[11px] text-zinc-400 uppercase tracking-wider font-semibold">Browser Video Privacy</span>
            </div>
            <div className="p-3.5 rounded-2xl bg-zinc-900/70 border border-white/[0.06] backdrop-blur-xl">
              <span className="text-2xl font-extrabold text-amber-400 font-mono block">5.0 ★</span>
              <span className="text-[11px] text-zinc-400 uppercase tracking-wider font-semibold">Clinical Review Score</span>
            </div>
          </div>
        </div>

        {/* Hero Interactive Studio Telemetry Card Preview */}
        <div className="mt-14 relative max-w-5xl mx-auto">
          <div className="luminous-glass-card p-4 md:p-6 relative overflow-hidden border border-rose-500/30 shadow-2xl shadow-rose-950/60">
            {/* Window Bar */}
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3 mb-4">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 rounded-full bg-rose-500/80" />
                <div className="w-3 h-3 rounded-full bg-amber-500/80" />
                <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
                <span className="text-xs font-mono text-zinc-400 ml-2">RehabVision Clinical AI Engine &bull; Live Telemetry</span>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold font-mono flex items-center space-x-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                <span>ACTIVE KINEMATIC STREAM</span>
              </span>
            </div>

            {/* Studio Simulation Grid */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
              <div className="md:col-span-7 bg-zinc-950/90 rounded-2xl border border-zinc-800 p-6 flex flex-col justify-between h-72 relative overflow-hidden">
                <div className="flex items-center justify-between z-10">
                  <span className="px-3 py-1 rounded-xl bg-rose-950/80 border border-rose-500/40 text-rose-300 text-xs font-mono font-bold">
                    Seated Knee Extension &bull; Set 1 of 3
                  </span>
                  <span className="text-xs font-mono text-emerald-400 font-bold">ROM: 96% Optimal</span>
                </div>

                {/* Simulated Wireframe Skeleton Graphics */}
                <div className="flex items-center justify-center my-4">
                  <div className="relative w-48 h-32 flex items-center justify-center">
                    <div className="w-32 h-32 rounded-full border border-dashed border-rose-500/30 animate-spin" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-center">
                        <span className="text-4xl font-extrabold font-mono text-rose-400">168°</span>
                        <span className="text-[10px] text-zinc-400 block font-mono">Terminal Extension</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs font-mono z-10">
                  <span className="text-zinc-400">Goal: 10 Reps</span>
                  <div className="flex items-center space-x-2">
                    <span className="text-rose-400 font-bold">Rep 8 / 10</span>
                    <div className="w-24 bg-zinc-800 rounded-full h-1.5">
                      <div className="bg-gradient-to-r from-rose-500 to-amber-400 h-1.5 rounded-full w-4/5" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Real-Time Metrics Callouts */}
              <div className="md:col-span-5 space-y-3 text-left">
                <div className="p-3.5 rounded-2xl bg-zinc-950/70 border border-zinc-800">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-400 font-medium">Spine &amp; Shoulder Alignment</span>
                    <span className="text-emerald-400 font-bold font-mono">98% OPTIMAL</span>
                  </div>
                  <span className="text-[11px] text-zinc-300 mt-1 block">
                    Craniovertebral Angle (CVA) aligned with vertical anatomical axis.
                  </span>
                </div>

                <div className="p-3.5 rounded-2xl bg-zinc-950/70 border border-zinc-800">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-400 font-medium">Physiotherapist Supervision</span>
                    <span className="text-rose-400 font-bold font-mono">DR. PRIYA REDDY</span>
                  </div>
                  <span className="text-[11px] text-zinc-300 mt-1 block">
                    Tailored protocol with automated 30s inter-set recovery timer.
                  </span>
                </div>

                <div className="p-3.5 rounded-2xl bg-gradient-to-r from-rose-950/30 to-zinc-900 border border-rose-500/30 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <MessageSquare className="w-4 h-4 text-rose-400" />
                    <span className="text-xs font-bold text-white">Clinical Doubts Channel</span>
                  </div>
                  <span className="text-[10px] text-emerald-400 font-mono font-bold">LIVE ONLINE</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Technology & Capabilities Section */}
      <section id="technology" className="py-20 px-6 lg:px-12 max-w-7xl mx-auto border-t border-white/[0.08]">
        <div className="text-center space-y-3 mb-14">
          <span className="text-xs font-mono text-rose-400 uppercase font-bold tracking-wider">
            Clinical Architecture
          </span>
          <h2 className="text-3xl md:text-5xl font-extrabold text-white">
            Built for Clinical Precision and Patient Empowerment
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="luminous-glass-card p-6 md:p-8 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <Eye className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-white">2D/3D Biomechanical Vision</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Sub-millimeter MediaPipe joint telemetry calculates flexion, extension, abduction, and symmetry without costly external sensors or wearable hardware.
            </p>
          </div>

          <div className="luminous-glass-card p-6 md:p-8 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Sparkles className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-white">Gemini AI Prescriptions</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Physiotherapists can leverage 1-Click Clinical Recovery Protocols or generate evidence-based customized rehabilitation routines with Gemini AI.
            </p>
          </div>

          <div className="luminous-glass-card p-6 md:p-8 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-white">3-Stage Emergency Protocol</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Automated face presence monitoring, fall detection safety timers, and panic alerts notify emergency contacts if patient distress is detected.
            </p>
          </div>
        </div>
      </section>

      {/* Provider Suite Showcase */}
      <section id="providers" className="py-20 px-6 lg:px-12 max-w-7xl mx-auto border-t border-white/[0.08]">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-6 space-y-6 text-left">
            <span className="text-xs font-mono text-rose-400 uppercase font-bold tracking-wider">
              Practitioner Command Suite
            </span>
            <h2 className="text-3xl md:text-4xl font-extrabold text-white leading-tight">
              Manage Patients, Prescribe Protocols, and Solve Clinical Doubts
            </h2>
            <p className="text-sm text-zinc-400 leading-relaxed">
              Physiotherapists gain an enterprise-grade dashboard to authorize patient intake requests, review real-time joint telemetry, and communicate directly with patients.
            </p>

            <ul className="space-y-3 text-xs text-zinc-300">
              <li className="flex items-center space-x-2">
                <CheckCircle className="w-4 h-4 text-rose-400" />
                <span>1-Click Clinical Recovery Protocols (Knee, Shoulder, Spine, Wheelchair Adaptive)</span>
              </li>
              <li className="flex items-center space-x-2">
                <CheckCircle className="w-4 h-4 text-rose-400" />
                <span>Instant In-App Patient Doubt Notifications with 1-to-1 Counter</span>
              </li>
              <li className="flex items-center space-x-2">
                <CheckCircle className="w-4 h-4 text-rose-400" />
                <span>Patient Satisfaction &amp; Clinical Care Reviews Display</span>
              </li>
            </ul>

            <button
              onClick={() => navigate('/login')}
              className="luminous-button-primary text-xs font-bold"
            >
              <span>Explore Provider Suite</span>
              <ChevronRight className="w-4 h-4 ml-1" />
            </button>
          </div>

          <div className="lg:col-span-6">
            <div className="luminous-glass-card p-6 border border-rose-500/30 space-y-4 shadow-xl">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-rose-950 border border-rose-500/40 flex items-center justify-center text-rose-300 font-bold">
                    Dr
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-white">Dr. Priya Reddy</h4>
                    <span className="text-[11px] text-rose-400 font-mono">Senior Orthopedic Specialist</span>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold font-mono">
                  5.0 ★ (100% Rating)
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 text-xs space-y-2">
                <div className="flex items-center justify-between text-zinc-400">
                  <span>Assigned Patients: <strong className="text-white">Active</strong></span>
                  <span>Intake Code: <strong className="text-amber-400 font-mono">5A1BAA43</strong></span>
                </div>
                <div className="p-2.5 rounded-xl bg-rose-950/40 border border-rose-500/20 text-rose-300 text-[11px]">
                  💬 "Patient asked regarding quadriceps soreness post-set 2 &mdash; answer sent."
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/[0.08] bg-zinc-950 px-6 lg:px-12 py-10 text-center space-y-4 text-xs text-zinc-500">
        <div className="flex items-center justify-center space-x-2 text-zinc-400">
          <Lock className="w-3.5 h-3.5 text-rose-400" />
          <span>Encrypted On-Device Video Stream &bull; HIPAA Compliant Privacy Standard</span>
        </div>
        <p className="max-w-2xl mx-auto">
          RehabVision is an AI-powered motion telemetry and tele-rehabilitation platform designed to assist certified physiotherapists and patients. It does not replace emergency medical diagnosis.
        </p>
        <span className="block font-mono text-[10px] text-zinc-600">
          &copy; {new Date().getFullYear()} RehabVision Health. All rights reserved.
        </span>
      </footer>
    </div>
  )
}
