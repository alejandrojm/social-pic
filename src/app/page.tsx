import Link from 'next/link'

export default function HomePage() {
  return (
    <main className="page" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Navbar */}
      <nav className="navbar">
        <div className="navbar-inner">
          <span className="navbar-brand">📸 Social Pic</span>
          <Link href="/admin" className="btn btn-primary btn-sm">
            Panel Admin
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 24px' }}>
        <div style={{ textAlign: 'center', maxWidth: 740 }}>
          {/* Badge */}
          <div className="animate-fade-in" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 18px', background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 99, marginBottom: 32 }}>
            <span style={{ fontSize: 14, color: 'var(--text-accent)', fontWeight: 600 }}>✨ Comparte momentos en tiempo real</span>
          </div>

          {/* Title */}
          <h1 className="animate-fade-in delay-100" style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(3rem, 8vw, 5.5rem)', fontWeight: 900, lineHeight: 1.05, letterSpacing: '-0.03em', marginBottom: 24 }}>
            <span className="text-gradient">Social Pic</span>
          </h1>

          <p className="animate-fade-in delay-200" style={{ fontSize: 'clamp(1rem, 2.5vw, 1.25rem)', color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 48, maxWidth: 560, margin: '0 auto 48px' }}>
            La forma más elegante de compartir y proyectar fotos en tus eventos. Los invitados suben, tú curas, todos disfrutan la galería en pantalla grande.
          </p>

          {/* CTAs */}
          <div className="animate-fade-in delay-300" style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/admin" className="btn btn-primary btn-lg animate-pulse-glow">
              🎛️ Crear Evento
            </Link>
            <a href="#features" className="btn btn-secondary btn-lg">
              Ver funciones
            </a>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" style={{ padding: '80px 24px', background: 'var(--bg-surface)' }}>
        <div className="container">
          <h2 style={{ textAlign: 'center', fontFamily: 'var(--font-display)', fontSize: '2rem', marginBottom: 56 }}>
            Todo lo que necesitas para tu evento
          </h2>
          <div className="grid grid-3" style={{ gap: 24 }}>
            {[
              { icon: '📱', title: 'QR para subir fotos', desc: 'Los invitados escanean el código QR y suben sus fotos directamente desde su celular, sin instalar nada.' },
              { icon: '🎛️', title: 'Moderación en tiempo real', desc: 'Tú decides qué fotos se publican. Aprueba o rechaza en segundos desde el panel de administrador.' },
              { icon: '🖥️', title: 'Galería para pantalla grande', desc: 'Slideshow automático, modo mosaico tipo iMovie, o cuadrícula. Perfecta para proyectar en TV o pantalla.' },
              { icon: '❤️', title: 'Sistema de likes', desc: 'Los asistentes pueden dar like a sus fotos favoritas. Descubre cuáles son las más populares del evento.' },
              { icon: '⚡', title: 'Tiempo real', desc: 'Cuando una foto se aprueba, aparece automáticamente en la galería. Sin recargar, sin esperar.' },
              { icon: '🔐', title: 'Acceso por PIN', desc: 'Comparte el acceso a tu panel con otros co-administradores usando PINs personalizados.' },
            ].map((feature, i) => (
              <div key={i} className="card card-hover animate-fade-in" style={{ animationDelay: `${i * 80}ms` }}>
                <div className="card-body">
                  <div style={{ fontSize: '2.5rem', marginBottom: 16 }}>{feature.icon}</div>
                  <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', marginBottom: 10 }}>{feature.title}</h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6 }}>{feature.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Bottom */}
      <section style={{ padding: '80px 24px', textAlign: 'center' }}>
        <div style={{ maxWidth: 500, margin: '0 auto' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', marginBottom: 16 }}>
            ¿Listo para tu evento?
          </h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 32 }}>
            Crea tu evento en menos de un minuto y comparte el QR con tus invitados.
          </p>
          <Link href="/admin" className="btn btn-primary btn-lg">
            🚀 Empezar ahora
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ padding: '24px', textAlign: 'center', borderTop: '1px solid var(--border-subtle)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
        <span className="text-gradient" style={{ fontWeight: 700 }}>Social Pic</span>
        {' '}— Compartir momentos que importan
      </footer>
    </main>
  )
}
