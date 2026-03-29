export default function PathChooser({ userState, onChoose }) {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="text-center mb-10">
        <h2 className="text-2xl font-bold text-[#e8e8e8] mb-2">Where do you want to go?</h2>
        <p className="text-[#9ca3af] text-sm">
          Your cultural DNA is mapped. Now choose how you want to use it.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {/* Card A — Local */}
        <button
          onClick={() => onChoose('local')}
          className="text-left rounded-2xl p-6 transition-all hover:scale-[1.02] active:scale-[0.99] group"
          style={{ background: '#111827', border: '1px solid #1f2937' }}
        >
          {/* Map pin icon */}
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-colors group-hover:bg-[#f4b942]/20"
            style={{ background: '#f4b942/10', border: '1px solid #f4b942/30' }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f4b942" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
              <circle cx="12" cy="9" r="2.5" />
            </svg>
          </div>

          <h3 className="text-lg font-semibold text-[#e8e8e8] mb-2 group-hover:text-[#f4b942] transition-colors">
            Bridge your culture to {userState || 'your state'}
          </h3>
          <p className="text-sm text-[#9ca3af] leading-relaxed mb-5">
            Find films, music, and books from {userState || 'your state'}'s cultural scene that
            connect directly to what you already love.
          </p>

          <span
            className="inline-flex items-center gap-2 text-sm font-medium rounded-lg px-4 py-2.5 transition-colors group-hover:bg-[#f4b942] group-hover:text-[#0a0f1e]"
            style={{ border: '1px solid #f4b942', color: '#f4b942' }}
          >
            Show me {userState || 'local'} connections
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </span>
        </button>

        {/* Card B — Connect */}
        <button
          onClick={() => onChoose('connect')}
          className="text-left rounded-2xl p-6 transition-all hover:scale-[1.02] active:scale-[0.99] group"
          style={{ background: '#111827', border: '1px solid #1f2937' }}
        >
          {/* Two overlapping circles icon */}
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-colors group-hover:bg-[#5ecfcf]/20"
            style={{ background: '#5ecfcf10', border: '1px solid #5ecfcf30' }}
          >
            <svg width="26" height="18" viewBox="0 0 26 18" fill="none">
              <circle cx="9" cy="9" r="8" stroke="#5ecfcf" strokeWidth="2" fill="rgba(94,207,207,0.1)" />
              <circle cx="17" cy="9" r="8" stroke="#5ecfcf" strokeWidth="2" fill="rgba(94,207,207,0.1)" />
            </svg>
          </div>

          <h3 className="text-lg font-semibold text-[#e8e8e8] mb-2 group-hover:text-[#5ecfcf] transition-colors">
            Find others on the same journey
          </h3>
          <p className="text-sm text-[#9ca3af] leading-relaxed mb-5">
            Match with other students whose taste points toward the same blind spots as yours.
          </p>

          <span
            className="inline-flex items-center gap-2 text-sm font-medium rounded-lg px-4 py-2.5 transition-colors group-hover:bg-[#5ecfcf] group-hover:text-[#0a0f1e]"
            style={{ border: '1px solid #5ecfcf', color: '#5ecfcf' }}
          >
            Find my matches
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </span>
        </button>
      </div>
    </div>
  )
}
