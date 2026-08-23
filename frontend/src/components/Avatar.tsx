import { useState } from 'react'

interface AvatarProps {
  src?: string | null
  name: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
  role?: 'patient' | 'physiotherapist'
}

export default function Avatar({
  src,
  name,
  size = 'md',
  className = '',
  role = 'patient',
}: AvatarProps) {
  const [error, setError] = useState(false)

  // Generate initials (e.g. "Rahul Kumar" -> "RK", "Priya Reddy" -> "PR")
  const getInitials = (n: string) => {
    if (!n) return 'PT'
    const parts = n.replace(/^Dr\.\s*/i, '').trim().split(/\s+/)
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }

  const initials = getInitials(name)

  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-16 h-16 text-lg',
    xl: 'w-20 h-20 text-xl',
  }

  const bgClasses = role === 'physiotherapist'
    ? 'bg-gradient-to-br from-cyan-600 to-teal-700 text-white border-cyan-400/40'
    : 'bg-gradient-to-br from-sky-600 to-blue-700 text-white border-sky-400/40'

  if (!src || error) {
    return (
      <div
        className={`${sizeClasses[size]} rounded-2xl flex items-center justify-center font-bold tracking-wider border shadow-md shrink-0 ${bgClasses} ${className}`}
        title={name}
      >
        {initials}
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={name}
      onError={() => setError(true)}
      className={`${sizeClasses[size]} rounded-2xl object-cover border border-slate-700 bg-slate-800 shadow-md shrink-0 ${className}`}
    />
  )
}
