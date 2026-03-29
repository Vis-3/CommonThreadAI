import { useState } from 'react'

const TAG_RE = /^[a-zA-Z0-9 \-&',\.\(\)/]{2,100}$/
const MAX_PER_CATEGORY = 10

const SECTION_CONFIG = [
  { key: 'dominant_themes',          label: 'Themes',               color: '#F2A154' },
  { key: 'dominant_emotions',        label: 'Emotions',             color: '#FFD768' },
  { key: 'aesthetic_signatures',     label: 'Aesthetic Style',      color: '#81A684' },
  { key: 'cultural_origins_detected',label: 'Cultural Roots',       color: '#6E9BB5' },
  { key: 'taste_palette',            label: 'Taste Palette',        color: '#D96C4B' },
]

function TagSection({ sectionKey, label, color, tags, onTagsChange }) {
  const [inputValue, setInputValue] = useState('')
  const [inputError, setInputError] = useState('')

  function removeTag(idx) {
    onTagsChange(tags.filter((_, i) => i !== idx))
  }

  function addTag() {
    const trimmed = inputValue.trim()
    if (!trimmed) return
    if (!TAG_RE.test(trimmed)) {
      setInputError('2–60 chars, letters/numbers/spaces/hyphens/ampersands only.')
      return
    }
    if (tags.length >= MAX_PER_CATEGORY) {
      setInputError(`Maximum ${MAX_PER_CATEGORY} tags per category.`)
      return
    }
    if (tags.includes(trimmed)) {
      setInputError('This tag already exists.')
      return
    }
    setInputError('')
    onTagsChange([...tags, trimmed])
    setInputValue('')
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault()
      addTag()
    }
  }

  return (
    <div className="mb-6">
      <h3 className="text-sm font-semibold mb-3" style={{ color }}>
        {label}
      </h3>
      <div className="flex flex-wrap gap-2 mb-3">
        {tags.map((tag, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm"
            style={{
              background: `${color}18`,
              border: `1px solid ${color}40`,
              color,
            }}
          >
            {tag}
            <button
              onClick={() => removeTag(i)}
              className="hover:opacity-70 transition-opacity leading-none"
              aria-label={`Remove ${tag}`}
            >
              ×
            </button>
          </span>
        ))}
        {tags.length === 0 && (
          <span className="text-xs text-[#6b7280] italic">No tags — add some below</span>
        )}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          className="flex-1 bg-[#0d1526] border border-[#2d3748] rounded-lg px-3 py-1.5 text-[#e8e8e8] placeholder-[#4a5568] focus:outline-none focus:border-[#f4b942] focus:ring-1 focus:ring-[#f4b942] text-sm transition-colors"
          placeholder={`Add ${label.toLowerCase()} tag...`}
          value={inputValue}
          onChange={(e) => { setInputValue(e.target.value); setInputError('') }}
          onKeyDown={handleKeyDown}
          maxLength={60}
        />
        <button
          onClick={addTag}
          className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
          style={{ background: `${color}20`, color, border: `1px solid ${color}40` }}
        >
          Add
        </button>
      </div>
      {inputError && (
        <p className="text-red-400 text-xs mt-1">{inputError}</p>
      )}
      {tags.length >= MAX_PER_CATEGORY && (
        <p className="text-[#6b7280] text-xs mt-1">Max {MAX_PER_CATEGORY} tags reached.</p>
      )}
    </div>
  )
}

export default function DNAVerification({ dnaProfile, onVerified, onStartOver }) {
  const [editedDNA, setEditedDNA] = useState(() => ({
    dominant_themes: Array.isArray(dnaProfile?.dominant_themes)
      ? [...dnaProfile.dominant_themes]
      : [],
    dominant_emotions: Array.isArray(dnaProfile?.dominant_emotions)
      ? [...dnaProfile.dominant_emotions]
      : [],
    aesthetic_signatures: Array.isArray(dnaProfile?.aesthetic_signatures)
      ? [...dnaProfile.aesthetic_signatures]
      : [],
    cultural_origins_detected: Array.isArray(dnaProfile?.cultural_origins_detected)
      ? [...dnaProfile.cultural_origins_detected]
      : [],
    taste_palette: Array.isArray(dnaProfile?.taste_palette)
      ? [...dnaProfile.taste_palette]
      : [],
  }))

  function setSection(key, tags) {
    setEditedDNA((prev) => ({ ...prev, [key]: tags }))
  }

  function handleVerify() {
    const merged = { ...dnaProfile, ...editedDNA }
    onVerified(merged)
  }

  const totalTags =
    editedDNA.dominant_themes.length +
    editedDNA.dominant_emotions.length +
    editedDNA.aesthetic_signatures.length +
    editedDNA.cultural_origins_detected.length +
    editedDNA.taste_palette.length

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-[#e8e8e8] mb-2">Does this look like you?</h2>
        <p className="text-[#9ca3af] text-sm">
          AI can miss things or get things wrong. Review and edit before we save.
        </p>
      </div>

      {/* Confidence Notes */}
      {dnaProfile?.confidence_notes && (
        <div
          className="mb-6 p-4 rounded-xl text-sm text-[#9ca3af] leading-relaxed"
          style={{ background: 'rgba(15,40,50,0.85)', border: '1px solid rgba(94,207,207,0.45)' }}
        >
          <p className="text-xs font-semibold text-[#5ecfcf] mb-1 uppercase tracking-wide">
            AI Confidence Notes
          </p>
          {dnaProfile.confidence_notes}
        </div>
      )}

      {/* Editable sections */}
      <div
        className="rounded-xl p-6 mb-6"
        style={{ background: '#111827', border: '1px solid #1f2937' }}
      >
        {SECTION_CONFIG.map((sec) => (
          <TagSection
            key={sec.key}
            sectionKey={sec.key}
            label={sec.label}
            color={sec.color}
            tags={editedDNA[sec.key]}
            onTagsChange={(tags) => setSection(sec.key, tags)}
          />
        ))}
      </div>

      {totalTags === 0 && (
        <p className="text-center text-[#6b7280] text-sm mb-4">
          Add at least one tag to continue.
        </p>
      )}

      {/* Buttons */}
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={onStartOver}
          className="flex-1 py-3 rounded-lg text-sm font-medium border transition-colors"
          style={{ borderColor: '#2d3748', color: '#9ca3af', background: 'transparent' }}
        >
          Start Over
        </button>
        <button
          onClick={handleVerify}
          disabled={totalTags === 0}
          className="flex-grow-[2] py-3 rounded-lg text-sm font-semibold text-[#0a0f1e] transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ background: '#f4b942' }}
        >
          This looks right — Save My DNA
        </button>
      </div>
    </div>
  )
}
