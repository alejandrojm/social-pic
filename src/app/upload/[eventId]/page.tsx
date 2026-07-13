'use client'
import { useState, useRef, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase, Event } from '@/lib/supabase'

export default function UploadPage() {
  const { eventId } = useParams<{ eventId: string }>()
  const [event, setEvent] = useState<Event | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [uploaderName, setUploaderName] = useState('')
  const [caption, setCaption] = useState('')
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [dragOver, setDragOver] = useState(false)
  const [uploadedCount, setUploadedCount] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadEvent()
    // Restore name from localStorage
    const saved = localStorage.getItem('socialpic_uploader_name')
    if (saved) setUploaderName(saved)
  }, [eventId])

  const loadEvent = async () => {
    const { data } = await supabase.from('events').select('*').eq('id', eventId).single()
    setEvent(data)
    setLoading(false)
  }

  const handleFiles = (files: FileList | File[]) => {
    const arr = Array.from(files).filter(f => f.type.startsWith('image/'))
    if (!arr.length) return
    setSelectedFiles(arr)
    const urls = arr.map(f => URL.createObjectURL(f))
    setPreviews(prev => { prev.forEach(u => URL.revokeObjectURL(u)); return urls })
    setSuccess(false)
    setError('')
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    handleFiles(e.dataTransfer.files)
  }

  const uploadFiles = async () => {
    if (!selectedFiles.length) return
    setUploading(true)
    setError('')
    setUploadedCount(0)

    const name = uploaderName.trim() || 'Anónimo'
    localStorage.setItem('socialpic_uploader_name', name)

    let successCount = 0

    for (const file of selectedFiles) {
      try {
        // Upload to Supabase Storage
        const ext = file.name.split('.').pop()
        const fileName = `${eventId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
        const { data: storageData, error: storageError } = await supabase.storage
          .from('photos')
          .upload(fileName, file, { cacheControl: '3600', upsert: false })

        if (storageError) throw storageError

        // Get public URL
        const { data: { publicUrl } } = supabase.storage.from('photos').getPublicUrl(fileName)

        // Insert photo record
        const { error: dbError } = await supabase.from('photos').insert({
          event_id: eventId,
          url: publicUrl,
          thumbnail_url: publicUrl,
          uploader_name: name,
          caption: caption.trim() || null,
          status: 'pending',
          likes_count: 0,
        })

        if (dbError) throw dbError
        successCount++
        setUploadedCount(successCount)
      } catch (err) {
        console.error('Upload error:', err)
      }
    }

    setUploading(false)
    if (successCount > 0) {
      setSuccess(true)
      setSelectedFiles([])
      setPreviews([])
      setCaption('')
    } else {
      setError('No se pudieron subir las fotos. Intenta de nuevo.')
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="animate-spin" style={{ width: 40, height: 40, border: '3px solid rgba(139,92,246,0.3)', borderTopColor: 'var(--brand-primary)', borderRadius: '50%' }} />
      </div>
    )
  }

  if (!event) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 24 }}>
        <div>
          <div style={{ fontSize: '3rem', marginBottom: 16 }}>🔍</div>
          <h1 style={{ fontFamily: 'var(--font-display)', marginBottom: 8 }}>Evento no encontrado</h1>
          <p style={{ color: 'var(--text-secondary)' }}>El enlace puede estar incorrecto o el evento ya no está disponible.</p>
          <Link href="/" className="btn btn-primary" style={{ marginTop: 24, display: 'inline-flex' }}>Ir al inicio</Link>
        </div>
      </div>
    )
  }

  if (event.status === 'ended') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 24 }}>
        <div>
          <div style={{ fontSize: '3rem', marginBottom: 16 }}>🏁</div>
          <h1 style={{ fontFamily: 'var(--font-display)', marginBottom: 8 }}>Evento finalizado</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Este evento ya no acepta nuevas fotos.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="page" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '24px 24px 0', textAlign: 'center' }}>
        <Link href="/" style={{ display: 'inline-block', marginBottom: 20 }}>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.3rem', background: 'var(--brand-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
            📸 Social Pic
          </span>
        </Link>
        <div className="animate-fade-in">
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.5rem, 5vw, 2.2rem)', marginBottom: 8 }}>{event.name}</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            📅 {new Date(event.date).toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '32px 24px 48px' }}>
        <div className="animate-fade-in-scale" style={{ width: '100%', maxWidth: 480 }}>
          {success ? (
            // Success State
            <div style={{ textAlign: 'center', padding: '48px 24px' }}>
              <div style={{ fontSize: '4rem', marginBottom: 16, animation: 'heart-pop 0.6s ease' }}>🎉</div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', marginBottom: 12 }}>¡Foto{uploadedCount > 1 ? 's' : ''} enviada{uploadedCount > 1 ? 's' : ''}!</h2>
              <p style={{ color: 'var(--text-secondary)', marginBottom: 8 }}>
                Subiste <strong>{uploadedCount}</strong> foto{uploadedCount > 1 ? 's' : ''} correctamente.
              </p>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: 32 }}>
                El administrador las revisará antes de publicarlas en la galería.
              </p>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
                <button
                  id="upload-more-btn"
                  onClick={() => { setSuccess(false); setUploadedCount(0) }}
                  className="btn btn-primary"
                >
                  📷 Subir más fotos
                </button>
                <Link href={`/gallery/${eventId}`} className="btn btn-secondary">
                  🖼️ Ver galería
                </Link>
              </div>
            </div>
          ) : (
            // Upload Form
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {error && (
                <div style={{ padding: '12px 16px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius-sm)', color: '#EF4444', fontSize: '0.875rem' }}>
                  ⚠️ {error}
                </div>
              )}

              {/* Name */}
              <div className="form-group">
                <label className="form-label">Tu nombre (opcional)</label>
                <input
                  id="uploader-name"
                  className="form-input"
                  type="text"
                  placeholder="¿Cómo te llamas?"
                  value={uploaderName}
                  onChange={e => setUploaderName(e.target.value)}
                />
              </div>

              {/* Caption */}
              <div className="form-group">
                <label className="form-label">Mensaje (opcional)</label>
                <input
                  id="photo-caption"
                  className="form-input"
                  type="text"
                  placeholder="Describe el momento..."
                  value={caption}
                  onChange={e => setCaption(e.target.value)}
                />
              </div>

              {/* Drop Zone */}
              <div
                id="upload-dropzone"
                className={`upload-zone ${dragOver ? 'drag-over' : ''}`}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                style={{ position: 'relative', zIndex: 1 }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={e => e.target.files && handleFiles(e.target.files)}
                  style={{ display: 'none' }}
                />
                {previews.length > 0 ? (
                  <div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 12 }}>
                      {previews.slice(0, 9).map((url, i) => (
                        <div key={i} style={{ aspectRatio: '1', borderRadius: 8, overflow: 'hidden' }}>
                          <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </div>
                      ))}
                    </div>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', position: 'relative', zIndex: 1 }}>
                      {selectedFiles.length} foto{selectedFiles.length > 1 ? 's' : ''} seleccionada{selectedFiles.length > 1 ? 's' : ''} · Toca para cambiar
                    </p>
                  </div>
                ) : (
                  <div style={{ position: 'relative', zIndex: 1 }}>
                    <div style={{ fontSize: '3.5rem', marginBottom: 12 }}>📷</div>
                    <p style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '1.1rem', marginBottom: 8 }}>
                      Toca para seleccionar fotos
                    </p>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      O arrastra fotos aquí · Puedes subir varias a la vez
                    </p>
                  </div>
                )}
              </div>

              {/* Upload Button */}
              <button
                id="upload-btn"
                onClick={uploadFiles}
                disabled={!selectedFiles.length || uploading}
                className="btn btn-primary btn-lg"
                style={{ width: '100%', opacity: !selectedFiles.length ? 0.5 : 1 }}
              >
                {uploading ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span className="animate-spin" style={{ display: 'inline-block', width: 18, height: 18, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%' }} />
                    Subiendo {uploadedCount > 0 ? `${uploadedCount}/${selectedFiles.length}` : ''}...
                  </span>
                ) : `📤 Enviar ${selectedFiles.length > 1 ? `${selectedFiles.length} fotos` : 'foto'}`}
              </button>

              <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                Las fotos serán revisadas por el administrador antes de aparecer en la galería.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
