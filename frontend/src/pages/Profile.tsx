import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import * as api from '../api/client'
import { toast } from 'sonner'

const DEPARTMENTS = ['Engineering', 'Marketing', 'Sales', 'Design', 'HR', 'Finance', 'Operations', 'Other']

export default function Profile() {
  const { user, refreshUser } = useAuth()
  const [form, setForm] = useState({
    name:                 user?.name                 ?? '',
    department:           user?.department           ?? '',
    position:             user?.position             ?? '',
    annual_vacation_days: user?.annual_vacation_days ?? 30,
    daily_target_hours:   user?.daily_target_hours   ?? 8,
  })
  const [pw, setPw]         = useState({ current_password: '', new_password: '', confirm: '' })
  const [saving, setSaving] = useState(false)
  const [changingPw, setCp] = useState(false)

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true)
    try {
      await api.updateMe(user!.id, {
        name: form.name,
        department: form.department,
        position: form.position,
        annual_vacation_days: Number(form.annual_vacation_days),
        daily_target_hours: Number(form.daily_target_hours),
      })
      await refreshUser()
      toast.success('Profile updated')
    } catch (e: any) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (pw.new_password !== pw.confirm) { toast.error('Passwords do not match'); return }
    if (pw.new_password.length < 6)     { toast.error('Min 6 characters'); return }
    setCp(true)
    try {
      await api.changePassword({ current_password: pw.current_password, new_password: pw.new_password })
      toast.success('Password changed')
      setPw({ current_password: '', new_password: '', confirm: '' })
    } catch (e: any) { toast.error(e.message) }
    finally { setCp(false) }
  }

  const initials = user?.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() ?? '?'

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="page-title">Profile</h1>
        <p className="page-subtitle">Manage your account</p>
      </div>

      <div className="flex items-center gap-4 mb-8">
        <div className="w-16 h-16 rounded-2xl bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-xl">
          {initials}
        </div>
        <div>
          <p className="font-semibold text-slate-900 text-lg">{user?.name}</p>
          <p className="text-sm text-slate-400">{user?.position} · {user?.department}</p>
          <p className="text-xs text-slate-400 mt-0.5">{user?.email}</p>
        </div>
      </div>

      {/* Profile form */}
      <div className="card p-6 mb-6">
        <h2 className="font-semibold text-slate-900 mb-5">Personal info</h2>
        <form onSubmit={saveProfile} className="space-y-4">
          <div>
            <label className="label">Full name</label>
            <input className="input" value={form.name} required
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Department</label>
              <select className="input" value={form.department}
                onChange={e => setForm(f => ({ ...f, department: e.target.value }))}>
                {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Position</label>
              <input className="input" value={form.position}
                onChange={e => setForm(f => ({ ...f, position: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Vacation days / year</label>
              <input className="input" type="number" min={0} max={365}
                value={form.annual_vacation_days}
                onChange={e => setForm(f => ({ ...f, annual_vacation_days: Number(e.target.value) }))} />
            </div>
            <div>
              <label className="label">Daily target (hours)</label>
              <input className="input" type="number" min={1} max={24} step={0.5}
                value={form.daily_target_hours}
                onChange={e => setForm(f => ({ ...f, daily_target_hours: Number(e.target.value) }))} />
            </div>
          </div>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? <><span className="spinner" />&nbsp;Saving…</> : 'Save changes'}
          </button>
        </form>
      </div>

      {/* Password form */}
      <div className="card p-6">
        <h2 className="font-semibold text-slate-900 mb-5">Change password</h2>
        <form onSubmit={changePassword} className="space-y-4">
          {[
            { label: 'Current password', key: 'current_password', ph: '••••••••' },
            { label: 'New password',     key: 'new_password',     ph: 'Min 6 characters' },
            { label: 'Confirm new',      key: 'confirm',          ph: 'Repeat new password' },
          ].map(f => (
            <div key={f.key}>
              <label className="label">{f.label}</label>
              <input className="input" type="password" placeholder={f.ph}
                value={(pw as any)[f.key]}
                onChange={e => setPw(p => ({ ...p, [f.key]: e.target.value }))} />
            </div>
          ))}
          <button type="submit" disabled={changingPw} className="btn-primary">
            {changingPw ? <><span className="spinner" />&nbsp;Updating…</> : 'Update password'}
          </button>
        </form>
      </div>
    </div>
  )
}