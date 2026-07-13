'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { saveAdminSession } from '@/lib/auth'

export default function AdminLoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<'join' | 'create'>('create')
  const [eventCode, setEventCode] = useState('')
  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Create event form
  const [eventName, setEventName] = useState('')
  const [eventDate, setEventDate] = useState('')
  const [adminPin, setAdminPin] = useState('')
  const [description, setDescription] = useState('')

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data: events, error: err } = await supabase
        .from('events')
        .select('*')
        .eq('id', eventCode.trim())
      
      if (err || !events?.length) {
        setError('Evento no encontrado. Verifica el código.')
        return
      }
      const event = events[0]
      const allPins = [event.admin_pin, ...(event.extra_pins || [])]
      if (!allPins.includes(pin.trim())) {
        setError('PIN incorrecto.')
        return
      }
      saveAdminSession({
        eventId: event.id,
        eventName: event.name,
        pin: pin.trim(),
        expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      })
      router.push(`/admin/events/${event.id}`)
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!eventName || !eventDate || adminPin.length < 4) {
      setError('Completa todos los campos. El PIN debe tener al menos 4 caracteres.')
      return
    }
    setLoading(true)
    try {
      const { data, error: err } = await supabase
        .from('events')
        .insert({
          name: eventName.trim(),
          date: eventDate,
          admin_pin: adminPin.trim(),
          description: description.trim() || null,
          extra_pins: [],
          status: 'active',
        })
        .select()
        .single()

      if (err || !data) {
        setError(`Error: ${err?.code} — ${err?.message || 'Sin respuesta de Supabase'}`)
        console.error(err)
        return
      }
      saveAdminSession({
        eventId: data.id,
        eventName: data.name,
        pin: adminPin.trim(),
        expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      })
      router.push(`/admin/events/${data.id}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <nav className="navbar">
        <div className="navbar-inner">
          <Link href="/" className="navbar-brand">📸 Social Pic</Link>
        </div>
      </nav>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 24px' }}>
        <div className="animate-fade-in-scale" style={{ width: '100%', maxWidth: 460 }}>
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <div style={{ fontSize: '3rem', marginBottom: 16 }}>🎛️</div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', marginBottom: 8 }}>Panel Admin</h1>
            <p style={{ color: 'var(--text-secondary)' }}>Crea un nuevo evento o accede a uno existente</p>
          </div>

          {/* Tab Switcher */}
          <div style={{ display: 'flex', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', padding: 4, marginBottom: 32 }}>
            {(['create', 'join'] as const).map(m => (
              <button
                key={m}
                onClick={() => { setMode(m); setError('') }}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: 'calc(var(--radius-md) - 4px)',
                  fontFamily: 'var(--font-display)',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  background: mode === m ? 'var(--brand-gradient)' : 'transparent',
                  color: mode === m ? 'white' : 'var(--text-secondary)',
                  transition: 'all 0.2s',
                }}
              >
                {m === 'create' ? '✨ Crear evento' : '🔑 Acceder'}
              </button>
            ))}
          </div>

          {/* Card */}
          <div className="card">
            <div className="card-body" style={{ padding: 32 }}>
              {error && (
                <div style={{ padding: '12px 16px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius-sm)', color: '#EF4444', fontSize: '0.875rem', marginBottom: 24 }}>
                  ⚠️ {error}
                </div>
              )}

              {mode === 'create' ? (
                <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  <div className="form-group">
                    <label className="form-label">Nombre del evento</label>
                    <input
                      id="event-name"
                      className="form-input"
                      type="text"
                      placeholder="Boda de Ana y Carlos"
                      value={eventName}
                      onChange={e => setEventName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Fecha del evento</label>
                    <input
                      id="event-date"
                      className="form-input"
                      type="date"
                      value={eventDate}
                      onChange={e => setEventDate(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Descripción (opcional)</label>
                    <input
                      id="event-desc"
                      className="form-input"
                      type="text"
                      placeholder="Una noche especial..."
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">PIN de administrador (min. 4 caracteres)</label>
                    <input
                      id="admin-pin"
                      className="form-input"
                      type="text"
                      placeholder="ej: boda2025"
                      value={adminPin}
                      onChange={e => setAdminPin(e.target.value)}
                      required
                    />
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Guarda este PIN para acceder al panel después.</span>
                  </div>
                  <button
                    id="create-event-btn"
                    type="submit"
                    className="btn btn-primary"
                    disabled={loading}
                    style={{ width: '100%', marginTop: 8 }}
                  >
                    {loading ? <span className="animate-spin" style={{ display: 'inline-block', width: 18, height: 18, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%' }} /> : '🚀 Crear evento'}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleJoin} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  <div className="form-group">
                    <label className="form-label">ID del evento</label>
                    <input
                      id="event-id"
                      className="form-input"
                      type="text"
                      placeholder="Pega el ID del evento aquí"
                      value={eventCode}
                      onChange={e => setEventCode(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">PIN de administrador</label>
                    <input
                      id="join-pin"
                      className="form-input"
                      type="text"
                      placeholder="Tu PIN"
                      value={pin}
                      onChange={e => setPin(e.target.value)}
                      required
                    />
                  </div>
                  <button
                    id="join-event-btn"
                    type="submit"
                    className="btn btn-primary"
                    disabled={loading}
                    style={{ width: '100%', marginTop: 8 }}
                  >
                    {loading ? <span className="animate-spin" style={{ display: 'inline-block', width: 18, height: 18, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%' }} /> : '🔑 Acceder al panel'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
