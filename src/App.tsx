import { useEffect, useMemo, useState } from 'react'
import {
  ArrowUpRight, BarChart3, Bell, CalendarDays, Check, ChevronRight, CircleUserRound,
  Download, Home, LockKeyhole, Mail, Moon, Plus, Receipt, Search, Settings, Sun, Tag, Trash2, Users, WalletCards, X,
} from 'lucide-react'
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { categoryData, expenses as initialExpenses, monthlyData } from './data'
import type { Category, Expense, Person } from './types'
import { auth } from './firebase'
import { createUserWithEmailAndPassword, onAuthStateChanged, sendPasswordResetEmail, signInWithEmailAndPassword, signOut, type User } from 'firebase/auth'

const money = (value: number) => `₹${value.toLocaleString('en-IN')}`
const navItems = [
  { label: 'Overview', icon: Home }, { label: 'History', icon: Receipt },
  { label: 'Reports', icon: BarChart3 }, { label: 'Profile', icon: CircleUserRound },
]

function App() {
  const [user, setUser] = useState<User | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [active, setActive] = useState('Overview')
  const [expenses, setExpenses] = useState(initialExpenses)
  const [showAdd, setShowAdd] = useState(false)
  const [dark, setDark] = useState(false)
  const total = useMemo(() => expenses.filter((expense) => expense.shared).reduce((sum, expense) => sum + expense.amount, 0), [expenses])
  const shashikantTotal = expenses.filter((expense) => expense.paidBy === 'Shashikant' && expense.shared).reduce((sum, expense) => sum + expense.amount, 0)
  const niteshTotal = total - shashikantTotal
  const balance = Math.abs(shashikantTotal - niteshTotal) / 2

  useEffect(() => onAuthStateChanged(auth, (nextUser) => {
    setUser(nextUser)
    setAuthLoading(false)
  }), [])

  if (authLoading) return <div className="auth-loading"><div className="brand-mark">F</div><span>Loading FlatMate…</span></div>
  if (!user) return <AuthScreen />

  const addExpense = (expense: Expense) => {
    setExpenses((current) => [expense, ...current])
    setShowAdd(false)
    setActive('Overview')
  }

  return (
    <div className={dark ? 'app dark' : 'app'}>
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark">F</div><span>flatmate</span></div>
        <div className="flat-switcher"><div className="avatar-stack"><span>SK</span><span>NT</span></div><div><strong>Our flat</strong><small>2 members</small></div><ChevronRight size={16} /></div>
        <nav>{navItems.map(({ label, icon: Icon }) => <button className={active === label ? 'nav-item active' : 'nav-item'} key={label} onClick={() => setActive(label)}><Icon size={19} /><span>{label}</span>{label === 'History' && <b>5</b>}</button>)}</nav>
        <div className="sidebar-bottom"><button className="nav-item"><Settings size={19} /><span>Settings</span></button><button className="user-card"><div className="person-avatar shashi">SK</div><div><strong>Shashikant</strong><small>Admin</small></div><ChevronRight size={16} /></button></div>
      </aside>
      <main>
        <header className="topbar"><div className="mobile-brand"><div className="brand-mark">F</div><span>flatmate</span></div><div className="header-actions"><button className="icon-btn" aria-label="Notifications"><Bell size={19} /><i /></button><button className="icon-btn" aria-label="Toggle theme" onClick={() => setDark(!dark)}>{dark ? <Sun size={19} /> : <Moon size={19} />}</button><button className="person-avatar shashi user-avatar-button" aria-label="Sign out" onClick={() => void signOut(auth)}>SK</button></div></header>
        <div className="content">
          {active === 'Overview' && <Dashboard total={total} shashikantTotal={shashikantTotal} niteshTotal={niteshTotal} balance={balance} expenses={expenses} onAdd={() => setShowAdd(true)} onHistory={() => setActive('History')} />}
          {active === 'History' && <History expenses={expenses} onAdd={() => setShowAdd(true)} onDelete={(id) => setExpenses(expenses.filter((expense) => expense.id !== id))} />}
          {active === 'Reports' && <Reports total={total} shashikantTotal={shashikantTotal} niteshTotal={niteshTotal} />}
          {active === 'Profile' && <Profile dark={dark} setDark={setDark} />}
        </div>
      </main>
      <nav className="mobile-nav">{navItems.slice(0, 2).map(({ label, icon: Icon }) => <button className={active === label ? 'active' : ''} key={label} onClick={() => setActive(label)}><Icon size={20} /><span>{label}</span></button>)}<button className="add-fab" onClick={() => setShowAdd(true)}><Plus size={24} /></button>{navItems.slice(2).map(({ label, icon: Icon }) => <button className={active === label ? 'active' : ''} key={label} onClick={() => setActive(label)}><Icon size={20} /><span>{label}</span></button>)}</nav>
      {showAdd && <AddExpense onClose={() => setShowAdd(false)} onSave={addExpense} />}
    </div>
  )
}

