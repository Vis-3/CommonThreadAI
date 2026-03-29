import { useEffect, useState } from 'react'
import useDNAStore from '../store/useDNAStore'

function formatTime(ts) {
  if (!ts) return ''
  try {
    const d = new Date(ts)
    const now = new Date()
    const diffDays = Math.floor((now - d) / 86400000)
    if (diffDays === 0) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    if (diffDays === 1) return 'Yesterday'
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
  } catch {
    return ''
  }
}

export default function Inbox({ onOpenChat }) {
  const token = useDNAStore((s) => s.currentUser?.token)
  const currentUser = useDNAStore((s) => s.currentUser)

  const [conversations, setConversations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) return
    setLoading(true)
    fetch('/api/conversations', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        setConversations(data.conversations || [])
      })
      .catch(() => setError('Could not load conversations.'))
      .finally(() => setLoading(false))
  }, [token])

  if (loading) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <p className="text-[#6b7280] text-sm">Loading conversations…</p>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-[#e8e8e8]">Messages</h2>
        <p className="text-[#6b7280] text-sm mt-0.5">Your conversations</p>
      </div>

      {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

      {conversations.length === 0 ? (
        <div
          className="rounded-xl p-10 text-center"
          style={{ background: '#111827', border: '1px solid #1f2937' }}
        >
          <p className="text-[#6b7280] text-sm">No conversations yet.</p>
          <p className="text-[#4b5563] text-xs mt-1">
            Match with someone to start chatting.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {conversations.map((convo) => {
            const isLastSentByMe = convo.last_sender_id === currentUser?.id
            const preview = convo.last_message
              ? (isLastSentByMe ? 'You: ' : '') + convo.last_message.slice(0, 60) + (convo.last_message.length > 60 ? '…' : '')
              : 'No messages yet'

            return (
              <button
                key={convo.conversation_id}
                onClick={() =>
                  onOpenChat(convo.conversation_id, {
                    display_name: convo.other_display_name,
                    user_id: convo.other_user_id,
                  })
                }
                className="w-full text-left rounded-xl px-4 py-3.5 flex items-center gap-3 transition-colors"
                style={{ background: '#111827', border: '1px solid #1f2937' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#1a2235')}
                onMouseLeave={(e) => (e.currentTarget.style.background = '#111827')}
              >
                {/* Avatar */}
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                  style={{ background: '#5ecfcf22', color: '#5ecfcf', border: '1px solid #5ecfcf40' }}
                >
                  {(convo.other_display_name || '?')[0].toUpperCase()}
                </div>

                {/* Text */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[#e8e8e8] text-sm font-medium truncate">
                      {convo.other_display_name}
                    </span>
                    <span className="text-[#4b5563] text-xs shrink-0">
                      {formatTime(convo.last_message_at || convo.conversation_created_at)}
                    </span>
                  </div>
                  <p className="text-[#6b7280] text-xs mt-0.5 truncate">{preview}</p>
                </div>

                {/* Arrow */}
                <svg
                  className="shrink-0 text-[#2d3748]"
                  width="14" height="14" viewBox="0 0 24 24"
                  fill="none" stroke="currentColor" strokeWidth="2"
                  strokeLinecap="round" strokeLinejoin="round"
                >
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
