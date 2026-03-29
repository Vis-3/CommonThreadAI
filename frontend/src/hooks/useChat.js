import { useState, useEffect, useRef, useCallback } from 'react'

/** If a message's content is a JSON envelope, unwrap it. */
function normalizeMessage(msg) {
  if (!msg || typeof msg.content !== 'string') return msg
  const raw = msg.content.trim()
  if (!raw.startsWith('{')) return msg
  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed.content === 'string') {
      return { ...msg, content: parsed.content }
    }
  } catch {
    // not JSON — leave as-is
  }
  return msg
}

export default function useChat({ conversationId, token, currentUser }) {
  const [messages, setMessages] = useState([])
  const [inputValue, setInputValue] = useState('')
  const [connectionStatus, setConnectionStatus] = useState('connecting')
  const wsRef = useRef(null)

  // Fetch message history on mount
  useEffect(() => {
    if (!conversationId || !token) return

    async function fetchHistory() {
      try {
        const res = await fetch(`/api/conversations/${conversationId}/messages`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.ok) {
          const data = await res.json()
          const msgs = Array.isArray(data) ? data : (data.messages || [])
          setMessages(msgs.map(normalizeMessage))
        }
      } catch {
        // Silently fail — WebSocket will still work
      }
    }

    fetchHistory()
  }, [conversationId, token])

  // Open WebSocket
  useEffect(() => {
    if (!conversationId || !token) return

    setConnectionStatus('connecting')

    const wsUrl = `/ws/chat/${conversationId}?token=${token}`
    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onopen = () => {
      setConnectionStatus('connected')
    }

    ws.onmessage = (event) => {
      try {
        const msg = normalizeMessage(JSON.parse(event.data))
        setMessages((prev) => [...prev, msg])
      } catch {
        // ignore malformed messages
      }
    }

    ws.onerror = () => {
      setConnectionStatus('disconnected')
    }

    ws.onclose = () => {
      setConnectionStatus('disconnected')
    }

    return () => {
      ws.close()
    }
  }, [conversationId, token])

  const sendMessage = useCallback(
    (text) => {
      const trimmed = text.trim()
      if (!trimmed) return
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        const payload = {
          type: 'message',
          content: trimmed,
          sender_id: currentUser?.id,
          timestamp: new Date().toISOString(),
        }
        wsRef.current.send(JSON.stringify(payload))
        // Optimistically add to messages
        setMessages((prev) => [
          ...prev,
          {
            ...payload,
            id: `local-${Date.now()}`,
            sender_id: currentUser?.id,
            content: trimmed,
          },
        ])
      }
    },
    [currentUser]
  )

  return {
    messages,
    inputValue,
    setInputValue,
    sendMessage,
    connectionStatus,
  }
}
