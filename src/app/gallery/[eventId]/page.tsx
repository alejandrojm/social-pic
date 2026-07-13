'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase, Event, Photo } from '@/lib/supabase'
import { getSessionId } from '@/lib/auth'

type ViewMode = 'slideshow' | 'mosaic' | 'grid'

export default function GalleryPage() {
  const { eventId } = useParams<{ eventId: string }>()
  const [event, setEvent] = useState<Event | null>(null)
  const [photos, setPhotos] = useState<Photo[]>([])
  const [mode, setMode] = useState<ViewMode>('slideshow')
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [isPlaying, setIsPlaying] = useState(true)
  const [showControls, setShowControls] = useState(true)
  const [likedPhotos, setLikedPhotos] = useState<Set<string>>(new Set())
  const [justLiked, setJustLiked] = useState<string | null>(null)
  const [fullscreenPhoto, setFullscreenPhoto] = useState<Photo | null>(null)
  const [transition, setTransition] = useState(true)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const controlsTimer = useRef<NodeJS.Timeout | null>(null)
  const sessionId = useRef<string>('')
  const SLIDE_DURATION = 5000

  useEffect(() => {
    sessionId.current = getSessionId()
    loadData()
    loadLikedPhotos()
  }, [eventId])

  // Realtime subscription for new approved photos
  useEffect(() => {
    const channel = supabase
      .channel(`gallery-${eventId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'photos',
        filter: `event_id=eq.${eventId}`,
      }, payload => {
        const updated = payload.new as Photo
        if (updated.status === 'approved') {
          setPhotos(prev => {
            const exists = prev.find(p => p.id === updated.id)
            if (exists) return prev.map(p => p.id === updated.id ? updated : p)
            return [...prev, updated]
          })
        } else {
          setPhotos(prev => prev.filter(p => p.id !== updated.id))
        }
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'photos',
        filter: `event_id=eq.${eventId}`,
      }, payload => {
        const photo = payload.new as Photo
        if (photo.status === 'approved') {
          setPhotos(prev => [...prev, photo])
        }
      })
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'photos',
        filter: `event_id=eq.${eventId}`,
      }, payload => {
        setPhotos(prev => prev.filter(p => p.id !== (payload.old as Photo).id))
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [eventId])

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (fullscreenPhoto) {
        if (e.key === 'Escape') setFullscreenPhoto(null)
        return
      }
      if (e.key === 'ArrowRight' || e.key === ' ') next()
      if (e.key === 'ArrowLeft') prev()
      if (e.key === 'f' || e.key === 'F') toggleFullscreen()
      if (e.key === 'm' || e.key === 'M') setMode(m => m === 'slideshow' ? 'mosaic' : m === 'mosaic' ? 'grid' : 'slideshow')
      if (e.key === 'p' || e.key === 'P') setIsPlaying(p => !p)
      showControlsTemporarily()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [photos, currentIndex, fullscreenPhoto])

  // Auto-advance slideshow
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    if (mode === 'slideshow' && isPlaying && photos.length > 0) {
      intervalRef.current = setInterval(() => {
        setCurrentIndex(i => (i + 1) % photos.length)
      }, SLIDE_DURATION)
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [mode, isPlaying, photos.length])

  // Hide controls after inactivity
  useEffect(() => {
    if (mode !== 'slideshow') return
    showControlsTemporarily()
  }, [mode])

  const showControlsTemporarily = () => {
    setShowControls(true)
    if (controlsTimer.current) clearTimeout(controlsTimer.current)
    controlsTimer.current = setTimeout(() => setShowControls(false), 3500)
  }

  const loadData = async () => {
    const [eventRes, photosRes] = await Promise.all([
      supabase.from('events').select('*').eq('id', eventId).single(),
      supabase.from('photos').select('*').eq('event_id', eventId).eq('status', 'approved').order('created_at', { ascending: false }),
    ])
    if (eventRes.data) setEvent(eventRes.data)
    if (photosRes.data) setPhotos(photosRes.data)
    setLoading(false)
  }

  const loadLikedPhotos = async () => {
    const { data } = await supabase
      .from('likes')
      .select('photo_id')
      .eq('session_id', sessionId.current)
    if (data) setLikedPhotos(new Set(data.map(l => l.photo_id)))
  }

  const next = useCallback(() => {
    if (photos.length === 0) return
    setTransition(false)
    setTimeout(() => {
      setCurrentIndex(i => (i + 1) % photos.length)
      setTransition(true)
    }, 50)
  }, [photos.length])

  const prev = useCallback(() => {
    if (photos.length === 0) return
    setCurrentIndex(i => (i - 1 + photos.length) % photos.length)
  }, [photos.length])

  const toggleLike = async (photo: Photo, e?: React.MouseEvent) => {
    e?.stopPropagation()
    const sid = sessionId.current
    const isLiked = likedPhotos.has(photo.id)

    // Optimistic update
    setPhotos(prev => prev.map(p => p.id === photo.id
      ? { ...p, likes_count: isLiked ? p.likes_count - 1 : p.likes_count + 1 }
      : p
    ))
    setLikedPhotos(prev => {
      const next = new Set(prev)
      isLiked ? next.delete(photo.id) : next.add(photo.id)
      return next
    })
    if (!isLiked) {
      setJustLiked(photo.id)
      setTimeout(() => setJustLiked(null), 500)
    }
    if (fullscreenPhoto?.id === photo.id) {
      setFullscreenPhoto(prev => prev ? { ...prev, likes_count: isLiked ? prev.likes_count - 1 : prev.likes_count + 1 } : null)
    }

    if (isLiked) {
      await supabase.from('likes').delete().eq('photo_id', photo.id).eq('session_id', sid)
    } else {
      await supabase.from('likes').insert({ photo_id: photo.id, session_id: sid })
    }
  }

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.()
    } else {
      document.exitFullscreen?.()
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="animate-spin" style={{ width: 48, height: 48, border: '3px solid rgba(139,92,246,0.3)', borderTopColor: 'var(--brand-primary)', borderRadius: '50%' }} />
      </div>
    )
  }

  const currentPhoto = photos[currentIndex]

  return (
    <div
      style={{ minHeight: '100vh', background: '#000', overflow: 'hidden', position: 'relative' }}
      onMouseMove={showControlsTemporarily}
    >
      {/* Mode Switcher (top bar) */}
      <div
        style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
          padding: '16px 24px',
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, transparent 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          transition: 'opacity 0.4s',
          opacity: showControls || mode !== 'slideshow' ? 1 : 0,
          pointerEvents: showControls || mode !== 'slideshow' ? 'auto' : 'none',
        }}
      >
        <Link href="/" style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.2rem', background: 'var(--brand-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
          📸 Social Pic
        </Link>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {event && (
            <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem', marginRight: 12 }}>{event.name}</span>
          )}
          {([
            { key: 'slideshow', icon: '▶', label: 'Slideshow' },
            { key: 'mosaic', icon: '⊞', label: 'Mosaico' },
            { key: 'grid', icon: '⊟', label: 'Grid' },
          ] as { key: ViewMode; icon: string; label: string }[]).map(m => (
            <button
              key={m.key}
              id={`mode-${m.key}`}
              onClick={() => setMode(m.key)}
              style={{
                padding: '6px 14px',
                borderRadius: 99,
                background: mode === m.key ? 'var(--brand-gradient)' : 'rgba(255,255,255,0.1)',
                color: 'white',
                fontSize: '0.8rem',
                fontWeight: 600,
                backdropFilter: 'blur(10px)',
                border: mode === m.key ? 'none' : '1px solid rgba(255,255,255,0.15)',
                transition: 'all 0.2s',
              }}
            >
              {m.icon} {m.label}
            </button>
          ))}
          <Link href={`/upload/${eventId}`} style={{ padding: '6px 14px', borderRadius: 99, background: 'rgba(255,255,255,0.1)', color: 'white', fontSize: '0.8rem', fontWeight: 600, backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.15)' }}>
            📷 Subir
          </Link>
        </div>
      </div>

      {/* ======================== SLIDESHOW MODE ======================== */}
      {mode === 'slideshow' && (
        <>
          {photos.length === 0 ? (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, color: 'rgba(255,255,255,0.4)' }}>
              <div style={{ fontSize: '4rem' }}>📭</div>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem' }}>Esperando fotos aprobadas...</p>
              <Link href={`/upload/${eventId}`} className="btn btn-primary" style={{ marginTop: 8 }}>Ser el primero en subir</Link>
            </div>
          ) : (
            <>
              {/* Main Photo */}
              <div
                style={{
                  position: 'fixed', inset: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
                onClick={showControlsTemporarily}
              >
                {currentPhoto && (
                  <div key={currentPhoto.id} style={{ position: 'relative', width: '100%', height: '100%' }}>
                    {/* Blurred background */}
                    <div style={{
                      position: 'absolute', inset: 0,
                      backgroundImage: `url(${currentPhoto.url})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                      filter: 'blur(30px) brightness(0.3)',
                      transform: 'scale(1.1)',
                    }} />
                    {/* Main image */}
                    <img
                      src={currentPhoto.url}
                      alt={currentPhoto.caption || ''}
                      style={{
                        position: 'absolute', inset: 0,
                        width: '100%', height: '100%',
                        objectFit: 'contain',
                        opacity: transition ? 1 : 0,
                        transition: 'opacity 0.6s ease',
                      }}
                    />
                    {/* Caption & likes */}
                    <div style={{
                      position: 'absolute', bottom: 0, left: 0, right: 0,
                      padding: '80px 40px 40px',
                      background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 100%)',
                      display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
                      opacity: showControls ? 1 : 0,
                      transition: 'opacity 0.4s',
                    }}>
                      <div>
                        <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.9rem' }}>👤 {currentPhoto.uploader_name}</p>
                        {currentPhoto.caption && <p style={{ color: 'white', fontSize: '1.1rem', fontWeight: 500, marginTop: 4 }}>{currentPhoto.caption}</p>}
                      </div>
                      <button
                        id={`like-slide-${currentPhoto.id}`}
                        onClick={e => toggleLike(currentPhoto, e)}
                        className={`like-btn ${likedPhotos.has(currentPhoto.id) ? 'liked' : ''} ${justLiked === currentPhoto.id ? 'just-liked' : ''}`}
                        style={{ backdropFilter: 'blur(10px)' }}
                      >
                        <span className="heart">{likedPhotos.has(currentPhoto.id) ? '❤️' : '🤍'}</span>
                        {currentPhoto.likes_count > 0 && currentPhoto.likes_count}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Controls */}
              <div style={{
                position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 60,
                padding: '24px',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16,
                opacity: showControls ? 1 : 0,
                transition: 'opacity 0.4s',
                pointerEvents: showControls ? 'auto' : 'none',
              }}>
                <button id="prev-btn" onClick={prev} style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', color: 'white', fontSize: '1.2rem', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.2)' }}>‹</button>
                <button id="play-pause-btn" onClick={() => setIsPlaying(p => !p)} style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', color: 'white', fontSize: '1rem', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.2)' }}>
                  {isPlaying ? '⏸' : '▶'}
                </button>
                <button id="next-btn" onClick={next} style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', color: 'white', fontSize: '1.2rem', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.2)' }}>›</button>
                <button id="fullscreen-btn" onClick={toggleFullscreen} style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', color: 'white', fontSize: '1rem', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.2)' }}>⛶</button>

                {/* Dot indicators */}
                <div style={{ display: 'flex', gap: 4, maxWidth: 200, overflow: 'hidden' }}>
                  {photos.slice(Math.max(0, currentIndex - 3), currentIndex + 4).map((_, i) => {
                    const actualIndex = Math.max(0, currentIndex - 3) + i
                    return (
                      <button
                        key={actualIndex}
                        onClick={() => setCurrentIndex(actualIndex)}
                        style={{
                          width: actualIndex === currentIndex ? 20 : 6,
                          height: 6,
                          borderRadius: 99,
                          background: actualIndex === currentIndex ? 'var(--brand-primary)' : 'rgba(255,255,255,0.3)',
                          transition: 'all 0.3s',
                        }}
                      />
                    )
                  })}
                </div>

                <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem' }}>{currentIndex + 1} / {photos.length}</span>
              </div>
            </>
          )}
        </>
      )}

      {/* ======================== MOSAIC MODE ======================== */}
      {mode === 'mosaic' && (
        <div style={{ minHeight: '100vh', background: '#0a0a0a', padding: '80px 4px 4px', overflow: 'auto' }}>
          {photos.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '80vh', flexDirection: 'column', gap: 16, color: 'rgba(255,255,255,0.4)' }}>
              <div style={{ fontSize: '4rem' }}>📭</div>
              <p>No hay fotos aprobadas aún.</p>
            </div>
          ) : (
            <div className="mosaic">
              {photos.map((photo, i) => (
                <div
                  key={photo.id}
                  className="mosaic-item animate-fade-in"
                  style={{ animationDelay: `${(i % 12) * 50}ms`, cursor: 'pointer', position: 'relative' }}
                  onClick={() => setFullscreenPhoto(photo)}
                >
                  <img src={photo.url} alt={photo.caption || ''} style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.4s, filter 0.3s' }}
                    onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.03)'; e.currentTarget.style.filter = 'brightness(1.1)' }}
                    onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.filter = '' }}
                  />
                  {/* Hover overlay */}
                  <div style={{ position: 'absolute', inset: 0, opacity: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 60%)', transition: 'opacity 0.3s', display: 'flex', alignItems: 'flex-end', padding: 10 }}
                    onMouseEnter={e => { e.currentTarget.style.opacity = '1' }}
                    onMouseLeave={e => { e.currentTarget.style.opacity = '0' }}
                  >
                    <button
                      id={`like-mosaic-${photo.id}`}
                      onClick={ev => toggleLike(photo, ev)}
                      style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(0,0,0,0.5)', border: 'none', color: likedPhotos.has(photo.id) ? '#EC4899' : 'white', padding: '4px 10px', borderRadius: 99, fontSize: '0.8rem', backdropFilter: 'blur(6px)' }}
                    >
                      {likedPhotos.has(photo.id) ? '❤️' : '🤍'} {photo.likes_count > 0 && photo.likes_count}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ======================== GRID MODE ======================== */}
      {mode === 'grid' && (
        <div style={{ minHeight: '100vh', background: '#0a0a0a', padding: '80px 16px 40px', overflow: 'auto' }}>
          {photos.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '80vh', flexDirection: 'column', gap: 16, color: 'rgba(255,255,255,0.4)' }}>
              <div style={{ fontSize: '4rem' }}>📭</div>
              <p>No hay fotos aprobadas aún.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12, maxWidth: 1400, margin: '0 auto' }}>
              {photos.map((photo, i) => (
                <div
                  key={photo.id}
                  className="card animate-fade-in"
                  style={{ animationDelay: `${(i % 12) * 40}ms`, cursor: 'pointer', overflow: 'hidden' }}
                  onClick={() => setFullscreenPhoto(photo)}
                >
                  <div style={{ aspectRatio: '4/3', overflow: 'hidden', background: '#111' }}>
                    <img
                      src={photo.url}
                      alt={photo.caption || ''}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.4s' }}
                      onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.05)')}
                      onMouseLeave={e => (e.currentTarget.style.transform = '')}
                    />
                  </div>
                  <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ flex: 1, overflow: 'hidden' }}>
                      <p style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        👤 {photo.uploader_name}
                      </p>
                      {photo.caption && <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{photo.caption}</p>}
                    </div>
                    <button
                      id={`like-grid-${photo.id}`}
                      onClick={e => toggleLike(photo, e)}
                      className={`like-btn ${likedPhotos.has(photo.id) ? 'liked' : ''} ${justLiked === photo.id ? 'just-liked' : ''}`}
                    >
                      <span className="heart">{likedPhotos.has(photo.id) ? '❤️' : '🤍'}</span>
                      {photo.likes_count > 0 && photo.likes_count}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ======================== FULLSCREEN PHOTO MODAL ======================== */}
      {fullscreenPhoto && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.96)', zIndex: 200, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setFullscreenPhoto(null)}
        >
          <button
            id="close-fullscreen-btn"
            onClick={() => setFullscreenPhoto(null)}
            style={{ position: 'absolute', top: 24, right: 24, width: 44, height: 44, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', color: 'white', fontSize: '1.2rem', backdropFilter: 'blur(10px)', zIndex: 201 }}
          >
            ✕
          </button>
          <div
            className="animate-fade-in-scale"
            style={{ maxWidth: '90vw', maxHeight: '80vh', position: 'relative' }}
            onClick={e => e.stopPropagation()}
          >
            <img
              src={fullscreenPhoto.url}
              alt={fullscreenPhoto.caption || ''}
              style={{ maxWidth: '90vw', maxHeight: '75vh', objectFit: 'contain', borderRadius: 12 }}
            />
          </div>
          <div
            style={{ display: 'flex', alignItems: 'center', gap: 20, marginTop: 20, padding: '0 24px' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.9rem' }}>
              👤 {fullscreenPhoto.uploader_name}
              {fullscreenPhoto.caption && <span style={{ marginLeft: 12, color: 'white' }}>"{fullscreenPhoto.caption}"</span>}
            </div>
            <button
              id={`like-fullscreen-${fullscreenPhoto.id}`}
              onClick={() => toggleLike(fullscreenPhoto)}
              className={`like-btn ${likedPhotos.has(fullscreenPhoto.id) ? 'liked' : ''} ${justLiked === fullscreenPhoto.id ? 'just-liked' : ''}`}
              style={{ backdropFilter: 'blur(10px)' }}
            >
              <span className="heart">{likedPhotos.has(fullscreenPhoto.id) ? '❤️' : '🤍'}</span>
              {fullscreenPhoto.likes_count > 0 && fullscreenPhoto.likes_count}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
