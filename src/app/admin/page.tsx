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
  const [createdEventId, setCreatedEventId] = useState('')

  // Create event form
  const [eventName, setEventName] = useState('')
  const [eventDate, setEventDate] = useState('')
  const [adminPin, setAdminPin] = useState('')
  const [description, setDescription] = useState('')

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const searchInput = eventCode.trim()
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    const isUuid = uuidRegex.test(searchInput)

    try {
      let query = supabase.from('events').select('*')
      
      if (isUuid) {
        query = query.eq('id', searchInput)
      } else {
        query = query.ilike('name', searchInput)
      }

      const { data: events, error: err } = await query
      
      if (err) {
        setError(`Error de Supabase: ${err.code} — ${err.message}`)
        return
      }
      if (!events?.length) {
        setError('Evento no encontrado. Asegúrate de escribir el nombre de tu evento exactamente o su ID.')
        return
      }

      // Si hay múltiples eventos con el mismo nombre, buscamos el que coincida con el PIN
      const event = events.find(ev => {
        const allPins = [ev.admin_pin, ...(ev.extra_pins || [])]
        return allPins.includes(pin.trim())
      })

      if (!event) {
        setError('PIN incorrecto para este evento o no coincide con los eventos encontrados.')
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
      setCreatedEventId(data.id)
    } finally {
      setLoading(false)
    }
  }

  // Success screen after event creation
  if (createdEventId) {
    const adminUrl = typeof window !== 'undefined'
      ? `${window.location.origin}/admin/events/${createdEventId}`
      : `/admin/events/${createdEventId}`
    return (
      <div className="page" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <nav className="navbar">
          <div className="navbar-inner">
            <Link href="/" className="navbar-brand">📸 Social Pic</Link>
          </div>
        </nav>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 24px' }}>
          <div className="animate-fade-in-scale" style={{ width: '100%', maxWidth: 480, textAlign: 'center' }}>
            <div style={{ fontSize: '4rem', marginBottom: 16 }}>🎉</div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', marginBottom: 8 }}>¡Evento creado!</h1>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 32 }}>
              Guarda este link — es tu acceso al panel de administración:
            </p>
            <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-accent)', borderRadius: 'var(--radius-md)', padding: '14px 18px', marginBottom: 24, wordBreak: 'break-all', fontSize: '0.82rem', color: 'var(--text-accent)', textAlign: 'left' }}>
              {adminUrl}
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link href={`/admin/events/${createdEventId}`} className="btn btn-primary btn-lg">
                🎛️ Ir al panel del evento
              </Link>
              <button
                className="btn btn-secondary"
                onClick={() => { navigator.clipboard.writeText(adminUrl); alert('Link copiado!') }}
              >
                📋 Copiar link
              </button>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: 24 }}>
              Tu PIN: <strong style={{ color: 'var(--text-accent)' }}>{adminPin}</strong> — guárdalo también.
            </p>
          </div>
        </div>
      </div>
    )
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
                    <label className="form-label">Nombre del evento (o ID)</label>
                    <input
                      id="event-id"
                      className="form-input"
                      type="text"
                      placeholder="ej: Mi Boda"
                      value={eventCode}
                      onChange={e => setEventCode(e.target.value)}
                      required
                    />
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Escribe el nombre de tu evento exactamente como lo creaste (o usa su ID UUID largo).
                    </span>
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
