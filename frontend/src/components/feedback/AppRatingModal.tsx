import React, { useState } from 'react'
import { Star, X, Sparkles, Check, Heart } from 'lucide-react'
import { ratingsApi } from '../../api/client'

interface Props {
  isOpen: boolean
  onClose: () => void
}

export const AppRatingModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const [rating, setRating] = useState<number>(5)
  const [hoverRating, setHoverRating] = useState<number>(0)
  const [category, setCategory] = useState<string>('overall')
  const [feedback, setFeedback] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      await ratingsApi.submitAppRating({
        rating,
        category,
        feedback: feedback.trim(),
      })
      setIsSubmitted(true)
      setTimeout(() => {
        setIsSubmitted(false)
        onClose()
      }, 2000)
    } catch {
      alert('Failed to submit application rating.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const categories = [
    { id: 'overall', label: 'Overall Experience' },
    { id: 'ai_tracking', label: 'AI Pose & Rep Tracking' },
    { id: 'ease_of_use', label: 'Ease of Use & UI' },
    { id: 'exercises', label: 'Exercise Effectiveness' },
  ]

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="relative w-full max-w-md bg-slate-900 border border-cyan-500/40 rounded-3xl p-6 md:p-8 shadow-2xl shadow-cyan-950/80 text-center space-y-6">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400"
        >
          <X className="w-4 h-4" />
        </button>

        {isSubmitted ? (
          <div className="py-8 space-y-3 animate-fadeIn">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center text-emerald-400 mx-auto animate-bounce">
              <Check className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-white">Thank You for Your Feedback!</h3>
            <p className="text-xs text-slate-400 max-w-xs mx-auto">
              Your review helps us continuously improve RehabVision's AI tele-rehabilitation experience.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-mono font-bold">
                <Sparkles className="w-3.5 h-3.5" />
                <span>PLATFORM REVIEW</span>
              </div>
              <h2 className="text-xl font-extrabold text-white">Rate Your RehabVision Experience</h2>
              <p className="text-xs text-slate-400">
                How satisfied are you with our AI exercise guidance and tracking platform?
              </p>
            </div>

            {/* Interactive 5-Star Rating */}
            <div className="flex items-center justify-center space-x-2 py-2">
              {[1, 2, 3, 4, 5].map((star) => {
                const active = (hoverRating || rating) >= star
                return (
                  <button
                    key={star}
                    type="button"
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    onClick={() => setRating(star)}
                    className="p-1 transition transform hover:scale-125 focus:outline-none"
                  >
                    <Star
                      className={`w-8 h-8 ${
                        active
                          ? 'text-amber-400 fill-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]'
                          : 'text-slate-700'
                      } transition`}
                    />
                  </button>
                )
              })}
            </div>

            {/* Category Filter Pills */}
            <div className="space-y-1.5 text-left">
              <label className="block text-[11px] font-mono text-slate-400 uppercase font-semibold">
                What did you like most?
              </label>
              <div className="grid grid-cols-2 gap-2">
                {categories.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCategory(c.id)}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border text-center transition ${
                      category === c.id
                        ? 'bg-cyan-500/20 border-cyan-500/60 text-cyan-300 shadow-sm'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Feedback Textarea */}
            <div className="text-left">
              <label className="block text-[11px] font-mono text-slate-400 uppercase font-semibold mb-1">
                Your Review & Suggestions (Optional)
              </label>
              <textarea
                rows={3}
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Share your thoughts on the exercise tracking accuracy, audio cues, or dashboard..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-cyan-400 transition resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-cyan-500/25 flex items-center justify-center space-x-2 transition disabled:opacity-50"
            >
              <Heart className="w-4 h-4 fill-current text-rose-300" />
              <span>{isSubmitting ? 'Submitting...' : 'Submit Application Rating'}</span>
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
