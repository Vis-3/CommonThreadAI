import { useState } from 'react'
import useDNAStore from '../store/useDNAStore'

export default function MatchCard({ match, currentUser, onChatOpen }) {
  const token = useDNAStore((s) => s.currentUser?.token)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [tooltipVisible, setTooltipVisible] = useState(false)

  const overlapPct = Math.round((match.overlap_score || 0) * 100)
  const sharedSpots = match.shared_blind_spots || []
  const isSimulated = match.simulated === true

  async function handleCompareNotes() {
    if (isSimulated) return
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/conversations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ other_user_id: match.user_id }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.detail || data.message || 'Could not open conversation.')
        return
      }
      onChatOpen(data.conversation_id || data.id, match)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="rounded-2xl p-5 mb-4"
      style={{ background: '#111827', border: '1px solid #1f2937' }}
    >
      {/* Simulated banner */}
      {isSimulated && (
        <div
          className="mb-4 px-3 py-2 rounded-lg text-xs leading-relaxed"
          style={{ background: '#f4b94215', border: '1px solid #f4b94230', color: '#f4b942' }}
        >
          Simulated match — real matching requires more users. Your DNA extraction was real.
        </div>
      )}

      {/* User info */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-[#e8e8e8] font-semibold text-base">{match.display_name}</h3>
          <p className="text-[#9ca3af] text-sm mt-0.5">
            {match.university}
            {match.state ? ` · ${match.state}` : ''}
          </p>
        </div>
      </div>

      {/* Overlap bar */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-1.5">
          <span className="text-xs text-[#9ca3af]">Taste overlap</span>
          <span className="text-sm font-semibold" style={{ color: '#f4b942' }}>
            {overlapPct}%
          </span>
        </div>
        <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: '#1f2937' }}>
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${overlapPct}%`,
              background: 'linear-gradient(90deg, #f4b942, #5ecfcf)',
            }}
          />
        </div>
      </div>

      {/* Shared blind spots */}
      {sharedSpots.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-semibold text-[#6b7280] uppercase tracking-wide mb-2">
            Shared Blind Spots
          </p>
          <div className="space-y-2">
            {sharedSpots.map((spot, i) => (
              <div
                key={i}
                className="px-3 py-2 rounded-lg text-sm"
                style={{ background: '#5ecfcf10', border: '1px solid #5ecfcf25' }}
              >
                <span className="text-[#e8e8e8] font-medium">{spot.title || spot.name || spot}</span>
                <span className="text-[#6b7280] text-xs block mt-0.5">
                  You both point toward this
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="text-red-400 text-xs mb-3">{error}</p>
      )}

      {/* Compare notes button */}
      <div className="relative inline-block w-full">
        <button
          onClick={isSimulated ? undefined : handleCompareNotes}
          disabled={isSimulated || loading}
          onMouseEnter={() => isSimulated && setTooltipVisible(true)}
          onMouseLeave={() => setTooltipVisible(false)}
          className="w-full py-2.5 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 disabled:cursor-not-allowed"
          style={{
            border: isSimulated ? '1px solid #2d3748' : '1px solid #5ecfcf',
            color: isSimulated ? '#4a5568' : '#5ecfcf',
            background: 'transparent',
            opacity: isSimulated ? 0.6 : 1,
          }}
        >
          {loading ? 'Opening...' : 'Compare notes'}
          {!loading && (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          )}
        </button>

        {/* Tooltip for simulated */}
        {tooltipVisible && isSimulated && (
          <div
            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 rounded text-xs whitespace-nowrap z-10"
            style={{ background: '#0a0f1e', border: '1px solid #2d3748', color: '#9ca3af' }}
          >
            Chat only available with real users
          </div>
        )}
      </div>
    </div>
  )
}