function AuthScreen() {
  const [signUp, setSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    setMessage('')
    try {
      if (signUp) {
        await createUserWithEmailAndPassword(auth, email.trim(), password)
        setMessage(`Welcome to FlatMate${name.trim() ? `, ${name.trim()}` : ''}!`)
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password)
      }
    } catch (authError) {
      const code = authError instanceof Error ? authError.message : ''
      setError(
        code.includes('operation-not-allowed')
          ? 'Email/password sign-in is disabled in Firebase. Enable it in Firebase Console → Authentication → Sign-in method.'
          : code.includes('invalid-email')
            ? 'Please enter a valid email address.'
            : code.includes('invalid-credential')
              ? 'Email or password is incorrect.'
              : code.includes('email-already-in-use')
                ? 'An account already exists with this email.'
                : code.includes('weak-password')
                  ? 'Password must be at least 6 characters.'
                  : code.includes('network-request-failed')
                    ? 'Network error. Check your internet connection and try again.'
                    : 'Unable to continue. Please check your details and try again.'
      )
    } finally {
      setBusy(false)
    }
  }

  const resetPassword = async () => {
    if (!email.trim()) {
      setError('Enter your email first to reset your password.')
      return
    }
    try {
      await sendPasswordResetEmail(auth, email.trim())
      setError('')
      setMessage('Password reset email sent. Check your inbox.')
    } catch {
      setError('We could not send the reset email. Check the address and try again.')
    }
  }

  return <main className="auth-page"><section className="auth-visual"><div className="auth-brand"><div className="brand-mark">F</div><span>flatmate</span></div><div className="auth-visual-copy"><span className="eyebrow">SHARED EXPENSES, SORTED</span><h1>Less notebook.<br /><em>More together.</em></h1><p>Keep your flat expenses simple, transparent and perfectly balanced.</p><div className="auth-preview"><div><span>OCTOBER SPEND</span><strong>₹3,510</strong></div><div className="auth-check"><Check size={17} /></div><small>All your shared spending in one calm place.</small></div></div></section><section className="auth-form-side"><div className="auth-form-wrap"><div className="auth-mobile-brand"><div className="brand-mark">F</div><span>flatmate</span></div><div className="auth-heading"><span className="eyebrow">{signUp ? 'GET STARTED' : 'WELCOME BACK'}</span><h2>{signUp ? 'Create your account' : 'Welcome back'}</h2><p>{signUp ? 'Start tracking your flat expenses together.' : 'Sign in to see how your flat is doing.'}</p></div><form className="auth-form" onSubmit={(event) => void submit(event)}>{signUp && <label>Your name<div className="auth-input"><CircleUserRound size={17} /><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Shashikant" autoComplete="name" /></div></label>}<label>Email address<div className="auth-input"><Mail size={17} /><input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" autoComplete="email" /></div></label><label>Password<div className="auth-input"><LockKeyhole size={17} /><input type="password" required minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 6 characters" autoComplete={signUp ? 'new-password' : 'current-password'} /></div></label>{!signUp && <button type="button" className="forgot-button" onClick={() => void resetPassword()}>Forgot password?</button>}{error && <div className="auth-message error">{error}</div>}{message && <div className="auth-message success">{message}</div>}<button className="primary auth-submit" disabled={busy}>{busy ? 'Please wait…' : signUp ? 'Create account' : 'Sign in'} {!busy && <ChevronRight size={17} />}</button></form><p className="auth-switch">{signUp ? 'Already have an account?' : 'New to FlatMate?'} <button onClick={() => { setSignUp(!signUp); setError(''); setMessage('') }}>{signUp ? 'Sign in' : 'Create an account'}</button></p><p className="auth-security"><LockKeyhole size={13} /> Your data is protected with Firebase Authentication</p></div></section></main>
}

