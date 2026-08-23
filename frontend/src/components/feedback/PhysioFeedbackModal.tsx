import React, { useState } from 'react'
import { Star, X, Stethoscope, Check, Award } from 'lucide-react'
import { feedbackApi } from '../../api/client'

interface Props {
  isOpen: boolean
  onClose: () => void
  physioId: string
  physioName: string
}

export const PhysioFeedbackModal: React.FC<Props> = ({
  isOpen,
  onClose,
  physioId,
  physioName,
}) => {
  const [rating, setRating] = useState<number>(5)
  const [hoverRating, setHoverRating] = useState<number>(0)
  const [treatmentSatisfaction, setTreatmentSatisfaction] = useState<number>(5)
  const [responsiveness, setResponsiveness] = useState<number>(5)
  const [comments, setComments] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      await feedbackApi.submitPhysioFeedback({
        physio_id: physioId,
        rating,
        treatment_satisfaction: treatmentSatisfaction,
        responsiveness,
        comments: comments.trim(),
      })
      setIsSubmitted(true)
      setTimeout(() => {
        setIsSubmitted(false)
        onClose()
      }, 2000)
    } catch {
      alert('Failed to submit clinical feedback.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="relative w-full max-w-lg bg-slate-900 border border-cyan-500/40 rounded-3xl p-6 md:p-8 shadow-2xl shadow-cyan-950/80 space-y-6">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400"
        >
          <X className="w-4 h-4" />
        </button>

        {isSubmitted ? (
          <div className="py-8 text-center space-y-3 animate-fadeIn">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center text-emerald-400 mx-auto animate-bounce">
              <Check className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-white">Feedback Submitted!</h3>
            <p className="text-xs text-slate-400 max-w-xs mx-auto">
              Your clinical review has been shared with Dr. {physioName} to optimize your care plan.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="text-center space-y-2">
              <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-mono font-bold">
                <Stethoscope className="w-3.5 h-3.5" />
                <span>CLINICAL CARE EVALUATION</span>
              </div>
              <h2 className="text-xl font-extrabold text-white">Rate Dr. {physioName}</h2>
              <p className="text-xs text-slate-400">
                Provide clinical feedback on your rehabilitation prescriptions and physician guidance.
              </p>
            </div>

            {/* Overall Star Rating */}
            <div className="space-y-1.5 text-center">
              <span className="text-xs font-semibold text-slate-300">Overall Clinical Experience</span>
              <div className="flex items-center justify-center space-x-2 py-1">
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
                        className={`w-7 h-7 ${
                          active
                            ? 'text-amber-400 fill-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]'
                            : 'text-slate-700'
                        } transition`}
                      />
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Dimension Sliders / Buttons */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-slate-950 p-4 rounded-2xl border border-slate-800 text-xs">
              <div className="space-y-1.5">
                <span className="text-slate-400 font-medium block">Prescription Quality</span>
                <div className="flex items-center space-x-1">
                  {[1, 2, 3, 4, 5].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setTreatmentSatisfaction(val)}
                      className={`flex-1 py-1 rounded-lg font-bold transition ${
                        treatmentSatisfaction === val
                          ? 'bg-cyan-500 text-slate-950 shadow'
                          : 'bg-slate-900 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {val}★
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <span className="text-slate-400 font-medium block">Responsiveness & Doubts</span>
                <div className="flex items-center space-x-1">
                  {[1, 2, 3, 4, 5].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setResponsiveness(val)}
                      className={`flex-1 py-1 rounded-lg font-bold transition ${
                        responsiveness === val
                          ? 'bg-cyan-500 text-slate-950 shadow'
                          : 'bg-slate-900 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {val}★
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Comments Textarea */}
            <div>
              <label className="block text-[11px] font-mono text-slate-400 uppercase font-semibold mb-1">
                Clinical Comments & Doubts (Optional)
              </label>
              <textarea
                rows={3}
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                placeholder="How has Dr. Priya's rehabilitation routine helped your mobility? Any suggestions?"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-cyan-400 transition resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-cyan-500/25 flex items-center justify-center space-x-2 transition disabled:opacity-50"
            >
              <Award className="w-4 h-4" />
              <span>{isSubmitting ? 'Submitting...' : 'Submit Doctor Review'}</span>
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
