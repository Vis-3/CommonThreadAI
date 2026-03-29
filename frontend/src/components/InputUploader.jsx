import { useState, useRef, useEffect } from 'react'
import useDNAStore from '../store/useDNAStore'
import { demoData } from '../data/demoData'

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------
const ITEM_RE = /^[a-zA-Z0-9 .,'\-\(\)&:!?\/#]{1,300}$/

function validateItems(rawItems) {
  const valid = []
  let skipped = 0
  for (const item of rawItems) {
    const t = item.trim()
    if (!t) continue
    if (t.length <= 300 && ITEM_RE.test(t)) {
      valid.push(t)
    } else {
      skipped++
    }
  }
  return { valid, skipped }
}

function textToLines(text) {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
}

// ---------------------------------------------------------------------------
// File parsers — extract title strings only, never raw content
// ---------------------------------------------------------------------------
function parseYouTubeHistory(text) {
  try {
    const data = JSON.parse(text)
    if (Array.isArray(data)) {
      return data
        .map((e) => e.title || e.titleUrl || '')
        .filter(Boolean)
        .map((t) => t.replace(/^Watched\s+/i, '').trim())
    }
  } catch {
    // fall through
  }
  return textToLines(text)
}

function parseNetflixCSV(text) {
  const lines = text.split('\n').slice(1) // skip header row
  return lines
    .map((l) => l.split(',')[0]?.replace(/"/g, '').trim())
    .filter(Boolean)
}

function parseSpotifyJSON(text) {
  try {
    const data = JSON.parse(text)
    const items = Array.isArray(data) ? data : data.items ?? []
    return items
      .map((e) => e?.track?.name || e?.master_metadata_track_name || '')
      .filter(Boolean)
  } catch {
    return []
  }
}

function parseLastFmCSV(text) {
  return text
    .split('\n')
    .slice(1)
    .map((l) => l.split(',')[0]?.replace(/"/g, '').trim())
    .filter(Boolean)
}

function parseGoodreadsCSV(text) {
  const lines = text.split('\n')
  if (!lines.length) return []
  const headers = lines[0].split(',').map((h) => h.replace(/"/g, '').trim().toLowerCase())
  const titleIdx = headers.indexOf('title')
  if (titleIdx < 0) return textToLines(text)
  return lines
    .slice(1)
    .map((l) => l.split(',')[titleIdx]?.replace(/"/g, '').trim())
    .filter(Boolean)
}

function parseMusicFile(text, filename) {
  if (filename.endsWith('.json')) return parseSpotifyJSON(text)
  return parseLastFmCSV(text)
}

function parseBooksFile(text) {
  if (text.includes(',') && text.split('\n')[0].toLowerCase().includes('title')) {
    return parseGoodreadsCSV(text)
  }
  return textToLines(text)
}

// ---------------------------------------------------------------------------
// Card definitions
// ---------------------------------------------------------------------------
const CARDS = [
  {
    id: 'youtube_titles',
    title: 'YouTube',
    subtitle: 'Watch history',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
        <path d="M10 8l6 4-6 4V8z"/>
        <path fillRule="evenodd" clipRule="evenodd" d="M2 6a2 2 0 012-2h16a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V6zm2 0h16v12H4V6z" opacity="0.3"/>
        <path d="M10 8l6 4-6 4V8z"/>
      </svg>
    ),
    color: '#B00020',
    headerGradient: 'linear-gradient(135deg, #7f0016, #B00020)',
    bodyBackground: 'rgba(80, 0, 14, 0.45)',
    placeholder: 'Dil Se Full Movie HD\nAR Rahman Documentary\n...',
    fileAccept: '.json',
    fileLabel: 'YouTube watch history JSON',
    parseFile: (text) => parseYouTubeHistory(text),
  },
  {
    id: 'movies',
    title: 'Movies',
    subtitle: 'Netflix / streaming history',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="6" width="20" height="14" rx="2"/>
        <path d="M8 6V4M16 6V4"/>
        <path d="M2 10h20"/>
        <path d="M8 10v4M12 10v4M16 10v4"/>
      </svg>
    ),
    color: '#1B5E20',
    headerGradient: 'linear-gradient(135deg, #0a3d12, #1B5E20)',
    bodyBackground: 'rgba(6, 30, 9, 0.55)',
    placeholder: 'Pather Panchali\nThe Namesake\n...',
    fileAccept: '.csv',
    fileLabel: 'Netflix viewing history CSV',
    parseFile: (text) => parseNetflixCSV(text),
  },
  {
    id: 'music',
    title: 'Songs',
    subtitle: 'Artists & tracks',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 18V5l12-2v13"/>
        <circle cx="6" cy="18" r="3"/>
        <circle cx="18" cy="16" r="3"/>
      </svg>
    ),
    color: '#4A148C',
    headerGradient: 'linear-gradient(135deg, #2d0060, #4A148C)',
    bodyBackground: 'rgba(22, 0, 55, 0.55)',
    placeholder: 'AR Rahman\nNusrat Fateh Ali Khan\n...',
    fileAccept: '.csv,.json',
    fileLabel: 'Last.fm CSV or Spotify extended history JSON',
    parseFile: (text, filename) => parseMusicFile(text, filename),
  },
  {
    id: 'books',
    title: 'Books',
    subtitle: 'Reading list',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/>
        <path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/>
      </svg>
    ),
    color: '#0D47A1',
    headerGradient: 'linear-gradient(135deg, #082a6b, #0D47A1)',
    bodyBackground: 'rgba(4, 18, 55, 0.55)',
    placeholder: "The God of Small Things\nMidnight's Children\n...",
    fileAccept: '.txt,.csv',
    fileLabel: 'Plain text list or Goodreads export CSV',
    parseFile: (text) => parseBooksFile(text),
  },
  {
    id: 'food',
    title: 'Food & Places',
    subtitle: 'Cuisines & favourites',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 2v7c0 1.66 1.34 3 3 3h1v10h2V12h1c1.66 0 3-1.34 3-3V2h-2v5H9V2H7v5H5V2H3zM16 2v20h2V14h3V2h-5z"/>
      </svg>
    ),
    color: '#BF360C',
    headerGradient: 'linear-gradient(135deg, #7f2008, #BF360C)',
    bodyBackground: 'rgba(60, 16, 4, 0.55)',
    placeholder: 'biryani\nbutter chicken\nramen\n...',
    fileAccept: null,
    fileLabel: null,
    parseFile: null,
  },
]

// ---------------------------------------------------------------------------
// FileDropZone sub-component
// ---------------------------------------------------------------------------
function FileDropZone({ card, onFileParsed }) {
  const inputRef = useRef(null)
  const [dragging, setDragging] = useState(false)
  const [fileName, setFileName] = useState('')

  function handleFile(file) {
    if (!file) return
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target.result
      const items = card.parseFile(text, file.name)
      onFileParsed(items)
    }
    reader.readAsText(file)
  }

  function handleDrop(e) {
    e.preventDefault()
    setDragging(false)
    handleFile(e.dataTransfer.files[0])
  }

  return (
    <div
      style={{
        border: `1.5px dashed ${dragging ? card.color : 'rgba(255,255,255,0.13)'}`,
        borderRadius: 10,
        padding: '12px 14px',
        background: dragging ? `${card.color}10` : 'rgba(0,0,0,0.18)',
        cursor: 'pointer',
        textAlign: 'center',
        transition: 'all 0.2s',
        marginTop: 8,
      }}
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept={card.fileAccept}
        style={{ display: 'none' }}
        onChange={(e) => handleFile(e.target.files[0])}
      />
      {fileName ? (
        <span style={{ color: card.color, fontSize: 12, fontWeight: 600 }}>{fileName}</span>
      ) : (
        <>
          <svg
            style={{ margin: '0 auto 4px', opacity: 0.4, display: 'block' }}
            width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11 }}>
            or drag & drop {card.fileLabel}
          </span>
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tag input — chips with Enter, value stays newline-string for compat
// ---------------------------------------------------------------------------
function TagInput({ card, value, onChange }) {
  const [draft, setDraft] = useState('')
  const inputRef = useRef(null)
  const items = value ? value.split('\n').filter(Boolean) : []

  function addItem(raw) {
    const trimmed = raw.trim()
    if (!trimmed || items.includes(trimmed)) return
    onChange([...items, trimmed].join('\n'))
  }

  function removeItem(idx) {
    onChange(items.filter((_, i) => i !== idx).join('\n'))
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (draft.trim()) {
        addItem(draft)
        setDraft('')
      }
    } else if (e.key === 'Backspace' && draft === '' && items.length > 0) {
      removeItem(items.length - 1)
    }
  }

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        background: 'rgba(0,0,0,0.25)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 8,
        padding: '8px 10px',
        overflow: 'hidden',
        cursor: 'text',
      }}
      onClick={() => inputRef.current?.focus()}
    >
      {/* Chips */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexWrap: 'wrap', gap: 5, alignContent: 'flex-start' }}>
        {items.map((item, i) => (
          <span
            key={i}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '2px 8px',
              borderRadius: 5,
              border: `1px solid ${card.color}80`,
              background: `${card.color}15`,
              color: '#e8e8e8',
              fontSize: 11,
              lineHeight: 1.6,
              maxWidth: '100%',
              wordBreak: 'break-word',
            }}
          >
            {item}
            <button
              onClick={(e) => { e.stopPropagation(); removeItem(i) }}
              style={{
                background: 'none', border: 'none', color: card.color,
                cursor: 'pointer', padding: 0, lineHeight: 1, fontSize: 13,
                opacity: 0.7, flexShrink: 0,
              }}
              aria-label={`Remove ${item}`}
            >×</button>
          </span>
        ))}

        {/* Inline input */}
        <input
          ref={inputRef}
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={items.length === 0 ? card.placeholder.split('\n')[0] + '...' : 'Add more...'}
          style={{
            background: 'none',
            border: 'none',
            outline: 'none',
            color: '#e8e8e8',
            fontSize: 11,
            fontFamily: 'inherit',
            minWidth: 120,
            flex: 1,
            padding: '2px 2px',
            caretColor: card.color,
          }}
        />
      </div>

      {/* Hint */}
      {items.length === 0 && (
        <p style={{ margin: '6px 0 0', color: 'rgba(255,255,255,0.25)', fontSize: 10 }}>
          Press Enter after each item
        </p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Single Card component
// ---------------------------------------------------------------------------
function CarouselCard({ card, value, onChange, onSkip, skipped, onFileParsed }) {
  const lines = textToLines(value)
  const { valid, skipped: skipCount } = validateItems(lines)

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div
        style={{
          background: card.headerGradient,
          borderRadius: '16px 16px 0 0',
          height: 64,
          display: 'flex',
          alignItems: 'center',
          padding: '0 20px',
          gap: 12,
          flexShrink: 0,
        }}
      >
        <div style={{ color: '#fff', opacity: 0.92, flexShrink: 0 }}>{card.icon}</div>
        <div>
          <div style={{ color: '#fff', fontWeight: 700, fontSize: 15, lineHeight: 1.2 }}>
            {card.title}
          </div>
          <div style={{ color: 'rgba(255,255,255,0.72)', fontSize: 11, marginTop: 2 }}>
            {card.subtitle}
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, padding: '16px 18px 14px', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: card.bodyBackground }}>
        <TagInput card={card} value={value} onChange={onChange} />

        {/* Item count */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, alignItems: 'center' }}>
          <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 10 }}>
            Press Enter to add · Backspace to remove last
          </span>
          {valid.length > 0 && (
            <span style={{ color: card.color, fontSize: 10, opacity: 0.7 }}>
              {valid.length} item{valid.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Skip count warning */}
        {skipCount > 0 && (
          <div style={{ color: '#f4b942', fontSize: 10, marginTop: 4 }}>
            {skipCount} item{skipCount !== 1 ? 's' : ''} will be skipped
          </div>
        )}

        {/* File upload zone */}
        {card.fileAccept && (
          <FileDropZone card={card} onFileParsed={onFileParsed} />
        )}

        {/* Skip link */}
        <button
          onClick={onSkip}
          style={{
            background: 'none',
            border: 'none',
            color: skipped ? card.color : 'rgba(255,255,255,0.28)',
            fontSize: 11,
            cursor: 'pointer',
            padding: '6px 0 0',
            textAlign: 'left',
            fontFamily: 'inherit',
          }}
        >
          {skipped ? '✓ Skipped' : 'Skip this one →'}
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function InputUploader({ onDNAExtracted }) {
  const currentUser = useDNAStore((s) => s.currentUser)

  const [activeIndex, setActiveIndex] = useState(0)
  const [loading, setLoading] = useState(false)
  const [apiError, setApiError] = useState('')
  const carouselRef = useRef(null)
  const wheelAccum = useRef(0)

  // Touchpad horizontal swipe → navigate cards
  useEffect(() => {
    const el = carouselRef.current
    if (!el) return
    function onWheel(e) {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        e.preventDefault()
        wheelAccum.current += e.deltaX
        if (wheelAccum.current > 60) {
          wheelAccum.current = 0
          setActiveIndex((p) => Math.min(CARDS.length - 1, p + 1))
        } else if (wheelAccum.current < -60) {
          wheelAccum.current = 0
          setActiveIndex((p) => Math.max(0, p - 1))
        }
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  // Per-card text values, keyed by card id
  const [values, setValues] = useState({
    youtube_titles: '',
    movies: '',
    music: '',
    books: '',
    food: '',
  })

  // Per-card skip flags
  const [skipped, setSkipped] = useState({
    youtube_titles: false,
    movies: false,
    music: false,
    books: false,
    food: false,
  })

  function setValue(id, text) {
    setValues((prev) => ({ ...prev, [id]: text }))
    // Unskip if user starts typing
    if (skipped[id]) setSkipped((prev) => ({ ...prev, [id]: false }))
  }

  function toggleSkip(id) {
    setSkipped((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  function handleFileParsed(id, items) {
    setValue(id, items.join('\n'))
  }

  // Compute valid items per card
  function getValid(id) {
    if (skipped[id]) return []
    const { valid } = validateItems(textToLines(values[id]))
    return valid
  }

  const allValid = CARDS.reduce((acc, c) => acc + getValid(c.id).length, 0)

  function loadDemo() {
    setValues({
      youtube_titles: demoData.youtube_titles.join('\n'),
      movies: demoData.movies.join('\n'),
      music: demoData.music.join('\n'),
      books: demoData.books.join('\n'),
      food: demoData.food.join('\n'),
    })
    setSkipped({ youtube_titles: false, movies: false, music: false, books: false, food: false })
  }

  async function handleSubmit() {
    if (allValid < 5 || loading) return
    setApiError('')
    setLoading(true)
    try {
      const body = {}
      CARDS.forEach((c) => { body[c.id] = getValid(c.id) })

      const res = await fetch('/api/extract-dna', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${currentUser?.token}`,
        },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        setApiError(data.detail || data.message || 'DNA extraction failed. Please try again.')
        return
      }
      onDNAExtracted(data)
    } catch {
      setApiError('Network error. Please check your connection.')
    } finally {
      setLoading(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Carousel geometry
  // ---------------------------------------------------------------------------
  function cardStyle(i) {
    const d = i - activeIndex
    const absd = Math.abs(d)
    if (absd > 2) return { display: 'none' }

    let transform, opacity, zIndex
    if (d === 0) {
      transform = 'translateX(-50%) translateY(-18px) scale(1)'
      opacity = 1
      zIndex = 10
    } else if (absd === 1) {
      transform = `translateX(calc(-50% + ${d * 290}px)) translateY(0) scale(0.84)`
      opacity = 0.55
      zIndex = 5
    } else {
      transform = `translateX(calc(-50% + ${d * 290}px)) translateY(0) scale(0.70)`
      opacity = 0.25
      zIndex = 1
    }

    const card = CARDS[i]
    const isActive = d === 0

    return {
      position: 'absolute',
      left: '50%',
      top: 0,
      width: 300,
      height: '100%',
      transform,
      opacity,
      zIndex,
      transition: 'all 0.42s cubic-bezier(0.4, 0, 0.2, 1)',
      cursor: isActive ? 'default' : 'pointer',
      background: 'rgba(6, 4, 14, 0.75)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 16,
      boxShadow: isActive
        ? `0 0 0 1.5px ${card.color}55, 0 8px 40px ${card.color}22, 0 2px 16px rgba(0,0,0,0.5)`
        : '0 2px 12px rgba(0,0,0,0.3)',
      overflow: 'hidden',
    }
  }

  return (
    <div style={{
      height: 'calc(100vh - 56px)',
      maxWidth: 700,
      margin: '0 auto',
      padding: '0 12px',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Page header — compact */}
      <div style={{ textAlign: 'center', padding: '10px 0 6px', flexShrink: 0 }}>
        <h2 style={{ color: '#e8e8e8', fontSize: 17, fontWeight: 700, margin: '0 0 3px' }}>
          Map Your Cultural DNA
        </h2>
        <p style={{ color: '#9ca3af', fontSize: 12, margin: 0 }}>
          Share what you've watched, read, and listened to.
        </p>
      </div>

      {/* Carousel — fills remaining space */}
      <div
        ref={carouselRef}
        style={{ flex: 1, minHeight: 0, position: 'relative', overflow: 'visible' }}
      >
        {CARDS.map((card, i) => (
          <div
            key={card.id}
            style={cardStyle(i)}
            onClick={i !== activeIndex ? () => setActiveIndex(i) : undefined}
          >
            <CarouselCard
              card={card}
              value={values[card.id]}
              onChange={(text) => setValue(card.id, text)}
              onSkip={() => toggleSkip(card.id)}
              skipped={skipped[card.id]}
              onFileParsed={(items) => handleFileParsed(card.id, items)}
            />
          </div>
        ))}
      </div>

      {/* Navigation arrows + dots */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 18, padding: '8px 0 4px', flexShrink: 0 }}>
        <button
          onClick={() => setActiveIndex((p) => Math.max(0, p - 1))}
          disabled={activeIndex === 0}
          style={{
            background: activeIndex === 0 ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.14)',
            border: `1px solid ${activeIndex === 0 ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.28)'}`,
            color: activeIndex === 0 ? 'rgba(255,255,255,0.2)' : '#ffffff',
            borderRadius: 24,
            width: 48, height: 48,
            fontSize: 26,
            cursor: activeIndex === 0 ? 'default' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.2s',
            flexShrink: 0,
          }}
        >‹</button>

        <div style={{ display: 'flex', gap: 8 }}>
          {CARDS.map((card, i) => (
            <button
              key={card.id}
              onClick={() => setActiveIndex(i)}
              style={{
                width: i === activeIndex ? 22 : 8,
                height: 8,
                borderRadius: 4,
                background: i === activeIndex ? card.color : 'rgba(255,255,255,0.18)',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              }}
            />
          ))}
        </div>

        <button
          onClick={() => setActiveIndex((p) => Math.min(CARDS.length - 1, p + 1))}
          disabled={activeIndex === CARDS.length - 1}
          style={{
            background: activeIndex === CARDS.length - 1 ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.14)',
            border: `1px solid ${activeIndex === CARDS.length - 1 ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.28)'}`,
            color: activeIndex === CARDS.length - 1 ? 'rgba(255,255,255,0.2)' : '#ffffff',
            borderRadius: 24,
            width: 48, height: 48,
            fontSize: 26,
            cursor: activeIndex === CARDS.length - 1 ? 'default' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.2s',
            flexShrink: 0,
          }}
        >›</button>
      </div>

      {/* Status + error — compact */}
      <div style={{ flexShrink: 0, minHeight: 20 }}>
        <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.32)', fontSize: 11 }}>
          {allValid} item{allValid !== 1 ? 's' : ''} ready
          {allValid < 5 && allValid > 0 && ' — need at least 5'}
        </div>
        {apiError && (
          <div style={{ margin: '4px 0', padding: '8px 12px', borderRadius: 8, background: 'rgba(220,38,38,0.15)', border: '1px solid rgba(220,38,38,0.4)', color: '#fca5a5', fontSize: 12 }}>
            {apiError}
          </div>
        )}
      </div>

      {/* Action buttons — always at bottom */}
      <div style={{ display: 'flex', gap: 10, paddingBottom: 10, flexShrink: 0 }}>
        <button
          onClick={loadDemo}
          style={{
            flex: '0 0 auto',
            padding: '10px 16px',
            borderRadius: 10,
            border: '1px solid rgba(255,255,255,0.14)',
            background: 'transparent',
            color: '#9ca3af',
            fontSize: 12,
            fontWeight: 500,
            cursor: 'pointer',
            fontFamily: 'inherit',
            whiteSpace: 'nowrap',
          }}
        >
          Load Demo
        </button>
        <button
          onClick={handleSubmit}
          disabled={allValid < 5 || loading}
          style={{
            flex: 1,
            padding: '10px 20px',
            borderRadius: 10,
            border: 'none',
            background: allValid >= 5 && !loading ? '#f4b942' : '#374151',
            color: allValid >= 5 && !loading ? '#0a0f1e' : '#6b7280',
            fontSize: 13,
            fontWeight: 700,
            cursor: allValid >= 5 && !loading ? 'pointer' : 'not-allowed',
            fontFamily: 'inherit',
            transition: 'all 0.25s',
            animation: loading ? 'ctPulse 1.4s ease-in-out infinite' : 'none',
          }}
        >
          {loading ? 'Reading your cultural DNA...' : 'Map My Cultural DNA →'}
        </button>
      </div>

      <style>{`
        @keyframes ctPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.55; } }
      `}</style>
    </div>
  )
}