function Dashboard({ total, shashikantTotal, niteshTotal, balance, expenses, onAdd, onHistory }: { total: number; shashikantTotal: number; niteshTotal: number; balance: number; expenses: Expense[]; onAdd: () => void; onHistory: () => void }) {
  const settlementMessage = shashikantTotal === niteshTotal ? 'All settled up!' : shashikantTotal > niteshTotal ? `Nitesh owes you ${money(balance)}` : `You owe Nitesh ${money(balance)}`
  const settlementDescription = shashikantTotal === niteshTotal ? 'You’re both perfectly balanced this month.' : 'Based on shared expenses and a 50:50 split.'
  return <><section className="page-heading"><div><p className="eyebrow">Wednesday, 23 October 2024</p><h1>Good morning, Shashikant <span>✦</span></h1><p className="muted">Here’s how your flat is doing this month.</p></div><button className="primary desktop-add" onClick={onAdd}><Plus size={18} /> Add expense</button></section>
    <section className="balance-card"><div className="balance-top"><div><span className="label">OCTOBER 2024 · SHARED EXPENSES</span><h2>{money(total)}</h2><p className="muted">Total across 5 transactions <span className="trend"><ArrowUpRight size={14} /> 8.4%</span></p></div><div className="balance-icon"><WalletCards size={22} /></div></div><div className="settlement"><div className="settlement-icon">{shashikantTotal === niteshTotal ? <Check size={17} /> : <ArrowUpRight size={17} />}</div><div><strong>{settlementMessage}</strong><p>{settlementDescription}</p></div><ChevronRight size={18} /></div></section>
    <section className="stats-grid"><Stat label="Shashikant paid" value={shashikantTotal} color="green" initials="SK" /><Stat label="Nitesh paid" value={niteshTotal} color="blue" initials="NT" /><Stat label="Your share" value={total / 2} color="yellow" icon={<Users size={16} />} /></section>
    <div className="section-heading"><div><h3>Recent activity</h3><p className="muted">Latest shared purchases</p></div><button className="text-button" onClick={onHistory}>View all <ChevronRight size={15} /></button></div>
    <div className="transactions">{expenses.slice(0, 4).map((expense) => <Transaction key={expense.id} expense={expense} />)}</div>
    <div className="chart-grid"><section className="panel"><div className="panel-heading"><div><h3>Spending overview</h3><p className="muted">Shared expenses by month</p></div><button className="select-button">Last 6 months <ChevronRight size={14} /></button></div><div className="chart"><ResponsiveContainer width="100%" height={210}><BarChart data={monthlyData} margin={{ left: -18, right: 4, top: 10 }}><XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#9aa2ad', fontSize: 11 }} /><YAxis hide /><Tooltip cursor={{ fill: 'rgba(22,182,122,.06)' }} formatter={(value) => [money(Number(value)), 'Spent']} /><Bar dataKey="total" fill="#16b67a" radius={[5, 5, 0, 0]} barSize={24} /></BarChart></ResponsiveContainer></div></section><section className="panel category-panel"><div className="panel-heading"><div><h3>By category</h3><p className="muted">This month</p></div><button className="more-button">•••</button></div><div className="pie-wrap"><ResponsiveContainer width={150} height={150}><PieChart><Pie data={categoryData} dataKey="value" innerRadius={49} outerRadius={67} paddingAngle={4} stroke="none">{categoryData.map((item) => <Cell key={item.name} fill={item.color} />)}</Pie></PieChart></ResponsiveContainer><div className="pie-label"><strong>₹3,510</strong><span>total</span></div></div><div className="legend">{categoryData.map((item) => <div key={item.name}><i style={{ background: item.color }} />{item.name}<strong>{item.value}%</strong></div>)}</div></section></div>
  </>
}

