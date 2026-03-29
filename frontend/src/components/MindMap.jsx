import { useEffect, useRef, useState, useMemo, useCallback } from 'react'

// ── Canvas constants ───────────────────────────────────────────────────────────
const LW = 1000, LH = 900
const CX = 500,  CY = 450   // "You" center

const HUB_DIST     = 90  // YOU → category hub
const CLUSTER_DIST = 180  // hub center → honeycomb cluster centroid
const HEX_R        = 47   // hexagon circumradius (normal)
const HEX_R_HOV    = 50   // hexagon circumradius (hovered)
const HUB_R        = 40  // category hub circle radius

const CLUSTER_DEFS = [
  { type: 'theme',     label: 'Themes',     color: '#68127d' },
  { type: 'emotion',   label: 'Emotions',   color: '#C49A20' },
  { type: 'aesthetic', label: 'Aesthetics', color: '#4E7A52' },
  { type: 'origin',    label: 'Origins',    color: '#3A7090' },
  { type: 'taste',     label: 'Taste',      color: '#8a2616' },
]

// ── Honeycomb cluster positions (axial hex coords for flat-top hexes) ──────────
// Each entry lists the axial (q, r) coords of hexes in a compact cluster of that size.
// Adjacent hex center-to-center distance = HEX_R * √3 (exact edge sharing).
const AXIAL_CLUSTERS = [
  [],
  [[0, 0]],
  [[0, 0], [1, 0]],
  [[0, 0], [1, 0], [0, 1]],
  [[0, 0], [1, 0], [0, 1], [1, -1]],
  [[0, 0], [1, 0], [0, 1], [1, -1], [-1, 0]],
  [[0, 0], [1, 0], [0, 1], [1, -1], [-1, 0], [-1, 1]],
]

/**
 * Convert axial hex coords to centered pixel offsets (flat-top orientation).
 * Hexes share edges exactly (no gap, no overlap).
 */
function clusterOffsets(n) {
  const coords = AXIAL_CLUSTERS[Math.min(n, 6)] || []
  if (!coords.length) return []
  // s = spacing so adjacent centers are exactly HEX_R * √3 apart (edge-sharing)
  const s = HEX_R
  const pixels = coords.map(([q, r]) => ({
    x: s * (3 / 2) * q,
    y: s * (Math.sqrt(3) / 2 * q + Math.sqrt(3) * r),
  }))
  const avgX = pixels.reduce((sum, p) => sum + p.x, 0) / pixels.length
  const avgY = pixels.reduce((sum, p) => sum + p.y, 0) / pixels.length
  return pixels.map(p => ({ x: p.x - avgX, y: p.y - avgY }))
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function prng(seed) {
  let s = (Math.abs(seed) | 0) || 1
  return () => { s ^= s << 13; s ^= s >> 17; s ^= s << 5; return (s >>> 0) / 0xffffffff }
}

/** Flat-top hexagon path centered at (cx, cy) with radius r */
function hexPath(cx, cy, r) {
  const pts = Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)]
  })
  return pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ') + 'Z'
}

/** Split a label into at most 2 lines for display inside a hexagon */
function splitLabel(label) {
  if (label.length <= 10) return [label]
  const words = label.split(' ')
  if (words.length === 1) return [label.slice(0, 9) + '…']
  const mid = Math.ceil(words.length / 2)
  const line1 = words.slice(0, mid).join(' ')
  const line2 = words.slice(mid).join(' ')
  return [
    line1.length > 11 ? line1.slice(0, 10) + '…' : line1,
    line2.length > 11 ? line2.slice(0, 10) + '…' : line2,
  ]
}

function makeParticles(count = 55, seed = 42) {
  const rand = prng(seed)
  return Array.from({ length: count }, () => ({
    x: rand() * LW, y: rand() * LH,
    r: 0.5 + rand() * 1.2,
    op: 0.07 + rand() * 0.18,
    dur: (6 + rand() * 10).toFixed(1),
    del: (rand() * -15).toFixed(1),
  }))
}

