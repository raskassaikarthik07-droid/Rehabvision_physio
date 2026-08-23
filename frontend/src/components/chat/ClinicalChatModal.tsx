import React, { useState, useEffect, useRef } from 'react'
import {
  MessageSquare, Send, X, User, CheckCheck, Sparkles
} from 'lucide-react'
import { messagesApi } from '../../api/client'
import { useAuth } from '../../contexts/AuthContext'

interface Props {
  isOpen: boolean
  onClose: () => void
  recipientId: string
  recipientName: string
  recipientRole: 'patient' | 'physiotherapist'
  patientId?: string
  physioId?: string
}

export const ClinicalChatModal: React.FC<Props> = ({
  isOpen,
  onClose,
  recipientId,
  recipientName,
  recipientRole,
  patientId,
  physioId,
}) => {
  const { user } = useAuth()
  const [messages, setMessages] = useState<any[]>([])
  const [inputText, setInputText] = useState('')
  const [isSending, setIsSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isOpen) {
      loadMessages()
      const interval = setInterval(loadMessages, 3000)
      return () => clearInterval(interval)
    }
  }, [isOpen, patientId, physioId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const loadMessages = async () => {
    try {
      const res = await messagesApi.list({ patient_id: patientId, physio_id: physioId })
      setMessages(res.data.messages || [])
    } catch {}
  }

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!inputText.trim() || isSending) return

    const content = inputText.trim()
    setInputText('')
    setIsSending(true)

    try {
      await messagesApi.send({
        receiver_id: recipientId,
        content,
        patient_id: patientId,
        physio_id: physioId,
      })
      await loadMessages()
    } catch (err: any) {
      console.error('Send message error:', err)
      const errMsg = err?.response?.data?.error || 'Failed to send message.'
      alert(errMsg)
    } finally {
      setIsSending(false)
    }
  }

  const quickPrompts =
    user?.role === 'patient'
      ? [
          'Is mild tightness expected during knee extensions?',
          'Should I decrease the target reps if my shoulder fatigues?',
          'Can you review my recent posture alignment score?',
        ]
      : [
          'Great form on your recent session! Keep up the momentum.',
          'Please take 45s rest between sets to avoid muscle strain.',
          'Let me adjust your prescription routine for better joint comfort.',
        ]

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-cyan-500/40 rounded-3xl shadow-2xl shadow-cyan-950/80 flex flex-col h-[600px] overflow-hidden">
        {/* Chat Header */}
        <div className="p-4 md:px-6 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 p-0.5 shadow-md">
              <div className="w-full h-full bg-slate-900 rounded-2xl flex items-center justify-center text-cyan-300 font-bold text-sm">
                {recipientRole === 'physiotherapist' ? 'Dr' : <User className="w-4 h-4" />}
              </div>
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <h3 className="font-bold text-white text-sm md:text-base">
                  {recipientRole === 'physiotherapist' ? `Dr. ${recipientName}` : recipientName}
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold">
                  {recipientRole === 'physiotherapist' ? 'Supervising Specialist' : 'Active Patient'}
                </span>
              </div>
              <span className="text-[11px] text-slate-400 font-mono">
                Direct Tele-Rehabilitation Clinical Channel
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Message Feed */}
        <div className="flex-1 p-4 md:p-6 overflow-y-auto space-y-3.5">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 space-y-2">
              <MessageSquare className="w-10 h-10 text-cyan-500/50" />
              <h4 className="text-sm font-bold text-slate-200">No Messages Yet</h4>
              <p className="text-xs max-w-xs">
                Ask doubts regarding your prescribed exercises, form issues, or joint discomfort.
              </p>
            </div>
          ) : (
            messages.map((m) => {
              const isMe = m.sender_id === user?.id
              return (
                <div
                  key={m.id}
                  className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                >
                  <span className="text-[10px] text-slate-400 mb-0.5 px-1 font-mono">
                    {isMe ? 'You' : m.sender_name}
                  </span>
                  <div
                    className={`max-w-[80%] p-3.5 rounded-2xl text-xs leading-relaxed ${
                      isMe
                        ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-br-none shadow-md'
                        : 'bg-slate-950 border border-slate-800 text-slate-200 rounded-bl-none'
                    }`}
                  >
                    {m.content}
                  </div>
                  <div className="flex items-center space-x-1 text-[10px] text-slate-500 mt-1 px-1 font-mono">
                    <span>{new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    {isMe && <CheckCheck className="w-3 h-3 text-cyan-400" />}
                  </div>
                </div>
              )
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick Doubt / Clinical Prompts */}
        <div className="px-4 py-2 bg-slate-950/60 border-t border-slate-800/80 flex items-center space-x-2 overflow-x-auto scrollbar-none">
          <span className="text-[10px] font-mono text-cyan-400 shrink-0 flex items-center space-x-1">
            <Sparkles className="w-3 h-3" />
            <span>Quick:</span>
          </span>
          {quickPrompts.map((prompt, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                setInputText(prompt)
              }}
              className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[11px] text-slate-300 hover:text-cyan-300 transition shrink-0 truncate max-w-xs"
            >
              {prompt}
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <form onSubmit={handleSend} className="p-3 bg-slate-950 border-t border-slate-800 flex items-center space-x-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Type your clinical question or feedback..."
            className="flex-1 px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-cyan-400 transition"
          />
          <button
            type="submit"
            disabled={!inputText.trim() || isSending}
            className="p-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 text-white font-bold text-xs shadow-md disabled:opacity-40 transition"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  )
}
