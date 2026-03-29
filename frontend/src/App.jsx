import { useState, useEffect } from 'react'
import useDNAStore from './store/useDNAStore'
import SceneBackground from './components/SceneBackground'
import AuthGate from './components/AuthGate'
import InputUploader from './components/InputUploader'
import DNAVerification from './components/DNAVerification'
import MindMap from './components/MindMap'
import PathChooser from './components/PathChooser'
import BridgeResults from './components/BridgeResults'
import BlindSpots from './components/BlindSpots'
import MatchCard from './components/MatchCard'
import ChatWindow from './components/ChatWindow'
import Inbox from './components/Inbox'

const STEPS = [
  { key: 'auth', label: 'Sign In' },
  { key: 'upload', label: 'Cultural Input' },
  { key: 'verify', label: 'Verify DNA' },
  { key: 'mindmap', label: 'DNA Map' },
  { key: 'path', label: 'Choose Path' },
  { key: 'results', label: 'Discover' },
]

const SIDEBAR_STEPS = [
  { key: 'upload',  label: 'Cultural Input', icon: '◈' },
  { key: 'verify',  label: 'Verify DNA',      icon: '◎' },
  { key: 'mindmap', label: 'DNA Map',         icon: '⬡' },
  { key: 'path',    label: 'Choose Path',     icon: '⊕' },
  { key: 'results', label: 'Discover',        icon: '✦' },
]

function Spinner({ message }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <div
        className="w-10 h-10 rounded-full border-4 border-[#1f2937] border-t-[#f4b942]"
        style={{ animation: 'spin 0.8s linear infinite' }}
      />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      {message && <p className="text-[#e8e8e8] text-sm font-semibold">{message}</p>}
    </div>
  )
}

function ErrorCard({ message, onDismiss }) {
  return (
    <div
      className="max-w-lg mx-auto my-8 rounded-xl p-5"
      style={{ background: '#2d0e0e', border: '1px solid #7f1d1d' }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-red-400 font-semibold text-sm mb-1">Something went wrong</p>
          <p className="text-red-300 text-sm leading-relaxed">{message}</p>
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="text-red-400 hover:text-red-200 transition-colors text-lg leading-none shrink-0"
          >
            ×
          </button>
        )}
      </div>
    </div>
  )
}

