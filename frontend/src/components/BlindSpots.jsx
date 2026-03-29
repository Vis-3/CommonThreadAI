import { useEffect, useState } from 'react'

function BlindSpotCard({ spot, index }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), index * 100)
    return () => clearTimeout(t)
  }, [index])

  return (
    <div
      className="rounded-xl p-5 transition-all duration-500"
      style={{
        background: '#111827',
        border: '1px solid #1f2937',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(24px)',
      }}
    >
      {/* BLIND SPOT label */}
      <div className="flex items-center justify-between mb-3">
        <span
          className="text-xs font-bold tracking-widest uppercase"
          style={{ color: '#5ecfcf' }}
        >
          Blind Spot
        </span>
        <div className="flex gap-2">
          {spot.type && (
            <span
              className="text-xs px-2 py-0.5 rounded font-medium"
              style={{ background: '#5ecfcf15', border: '1px solid #5ecfcf30', color: '#5ecfcf' }}
            >
              {spot.type}
            </span>
          )}
          {spot.culture && (
            <span
              className="text-xs px-2 py-0.5 rounded font-medium"
              style={{ background: '#b48ef415', border: '1px solid #b48ef430', color: '#b48ef4' }}
            >
              {spot.culture}
            </span>
          )}
        </div>
      </div>

      {/* Title + Creator */}
      <h3 className="text-[#e8e8e8] font-semibold text-base mb-0.5">
        {spot.title || spot.name}
      </h3>
      {spot.creator && (
        <p className="text-[#9ca3af] text-sm mb-3">{spot.creator}</p>
      )}

      {/* Blind spot reason */}
      {spot.blind_spot_reason && (
        <p className="text-[#9ca3af] text-sm italic mb-3 leading-relaxed">
          {spot.blind_spot_reason}
        </p>
      )}

      {/* Discovery hook */}
      {spot.discovery_hook && (
        <div
          className="px-3 py-2 rounded-lg text-sm leading-relaxed"
          style={{ background: '#f4b94212', border: '1px solid #f4b94230', color: '#f4b942' }}
        >
          {spot.discovery_hook}
        </div>
      )}
    </div>
  )
}

export default function BlindSpots({ blindSpots, onFindMatch }) {
  const spots = Array.isArray(blindSpots) ? blindSpots : []

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-[#e8e8e8] mb-1">
          Your Blind Spots — Works You Were Born to Love
        </h2>
        <p className="text-[#e8e8e8] text-sm font-semibold">
          From cultures you haven't explored — but your DNA says you should.
        </p>
      </div>

      {spots.length === 0 ? (
        <div
          className="rounded-xl p-8 text-center"
          style={{ background: '#111827', border: '1px solid #1f2937' }}
        >
          <p className="text-[#6b7280]">No blind spots found.</p>
        </div>
      ) : (
        <div className="space-y-4 mb-8">
          {spots.map((spot, i) => (
            <BlindSpotCard key={i} spot={spot} index={i} />
          ))}
        </div>
      )}

      <button
        onClick={onFindMatch}
        className="w-full py-3 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
        style={{ border: '1px solid #5ecfcf', color: '#5ecfcf', background: 'transparent' }}
      >
        Find someone who shares these blind spots
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12h14M12 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  )
}
