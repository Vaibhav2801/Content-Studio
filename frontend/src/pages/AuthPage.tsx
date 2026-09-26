import { ArrowLeft, ArrowRight, Check, LockKeyhole, Mail, Sparkles } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../components/content/AuthContext'
import './AuthPage.css'

export function AuthPage({ mode }: { mode: 'signin' | 'signup' }) {
  const { user, ready, signIn, signUp } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [workspace, setWorkspace] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const isSignup = mode === 'signup'
  const from = (location.state as { from?: unknown } | null)?.from
  const destination = typeof from === 'string' && (from === '/content' || from.startsWith('/content/')) ? from : '/content'

  if (!ready) return <div className="auth-gate" role="status">Checking your session…</div>
  if (user) return <Navigate to={destination} replace />

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    if (isSignup && password !== confirmPassword) { setError('Passwords do not match.'); return }
    setBusy(true)
    try {
      if (isSignup) await signUp(name.trim(), email.trim(), password, workspace.trim())
      else await signIn(email.trim(), password)
      navigate(destination, { replace: true })
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return <div className="auth-page">
    <aside className="auth-story">
      <Link className="auth-brand" to="/"><span><Sparkles size={23} /></span><strong>Visiofy Studio</strong></Link>
      <div className="auth-story-body">
        <div className="auth-eyebrow"><span /> YOUR CONTENT WORKSPACE</div>
        <h1>Make room for<br /><em>better ideas.</em></h1>
        <p>Plan, create, review, and publish from one calm place. Your drafts, schedule, and connected channels stay in your workspace.</p>
        <div className="auth-story-list">
          <span><Check size={16} /> Your own private publishing desk</span>
          <span><Check size={16} /> Every channel in one view</span>
          <span><Check size={16} /> A clear path from idea to published</span>
        </div>
      </div>
      <span className="auth-story-foot">Create · Publish · Grow</span>
      <div className="auth-orbit auth-orbit-one" /><div className="auth-orbit auth-orbit-two" />
    </aside>
    <main className="auth-main">
      <Link className="auth-home-link" to="/"><ArrowLeft size={16} /> Back to home</Link>
      <Link className="auth-mobile-brand" to="/" aria-label="Visiofy Studio home"><Sparkles size={20} /> Visiofy Studio</Link>
      <div className="auth-form-wrap">
        <span className="auth-form-kicker">{isSignup ? 'START YOUR WORKSPACE' : 'WELCOME BACK'}</span>
        <h2>{isSignup ? 'Create your account' : 'Sign in to Visiofy Studio'}</h2>
        <p className="auth-form-intro">{isSignup ? 'A fresh space for your ideas, drafts, and connected channels.' : 'Pick up where your last great idea left off.'}</p>
        <form onSubmit={(event) => void submit(event)}>
          {isSignup && <label>Full name<input autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Alex Morgan" required maxLength={150} /></label>}
          <label>Email address<span className="auth-input-icon"><Mail size={18} /><input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@company.com" required maxLength={150} /></span></label>
          <label>Password<span className="auth-input-icon"><LockKeyhole size={18} /><input type="password" autoComplete={isSignup ? 'new-password' : 'current-password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder={isSignup ? 'Create a strong password' : 'Enter your password'} required minLength={isSignup ? 8 : undefined} /></span></label>
          {isSignup && <><label>Confirm password<span className="auth-input-icon"><LockKeyhole size={18} /><input type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Repeat your password" required /></span></label><p className="auth-password-hint">Use at least 8 characters. Common or numeric-only passwords are rejected.</p><label><span className="auth-label-line">Workspace name <small>Optional</small></span><input value={workspace} onChange={(event) => setWorkspace(event.target.value)} placeholder="Your brand or team name" maxLength={255} /></label></>}
          {error && <div className="auth-error" role="alert">{error}</div>}
          <button className="auth-submit" type="submit" disabled={busy}>{busy ? 'One moment…' : isSignup ? 'Create account' : 'Sign in'} <ArrowRight size={18} /></button>
        </form>
        <p className="auth-switch">{isSignup ? 'Already have an account?' : 'New to Visiofy Studio?'} <Link to={isSignup ? '/signin' : '/signup'} state={location.state}>{isSignup ? 'Sign in' : 'Create an account'}</Link></p>
      </div>
      <span className="auth-main-foot">Your space to create with clarity.</span>
    </main>
  </div>
}
