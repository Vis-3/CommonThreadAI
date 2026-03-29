import { useEffect, useRef } from 'react'
import useChat from '../hooks/useChat'

function formatTime(timestamp) {
  if (!timestamp) return ''
  try {
    const d = new Date(timestamp)
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

export default function ChatWindow({
  conversationId,
  otherUser,
  currentUser,
  token,
  onClose,
}) {
  const { messages, inputValue, setInputValue, sendMessage, connectionStatus } = useChat({
    conversationId,
    token,
    currentUser,
  })

  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  function handleSend() {
    if (!inputValue.trim()) return
    sendMessage(inputValue)
    setInputValue('')
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const sharedSpots = otherUser?.shared_blind_spots || []

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(10,15,30,0.88)', backdropFilter: 'blur(6px)' }}
    >
      <div
        className="w-full max-w-lg flex flex-col rounded-2xl overflow-hidden"
        style={{
          height: 'min(90vh, 680px)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.7)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-3.5 shrink-0"
          style={{ background: '#0D1117', borderBottom: '1px solid rgba(197,160,89,0.25)' }}
        >
          <div className="flex items-center gap-3">
            {/* Online dot */}
            <div className="relative">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold"
                style={{ background: 'rgba(197,160,89,0.18)', color: '#C5A059' }}
              >
                {(otherUser?.display_name || 'U')[0].toUpperCase()}
              </div>
              {connectionStatus === 'connected' && (
                <span
                  className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2"
                  style={{ background: '#4CAF50', borderColor: '#0D1117' }}
                />
              )}
            </div>
            <div>
              <p className="font-semibold text-sm leading-none" style={{ color: '#C5A059' }}>
                {otherUser?.display_name || 'User'}
              </p>
              {otherUser?.state && (
                <p className="text-xs mt-0.5 text-[#6b7280]">{otherUser.state}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {connectionStatus === 'connecting' && (
              <span className="text-[10px] text-[#f4b942] opacity-70">connecting…</span>
            )}
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-full flex items-center justify-center text-lg leading-none transition-colors"
              style={{ color: '#4CAF50', background: 'rgba(76,175,80,0.12)' }}
              aria-label="Close chat"
            >
              ×
            </button>
          </div>
        </div>

        {/* Disconnected banner */}
        {connectionStatus === 'disconnected' && (
          <div
            className="shrink-0 text-center text-xs py-1.5"
            style={{ background: '#ef444420', color: '#ef4444' }}
          >
            Disconnected — messages may not send
          </div>
        )}

        {/* Shared Blind Spots panel */}
        {sharedSpots.length > 0 && (
          <div
            className="shrink-0 px-4 py-2.5"
            style={{ background: 'rgba(13,17,23,0.8)', borderBottom: '1px solid rgba(197,160,89,0.15)' }}
          >
            <p className="text-[10px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: '#C5A059' }}>
              What you both point toward
            </p>
            <div className="flex flex-wrap gap-1.5">
              {sharedSpots.map((spot, i) => (
                <span
                  key={i}
                  className="text-xs px-2.5 py-0.5 rounded-full"
                  style={{ background: 'rgba(197,160,89,0.12)', border: '1px solid rgba(197,160,89,0.3)', color: '#C5A059' }}
                >
                  {spot.title || spot.name || spot}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Message list — bg image + overlay */}
        <div
          className="relative flex-1 overflow-y-auto"
          style={{
            backgroundImage: 'url(/chat_template.jpeg)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
          {/* Semi-transparent overlay */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: 'rgba(10,15,30,0.55)', zIndex: 0 }}
          />
          <div className="relative px-4 py-4 space-y-3" style={{ zIndex: 1 }}>

          {messages.length === 0 && (
            <div className="relative flex items-center justify-center h-full">
              <p className="text-sm px-4 py-2 rounded-xl" style={{ color: '#C5A059', background: 'rgba(13,17,23,0.7)' }}>
                Start the conversation
              </p>
            </div>
          )}

          {messages.map((msg, i) => {
            const isMe =
              msg.sender_id === currentUser?.id ||
              msg.sender_id === String(currentUser?.id)

            return (
              <div
                key={msg.id || i}
                className={`relative flex message-fade-in ${isMe ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className="max-w-[72%] px-4 py-2.5 text-sm leading-relaxed"
                  style={{
                    background: isMe ? '#D06A2B' : '#708090',
                    color: '#FFFFFF',
                    borderRadius: isMe
                      ? '18px 18px 4px 18px'
                      : '18px 18px 18px 4px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.35)',
                  }}
                >
                  <p style={{ wordBreak: 'break-word' }}>{msg.content}</p>
                  {msg.timestamp && (
                    <p className="text-right text-[10px] mt-1" style={{ opacity: 0.65 }}>
                      {formatTime(msg.timestamp)}
                    </p>
                  )}
                </div>
              </div>
            )
          })}
          <div ref={messagesEndRef} />
          </div>{/* end inner relative div */}
        </div>

        {/* Input bar */}
        <div
          className="shrink-0 px-4 py-3 flex gap-2 items-center"
          style={{
            background: 'rgba(13,17,23,0.92)',
            borderTop: '1px solid rgba(197,160,89,0.2)',
          }}
        >
          <input
            ref={inputRef}
            type="text"
            className="flex-1 rounded-xl px-4 py-2.5 text-sm text-[#e8e8e8] placeholder-[#4a5568] focus:outline-none transition-colors"
            style={{
              background: 'rgba(10,15,30,0.85)',
              border: '1px solid #C5A059',
            }}
            placeholder="Message…"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={connectionStatus === 'disconnected'}
          />
          <button
            onClick={handleSend}
            disabled={!inputValue.trim() || connectionStatus === 'disconnected'}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold transition-opacity disabled:opacity-40"
            style={{ background: '#C5A059', color: '#0D1117' }}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  )
}
