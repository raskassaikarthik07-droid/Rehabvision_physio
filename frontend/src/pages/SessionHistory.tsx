import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { sessionsApi } from '../api/client'
import Layout from '../components/Layout'
import { Dumbbell, Clock, CheckCircle, XCircle } from 'lucide-react'

export default function SessionHistory() {
  const [sessions, setSessions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    sessionsApi.list().then((res) => setSessions(res.data.sessions || [])).finally(() => setLoading(false))
  }, [])

  const exerciseName = (id: string) => ({ arm_raise: 'Arm Raise', knee_extension: 'Knee Extension', sit_to_stand: 'Sit to Stand' } as any)[id] || id
  const formatDate = (d: string) => new Date(d).toLocaleString('en-IN')

  return (
    <Layout>
      <div className="p-8">
        <h1 className="text-2xl font-bold text-white mb-6">Session History</h1>
        {loading ? (
          <div className="space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="skeleton h-16" />)}</div>
        ) : !sessions.length ? (
          <div className="text-center py-20">
            <Dumbbell className="w-16 h-16 text-slate-700 mx-auto mb-4" />
            <p className="text-slate-400">No sessions yet. Start your first exercise!</p>
            <Link to="/exercises" className="inline-flex mt-4 px-5 py-2.5 bg-sky-500 hover:bg-sky-400 text-white rounded-xl font-medium">Start Exercise</Link>
          </div>
        ) : (
          <div className="space-y-3">
            {sessions.map((s) => (
              <Link key={s.id} to={`/sessions/${s.id}/results`}
                className="flex items-center justify-between p-5 bg-[#1e293b] border border-[#334155] hover:border-sky-500/30 rounded-2xl transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-11 h-11 bg-sky-500/15 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Dumbbell className="w-5 h-5 text-sky-400" />
                  </div>
                  <div>
                    <p className="text-white font-medium">{exerciseName(s.exercise_id)}</p>
                    <p className="text-slate-500 text-sm flex items-center gap-1"><Clock className="w-3 h-3" />{formatDate(s.started_at)}</p>
                  </div>
                </div>
                <span className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-sm font-medium
                  ${s.status === 'completed' ? 'bg-green-500/15 text-green-400' : 'bg-slate-700 text-slate-400'}`}>
                  {s.status === 'completed' ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                  {s.status}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </Layout>
  )
}