// ── Layout builder ─────────────────────────────────────────────────────────────
function buildLayout(dnaProfile) {
  const map = {
    theme:     dnaProfile?.dominant_themes           || [],
    emotion:   dnaProfile?.dominant_emotions         || [],
    aesthetic: dnaProfile?.aesthetic_signatures      || [],
    origin:    dnaProfile?.cultural_origins_detected || [],
    taste:     dnaProfile?.taste_palette             || [],
  }

  const rand = prng(77)

  return CLUSTER_DEFS.map((def, i) => {
    const hubAngle = (2 * Math.PI * i / 5) - Math.PI / 2
    const hx = CX + HUB_DIST * Math.cos(hubAngle)
    const hy = CY + HUB_DIST * Math.sin(hubAngle)

    // Cluster centroid (the geometric center of the honeycomb patch)
    const clusterCx = hx + CLUSTER_DIST * Math.cos(hubAngle)
    const clusterCy = hy + CLUSTER_DIST * Math.sin(hubAngle)

    const labels = (map[def.type] || []).slice(0, 6)
    const n = labels.length
    const offsets = clusterOffsets(n)

    const leaves = labels.map((label, j) => ({
      id: `${def.type}-${j}`,
      label,
      type: def.type,
      lx: clusterCx + (offsets[j]?.x ?? 0),
      ly: clusterCy + (offsets[j]?.y ?? 0),
    }))

    // Which leaf is closest to the hub? → single connection line endpoint
    let closestIdx = 0
    let minDist = Infinity
    leaves.forEach((leaf, j) => {
      const d = Math.hypot(leaf.lx - hx, leaf.ly - hy)
      if (d < minDist) { minDist = d; closestIdx = j }
    })

    // Per-cluster float animation
    const fdx = ((rand() - 0.5) * 8).toFixed(2)
    const fdy = ((rand() - 0.5) * 8).toFixed(2)
    const fdur = (5 + rand() * 5).toFixed(1)
    const fdel = (rand() * -12).toFixed(1)

    return { ...def, hx, hy, hubAngle, clusterCx, clusterCy, leaves, closestIdx, fdx, fdy, fdur, fdel }
  })
}

