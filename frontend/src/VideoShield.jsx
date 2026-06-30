import { useState } from 'react'
import { authFetch, getToken } from './auth'

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

// Démo Pôle 2 : appelle la route vidéo protégée par AuthGuard + AntiScrapingGuard,
// affiche le watermark forensic en overlay, et permet de simuler une attaque
// (spam de requêtes) pour montrer le blocage en direct.
export default function VideoShield() {
  const [manifest, setManifest] = useState(null)
  const [error, setError] = useState(null)
  const [attackLog, setAttackLog] = useState([])
  const [attacking, setAttacking] = useState(false)

  async function loadVideo() {
    setError(null)
    const res = await authFetch('/video/demo-video/manifest')
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setError(`${res.status} - ${JSON.stringify(body)}`)
      setManifest(null)
      return
    }
    setManifest(await res.json())
  }

  async function simulateAttack() {
    setAttacking(true)
    setAttackLog([])
    const token = getToken()
    for (let i = 1; i <= 20; i++) {
      const res = await fetch(`${API}/video/demo-video/manifest`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      setAttackLog((prev) => [
        ...prev,
        `requête ${i} -> ${res.status} ${res.status === 200 ? '✅' : '🚫 BLOQUÉ'}`,
      ])
      await new Promise((r) => setTimeout(r, 80))
    }
    setAttacking(false)
  }

  if (!getToken()) {
    return (
      <section style={{ maxWidth: 480, margin: '2rem auto', textAlign: 'left' }}>
        <h2>🛡️ Lecteur vidéo protégé (Pôle 2)</h2>
        <p>Connectez-vous ci-dessus pour accéder à la démo.</p>
      </section>
    )
  }

  return (
    <section style={{ maxWidth: 480, margin: '2rem auto', textAlign: 'left' }}>
      <h2>🛡️ Lecteur vidéo protégé (Pôle 2)</h2>
      <button onClick={loadVideo}>Charger la vidéo protégée</button>

      {error && <p style={{ color: 'crimson' }}>Accès refusé : {error}</p>}

      {manifest && (
        <div
          style={{
            position: 'relative',
            background: '#111',
            color: '#fff',
            padding: '2rem 1rem',
            marginTop: '1rem',
            borderRadius: 8,
          }}
        >
          <p>🎬 Vidéo : {manifest.videoId}</p>
          <p style={{ fontSize: '0.75rem', opacity: 0.8 }}>
            Watermark forensic : {manifest.watermark.text}
          </p>
        </div>
      )}

      <div style={{ marginTop: '1.5rem' }}>
        <button onClick={simulateAttack} disabled={attacking}>
          {attacking ? 'Simulation en cours...' : '🤖 Simuler une attaque (bot scraper)'}
        </button>
        {attackLog.length > 0 && (
          <pre
            style={{
              background: '#f4f4f4',
              padding: '0.75rem',
              marginTop: '0.5rem',
              maxHeight: 220,
              overflowY: 'auto',
              fontSize: '0.8rem',
            }}
          >
            {attackLog.join('\n')}
          </pre>
        )}
      </div>
    </section>
  )
}
