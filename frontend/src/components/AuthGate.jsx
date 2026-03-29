import { useState } from 'react'
import useDNAStore from '../store/useDNAStore'

const US_STATES = [
  'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado',
  'Connecticut', 'Delaware', 'Florida', 'Georgia', 'Hawaii', 'Idaho',
  'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky', 'Louisiana',
  'Maine', 'Maryland', 'Massachusetts', 'Michigan', 'Minnesota',
  'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada',
  'New Hampshire', 'New Jersey', 'New Mexico', 'New York',
  'North Carolina', 'North Dakota', 'Ohio', 'Oklahoma', 'Oregon',
  'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota',
  'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington',
  'West Virginia', 'Wisconsin', 'Wyoming'
]

const USERNAME_RE = /^[a-zA-Z0-9_]{3,30}$/
const DISPLAY_NAME_RE = /^[a-zA-Z0-9 '\-]{2,50}$/
const PASSWORD_RE = /^(?=.*[a-zA-Z])(?=.*[0-9]).{8,128}$/

function validateEduEmail(email) {
  if (!email) return false
  const lower = email.toLowerCase()
  const knownInstitutional = ['.edu', '.ac.uk', '.ac.in', '.edu.au', '.edu.ca']
  return knownInstitutional.some((d) => lower.includes(d))
}

export default function AuthGate({ onAuth }) {
  const setUser = useDNAStore((s) => s.setUser)
  const [tab, setTab] = useState('signup')
  const [loading, setLoading] = useState(false)
  const [apiError, setApiError] = useState('')

  // Sign up state
  const [signupForm, setSignupForm] = useState({
    display_name: '',
    username: '',
    email: '',
    password: '',
    state: '',
  })
  const [signupErrors, setSignupErrors] = useState({})

  // Log in state
  const [loginForm, setLoginForm] = useState({ username: '', password: '' })
  const [loginErrors, setLoginErrors] = useState({})

  function validateSignup(form) {
    const errs = {}
    if (!DISPLAY_NAME_RE.test(form.display_name))
      errs.display_name = 'Must be 2–50 chars, letters/numbers/spaces/apostrophes/hyphens only.'
    if (!USERNAME_RE.test(form.username))
      errs.username = 'Must be 3–30 chars, letters/numbers/underscores only.'
    if (!validateEduEmail(form.email))
      errs.email = 'Must be a valid institutional email (e.g. .edu).'
    if (!PASSWORD_RE.test(form.password))
      errs.password = 'Must be 8–128 chars with at least one letter and one number.'
    if (!form.state)
      errs.state = 'Please select your state.'
    return errs
  }

  function validateLogin(form) {
    const errs = {}
    if (!form.username.trim()) errs.username = 'Username is required.'
    if (!form.password.trim()) errs.password = 'Password is required.'
    return errs
  }

  async function handleSignup(e) {
    e.preventDefault()
    setApiError('')
    const errs = validateSignup(signupForm)
    setSignupErrors(errs)
    if (Object.keys(errs).length > 0) return

    setLoading(true)
    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(signupForm),
      })
      const data = await res.json()
      if (!res.ok) {
        setApiError(data.detail || data.message || 'Registration failed. Please try again.')
        return
      }
      const user = { ...data.user, token: data.token }
      setUser(user)
      onAuth(user)
    } catch {
      setApiError('Network error. Please check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleLogin(e) {
    e.preventDefault()
    setApiError('')
    const errs = validateLogin(loginForm)
    setLoginErrors(errs)
    if (Object.keys(errs).length > 0) return

    setLoading(true)
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm),
      })
      const data = await res.json()
      if (!res.ok) {
        setApiError(data.detail || data.message || 'Login failed. Check your credentials.')
        return
      }
      const user = { ...data.user, token: data.token }
      setUser(user)
      onAuth(user)
    } catch {
      setApiError('Network error. Please check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  const inputClass =
    'w-full bg-[#0d1526] border border-[#2d3748] rounded-lg px-4 py-3 text-[#e8e8e8] placeholder-[#4a5568] focus:outline-none focus:border-[#f4b942] focus:ring-1 focus:ring-[#f4b942] transition-colors'
  const errorClass = 'text-red-400 text-sm mt-1'
  const labelClass = 'block text-[#9ca3af] text-sm font-medium mb-1'

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'transparent' }}>
      <div className="w-full max-w-md">
        {/* Logo / Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2" style={{ color: '#f4b942', letterSpacing: '0.02em' }}>
            CommonThread
          </h1>
          <p className="text-[#9ca3af] text-sm leading-relaxed">
            Your culture is the bridge — not the thing you have to leave behind.
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl p-8" style={{ background: 'rgba(10,8,28,0.78)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.10)' }}>
          {/* Tabs */}
          <div className="flex rounded-lg overflow-hidden mb-8" style={{ background: 'rgba(0,0,0,0.35)' }}>
            {['signup', 'login'].map((t) => (
              <button
                key={t}
                onClick={() => { setTab(t); setApiError('') }}
                className="flex-1 py-2.5 text-sm font-medium transition-colors"
                style={{
                  background: tab === t ? '#f4b942' : 'transparent',
                  color: tab === t ? '#0a0f1e' : '#9ca3af',
                }}
              >
                {t === 'signup' ? 'Sign Up' : 'Log In'}
              </button>
            ))}
          </div>

          {/* API Error */}
          {apiError && (
            <div className="mb-6 p-3 rounded-lg bg-red-900/30 border border-red-700/50 text-red-300 text-sm">
              {apiError}
            </div>
          )}

          {tab === 'signup' ? (
            <form onSubmit={handleSignup} noValidate>
              <div className="space-y-5">
                {/* Display Name */}
                <div>
                  <label className={labelClass}>Display Name</label>
                  <input
                    type="text"
                    className={inputClass}
                    placeholder="How you'll appear to others"
                    value={signupForm.display_name}
                    onChange={(e) =>
                      setSignupForm((f) => ({ ...f, display_name: e.target.value }))
                    }
                  />
                  {signupErrors.display_name && (
                    <p className={errorClass}>{signupErrors.display_name}</p>
                  )}
                </div>

                {/* Username */}
                <div>
                  <label className={labelClass}>Username</label>
                  <input
                    type="text"
                    className={inputClass}
                    placeholder="your_username"
                    value={signupForm.username}
                    onChange={(e) =>
                      setSignupForm((f) => ({ ...f, username: e.target.value }))
                    }
                  />
                  {signupErrors.username && (
                    <p className={errorClass}>{signupErrors.username}</p>
                  )}
                </div>

                {/* Email */}
                <div>
                  <label className={labelClass}>Institutional Email</label>
                  <input
                    type="email"
                    className={inputClass}
                    placeholder="you@university.edu"
                    value={signupForm.email}
                    onChange={(e) =>
                      setSignupForm((f) => ({ ...f, email: e.target.value }))
                    }
                  />
                  {signupErrors.email && (
                    <p className={errorClass}>{signupErrors.email}</p>
                  )}
                </div>

                {/* Password */}
                <div>
                  <label className={labelClass}>Password</label>
                  <input
                    type="password"
                    className={inputClass}
                    placeholder="At least 8 chars, one letter + one number"
                    value={signupForm.password}
                    onChange={(e) =>
                      setSignupForm((f) => ({ ...f, password: e.target.value }))
                    }
                  />
                  {signupErrors.password && (
                    <p className={errorClass}>{signupErrors.password}</p>
                  )}
                </div>

                {/* State */}
                <div>
                  <label className={labelClass}>State</label>
                  <select
                    className={inputClass}
                    value={signupForm.state}
                    onChange={(e) =>
                      setSignupForm((f) => ({ ...f, state: e.target.value }))
                    }
                  >
                    <option value="">Select your state</option>
                    {US_STATES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  {signupErrors.state && (
                    <p className={errorClass}>{signupErrors.state}</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-lg font-semibold text-[#0a0f1e] transition-opacity disabled:opacity-60"
                  style={{ background: '#f4b942' }}
                >
                  {loading ? 'Creating account...' : 'Create Account'}
                </button>
              </div>

              <p className="mt-5 text-[#6b7280] text-xs text-center leading-relaxed">
                CommonThread is for university students only. A valid institutional email is required.
              </p>
            </form>
          ) : (
            <form onSubmit={handleLogin} noValidate>
              <div className="space-y-5">
                <div>
                  <label className={labelClass}>Username</label>
                  <input
                    type="text"
                    className={inputClass}
                    placeholder="your_username"
                    value={loginForm.username}
                    onChange={(e) =>
                      setLoginForm((f) => ({ ...f, username: e.target.value }))
                    }
                  />
                  {loginErrors.username && (
                    <p className={errorClass}>{loginErrors.username}</p>
                  )}
                </div>

                <div>
                  <label className={labelClass}>Password</label>
                  <input
                    type="password"
                    className={inputClass}
                    placeholder="Your password"
                    value={loginForm.password}
                    onChange={(e) =>
                      setLoginForm((f) => ({ ...f, password: e.target.value }))
                    }
                  />
                  {loginErrors.password && (
                    <p className={errorClass}>{loginErrors.password}</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-lg font-semibold text-[#0a0f1e] transition-opacity disabled:opacity-60"
                  style={{ background: '#f4b942' }}
                >
                  {loading ? 'Signing in...' : 'Sign In'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