// ── Component ──────────────────────────────────────────────────────────────────
export default function MindMap({ dnaProfile, onContinue, fullscreen = false }) {
  const wrapperRef   = useRef(null)
  const containerRef = useRef(null)
  const dragRef      = useRef(null)
  const touchRef     = useRef(null)

  const [dims, setDims]               = useState({ w: 700, h: 560 })
  const [visible, setVisible]         = useState(false)
  const [pulse, setPulse]             = useState(false)
  const [isBrowserFS, setIsBrowserFS] = useState(false)
  const [hoveredId, setHoveredId]     = useState(null)
  const [hoveredCluster, setHoveredCluster] = useState(null)

  const [tx, setTx]       = useState(0)
  const [ty, setTy]       = useState(0)
  const [scale, setScale] = useState(1)

  const layout    = useMemo(() => buildLayout(dnaProfile), [dnaProfile])
  const particles = useMemo(() => makeParticles(55), [])

  // Measure
  useEffect(() => {
    function measure() {
      if (!containerRef.current) return
      const w = containerRef.current.offsetWidth
      const h = isBrowserFS
        ? window.innerHeight - 100
        : fullscreen ? Math.max(window.innerHeight - 210, 400) : 560
      setDims({ w, h })
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [fullscreen, isBrowserFS])

  useEffect(() => {
    const t1 = setTimeout(() => setVisible(true), 60)
    const t2 = setInterval(() => setPulse((p) => !p), 950)
    return () => { clearTimeout(t1); clearInterval(t2) }
  }, [])

  useEffect(() => {
    const onChange = () => setIsBrowserFS(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  function toggleFullscreen() {
    if (!document.fullscreenElement) wrapperRef.current?.requestFullscreen()
    else document.exitFullscreen()
  }

  function zoomBy(factor) {
    setScale((s) => {
      const next = Math.min(Math.max(s * factor, 0.2), 5)
      const w = dims.w, h = dims.h
      setTx((x) => w / 2 - (w / 2 - x) * (next / s))
      setTy((y) => h / 2 - (h / 2 - y) * (next / s))
      return next
    })
  }

  useEffect(() => {
    if (!dims.w || !dims.h) return
    const s = Math.min((dims.w - 40) / LW, (dims.h - 20) / LH, 1)
    setScale(s)
    setTx((dims.w - LW * s) / 2)
    setTy((dims.h - LH * s) / 2)
  }, [dims])

  const handleWheel = useCallback((e) => {
    e.preventDefault()
    const factor = e.deltaY < 0 ? 1.06 : 0.94
    setScale((s) => {
      const next = Math.min(Math.max(s * factor, 0.2), 5)
      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect) return next
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top
      setTx((x) => mx - (mx - x) * (next / s))
      setTy((y) => my - (my - y) * (next / s))
      return next
    })
  }, [])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleWheel)
  }, [handleWheel])

  const onMouseDown = useCallback((e) => {
    if (e.button !== 0) return
    dragRef.current = { sx: e.clientX, sy: e.clientY, tx0: tx, ty0: ty }
  }, [tx, ty])
  const onMouseMove = useCallback((e) => {
    if (!dragRef.current) return
    setTx(dragRef.current.tx0 + e.clientX - dragRef.current.sx)
    setTy(dragRef.current.ty0 + e.clientY - dragRef.current.sy)
  }, [])
  const onMouseUp = useCallback(() => { dragRef.current = null }, [])

  const onTouchStart = useCallback((e) => {
    if (e.touches.length !== 1) return
    touchRef.current = { sx: e.touches[0].clientX, sy: e.touches[0].clientY, tx0: tx, ty0: ty }
  }, [tx, ty])
  const onTouchMove = useCallback((e) => {
    if (!touchRef.current || e.touches.length !== 1) return
    e.preventDefault()
    setTx(touchRef.current.tx0 + e.touches[0].clientX - touchRef.current.sx)
    setTy(touchRef.current.ty0 + e.touches[0].clientY - touchRef.current.sy)
  }, [])
  const onTouchEnd = useCallback(() => { touchRef.current = null }, [])

  const themes     = dnaProfile?.dominant_themes           || []
  const emotions   = dnaProfile?.dominant_emotions         || []
  const aesthetics = dnaProfile?.aesthetic_signatures      || []
  const origins    = dnaProfile?.cultural_origins_detected || []
  const taste      = dnaProfile?.taste_palette             || []

  return (
    <div
      ref={wrapperRef}
      style={{
        width: '100%',
        maxWidth: fullscreen && !isBrowserFS ? '100%' : 900,
        margin: '0 auto',
        padding: isBrowserFS ? '10px 16px' : '12px 18px',
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.5s ease',
        background: 'transparent',
        minHeight: isBrowserFS ? '100vh' : undefined,
        boxSizing: 'border-box',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#e8e8e8', margin: 0 }}>Your Cultural DNA</h2>
          <p style={{ color: '#9ca3af', fontSize: 11, margin: '2px 0 0' }}>Drag to pan · Scroll to zoom · Hover nodes</p>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {[['−', 0.88], ['+', 1.14]].map(([label, factor]) => (
            <button key={label} onClick={() => zoomBy(factor)} style={{
              background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.18)',
              borderRadius: 8, color: '#c8d6c9', cursor: 'pointer',
              width: 32, height: 32, fontSize: 18, fontWeight: 300,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>{label}</button>
          ))}
          <button onClick={toggleFullscreen} style={{
            background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.18)',
            borderRadius: 8, color: '#c8d6c9', cursor: 'pointer', padding: '6px 12px', fontSize: 13,
            height: 32, display: 'flex', alignItems: 'center',
          }}>{isBrowserFS ? '✕ Exit' : '⛶ Fullscreen'}</button>
        </div>
      </div>

      {/* Canvas */}
      <div
        ref={containerRef}
        style={{
          position: 'relative',
          background: '#0a0c1a',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 16,
          overflow: 'hidden',
          marginBottom: 10,
          height: dims.h,
          cursor: dragRef.current ? 'grabbing' : 'grab',
          userSelect: 'none',
          touchAction: 'none',
        }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* Background image */}
        <img src="/bg.jpg" alt="" style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%) rotate(-90deg)',
          width: '100vh', height: '100vw',
          objectFit: 'cover', pointerEvents: 'none', filter: 'blur(5px)',
        }} />
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', pointerEvents: 'none' }} />

        <svg width={dims.w} height={dims.h} style={{ display: 'block', position: 'relative' }}>
          <defs>
            {layout.map((c) => (
              <filter key={`gf-${c.type}`} id={`glow-${c.type}`} x="-80%" y="-80%" width="260%" height="260%">
                <feGaussianBlur stdDeviation="12" result="blur" />
                <feFlood floodColor={c.color} floodOpacity="0.5" result="color" />
                <feComposite in="color" in2="blur" operator="in" result="glow" />
                <feMerge><feMergeNode in="glow" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            ))}
            <filter id="hexglow" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="6" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <filter id="hubglow" x="-80%" y="-80%" width="260%" height="260%">
              <feGaussianBlur stdDeviation="8" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>

          <g transform={`translate(${tx},${ty}) scale(${scale})`}>

            {/* ── Particles ── */}
            {particles.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r={p.r} fill="#c8d6c9" opacity={p.op}>
                <animate attributeName="opacity"
                  values={`${p.op};${(p.op * 2.5).toFixed(2)};${p.op}`}
                  dur={`${p.dur}s`} begin={`${p.del}s`} repeatCount="indefinite" />
              </circle>
            ))}

            {/* ── Lines: YOU → hub ── */}
            {layout.map((c) => {
              const dx = c.hx - CX, dy = c.hy - CY
              const dist = Math.sqrt(dx * dx + dy * dy) || 1
              const ux = dx / dist, uy = dy / dist
              const isHov = hoveredCluster === c.type
              return (
                <line key={`you-hub-${c.type}`}
                  x1={CX + ux * 23} y1={CY + uy * 23}
                  x2={c.hx - ux * HUB_R} y2={c.hy - uy * HUB_R}
                  stroke={c.color}
                  strokeWidth={isHov ? 2 : 1.2}
                  opacity={isHov ? 0.9 : 0.5}
                />
              )
            })}

            {/* ── Single line: hub → nearest hex in cluster ── */}
            {layout.map((c) => {
              if (c.leaves.length === 0) return null
              const cl = c.leaves[c.closestIdx]
              const dx = cl.lx - c.hx, dy = cl.ly - c.hy
              const dist = Math.sqrt(dx * dx + dy * dy) || 1
              const ux = dx / dist, uy = dy / dist
              const isHov = hoveredCluster === c.type
              return (
                <line key={`hub-cluster-${c.type}`}
                  x1={c.hx + ux * HUB_R} y1={c.hy + uy * HUB_R}
                  x2={cl.lx - ux * HEX_R} y2={cl.ly - uy * HEX_R}
                  stroke={c.color}
                  strokeWidth={isHov ? 2 : 1.2}
                  opacity={isHov ? 0.9 : 0.45}
                  strokeDasharray={isHov ? 'none' : '5 3'}
                />
              )
            })}

            {/* ── Category hub circles ── */}
            {layout.map((c) => {
              const isHov = hoveredCluster === c.type
              return (
                <g key={`hub-${c.type}`}
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={() => setHoveredCluster(c.type)}
                  onMouseLeave={() => setHoveredCluster(null)}
                >
                  <circle cx={c.hx} cy={c.hy} r={HUB_R + 8}
                    fill={c.color} opacity={isHov ? 0.25 : 0.12}
                    filter="url(#hubglow)"
                  />
                  <circle cx={c.hx} cy={c.hy} r={HUB_R}
                    fill={c.color} opacity={isHov ? 0.6 : 0.55}
                  />
                  <circle cx={c.hx} cy={c.hy} r={HUB_R}
                    fill="none" stroke={c.color}
                    strokeWidth={isHov ? 2 : 1.4}
                  />
                  <text
                    x={c.hx} y={c.hy}
                    textAnchor="middle" dominantBaseline="middle"
                    fill="#ffffff" fontSize={11} fontWeight="700"
                    fontFamily="Inter, sans-serif"
                    letterSpacing="0.05em"
                    opacity={0.95}
                  >
                    {c.label.toUpperCase()}
                  </text>
                </g>
              )
            })}

            {/* ── Honeycomb clusters ── */}
            {layout.map((c) => (
              <g key={`cluster-${c.type}`}>
                {/* Whole cluster floats as one unit */}
                <animateTransform
                  attributeName="transform" type="translate"
                  values={`0,0;${c.fdx},${c.fdy};0,0`}
                  dur={`${c.fdur}s`} begin={`${c.fdel}s`}
                  repeatCount="indefinite" calcMode="spline"
                  keySplines="0.45,0.05,0.55,0.95;0.45,0.05,0.55,0.95"
                />
                {c.leaves.map((leaf) => {
                  const isHov = hoveredId === leaf.id
                  const r = isHov ? HEX_R_HOV : HEX_R
                  const lines = splitLabel(leaf.label)
                  return (
                    <g key={leaf.id}
                      style={{ cursor: 'pointer' }}
                      onMouseEnter={() => { setHoveredId(leaf.id); setHoveredCluster(leaf.type) }}
                      onMouseLeave={() => { setHoveredId(null); setHoveredCluster(null) }}
                    >
                      {/* Glow on hover only */}
                      {isHov && (
                        <path
                          d={hexPath(leaf.lx, leaf.ly, r + 6)}
                          fill={c.color}
                          opacity={0.3}
                          filter="url(#hexglow)"
                        />
                      )}
                      {/* Fill */}
                      <path
                        d={hexPath(leaf.lx, leaf.ly, r)}
                        fill={c.color}
                        opacity={isHov ? 0.55 : 0.42}
                      />
                      {/* Border */}
                      <path
                        d={hexPath(leaf.lx, leaf.ly, r)}
                        fill="none"
                        stroke={c.color}
                        strokeWidth={isHov ? 2 : 1.4}
                        opacity={isHov ? 1 : 0.9}
                      />
                      {/* Text inside hexagon */}
                      {lines.length === 1 ? (
                        <text
                          x={leaf.lx} y={leaf.ly}
                          textAnchor="middle" dominantBaseline="middle"
                          fill="#ffffff"
                          fontSize={isHov ? 11 : 10}
                          fontWeight={isHov ? '700' : '500'}
                          fontFamily="Inter, sans-serif"
                          opacity={isHov ? 1 : 0.9}
                        >
                          {lines[0]}
                        </text>
                      ) : (
                        <>
                          <text
                            x={leaf.lx} y={leaf.ly - 7}
                            textAnchor="middle" dominantBaseline="middle"
                            fill="#ffffff"
                            fontSize={isHov ? 11 : 10}
                            fontWeight={isHov ? '700' : '500'}
                            fontFamily="Inter, sans-serif"
                            opacity={isHov ? 1 : 0.9}
                          >
                            {lines[0]}
                          </text>
                          <text
                            x={leaf.lx} y={leaf.ly + 8}
                            textAnchor="middle" dominantBaseline="middle"
                            fill="#ffffff"
                            fontSize={isHov ? 11 : 10}
                            fontWeight={isHov ? '700' : '500'}
                            fontFamily="Inter, sans-serif"
                            opacity={isHov ? 1 : 0.9}
                          >
                            {lines[1]}
                          </text>
                        </>
                      )}
                    </g>
                  )
                })}
              </g>
            ))}

            {/* ── Central "You" node ── */}
            <circle cx={CX} cy={CY} r={pulse ? 44 : 34} fill="#f4b942" opacity={0.08}
              style={{ transition: 'r 0.95s ease, opacity 0.95s ease' }} />
            <circle cx={CX} cy={CY} r={pulse ? 32 : 26} fill="#f4b942" opacity={0.14}
              style={{ transition: 'r 0.95s ease' }} />
            <circle cx={CX} cy={CY} r={22} fill="#f4b942" />
            <circle cx={CX} cy={CY} r={22} fill="none" stroke="#fff" strokeWidth={1} opacity={0.25} />
            <text x={CX} y={CY} textAnchor="middle" dominantBaseline="middle"
              fill="#0a0f1e" fontSize={11} fontWeight="800" fontFamily="Inter, sans-serif">
              YOU
            </text>

          </g>
        </svg>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 10, paddingLeft: 2 }}>
        {layout.map((c) => (
          <span key={c.type} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#c8d6c9' }}>
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: c.color, display: 'inline-block', flexShrink: 0 }} />
            {c.label}
          </span>
        ))}
      </div>

      {/* Summary */}
      <div style={{ background: 'rgba(8,6,20,0.6)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '12px 16px', marginBottom: 12 }}>
        {origins.length > 0 && (
          <p style={{ fontSize: 12, color: '#e8e8e8', marginBottom: 5 }}>
            <span style={{ color: '#9ca3af' }}>Cultural DNA spans </span>
            <span style={{ color: '#3A7090', fontWeight: 600 }}>{origins.join(', ')}</span>
          </p>
        )}
        {themes.length > 0 && (
          <p style={{ fontSize: 12, color: '#e8e8e8', marginBottom: taste.length > 0 ? 5 : 0 }}>
            <span style={{ color: '#9ca3af' }}>Core themes: </span>
            <span style={{ color: '#C4581E', fontWeight: 600 }}>{themes.join(', ')}</span>
          </p>
        )}
        {taste.length > 0 && (
          <p style={{ fontSize: 12, color: '#e8e8e8', marginBottom: 0 }}>
            <span style={{ color: '#9ca3af' }}>Taste palette: </span>
            <span style={{ color: '#AA4025', fontWeight: 600 }}>{taste.join(', ')}</span>
          </p>
        )}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, paddingTop: 10, marginTop: 8, borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          {[
            [themes.length,     '#C4581E', 'themes'],
            [emotions.length,   '#C49A20', 'emotions'],
            [aesthetics.length, '#4E7A52', 'aesthetics'],
            [origins.length,    '#3A7090', 'origins'],
            [taste.length,      '#AA4025', 'taste'],
          ].map(([count, color, label]) => (
            <span key={label} style={{ fontSize: 11, color: '#9ca3af' }}>
              <span style={{ color, fontWeight: 700 }}>{count}</span> {label}
            </span>
          ))}
        </div>
      </div>

      {onContinue && (
        <button
          onClick={onContinue}
          style={{
            width: '100%', padding: '12px', borderRadius: 10, border: 'none',
            fontSize: 14, color: '#0a0f1e', background: '#f4b942', cursor: 'pointer', fontWeight: 600,
          }}
        >
          Find Your Cultural Bridge →
        </button>
      )}
    </div>
  )
}
