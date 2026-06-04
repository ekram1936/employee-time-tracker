import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Clock, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { toast } from 'sonner'

export default function Login() {
  const { login, loading } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow]         = useState(false)
  const [err, setErr]           = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr('')
    try {
      await login(email, password)
      toast.success('Welcome back!')
      navigate('/dashboard', { replace: true })
    } catch (e: any) { setErr(e.message ?? 'Invalid credentials') }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-600 shadow-lg mb-4">
            <Clock size={26} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">TimeTrack</h1>
          <p className="text-sm text-slate-500 mt-1">Personal time tracking</p>
        </div>

        <div className="card p-8">
          <h2 className="text-lg font-semibold text-slate-900 mb-6">Sign in</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Email</label>
              <input className="input" type="email" placeholder="you@example.com" autoFocus
                value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <div>
              <label className="label">Password</label>
              <div className="relative">
                <input className="input pr-10" type={show ? 'text' : 'password'} placeholder="••••••••"
                  value={password} onChange={e => setPassword(e.target.value)} required />
                <button type="button" onClick={() => setShow(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {show ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            {err && (
              <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2.5 border border-red-100">{err}</p>
            )}
            <button type="submit" disabled={loading} className="btn-primary btn-lg w-full justify-center">
              {loading ? <><span className="spinner" />&nbsp;Signing in…</> : 'Sign in'}
            </button>
          </form>
          <p className="text-center text-sm text-slate-500 mt-6">
            No account?{' '}
            <Link to="/register" className="font-medium text-blue-600 hover:text-blue-700">Create one</Link>
          </p>
        </div>
      </div>
    </div>
  )
}