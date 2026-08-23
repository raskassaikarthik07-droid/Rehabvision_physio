import React, { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Flame, Sparkles, ArrowRight, Trophy, BarChart3, Clock, Target, Zap, Heart } from 'lucide-react'
import confetti from 'canvas-confetti'
import { aiApi } from '../api/client'

export const SessionResults: React.FC = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const state = location.state || {}

  const [aiSummary, setAiSummary] = useState<string>('Generating AI clinical synthesis...')
  const [aiInsights, setAiInsights] = useState<string>('')
  const [loaded, setLoaded] = useState(false)

  const {
    sessionId,
    exerciseId = 'knee_extension',
    totalReps = 0,
    targetReps = 10,
    targetSets = 3,
    avgFormScore = 0,
    avgROMPercent = 0,
    durationSeconds = 0,
    commonIssues = [],
  } = state

  const formScoreNum = Math.round(avgFormScore) || 0
  const romNum = Math.round(avgROMPercent) || 0
  const getScoreColor = (n: number) => n >= 90 ? 'text-emerald-400' : n >= 70 ? 'text-amber-400' : 'text-rose-400'

  useEffect(() => {
    setTimeout(() => setLoaded(true), 100)
    confetti({ particleCount: 120, spread: 80, origin: { y: 0.5 }, colors: ['#ff3366', '#ff758c', '#ffaa00', '#ffffff'] })
    setTimeout(() => {
      confetti({ particleCount: 60, angle: 60, spread: 55, origin: { x: 0 }, colors: ['#ff3366', '#ffaa00'] })
      confetti({ particleCount: 60, angle: 120, spread: 55, origin: { x: 1 }, colors: ['#ff3366', '#ffaa00'] })
    }, 400)
    const fallback = `Session completed with ${totalReps} accurate repetitions and ${formScoreNum}% form accuracy.`
    if (sessionId) {
      aiApi.sessionSummary(sessionId, exerciseId).then((res) => {
        setAiSummary(res.data.summary || fallback)
        setAiInsights(res.data.insights || '')
      }).catch(() => setAiSummary(fallback))
    } else {
      setAiSummary(fallback)
    }
  }, [])

  const mins = String(Math.floor(durationSeconds / 60)).padStart(2, '0')
  const secs = String(durationSeconds % 60).padStart(2, '0')

  return (
    <div className="relative min-h-screen bg-zinc-950 text-zinc-100 overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-rose-500/8 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-amber-500/8 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      </div>
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen p-4 md:p-8">
        <div
          className="w-full max-w-2xl space-y-5 transition-all duration-700"
          style={{ opacity: loaded ? 1 : 0, transform: loaded ? 'translateY(0)' : 'translateY(20px)' }}
        >
          <div className="text-center space-y-3">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-rose-500/30 to-amber-500/20 border-2 border-rose-400/60 flex items-center justify-center mx-auto shadow-2xl shadow-rose-500/30">
              <Trophy className="w-10 h-10 text-amber-400" />
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">Session Complete!</h1>
            <p className="text-sm text-rose-300 font-mono uppercase tracking-widest">
              {exerciseId.replace(/_/g, ' ')} &bull; Clinical Telemetry Saved
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-zinc-900/80 border border-zinc-800 p-4 rounded-2xl text-center space-y-1 hover:border-rose-500/40 transition">
              <Target className="w-4 h-4 text-rose-400 mx-auto" />
              <p className="text-[10px] text-zinc-500 font-mono uppercase">Total Reps</p>
              <p className="text-2xl font-extrabold text-rose-400 font-mono">{totalReps}</p>
              <p className="text-[10px] text-zinc-600">of {targetReps * targetSets} target</p>
            </div>
            <div className="bg-zinc-900/80 border border-zinc-800 p-4 rounded-2xl text-center space-y-1 hover:border-emerald-500/40 transition">
              <Zap className="w-4 h-4 text-emerald-400 mx-auto" />
              <p className="text-[10px] text-zinc-500 font-mono uppercase">Form Score</p>
              <p className={`text-2xl font-extrabold font-mono ${getScoreColor(formScoreNum)}`}>{formScoreNum}%</p>
              <p className="text-[10px] text-zinc-600">biomechanics</p>
            </div>
            <div className="bg-zinc-900/80 border border-zinc-800 p-4 rounded-2xl text-center space-y-1 hover:border-amber-500/40 transition">
              <BarChart3 className="w-4 h-4 text-amber-400 mx-auto" />
              <p className="text-[10px] text-zinc-500 font-mono uppercase">ROM</p>
              <p className={`text-2xl font-extrabold font-mono ${getScoreColor(romNum)}`}>{romNum}%</p>
              <p className="text-[10px] text-zinc-600">range of motion</p>
            </div>
            <div className="bg-zinc-900/80 border border-zinc-800 p-4 rounded-2xl text-center space-y-1 hover:border-sky-500/40 transition">
              <Clock className="w-4 h-4 text-sky-400 mx-auto" />
              <p className="text-[10px] text-zinc-500 font-mono uppercase">Duration</p>
              <p className="text-2xl font-extrabold text-sky-400 font-mono">{mins}:{secs}</p>
              <p className="text-[10px] text-zinc-600">active time</p>
            </div>
          </div>

          <div className="bg-zinc-900/80 border border-rose-500/20 p-5 rounded-2xl space-y-3">
            <div className="flex items-center space-x-2">
              <div className="w-6 h-6 rounded-lg bg-rose-500/20 flex items-center justify-center">
                <Sparkles className="w-3.5 h-3.5 text-rose-400" />
              </div>
              <span className="text-xs font-mono font-bold text-rose-300 uppercase tracking-widest">AI Clinical Performance Summary</span>
            </div>
            <p className="text-sm text-zinc-300 leading-relaxed">{aiSummary}</p>
            {aiInsights && (
              <div className="pt-3 border-t border-zinc-800 text-xs text-zinc-400 whitespace-pre-line leading-relaxed">{aiInsights}</div>
            )}
          </div>

          {commonIssues.length > 0 && (
            <div className="bg-zinc-900/80 border border-amber-500/20 p-4 rounded-2xl space-y-2">
              <p className="text-xs font-mono font-bold text-amber-300 uppercase tracking-widest">Areas to Improve Next Session</p>
              <ul className="space-y-1">
                {commonIssues.slice(0, 3).map((issue: string, i: number) => (
                  <li key={i} className="text-xs text-zinc-400 flex items-start space-x-2">
                    <span className="text-amber-400 mt-0.5">-</span><span>{issue}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="bg-gradient-to-r from-amber-500/10 via-zinc-900 to-rose-500/10 border border-amber-500/30 p-4 rounded-2xl flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                <Flame className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Daily Streak Maintained!</h3>
                <p className="text-[11px] text-amber-300/80">Session saved to your doctor's clinical registry</p>
              </div>
            </div>
            <span className="px-3 py-1.5 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-300 font-mono font-bold text-xs">+1 Day</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => navigate('/patient/exercises')}
              className="py-3.5 rounded-2xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 text-sm font-bold transition flex items-center justify-center space-x-2"
            >
              <Heart className="w-4 h-4 text-rose-400" /><span>More Exercises</span>
            </button>
            <button
              onClick={() => navigate('/patient/dashboard')}
              className="py-3.5 rounded-2xl bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-400 hover:to-red-500 text-white text-sm font-bold shadow-lg shadow-rose-500/30 transition flex items-center justify-center space-x-2"
            >
              <span>Back to Dashboard</span><ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}