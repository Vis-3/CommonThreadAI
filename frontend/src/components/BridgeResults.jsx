import { useEffect, useState } from 'react'
import useDNAStore from '../store/useDNAStore'

const SECTIONS = [
  { key: 'film',        icon: '🎬', label: 'Film & TV',       color: '#b48ef4' },
  { key: 'music',       icon: '🎵', label: 'Music',           color: '#5ecfcf' },
  { key: 'local_scene', icon: '🍽', label: 'Local Scene',     color: '#f4b942' },
  { key: 'book',        icon: '📚', label: 'Books',           color: '#81C784' },
  { key: 'youtube',     icon: '▶',  label: 'YouTube Content', color: '#FF7043' },
]

// ─── Recommendation section ──────────────────────────────────────────────────

function Section({ icon, label, color, why, items, visible }) {
  return (
    <div
      className="rounded-xl p-6 transition-all duration-500"
      style={{
        background: '#111827',
        border: '1px solid #1f2937',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(24px)',
      }}
    >
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xl leading-none">{icon}</span>
        <h3 className="text-base font-semibold" style={{ color }}>{label}</h3>
      </div>

      {why && (
        <div
          className="mb-4 pl-3 py-2 rounded-r-lg text-sm text-[#c9cdd4] leading-relaxed italic"
          style={{ borderLeft: `3px solid ${color}`, background: `${color}0d` }}
        >
          {why}
        </div>
      )}

      {items && items.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {items.map((item, i) => (
            <span
              key={i}
              className="px-3 py-1 rounded-full text-sm"
              style={{
                background: `${color}18`,
                border: `1px solid ${color}40`,
                color,
              }}
            >
              {item}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-xs text-[#4b5563] italic">No recommendations available.</p>
      )}
    </div>
  )
}

// ─── Local match card ────────────────────────────────────────────────────────

function LocalMatchCard({ local, visible, onChatOpen }) {
  const token = useDNAStore((s) => s.currentUser?.token)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleConnect() {
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/conversations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ other_user_id: local.user_id }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.detail || data.message || 'Could not open conversation.')
        return
      }
      onChatOpen(data.conversation_id || data.id, local)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="rounded-xl p-4 transition-all duration-500 flex items-center justify-between gap-4"
      style={{
        background: '#111827',
        border: '1px solid #1f2937',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(24px)',
      }}
    >
      {/* Avatar + name */}
      <div className="flex items-center gap-3 min-w-0">
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
          style={{ background: '#5ecfcf22', color: '#5ecfcf', border: '1px solid #5ecfcf40' }}
        >
          {(local.display_name || '?')[0].toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="text-[#e8e8e8] text-sm font-medium truncate">{local.display_name}</p>
          <p className="text-[#6b7280] text-xs">{local.state}</p>
        </div>
      </div>

      {/* Connect button */}
      <div className="shrink-0">
        {error && <p className="text-red-400 text-xs mb-1 text-right">{error}</p>}
        <button
          onClick={handleConnect}
          disabled={loading}
          className="px-4 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
          style={{ border: '1px solid #5ecfcf', color: '#5ecfcf', background: 'transparent' }}
        >
          {loading ? 'Opening…' : 'Connect'}
          {!loading && (
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          )}
        </button>
      </div>
    </div>
  )
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function BridgeResults({ bridgeResults, userState, onChatOpen }) {
  // 5 rec sections + locals section = 6 animation slots
  const [visible, setVisible] = useState([false, false, false, false, false, false])

  useEffect(() => {
    const timers = [0, 1, 2, 3, 4, 5].map((i) =>
      setTimeout(
        () => setVisible((prev) => { const n = [...prev]; n[i] = true; return n }),
        i * 150,
      ),
    )
    return () => timers.forEach(clearTimeout)
  }, [])

  const data = bridgeResults || {}
  const matchedLocals = Array.isArray(data.matched_locals) ? data.matched_locals : []

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-[#e8e8e8] mb-1">
          Your culture → {userState}
        </h2>
        <p className="text-[#9ca3af] text-sm">
          People already here who share your taste also love these
        </p>
      </div>

      {/* Recommendation sections */}
      <div className="space-y-4 mb-8">
        {SECTIONS.map((sec, i) => {
          const bucket = data[sec.key] || {}
          return (
            <Section
              key={sec.key}
              icon={sec.icon}
              label={sec.label}
              color={sec.color}
              why={bucket.why || ''}
              items={bucket.items || []}
              visible={visible[i]}
            />
          )
        })}
      </div>

      {/* Local connections */}
      {matchedLocals.length > 0 && (
        <div
          className="transition-all duration-500"
          style={{ opacity: visible[5] ? 1 : 0, transform: visible[5] ? 'translateY(0)' : 'translateY(24px)' }}
        >
          <div className="mb-3">
            <h3 className="text-sm font-semibold text-[#e8e8e8]">
              Students already in {userState} with your taste
            </h3>
            <p className="text-xs text-[#6b7280] mt-0.5">
              Start a conversation — they know the local scene firsthand
            </p>
          </div>
          <div className="space-y-3">
            {matchedLocals.map((local, i) => (
              <LocalMatchCard
                key={local.user_id || i}
                local={local}
                visible={visible[3]}
                onChatOpen={onChatOpen}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
