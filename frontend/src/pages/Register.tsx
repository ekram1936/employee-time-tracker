import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Clock, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { toast } from 'sonner'

const DEPARTMENTS = ['Engineering', 'Marketing', 'Sales', 'Design', 'HR', 'Finance', 'Operations', 'Other']

export default function Register() {
  const { register, loading } = useAuth()
  const navigate = useNavigate()
  const [show, setShow] = useState(false)
  const [err, setErr]   = useState('')
  const [form, setForm] = useState({
    name: '', email: '', password: '', confirmPassword: '',
    department: 'Engineering', position: '',
    annual_vacation_days: 30,
    daily_target_hours: 8,
  })
  const set = (k: string, v: string | number) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr('')
    if (form.password !== form.confirmPassword) { setErr('Passwords do not match'); return }
    if (form.password.length < 6) { setErr('Password must be at least 6 characters'); return }
    try {
      await register({
        name: form.name, email: form.email, password: form.password,
        department: form.department, position: form.position,
        annual_vacation_days: Number(form.annual_vacation_days),
        daily_target_hours: Number(form.daily_target_hours),
      })
      toast.success('Account created! Welcome 🎉')
      navigate('/dashboard', { replace: true })
    } catch (e: any) { setErr(e.message ?? 'Registration failed') }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 p-4 py-10">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-600 shadow-lg mb-3">
            <Clock size={26} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">TimeTrack</h1>
          <p className="text-sm text-slate-500 mt-1">Create your account</p>
        </div>

        <div className="card p-8">
          <h2 className="text-lg font-semibold text-slate-900 mb-5">Register</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Full name</label>
              <input className="input" placeholder="Max Mustermann" required
                value={form.name} onChange={e => set('name', e.target.value)} />
            </div>
            <div>
              <label className="label">Email</label>
              <input className="input" type="email" placeholder="you@example.com" required
                value={form.email} onChange={e => set('email', e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Department</label>
                <select className="input" value={form.department}
                  onChange={e => set('department', e.target.value)}>
                  {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Position</label>
                <input className="input" placeholder="Developer" required
                  value={form.position} onChange={e => set('position', e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Vacation days/yr</label>
                <input className="input" type="number" min={0} max={365}
                  value={form.annual_vacation_days}
                  onChange={e => set('annual_vacation_days', e.target.value)} />
              </div>
              <div>
                <label className="label">Hours/day</label>
                <input className="input" type="number" min={1} max={24} step={0.5}
                  value={form.daily_target_hours}
                  onChange={e => set('daily_target_hours', e.target.value)} />
              </div>
            </div>
            <div>
              <label className="label">Password</label>
              <div className="relative">
                <input className="input pr-10" type={show ? 'text' : 'password'}
                  placeholder="Min 6 characters" required
                  value={form.password} onChange={e => set('password', e.target.value)} />
                <button type="button" onClick={() => setShow(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {show ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <div>
              <label className="label">Confirm password</label>
              <input className="input" type={show ? 'text' : 'password'} placeholder="Repeat password" required
                value={form.confirmPassword} onChange={e => set('confirmPassword', e.target.value)} />
            </div>
            {err && (
              <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2.5 border border-red-100">{err}</p>
            )}
            <button type="submit" disabled={loading} className="btn-primary btn-lg w-full justify-center">
              {loading ? <><span className="spinner" />&nbsp;Creating…</> : 'Create account'}
            </button>
          </form>
          <p className="text-center text-sm text-slate-500 mt-6">
            Already have an account?{' '}
            <Link to="/login" className="font-medium text-blue-600 hover:text-blue-700">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}