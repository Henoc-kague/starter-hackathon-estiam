import { useState, useEffect, useRef } from 'react'
import { io } from 'socket.io-client'
import { authFetch, getToken } from './auth'

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

/**
 * Pôle 1 - Sujet A : Lecteur de Revue augmenté.
 * - Annotations rattachées à un timecode, posées en cliquant sur la vidéo
 * - Synchronisation temps réel entre utilisateurs via WebSockets
 * - Export JSON des annotations
 * - Composant autonome : reçoit videoId en prop
 */
export default function ReviewPlayer({ videoId = 'demo-video' }) {
  const [manifest, setManifest] = useState(null)
  const [error, setError] = useState(null)
  const [annotations, setAnnotations] = useState([])
  const [viewersCount, setViewersCount] = useState(0)
  const [pendingAnnotation, setPendingAnnotation] = useState(null)
  const [noteText, setNoteText] = useState('')

  const videoRef = useRef(null)
  const socketRef = useRef(null)
  const token = getToken()

  // Charge le manifest vidéo (route protégée Pôle 2)
  useEffect(() => {
    if (!token) return
    async function load() {
      const res = await authFetch(`/video/${videoId}/manifest`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(`${res.status} - ${JSON.stringify(body)}`)
        return
      }
      setManifest(await res.json())
    }
    load()
  }, [videoId, token])

  // Connexion WebSocket pour les annotations temps réel
  useEffect(() => {
    if (!token) return
    const socket = io(API)
    socketRef.current = socket

    socket.emit('join-video', { videoId })

    socket.on('annotations-history', (history) => setAnnotations(history))
    socket.on('new-annotation', (a) => setAnnotations((prev) => [...prev, a]))
    socket.on('viewers-count', (count) => setViewersCount(count))

    return () => socket.disconnect()
  }, [videoId, token])

  function handleVideoClick(e) {
    if (!videoRef.current) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = Math.round(((e.clientX - rect.left) / rect.width) * 100)
    const y = Math.round(((e.clientY - rect.top) / rect.height) * 100)
    const timecode = Math.floor(videoRef.current.currentTime)
    setPendingAnnotation({ x, y, timecode })
  }

  function submitAnnotation() {
    if (!pendingAnnotation || !noteText.trim()) return
    socketRef.current.emit('add-annotation', {
      videoId,
      x: pendingAnnotation.x,
      y: pendingAnnotation.y,
      timecode: pendingAnnotation.timecode,
      text: noteText,
      author: 'moi', // remplacé côté serveur si on relie req.user plus tard
    })
    setPendingAnnotation(null)
    setNoteText('')
  }

  function jumpTo(timecode) {
    if (videoRef.current) videoRef.current.currentTime = timecode
  }

  function exportJSON() {
    const blob = new Blob([JSON.stringify(annotations, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `annotations-${videoId}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  function formatTime(sec) {
    const m = Math.floor(sec / 60)
    const s = sec % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  if (!token) {
    return (
      <section style={{ maxWidth: 700, margin: '2rem auto', textAlign: 'left' }}>
        <h2>🎬 Lecteur de Revue augmenté (Pôle 1)</h2>
        <p>Connectez-vous ci-dessus pour accéder à la démo.</p>
      </section>
    )
  }

  const streamUrl = manifest ? `${API}${manifest.manifestUrl}?token=${encodeURIComponent(token)}` : null

  return (
    <section style={{ maxWidth: 700, margin: '2rem auto', textAlign: 'left' }}>
      <h2>🎬 Lecteur de Revue augmenté (Pôle 1)</h2>
      <p style={{ fontSize: '0.85rem', opacity: 0.8 }}>
        👥 {viewersCount} personne(s) en revue sur cette vidéo · cliquez sur la vidéo pour annoter
      </p>

      {error && <p style={{ color: 'crimson' }}>Accès refusé : {error}</p>}

      {streamUrl && (
        <div
          style={{ position: 'relative', cursor: 'crosshair' }}
          onClick={handleVideoClick}
        >
          <video
            ref={videoRef}
            controls
            width="100%"
            style={{ borderRadius: 8, background: '#000', display: 'block' }}
            src={streamUrl}
          />
          {/* Marqueurs d'annotations existantes, positionnés sur l'image */}
          {annotations.map((a) => (
            <div
              key={a.id}
              title={`${a.author} à ${formatTime(a.timecode)} : ${a.text}`}
              style={{
                position: 'absolute',
                left: `${a.x}%`,
                top: `${a.y}%`,
                width: 16,
                height: 16,
                borderRadius: '50%',
                background: '#e63946',
                border: '2px solid white',
                transform: 'translate(-50%, -50%)',
                pointerEvents: 'none',
              }}
            />
          ))}
        </div>
      )}

      {pendingAnnotation && (
        <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem' }}>
          <input
            autoFocus
            placeholder={`Commentaire à ${formatTime(pendingAnnotation.timecode)}...`}
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submitAnnotation()}
            style={{ flex: 1, padding: '0.4rem' }}
          />
          <button onClick={submitAnnotation}>Ajouter</button>
          <button onClick={() => setPendingAnnotation(null)}>Annuler</button>
        </div>
      )}

      <div style={{ marginTop: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>Annotations ({annotations.length})</h3>
          <button onClick={exportJSON}>⬇️ Exporter en JSON</button>
        </div>
        <ul style={{ listStyle: 'none', padding: 0, marginTop: '0.5rem' }}>
          {annotations
            .slice()
            .sort((a, b) => a.timecode - b.timecode)
            .map((a) => (
              <li
                key={a.id}
                onClick={() => jumpTo(a.timecode)}
                style={{
                  padding: '0.5rem',
                  borderBottom: '1px solid #eee',
                  cursor: 'pointer',
                }}
              >
                <strong>{formatTime(a.timecode)}</strong> — {a.text}
                <span style={{ opacity: 0.6, fontSize: '0.8rem' }}> ({a.author})</span>
              </li>
            ))}
        </ul>
      </div>
    </section>
  )
}
