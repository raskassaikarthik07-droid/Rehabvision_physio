import axios from 'axios'

const api = axios.create({
  baseURL: '/api/v1',
  timeout: 20000,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('auth_token')
      if (window.location.pathname !== '/login' && window.location.pathname !== '/register' && window.location.pathname !== '/' && !window.location.pathname.startsWith('/login')) {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export default api

export const authApi = {
  health: () => api.get('/health', { baseURL: '' }),
  login: (data: { identifier: string; password: string; role?: string }) =>
    api.post('/auth/login', data),
  register: (data: {
    email: string
    password: string
    name: string
    phone?: string
    picture?: string
    role: 'patient' | 'physiotherapist'
    age?: number
    gender?: string
    diagnosis?: string
    rehab_goals?: string
    body_area_id?: string
    mobility_mode?: string
    emergency_contact_name?: string
    emergency_contact_phone?: string
    emergency_relationship?: string
    speciality?: string
    license_number?: string
    bio?: string
    specialization_names?: string[]
  }) => api.post('/auth/register', data),
  devLogin: (role: 'patient' | 'physiotherapist' = 'patient') =>
    api.post('/auth/dev-login', { role }),
  logout: () => api.post('/auth/logout'),
  getMe: () => api.get('/me'),
}

export const referenceApi = {
  getBodyAreas: () => api.get('/reference/body-areas'),
  getSpecializations: () => api.get('/reference/specializations'),
  searchPhysiotherapists: (params?: { specialization?: string; invite_code?: string }) =>
    api.get('/physiotherapists', { params }),
}

export const patientApi = {
  updateProfile: (data: { name: string; phone?: string; age?: number; diagnosis?: string; rehab_goals?: string }) =>
    api.put('/patient/profile', data),
  updateProfilePhoto: (picture: string) =>
    api.put('/profile/photo', { picture }),
  getStreak: () => api.get('/patient/streak'),
  getAnalytics: (timeframe = 'weekly') => api.get('/patient/analytics', { params: { timeframe } }),
  getActivePrescription: () => api.get('/patient/prescriptions/active'),
}

export const requestsApi = {
  create: (data: {
    physio_id?: string
    request_type?: 'invite_code' | 'matching'
    invite_code?: string
    body_area_id?: string
    specialization_id?: string
    rehab_goal_note?: string
  }) => api.post('/patient/requests', data),
  listPatientRequests: () => api.get('/patient/requests'),
  listPhysioPendingRequests: () => api.get('/physiotherapist/requests'),
  acceptRequest: (id: string) => api.post(`/physiotherapist/requests/${id}/accept`),
  rejectRequest: (id: string, reason?: string) => api.post(`/physiotherapist/requests/${id}/reject`, { reason }),
}

export const prescriptionsApi = {
  suggestAI: (patientId: string) =>
    api.post('/physiotherapist/prescriptions/suggest', { patient_id: patientId }),
  create: (data: {
    patient_id: string
    title?: string
    notes?: string
    ai_suggested?: boolean
    gemini_prompt?: string
    exercises: Array<{
      exercise_id: string
      target_reps: number
      target_sets: number
      rest_seconds: number
      difficulty: string
      instructions: string
      safety_notes: string
      form_criteria: string
      is_seated_adapted: boolean
    }>
  }) => api.post('/physiotherapist/prescriptions', data),
  getActive: (patientId?: string) =>
    api.get('/patient/prescriptions/active', { params: patientId ? { patient_id: patientId } : {} }),
}

export const emergencyApi = {
  recordEvent: (data: {
    session_id?: string
    stage: number
    event_type?: string
    detection_state?: string
    escalation_state?: string
    notes?: string
  }) => api.post('/emergency/event', data),
}

export const notificationsApi = {
  list: () => api.get('/notifications'),
  markRead: (id: string) => api.post(`/notifications/${id}/read`),
  markAllRead: () => api.post('/notifications/read-all'),
}

export const exercisesApi = {
  list: () => api.get('/exercises'),
}

export const messagesApi = {
  list: (params?: { patient_id?: string; physio_id?: string }) =>
    api.get('/messages', { params }),
  send: (data: { receiver_id: string; content: string; patient_id?: string; physio_id?: string }) =>
    api.post('/messages', data),
}

export const ratingsApi = {
  submitAppRating: (data: { rating: number; category?: string; feedback?: string }) =>
    api.post('/ratings/app', data),
  getAppRatings: () => api.get('/ratings/app'),
}

export const feedbackApi = {
  submitPhysioFeedback: (data: {
    physio_id: string
    rating: number
    treatment_satisfaction?: number
    responsiveness?: number
    comments?: string
  }) => api.post('/feedback/physio', data),
  getPhysioFeedback: (physioId: string) => api.get(`/feedback/physio/${physioId}`),
}

export const sessionsApi = {
  create: (exerciseId: string) => api.post('/sessions', { exercise_id: exerciseId }),
  list: () => api.get('/sessions'),
  get: (id: string) => api.get(`/sessions/${id}`),
  analyzeFrame: (sessionId: string, frameB64: string, exerciseId: string, frameIndex: number) =>
    api.post(`/sessions/${sessionId}/analyze`, { frame_b64: frameB64, exercise_id: exerciseId, frame_index: frameIndex }),
  complete: (sessionId: string, metrics: any) => api.post(`/sessions/${sessionId}/complete`, metrics),
}

export const dashboardApi = {
  patient: () => api.get('/dashboard/patient'),
  physiotherapist: () => api.get('/dashboard/physiotherapist'),
}

export const physioApi = {
  listPatients: () => api.get('/physiotherapist/patients'),
  assignPatient: (identifier: string) => api.post('/physiotherapist/patients/assign', { identifier }),
  getPatientDetail: (patientId: string) => api.get(`/physiotherapist/patients/${patientId}`),
  getPatientSessions: (patientId: string) => api.get(`/physiotherapist/patients/${patientId}/sessions`),
  getPatientProgress: (patientId: string) => api.get(`/physiotherapist/patients/${patientId}/progress`),
  getPatientSessionDetail: (patientId: string, sessionId: string) =>
    api.get(`/physiotherapist/patients/${patientId}/sessions/${sessionId}`),
}

export const aiApi = {
  sessionSummary: (sessionId: string, exerciseId: string) =>
    api.post('/ai/session-summary', { session_id: sessionId, exercise_id: exerciseId }),
}