function Stat({ label, value, color, initials, icon }: { label: string; value: number; color: string; initials?: string; icon?: React.ReactNode }) { return <div className="stat-card"><div className={`stat-icon ${color}`}>{initials || icon}</div><span className="muted">{label}</span><strong>{money(value)}</strong><small>of total</small></div> }
function Transaction({ expense }: { expense: Expense }) { return <div className="transaction"><div className={`expense-icon ${expense.color}`}>{expense.icon}</div><div className="transaction-main"><strong>{expense.item}</strong><span>{expense.category} · {expense.date}</span></div><div className="transaction-amount"><strong>{money(expense.amount)}</strong><span className={expense.paidBy === 'Shashikant' ? 'paid shashi-text' : 'paid'}>{expense.paidBy === 'Shashikant' ? 'You paid' : 'Nitesh paid'}</span></div><ChevronRight className="transaction-arrow" size={17} /></div> }

function History({ expenses, onAdd, onDelete }: { expenses: Expense[]; onAdd: () => void; onDelete: (id: string) => void }) { const [search, setSearch] = useState(''); const filtered = expenses.filter((expense) => expense.item.toLowerCase().includes(search.toLowerCase())); return <><section className="page-heading"><div><p className="eyebrow">YOUR FLAT</p><h1>Expense history</h1><p className="muted">Every purchase, all in one place.</p></div><button className="primary desktop-add" onClick={onAdd}><Plus size={18} /> Add expense</button></section><div className="history-toolbar"><div className="search"><Search size={17} /><input placeholder="Search expenses" value={search} onChange={(event) => setSearch(event.target.value)} /></div><button className="filter-button"><CalendarDays size={16} /> This month</button><button className="filter-button">All people</button></div><div className="history-list">{filtered.map((expense) => <div className="history-row" key={expense.id}><Transaction expense={expense} /><button className="delete-button" onClick={() => onDelete(expense.id)} aria-label={`Delete ${expense.item}`}><Trash2 size={16} /></button></div>)}</div></> }
function Reports({ total, shashikantTotal, niteshTotal }: { total: number; shashikantTotal: number; niteshTotal: number }) { const balance = Math.abs(shashikantTotal - niteshTotal) / 2; const status = shashikantTotal === niteshTotal ? 'All settled up' : shashikantTotal > niteshTotal ? `Nitesh owes you ${money(balance)}` : `You owe Nitesh ${money(balance)}`; return <><section className="page-heading"><div><p className="eyebrow">MONTHLY REPORT</p><h1>October at a glance</h1><p className="muted">A clear view of your shared spending.</p></div><button className="secondary"><Download size={17} /> Export report</button></section><div className="report-highlight"><div><span className="label">TOTAL SHARED SPEND</span><h2>{money(total)}</h2><p className="muted">Across 5 shared transactions</p></div><div className="report-stat"><span>Shashikant</span><strong>{money(shashikantTotal)}</strong><div className="progress"><i style={{ width: `${(shashikantTotal / total) * 100}%` }} /></div></div><div className="report-stat"><span>Nitesh</span><strong>{money(niteshTotal)}</strong><div className="progress blue-progress"><i style={{ width: `${(niteshTotal / total) * 100}%` }} /></div></div></div><div className="report-panels"><section className="panel"><div className="panel-heading"><div><h3>Monthly comparison</h3><p className="muted">Contribution by person</p></div><Tag size={18} /></div><div className="comparison"><div><span>Shashikant</span><strong>{money(shashikantTotal)}</strong><i style={{ height: `${(shashikantTotal / total) * 100}%` }} /></div><div><span>Nitesh</span><strong>{money(niteshTotal)}</strong><i className="blue-bar" style={{ height: `${(niteshTotal / total) * 100}%` }} /></div></div></section><section className="panel settle-panel"><span className="label">SETTLEMENT STATUS</span><div className="settle-big"><div className="settle-icon">{shashikantTotal === niteshTotal ? <Check size={20} /> : <ArrowUpRight size={20} />}</div><div><h3>{status}</h3><p className="muted">{shashikantTotal === niteshTotal ? 'No pending payments this month.' : 'Pending based on this month’s shared spend.'}</p></div></div></section></div></> }
function Profile({ dark, setDark }: { dark: boolean; setDark: (value: boolean) => void }) { return <><section className="page-heading"><div><p className="eyebrow">YOUR ACCOUNT</p><h1>Profile & settings</h1><p className="muted">Manage your flat and preferences.</p></div></section><section className="profile-card"><div className="profile-avatar">SK</div><div><h2>Shashikant</h2><p className="muted">shashikant@example.com</p><span className="role-pill">Flat admin</span></div><button className="secondary">Edit profile</button></section><section className="settings-list"><div className="settings-row"><div className="settings-icon"><Moon size={18} /></div><div><strong>Dark mode</strong><p className="muted">Use a darker appearance at night</p></div><button className={dark ? 'toggle on' : 'toggle'} onClick={() => setDark(!dark)}><i /></button></div><div className="settings-row"><div className="settings-icon"><Users size={18} /></div><div><strong>Our flat</strong><p className="muted">Shashikant and Nitesh · 2 members</p></div><ChevronRight size={18} /></div><div className="settings-row"><div className="settings-icon"><Bell size={18} /></div><div><strong>Notifications</strong><p className="muted">Expense and settlement updates</p></div><ChevronRight size={18} /></div></section></> }