function StepIndicator({ currentStep }) {
  const currentIdx = STEPS.findIndex((s) => s.key === currentStep)

  return (
    <div className="flex items-center justify-center gap-0 py-3 overflow-x-auto px-4">
      {STEPS.map((step, i) => {
        const isDone = i < currentIdx
        const isActive = i === currentIdx
        const isPending = i > currentIdx

        return (
          <div key={step.key} className="flex items-center">
            <div className="flex flex-col items-center gap-1">
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all"
                style={{
                  background: isDone
                    ? '#5ecfcf'
                    : isActive
                    ? '#f4b942'
                    : '#1f2937',
                  color: isDone || isActive ? '#0a0f1e' : '#4a5568',
                }}
              >
                {isDone ? (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  i + 1
                )}
              </div>
              <span
                className="text-[10px] whitespace-nowrap hidden sm:block"
                style={{ color: isActive ? '#f4b942' : isPending ? '#4a5568' : '#5ecfcf' }}
              >
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className="w-8 h-px mx-1 mb-3 sm:mb-4 transition-all"
                style={{ background: i < currentIdx ? '#5ecfcf' : '#1f2937' }}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

export default function App() {
  const {
    currentUser,
    dnaProfile,
    dnaVerified,
    pathChoice,
    bridgeResults,
    blindSpots,
    matches,
    setUser,
    setDNAProfile,
    setDNAVerified,
    setPathChoice,
    setBridgeResults,
    setBlindSpots,
    setMatches,
    reset,
  } = useDNAStore()

  // rawDNA: unverified extracted DNA — lives in local state only
  const [rawDNA, setRawDNA] = useState(null)

  // App step
  const [step, setStep] = useState(() => {
    if (!currentUser) return 'auth'
    if (!dnaVerified) return 'upload'
    if (!pathChoice) return 'path'
    return 'results'
  })

  const [loading, setLoading] = useState(false)
  const [loadingMessage, setLoadingMessage] = useState('')
  const [error, setError] = useState('')

  // Sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [visitedSteps, setVisitedSteps] = useState(new Set(['upload']))
  const [inboxOpen, setInboxOpen] = useState(false)

  // Track visited steps whenever step changes
  useEffect(() => {
    setVisitedSteps((prev) => {
      if (prev.has(step)) return prev
      const next = new Set(prev)
      next.add(step)
      return next
    })
  }, [step])

  // Chat overlay
  const [chatOpen, setChatOpen] = useState(false)
  const [chatConversationId, setChatConversationId] = useState(null)
  const [chatOtherUser, setChatOtherUser] = useState(null)

  function authHeaders() {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${currentUser?.token}`,
    }
  }

  // ─── Auth ───────────────────────────────────────────────────────────────────
  function handleAuth(user) {
    setUser(user)
    // If this user already has a verified DNA profile, restore it and skip the flow
    if (user.dna_verified && user.dna_profile) {
      try {
        const profile = typeof user.dna_profile === 'string'
          ? JSON.parse(user.dna_profile)
          : user.dna_profile
        setDNAProfile(profile)
        setDNAVerified(true)
        setVisitedSteps(new Set(['upload', 'verify', 'mindmap', 'path']))
        setStep('path')
        return
      } catch {
        // Malformed profile — fall through to normal upload flow
      }
    }
    setStep('upload')
  }

  // ─── DNA Extracted ───────────────────────────────────────────────────────────
  function handleDNAExtracted(result) {
    console.log('[App] DNA extracted, keys:', Object.keys(result || {}))
    setRawDNA(result)
    setStep('verify')
  }

  // ─── DNA Verified ────────────────────────────────────────────────────────────
  async function handleVerify(editedDNA) {
    setError('')
    setLoading(true)
    setLoadingMessage('Saving your cultural DNA...')
    try {
      const res = await fetch('/api/verify-dna', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ dna_profile: editedDNA, source: 'verified_edit' }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.detail || data.message || 'Could not save your DNA. Please try again.')
        return
      }
      const profile = data.dna_profile || editedDNA
      console.log('[App] verify-dna OK, setting dnaProfile:', profile)
      setDNAProfile(profile)
      setDNAVerified(true)
      setRawDNA(null)
      console.log('[App] stepping to mindmap')
      setStep('mindmap')
    } catch {
      setError('Network error while saving DNA. Please try again.')
    } finally {
      setLoading(false)
      setLoadingMessage('')
    }
  }

  // ─── Mind Map Continue ───────────────────────────────────────────────────────
  function handleMindMapContinue() {
    setStep('path')
  }

  // ─── Path Choice ─────────────────────────────────────────────────────────────
  async function handlePathChoice(path) {
    setPathChoice(path)
    setError('')
    setLoading(true)

    if (path === 'local') {
      setLoadingMessage(`Finding cultural bridges to ${currentUser?.state}...`)
      try {
        const res = await fetch('/api/bridge', {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({ dna: dnaProfile }),
        })
        const data = await res.json()
        if (!res.ok) {
          setError(data.detail || data.message || 'Could not load bridge results.')
          setPathChoice(null)
          setStep('path')
          return
        }
        setBridgeResults(data.recommendations || data.results || data || [])
        setStep('results')
      } catch {
        setError('Network error loading bridge results.')
        setPathChoice(null)
        setStep('path')
      } finally {
        setLoading(false)
        setLoadingMessage('')
      }
    } else if (path === 'connect') {
      setLoadingMessage('Finding your blind spots and matches...')
      try {
        const [blindRes, matchRes] = await Promise.all([
          fetch('/api/blindspots', {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify({ dna: dnaProfile }),
          }),
          fetch('/api/match', {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify({ dna: dnaProfile }),
          }),
        ])

        const [blindData, matchData] = await Promise.all([
          blindRes.json(),
          matchRes.json(),
        ])

        if (!blindRes.ok) {
          setError(blindData.detail || blindData.message || 'Could not load blind spots.')
          setPathChoice(null)
          setStep('path')
          return
        }
        if (!matchRes.ok) {
          setError(matchData.detail || matchData.message || 'Could not load matches.')
          setPathChoice(null)
          setStep('path')
          return
        }

        setBlindSpots(blindData.blind_spots || blindData.results || blindData || [])
        setMatches(matchData.matches || matchData.results || matchData || [])
        setStep('results')
      } catch {
        setError('Network error loading matches.')
        setPathChoice(null)
        setStep('path')
      } finally {
        setLoading(false)
        setLoadingMessage('')
      }
    }
  }

  // ─── Find Match (from BlindSpots) ────────────────────────────────────────────
  function handleFindMatch() {
    // Matches are already loaded — scroll to them or show them
    // If matches haven't loaded, trigger a fetch
    if (matches.length === 0) {
      handlePathChoice('connect')
    }
    // Scroll the page up so match cards are visible (they render below BlindSpots)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // ─── Chat ────────────────────────────────────────────────────────────────────
  function handleChatOpen(conversationId, otherUser) {
    setChatConversationId(conversationId)
    setChatOtherUser(otherUser)
    setChatOpen(true)
  }

  // ─── Start Over ──────────────────────────────────────────────────────────────
  function handleStartOver() {
    reset()
    setRawDNA(null)
    setStep('upload')
    setError('')
  }

  // ─── Determine current step key for progress indicator ──────────────────────
  function getProgressStep() {
    if (!currentUser) return 'auth'
    return step
  }

  // ─── Render ──────────────────────────────────────────────────────────────────
  if (!currentUser) {
    return (
      <>
        <SceneBackground />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <AuthGate onAuth={handleAuth} />
        </div>
      </>
    )
  }

  return (
    <div className="min-h-screen" style={{ background: 'transparent' }}>
      <SceneBackground />

      {/* Hamburger strip — always visible on far left */}
      <div
        style={{
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          width: 44,
          zIndex: 100,
          background: 'rgba(8,6,20,0.6)',
          backdropFilter: 'blur(8px)',
          borderRight: '1px solid rgba(255,255,255,0.06)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <button
          onClick={() => setSidebarOpen((o) => !o)}
          style={{
            marginTop: 18,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 4,
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            alignItems: 'center',
          }}
          aria-label="Toggle navigation"
        >
          <span style={{ display: 'block', width: 18, height: 2, background: '#e8e8e8', borderRadius: 1 }} />
          <span style={{ display: 'block', width: 18, height: 2, background: '#e8e8e8', borderRadius: 1 }} />
          <span style={{ display: 'block', width: 18, height: 2, background: '#e8e8e8', borderRadius: 1 }} />
        </button>
      </div>

      {/* Sidebar backdrop */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 98,
            background: 'transparent',
          }}
        />
      )}

      {/* Sidebar panel */}
      <div
        style={{
          position: 'fixed',
          left: 44,
          top: 0,
          bottom: 0,
          width: 220,
          zIndex: 99,
          background: 'rgba(10,8,22,0.92)',
          backdropFilter: 'blur(16px)',
          borderRight: '1px solid rgba(255,255,255,0.08)',
          transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.3s cubic-bezier(0.4,0,0.2,1)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* App name */}
        <div style={{ padding: '20px 16px 4px' }}>
          <div style={{ color: '#f4b942', fontSize: 15, fontWeight: 700, fontFamily: 'var(--font-title)' }}>CommonThread</div>
          <div style={{ color: '#4a5568', fontSize: 11, marginTop: 4 }}>
            Your culture is the bridge.
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', margin: '12px 0' }} />

        {/* Step list */}
        <nav style={{ flex: 1, overflowY: 'auto' }}>
          {SIDEBAR_STEPS.map((s) => {
            const isActive = step === s.key
            const isVisited = visitedSteps.has(s.key)
            const isNavigable = isVisited

            return (
              <button
                key={s.key}
                disabled={!isNavigable}
                onClick={() => {
                  if (isNavigable) {
                    setStep(s.key)
                    setSidebarOpen(false)
                  }
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  width: '100%',
                  padding: '10px 16px',
                  background: isActive ? 'rgba(244,185,66,0.08)' : 'none',
                  border: 'none',
                  borderLeft: isActive ? '3px solid #f4b942' : '3px solid transparent',
                  cursor: isNavigable ? 'pointer' : 'default',
                  color: isActive ? '#f4b942' : isVisited ? '#e8e8e8' : '#6b7280',
                  opacity: !isVisited ? 0.4 : 1,
                  textAlign: 'left',
                  fontSize: 13,
                  transition: 'background 0.15s, color 0.15s',
                }}
                onMouseEnter={(e) => {
                  if (isNavigable && !isActive) {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
                  }
                }}
                onMouseLeave={(e) => {
                  if (isNavigable && !isActive) {
                    e.currentTarget.style.background = 'none'
                  }
                }}
              >
                <span style={{ fontSize: 14, opacity: 0.85 }}>{s.icon}</span>
                <span>{s.label}</span>
              </button>
            )
          })}
        </nav>

        {/* Inbox button */}
        <button
          onClick={() => { setInboxOpen(true); setSidebarOpen(false) }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            width: '100%',
            padding: '10px 16px',
            background: inboxOpen ? 'rgba(94,207,207,0.08)' : 'none',
            border: 'none',
            borderLeft: inboxOpen ? '3px solid #5ecfcf' : '3px solid transparent',
            cursor: 'pointer',
            color: inboxOpen ? '#5ecfcf' : '#9ca3af',
            textAlign: 'left',
            fontSize: 13,
            transition: 'background 0.15s, color 0.15s',
          }}
        >
          <span style={{ fontSize: 14 }}>💬</span>
          <span>Messages</span>
        </button>

        {/* Spacer */}
        <div style={{ flexGrow: 1 }} />

        {/* Logout button */}
        <button
          onClick={() => {
            reset()
            setUser(null)
            localStorage.removeItem('dna-store')
            setStep('auth')
            setSidebarOpen(false)
          }}
          style={{
            margin: 16,
            padding: '10px 16px',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 8,
            color: '#9ca3af',
            textAlign: 'left',
            cursor: 'pointer',
            fontSize: 13,
          }}
        >
          Sign Out
        </button>
      </div>

      {/* Main content shifted right by hamburger strip */}
      <div style={{ position: 'relative', zIndex: 1, paddingLeft: 44 }}>

        {/* Global Header */}
        <header
          style={{
            position: 'sticky', top: 0, zIndex: 40,
            background: 'rgba(8,6,20,0.55)',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            backdropFilter: 'blur(12px)',
            height: 56,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <span style={{ color: '#f4b942', fontWeight: 800, fontSize: 22, letterSpacing: '0.02em', fontFamily: 'var(--font-title)' }}>
            CommonThread
          </span>
          <span style={{ position: 'absolute', right: 20, color: '#6b7280', fontSize: 13 }}>
            {currentUser.display_name || currentUser.username}
          </span>
        </header>

        {/* Main content */}
        <main style={{ paddingBottom: 64 }}>
          {/* Loading overlay */}
          {loading && (
            <div className="max-w-3xl mx-auto">
              <Spinner message={loadingMessage} />
            </div>
          )}

          {/* Error display */}
          {error && (
            <div className="max-w-3xl mx-auto px-4">
              <ErrorCard message={error} onDismiss={() => setError('')} />
            </div>
          )}

          {/* Inbox overlay */}
          {inboxOpen && (
            <div
              style={{
                position: 'fixed', inset: 0, paddingLeft: 44,
                zIndex: 50, background: 'rgba(8,6,18,0.97)',
                overflowY: 'auto', boxSizing: 'border-box',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '16px 20px 0' }}>
                <button
                  onClick={() => setInboxOpen(false)}
                  style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: 22, lineHeight: 1 }}
                  aria-label="Close inbox"
                >
                  ×
                </button>
              </div>
              <Inbox onOpenChat={(convId, otherUser) => {
                setInboxOpen(false)
                handleChatOpen(convId, otherUser)
              }} />
            </div>
          )}

          {!loading && (
            <>
              {/* Step: upload */}
              {step === 'upload' && (
                <InputUploader onDNAExtracted={handleDNAExtracted} />
              )}

              {/* Step: verify */}
              {step === 'verify' && (rawDNA || dnaProfile) && (
                <DNAVerification
                  dnaProfile={rawDNA || dnaProfile}
                  onVerified={handleVerify}
                  onStartOver={handleStartOver}
                />
              )}

              {/* Step: mindmap — fullscreen overlay */}
              {step === 'mindmap' && dnaProfile && (
                <div
                  style={{
                    position: 'fixed',
                    inset: 0,
                    paddingLeft: 44, // clear the hamburger sidebar strip
                    zIndex: 50,
                    background: 'rgba(8,6,18,0.96)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'flex-start',
                    overflowY: 'auto',
                    boxSizing: 'border-box',
                  }}
                >
                  <MindMap dnaProfile={dnaProfile} onContinue={handleMindMapContinue} fullscreen />
                </div>
              )}

              {/* Step: path */}
              {step === 'path' && (
                <PathChooser
                  userState={currentUser.state}
                  onChoose={handlePathChoice}
                />
              )}

              {/* Step: results — local bridge */}
              {step === 'results' && pathChoice === 'local' && (
                <BridgeResults
                  bridgeResults={bridgeResults}
                  userState={currentUser.state}
                  onChatOpen={handleChatOpen}
                />
              )}

              {/* Step: results — connect (blind spots + matches) */}
              {step === 'results' && pathChoice === 'connect' && (
                <div className="max-w-2xl mx-auto">
                  {matches.length > 0 && (
                    <div className="px-4 pt-8">
                      <h2 className="text-xl font-bold text-[#e8e8e8] mb-1">Your Matches</h2>
                      <p className="text-[#e8e8e8] text-sm font-semibold mb-5">
                        Students whose taste points in the same direction as yours.
                      </p>
                      {matches.map((match, i) => (
                        <MatchCard
                          key={match.user_id || i}
                          match={match}
                          currentUser={currentUser}
                          onChatOpen={handleChatOpen}
                        />
                      ))}
                    </div>
                  )}

                  <BlindSpots
                    blindSpots={blindSpots}
                    onFindMatch={handleFindMatch}
                  />
                </div>
              )}
            </>
          )}
        </main>

        {/* Chat Window Overlay */}
        {chatOpen && chatConversationId && (
          <ChatWindow
            conversationId={chatConversationId}
            otherUser={chatOtherUser}
            currentUser={currentUser}
            token={currentUser?.token}
            onClose={() => setChatOpen(false)}
          />
        )}
      </div>
    </div>
  )
}
