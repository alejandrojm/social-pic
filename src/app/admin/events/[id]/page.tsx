'use client'
import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import QRCode from 'react-qr-code'
import { supabase, Event, Photo } from '@/lib/supabase'
import { getAdminSession, clearAdminSession, saveAdminSession } from '@/lib/auth'
import { formatDate, timeAgo } from '@/lib/utils'

type Tab = 'photos' | 'qr' | 'settings'

export default function EventAdminPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [event, setEvent] = useState<Event | null>(null)
  const [photos, setPhotos] = useState<Photo[]>([])
  const [activeTab, setActiveTab] = useState<Tab>('photos')
  const [filterStatus, setFilterStatus] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending')
  const [loading, setLoading] = useState(true)
  const [pinVerified, setPinVerified] = useState(false)
  const [pinInput, setPinInput] = useState('')
  const [pinError, setPinError] = useState('')
  const [pinLoading, setPinLoading] = useState(false)
  const [qrUrl, setQrUrl] = useState('')
  const [newPin, setNewPin] = useState('')
  const [savingPin, setSavingPin] = useState(false)
  const [pinMsg, setPinMsg] = useState('')
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null)

  useEffect(() => {
    // Check if already have a valid session
    const session = getAdminSession()
    if (session && session.eventId === id) {
      setPinVerified(true)
      if (typeof window !== 'undefined') {
        setQrUrl(`${window.location.origin}/upload/${id}`)
      }
      loadData()
    } else {
      // No session — show PIN form but still load event name for display
      setLoading(false)
    }
  }, [id])

  const handlePinVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!pinInput.trim()) return
    setPinLoading(true)
    setPinError('')
    try {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('id', id)
        .single()
      if (error || !data) {
        setPinError('Evento no encontrado.')
        return
      }
      const allPins = [data.admin_pin, ...(data.extra_pins || [])]
      if (!allPins.includes(pinInput.trim())) {
        setPinError('PIN incorrecto. Intenta de nuevo.')
        return
      }
      saveAdminSession({
        eventId: data.id,
        eventName: data.name,
        pin: pinInput.trim(),
        expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      })
      setEvent(data)
      setPinVerified(true)
      if (typeof window !== 'undefined') {
        setQrUrl(`${window.location.origin}/upload/${id}`)
      }
      // Load photos
      const { data: photosData } = await supabase
        .from('photos')
        .select('*')
        .eq('event_id', id)
        .order('created_at', { ascending: false })
      if (photosData) setPhotos(photosData)
    } finally {
      setPinLoading(false)
    }
  }

  // Realtime subscription for new photos
  useEffect(() => {
    const channel = supabase
      .channel(`admin-photos-${id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'photos',
        filter: `event_id=eq.${id}`,
      }, () => { loadPhotos() })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [id])

  const loadData = async () => {
    setLoading(true)
    const [eventRes, photosRes] = await Promise.all([
      supabase.from('events').select('*').eq('id', id).single(),
      supabase.from('photos').select('*').eq('event_id', id).order('created_at', { ascending: false }),
    ])
    if (eventRes.data) setEvent(eventRes.data)
    if (photosRes.data) setPhotos(photosRes.data)
    setLoading(false)
  }

  const loadPhotos = async () => {
    const { data } = await supabase
      .from('photos')
      .select('*')
      .eq('event_id', id)
      .order('created_at', { ascending: false })
    if (data) setPhotos(data)
  }

  const updatePhotoStatus = async (photoId: string, status: 'approved' | 'rejected') => {
    await supabase.from('photos').update({ status }).eq('id', photoId)
    setPhotos(prev => prev.map(p => p.id === photoId ? { ...p, status } : p))
    if (selectedPhoto?.id === photoId) setSelectedPhoto(prev => prev ? { ...prev, status } : null)
  }

  const deletePhoto = async (photoId: string) => {
    if (!confirm('¿Eliminar esta foto definitivamente?')) return
    await supabase.from('photos').delete().eq('id', photoId)
    setPhotos(prev => prev.filter(p => p.id !== photoId))
    setSelectedPhoto(null)
  }

  const addPin = async () => {
    if (!newPin.trim() || newPin.length < 4 || !event) return
    setSavingPin(true)
    const updatedPins = [...(event.extra_pins || []), newPin.trim()]
    const { error } = await supabase
      .from('events')
      .update({ extra_pins: updatedPins })
      .eq('id', id)
    if (!error) {
      setEvent({ ...event, extra_pins: updatedPins })
      setNewPin('')
      setPinMsg('PIN agregado correctamente.')
      setTimeout(() => setPinMsg(''), 3000)
    }
    setSavingPin(false)
  }

  const removePin = async (pinToRemove: string) => {
    if (!event) return
    const updatedPins = event.extra_pins.filter(p => p !== pinToRemove)
    await supabase.from('events').update({ extra_pins: updatedPins }).eq('id', id)
    setEvent({ ...event, extra_pins: updatedPins })
  }

  const downloadQR = () => {
    const svg = document.getElementById('event-qr-svg')
    if (!svg) return
    const svgData = new XMLSerializer().serializeToString(svg)
    const blob = new Blob([svgData], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `qr-${event?.name || 'evento'}.svg`
    a.click()
    URL.revokeObjectURL(url)
  }

  const filteredPhotos = filterStatus === 'all' ? photos : photos.filter(p => p.status === filterStatus)
  const counts = {
    pending: photos.filter(p => p.status === 'pending').length,
    approved: photos.filter(p => p.status === 'approved').length,
    rejected: photos.filter(p => p.status === 'rejected').length,
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="animate-spin" style={{ width: 48, height: 48, border: '3px solid rgba(139,92,246,0.3)', borderTopColor: 'var(--brand-primary)', borderRadius: '50%', margin: '0 auto 16px' }} />
          <p style={{ color: 'var(--text-secondary)' }}>Cargando panel...</p>
        </div>
      </div>
    )
  }

  // PIN verification gate
  if (!pinVerified) {
    return (
      <div className="page" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <nav className="navbar">
          <div className="navbar-inner">
            <Link href="/" className="navbar-brand">📸 Social Pic</Link>
          </div>
        </nav>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 24px' }}>
          <div className="animate-fade-in-scale" style={{ width: '100%', maxWidth: 420 }}>
            <div style={{ textAlign: 'center', marginBottom: 32 }}>
              <div style={{ fontSize: '3rem', marginBottom: 12 }}>🔐</div>
              <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', marginBottom: 8 }}>Acceso al panel</h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Ingresa tu PIN para administrar este evento</p>
            </div>
            <div className="card">
              <div className="card-body" style={{ padding: 32 }}>
                {pinError && (
                  <div style={{ padding: '12px 16px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius-sm)', color: '#EF4444', fontSize: '0.875rem', marginBottom: 20 }}>
                    ⚠️ {pinError}
                  </div>
                )}
                <form onSubmit={handlePinVerify} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div className="form-group">
                    <label className="form-label">PIN de administrador</label>
                    <input
                      id="pin-verify-input"
                      className="form-input"
                      type="text"
                      placeholder="Tu PIN"
                      value={pinInput}
                      onChange={e => setPinInput(e.target.value)}
                      autoFocus
                      required
                    />
                  </div>
                  <button
                    id="pin-verify-btn"
                    type="submit"
                    className="btn btn-primary"
                    disabled={pinLoading}
                    style={{ width: '100%' }}
                  >
                    {pinLoading
                      ? <span className="animate-spin" style={{ display: 'inline-block', width: 18, height: 18, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%' }} />
                      : '🔑 Entrar al panel'}
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!event) return null


  return (
    <div className="page">
      {/* Navbar */}
      <nav className="navbar">
        <div className="navbar-inner">
          <Link href="/" className="navbar-brand">📸 Social Pic</Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Link href={`/gallery/${id}`} target="_blank" className="btn btn-secondary btn-sm">
              🖥️ Ver galería
            </Link>
            <button
              id="logout-btn"
              onClick={() => { clearAdminSession(); router.push('/admin') }}
              className="btn btn-secondary btn-sm"
            >
              Salir
            </button>
          </div>
        </div>
      </nav>

      <div className="container" style={{ paddingTop: 40, paddingBottom: 80 }}>
        {/* Event Header */}
        <div className="animate-fade-in" style={{ marginBottom: 40 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                <span className={`badge badge-${event.status}`}>
                  {event.status === 'active' ? '🟢 Activo' : event.status === 'paused' ? '⏸ Pausado' : '🔴 Finalizado'}
                </span>
              </div>
              <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2.2rem', marginBottom: 6 }}>{event.name}</h1>
              <p style={{ color: 'var(--text-secondary)' }}>
                📅 {formatDate(event.date)}
                {event.description && <span style={{ marginLeft: 16 }}>· {event.description}</span>}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8, fontSize: '0.75rem' }}>
              <div style={{ textAlign: 'center', padding: '12px 20px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 12 }}>
                <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#F59E0B' }}>{counts.pending}</div>
                <div style={{ color: 'var(--text-muted)' }}>Pendientes</div>
              </div>
              <div style={{ textAlign: 'center', padding: '12px 20px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 12 }}>
                <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#10B981' }}>{counts.approved}</div>
                <div style={{ color: 'var(--text-muted)' }}>Aprobadas</div>
              </div>
              <div style={{ textAlign: 'center', padding: '12px 20px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 12 }}>
                <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#EF4444' }}>{counts.rejected}</div>
                <div style={{ color: 'var(--text-muted)' }}>Rechazadas</div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border-subtle)', marginBottom: 32 }}>
          {([
            { key: 'photos', label: '📷 Fotos' },
            { key: 'qr', label: '📱 QR Code' },
            { key: 'settings', label: '⚙️ Configuración' },
          ] as { key: Tab; label: string }[]).map(tab => (
            <button
              key={tab.key}
              id={`tab-${tab.key}`}
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: '12px 20px',
                background: 'none',
                borderBottom: activeTab === tab.key ? '2px solid var(--brand-primary)' : '2px solid transparent',
                color: activeTab === tab.key ? 'var(--brand-primary)' : 'var(--text-secondary)',
                fontWeight: 600,
                fontSize: '0.9rem',
                fontFamily: 'var(--font-display)',
                transition: 'all 0.2s',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* === TAB: PHOTOS === */}
        {activeTab === 'photos' && (
          <div className="animate-fade-in">
            {/* Filter */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
              {([
                { key: 'pending', label: `Pendientes (${counts.pending})` },
                { key: 'approved', label: `Aprobadas (${counts.approved})` },
                { key: 'rejected', label: `Rechazadas (${counts.rejected})` },
                { key: 'all', label: `Todas (${photos.length})` },
              ] as { key: typeof filterStatus; label: string }[]).map(f => (
                <button
                  key={f.key}
                  id={`filter-${f.key}`}
                  onClick={() => setFilterStatus(f.key)}
                  className={`btn btn-sm ${filterStatus === f.key ? 'btn-primary' : 'btn-secondary'}`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {filteredPhotos.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--text-muted)' }}>
                <div style={{ fontSize: '3rem', marginBottom: 16 }}>📭</div>
                <p>No hay fotos {filterStatus !== 'all' ? `${filterStatus === 'pending' ? 'pendientes' : filterStatus === 'approved' ? 'aprobadas' : 'rechazadas'}` : ''} aún.</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
                {filteredPhotos.map(photo => (
                  <div
                    key={photo.id}
                    className="card animate-fade-in"
                    style={{ cursor: 'pointer', position: 'relative', overflow: 'hidden' }}
                    onClick={() => setSelectedPhoto(photo)}
                  >
                    <div style={{ aspectRatio: '1', overflow: 'hidden', background: 'var(--bg-elevated)' }}>
                      <img
                        src={photo.url}
                        alt={photo.caption || 'Foto del evento'}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.3s' }}
                        onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.05)')}
                        onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
                      />
                    </div>
                    <div style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span className={`badge badge-${photo.status}`} style={{ fontSize: '0.65rem', padding: '2px 8px' }}>
                          {photo.status === 'pending' ? 'Pendiente' : photo.status === 'approved' ? '✓ Aprobada' : '✗ Rechazada'}
                        </span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{timeAgo(photo.created_at)}</span>
                      </div>
                      <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: 6 }}>
                        👤 {photo.uploader_name}
                        {photo.likes_count > 0 && <span style={{ marginLeft: 8 }}>❤️ {photo.likes_count}</span>}
                      </p>
                    </div>
                    {/* Quick Actions */}
                    {photo.status === 'pending' && (
                      <div style={{ display: 'flex', position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent)' }}>
                        <button
                          id={`approve-${photo.id}`}
                          onClick={e => { e.stopPropagation(); updatePhotoStatus(photo.id, 'approved') }}
                          style={{ flex: 1, padding: '10px', color: '#10B981', fontWeight: 700, fontSize: '0.8rem', background: 'transparent' }}
                        >
                          ✓ Aprobar
                        </button>
                        <button
                          id={`reject-${photo.id}`}
                          onClick={e => { e.stopPropagation(); updatePhotoStatus(photo.id, 'rejected') }}
                          style={{ flex: 1, padding: '10px', color: '#EF4444', fontWeight: 700, fontSize: '0.8rem', background: 'transparent' }}
                        >
                          ✗ Rechazar
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* === TAB: QR === */}
        {activeTab === 'qr' && (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 32, padding: '20px 0' }}>
            <div style={{ textAlign: 'center', maxWidth: 480 }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', marginBottom: 8 }}>QR para subir fotos</h2>
              <p style={{ color: 'var(--text-secondary)' }}>
                Comparte este código con tus invitados. Al escanearlo, podrán subir fotos directamente desde su celular.
              </p>
            </div>

            <div className="qr-container animate-pulse-glow">
              {qrUrl && (
                <QRCode
                  id="event-qr-svg"
                  value={qrUrl}
                  size={240}
                  level="H"
                />
              )}
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: '#111', fontSize: '1.1rem' }}>{event.name}</p>
                <p style={{ color: '#666', fontSize: '0.8rem' }}>{formatDate(event.date)}</p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
              <button id="download-qr-btn" onClick={downloadQR} className="btn btn-primary">
                ⬇️ Descargar QR
              </button>
              <button
                id="copy-link-btn"
                onClick={() => { navigator.clipboard.writeText(qrUrl); alert('Link copiado!') }}
                className="btn btn-secondary"
              >
                📋 Copiar link
              </button>
            </div>

            <div style={{ padding: '16px 24px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', textAlign: 'center', maxWidth: 400 }}>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 8 }}>URL de subida</p>
              <code style={{ fontSize: '0.85rem', color: 'var(--text-accent)', wordBreak: 'break-all' }}>{qrUrl}</code>
            </div>
          </div>
        )}

        {/* === TAB: SETTINGS === */}
        {activeTab === 'settings' && (
          <div className="animate-fade-in" style={{ maxWidth: 560 }}>
            <div className="card" style={{ marginBottom: 24 }}>
              <div className="card-body">
                <h3 style={{ fontFamily: 'var(--font-display)', marginBottom: 20 }}>🔐 Administradores adicionales</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: 20 }}>
                  Agrega PINs para que otras personas puedan acceder al panel y moderar fotos.
                </p>
                <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
                  <input
                    id="new-pin-input"
                    className="form-input"
                    type="text"
                    placeholder="Nuevo PIN (min. 4 caracteres)"
                    value={newPin}
                    onChange={e => setNewPin(e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <button
                    id="add-pin-btn"
                    onClick={addPin}
                    disabled={savingPin || newPin.length < 4}
                    className="btn btn-primary"
                  >
                    Agregar
                  </button>
                </div>
                {pinMsg && <p style={{ color: 'var(--status-approved)', fontSize: '0.875rem', marginBottom: 12 }}>✓ {pinMsg}</p>}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--bg-elevated)', borderRadius: 8 }}>
                    <div>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>PIN principal (tuyo)</span>
                      <p style={{ fontWeight: 700, fontFamily: 'monospace', fontSize: '1rem' }}>{event.admin_pin}</p>
                    </div>
                    <span className="badge badge-active">Principal</span>
                  </div>
                  {event.extra_pins.map((p, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--bg-elevated)', borderRadius: 8 }}>
                      <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{p}</span>
                      <button
                        onClick={() => removePin(p)}
                        className="btn btn-danger btn-sm"
                      >
                        Eliminar
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-body">
                <h3 style={{ fontFamily: 'var(--font-display)', marginBottom: 16 }}>🔗 ID del evento</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: 12 }}>
                  Comparte este ID con otros administradores para que puedan acceder al panel.
                </p>
                <div style={{ display: 'flex', gap: 10 }}>
                  <code style={{ flex: 1, padding: '10px 14px', background: 'var(--bg-elevated)', borderRadius: 8, fontSize: '0.8rem', color: 'var(--text-accent)', wordBreak: 'break-all' }}>
                    {id}
                  </code>
                  <button
                    id="copy-id-btn"
                    onClick={() => { navigator.clipboard.writeText(id); alert('ID copiado!') }}
                    className="btn btn-secondary btn-sm"
                  >
                    Copiar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Photo Modal */}
      {selectedPhoto && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
          onClick={() => setSelectedPhoto(null)}
        >
          <div
            className="animate-fade-in-scale"
            style={{ background: 'var(--bg-card)', borderRadius: 20, overflow: 'hidden', maxWidth: 700, width: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ position: 'relative', flex: 1, overflow: 'hidden', maxHeight: 480, background: '#000' }}>
              <img src={selectedPhoto.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            </div>
            <div style={{ padding: '20px 24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <div>
                  <p style={{ fontWeight: 600 }}>👤 {selectedPhoto.uploader_name}</p>
                  {selectedPhoto.caption && <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{selectedPhoto.caption}</p>}
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{timeAgo(selectedPhoto.created_at)} · ❤️ {selectedPhoto.likes_count}</p>
                </div>
                <span className={`badge badge-${selectedPhoto.status}`}>
                  {selectedPhoto.status === 'pending' ? 'Pendiente' : selectedPhoto.status === 'approved' ? 'Aprobada' : 'Rechazada'}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {selectedPhoto.status !== 'approved' && (
                  <button onClick={() => updatePhotoStatus(selectedPhoto.id, 'approved')} className="btn btn-success btn-sm">✓ Aprobar</button>
                )}
                {selectedPhoto.status !== 'rejected' && (
                  <button onClick={() => updatePhotoStatus(selectedPhoto.id, 'rejected')} className="btn btn-danger btn-sm">✗ Rechazar</button>
                )}
                <button onClick={() => deletePhoto(selectedPhoto.id)} className="btn btn-danger btn-sm">🗑️ Eliminar</button>
                <button onClick={() => setSelectedPhoto(null)} className="btn btn-secondary btn-sm" style={{ marginLeft: 'auto' }}>Cerrar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
