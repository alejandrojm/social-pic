'use client'

const ADMIN_SESSION_KEY = 'socialpic_admin_session'

export type AdminSession = {
  eventId: string
  eventName: string
  pin: string
  expiresAt: number
}

export function saveAdminSession(session: AdminSession) {
  if (typeof window === 'undefined') return
  localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(session))
}

export function getAdminSession(): AdminSession | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(ADMIN_SESSION_KEY)
    if (!raw) return null
    const session: AdminSession = JSON.parse(raw)
    if (Date.now() > session.expiresAt) {
      clearAdminSession()
      return null
    }
    return session
  } catch {
    return null
  }
}

export function clearAdminSession() {
  if (typeof window === 'undefined') return
  localStorage.removeItem(ADMIN_SESSION_KEY)
}

export function isValidPin(inputPin: string, adminPin: string, extraPins: string[]): boolean {
  const allPins = [adminPin, ...extraPins]
  return allPins.includes(inputPin.trim())
}

export function getSessionId(): string {
  if (typeof window === 'undefined') return 'ssr'
  let sid = localStorage.getItem('socialpic_session_id')
  if (!sid) {
    sid = `sess_${Date.now()}_${Math.random().toString(36).slice(2)}`
    localStorage.setItem('socialpic_session_id', sid)
  }
  return sid
}