function AddExpense({ onClose, onSave }: { onClose: () => void; onSave: (expense: Expense) => void }) { const [item, setItem] = useState(''); const [amount, setAmount] = useState(''); const [paidBy, setPaidBy] = useState<Person>('Shashikant'); const [category, setCategory] = useState<Category>('Groceries'); const save = () => { const numericAmount = Number(amount); if (!item.trim() || !numericAmount || numericAmount < 1) return; onSave({ id: crypto.randomUUID(), item: item.trim(), amount: numericAmount, paidBy, category, date: 'Just now', icon: category === 'Groceries' ? '🛒' : category === 'Utilities' ? '⚡' : category === 'Home care' ? '🧼' : '🍜', color: category === 'Groceries' ? 'mint' : category === 'Utilities' ? 'yellow' : category === 'Home care' ? 'blue' : 'orange', shared: true }) }; return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><form className="expense-modal" onSubmit={(event) => { event.preventDefault(); save() }}><div className="modal-heading"><div><p className="eyebrow">NEW TRANSACTION</p><h2>Add an expense</h2></div><button type="button" className="close-button" onClick={onClose}><X size={20} /></button></div><label>What did you buy?<input autoFocus value={item} onChange={(event) => setItem(event.target.value)} placeholder="e.g. Rice, milk, electricity" /></label><label>Amount<input value={amount} onChange={(event) => setAmount(event.target.value.replace(/[^\d]/g, ''))} placeholder="₹ 0" inputMode="numeric" /></label><div className="form-grid"><label>Category<select value={category} onChange={(event) => setCategory(event.target.value as Category)}><option>Groceries</option><option>Utilities</option><option>Home care</option><option>Eating out</option></select></label><label>Paid by<select value={paidBy} onChange={(event) => setPaidBy(event.target.value as Person)}><option>Shashikant</option><option>Nitesh</option></select></label></div><label className="upload-field"><span>Receipt image <small>(optional)</small></span><div className="upload-box">📷 <span>Take a photo or choose from gallery</span></div></label><button className="primary submit-button" type="submit"><Plus size={18} /> Save expense</button></form></div> }

export default App
