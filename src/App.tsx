import { useEffect, useMemo, useState } from 'react'
import {
  ArrowUpRight, BarChart3, Bell, CalendarDays, Check, ChevronRight, CircleUserRound,
  Download, Home, LockKeyhole, Mail, Moon, Plus, Receipt, Search, Settings, Sun, Tag, Trash2, Users, WalletCards, X,
} from 'lucide-react'
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { Category, Expense, Person } from './types'
import { auth } from './firebase'
import { FirebaseError } from 'firebase/app'
import { createUserWithEmailAndPassword, onAuthStateChanged, sendEmailVerification, sendPasswordResetEmail, signInWithEmailAndPassword, signOut, updateProfile, type User } from 'firebase/auth'
import { deleteExpense, subscribeToExpenses, createExpense } from './services/expenses'
import { acceptInvitation, createFlat, createInvitation, getUserFlat } from './services/flat'
import { calculateBalances, type MemberBalance } from './services/settlement'

const money = (value: number) => `₹${value.toLocaleString('en-IN')}`
const initials = (name: string) => name.split(/\s+/).filter(Boolean).map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'FM'
const INDIA_TIME_ZONE = 'Asia/Kolkata'
const indiaDateFormatter = new Intl.DateTimeFormat('en-IN', {
  timeZone: INDIA_TIME_ZONE, weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
})
const indiaClockFormatter = new Intl.DateTimeFormat('en-IN', {
  timeZone: INDIA_TIME_ZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
})
const indiaMonthFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: INDIA_TIME_ZONE, year: 'numeric', month: '2-digit',
})
const indiaDateTimePartsFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: INDIA_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
})
const formatIndiaDate = (date: Date) => indiaDateFormatter.format(date)
const formatIndiaTime = (date: Date) => indiaClockFormatter.format(date)
const formatIndiaMonth = (date: Date) => indiaMonthFormatter.format(date)
const formatIndiaDateTimeInput = (date: Date) => {
  const parts = Object.fromEntries(indiaDateTimePartsFormatter.formatToParts(date).map(({ type, value }) => [type, value]))
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`
}
const indiaDateTimeToUtc = (value: string) => new Date(`${value}:00+05:30`).toISOString()
const getGreeting = (date: Date) => {
  const hour = Number(new Intl.DateTimeFormat('en-IN', { timeZone: INDIA_TIME_ZONE, hour: 'numeric', hourCycle: 'h23' }).format(date))
  if (hour < 12) return 'Good Morning'
  if (hour < 17) return 'Good Afternoon'
  if (hour < 21) return 'Good Evening'
  return 'Good Night'
}
const getFirebaseErrorMessage = (error: unknown) => {
  if (error instanceof FirebaseError) {
    if (error.code === 'permission-denied' || error.code === 'functions/permission-denied') return 'Permission denied. Please use an authorized account.'
    if (error.code === 'unauthenticated' || error.code === 'functions/unauthenticated') return 'Authentication required. Please sign in again.'
    if (error.code === 'unavailable' || error.code === 'functions/unavailable' || error.code === 'failed-precondition') return 'Network or Firebase service unavailable. Please try again.'
    if (error.code === 'functions/not-found') return 'Flat creation service is not deployed. Contact the administrator.'
    if (error.code === 'functions/internal') return 'Flat creation failed on the server. Please try again or contact the administrator.'
    return error.message || 'Flat creation failed. Please try again.'
  }
  return error instanceof Error ? error.message : 'Flat creation failed. Please try again.'
}
const navItems = [
  { label: 'Overview', icon: Home }, { label: 'History', icon: Receipt },
  { label: 'Reports', icon: BarChart3 }, { label: 'Profile', icon: CircleUserRound },
]

function App() {
  const [user, setUser] = useState<User | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [flatId, setFlatId] = useState<string | null>(null)
  const [flatName, setFlatName] = useState('Our flat')
  const [members, setMembers] = useState<import('./types').FlatMember[]>([])
  const [profileName, setProfileName] = useState('')
  const [flatLoading, setFlatLoading] = useState(false)
  const [active, setActive] = useState('Overview')
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [showInvite, setShowInvite] = useState(false)
  const [dark, setDark] = useState(false)
  const [now, setNow] = useState(() => new Date())
  const currentMonth = formatIndiaMonth(now)
  const total = useMemo(() => expenses.filter((expense) => expense.shared).reduce((sum, expense) => sum + expense.amount, 0), [expenses])
  const balances = useMemo(() => calculateBalances(expenses, members), [expenses, members])

  useEffect(() => onAuthStateChanged(auth, (nextUser) => {
    setUser(nextUser)
    setAuthLoading(false)
  }), [])

  useEffect(() => {
    let interval: number | undefined
    const timeout = window.setTimeout(() => {
      setNow(new Date())
      interval = window.setInterval(() => setNow(new Date()), 60_000)
    }, 60_000 - (Date.now() % 60_000))
    return () => {
      window.clearTimeout(timeout)
      if (interval !== undefined) window.clearInterval(interval)
    }
  }, [])

  useEffect(() => {
    if (!user) {
      setFlatId(null)
      setFlatName('Our flat')
      setMembers([])
      setProfileName('')
      setExpenses([])
      return
    }
    let unsubscribe = () => {}
    setFlatLoading(true)
    void getUserFlat(user.uid).then((context) => {
      if (!context) {
        setFlatId(null)
        setProfileName(user.displayName ?? '')
        return
      }
      setFlatId(context.flatId)
      setFlatName(context.flatName)
      setMembers(context.members)
      setProfileName(context.displayName || user.displayName || '')
      unsubscribe = subscribeToExpenses(context.flatId, currentMonth, setExpenses, (error) => console.error('Expense subscription failed', error))
    }).catch((error) => {
      console.error('Flat profile load failed', error)
      setFlatId(null)
    }).finally(() => setFlatLoading(false))
    return () => unsubscribe()
  }, [user, currentMonth])

  if (authLoading) return <div className="auth-loading"><div className="brand-mark">F</div><span>Loading FlatMate…</span></div>
  if (!user) return <AuthScreen />
  if (flatLoading) return <div className="auth-loading"><div className="brand-mark">F</div><span>Loading your flat…</span></div>
  if (!flatId) return <FlatSetup user={user} onJoined={(context) => { setFlatId(context.flatId); setFlatName(context.flatName); setMembers(context.members); setProfileName(context.displayName) }} />

  const addExpense = async (expense: Expense) => {
    await createExpense(flatId, {
      item: expense.item, amountInPaise: expense.amountInPaise, paidBy: expense.paidBy,
      category: expense.category, purchaseDate: expense.purchaseDate, expenseType: expense.expenseType,
    })
    setShowAdd(false)
    setActive('Overview')
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this expense? It will be removed for everyone in this flat.')) return
    await deleteExpense(flatId, id)
  }

  return (
    <div className={dark ? 'app dark' : 'app'}>
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark">F</div><span>flatmate</span></div>
        <div className="flat-switcher"><div className="avatar-stack">{members.slice(0, 2).map((member) => <span key={member.uid}>{initials(member.displayName)}</span>)}</div><div><strong>{flatName}</strong><small>{members.length} member{members.length === 1 ? '' : 's'}</small></div><button className="flat-add-person" onClick={() => setShowInvite(true)} aria-label="Add person" title="Add person"><Plus size={15} /></button></div>
        <nav>{navItems.map(({ label, icon: Icon }) => <button className={active === label ? 'nav-item active' : 'nav-item'} key={label} onClick={() => setActive(label)}><Icon size={19} /><span>{label}</span>{label === 'History' && <b>5</b>}</button>)}</nav>
        <div className="sidebar-bottom"><button className="nav-item"><Settings size={19} /><span>Settings</span></button><button className="user-card"><div className="person-avatar shashi">{initials(profileName || user.displayName || 'there')}</div><div><strong>{profileName || user.displayName || 'there'}</strong><small>Flat member</small></div><ChevronRight size={16} /></button></div>
      </aside>
      <main>
        <header className="topbar"><div className="mobile-brand"><div className="brand-mark">F</div><span>flatmate</span></div><div className="header-actions"><button className="icon-btn" aria-label="Notifications"><Bell size={19} /><i /></button><button className="icon-btn" aria-label="Toggle theme" onClick={() => setDark(!dark)}>{dark ? <Sun size={19} /> : <Moon size={19} />}</button><button className="person-avatar shashi user-avatar-button" aria-label="Sign out" onClick={() => void signOut(auth)}>{initials(profileName || user.displayName || 'there')}</button></div></header>
        <div className="content">
          {active === 'Overview' && <Dashboard userName={profileName || user.displayName || 'there'} flatName={flatName} now={now} total={total} balances={balances} expenses={expenses} onAdd={() => setShowAdd(true)} onInvite={() => setShowInvite(true)} onHistory={() => setActive('History')} />}
          {active === 'History' && <History expenses={expenses} onAdd={() => setShowAdd(true)} onDelete={(id) => void handleDelete(id)} />}
          {active === 'Reports' && <Reports total={total} balances={balances} />}
          {active === 'Profile' && <Profile name={profileName || user.displayName || 'there'} email={user.email || ''} dark={dark} setDark={setDark} />}
        </div>
      </main>
      <nav className="mobile-nav">{navItems.slice(0, 2).map(({ label, icon: Icon }) => <button className={active === label ? 'active' : ''} key={label} onClick={() => setActive(label)}><Icon size={20} /><span>{label}</span></button>)}<button className="add-fab" onClick={() => setShowAdd(true)}><Plus size={24} /></button>{navItems.slice(2).map(({ label, icon: Icon }) => <button className={active === label ? 'active' : ''} key={label} onClick={() => setActive(label)}><Icon size={20} /><span>{label}</span></button>)}</nav>
      {showAdd && <AddExpense currentUser={profileName || user.displayName || user.email || 'there'} now={now} onClose={() => setShowAdd(false)} onSave={(expense) => void addExpense(expense)} />}
      {showInvite && <InvitePerson flatId={flatId} onClose={() => setShowInvite(false)} />}
    </div>
  )
}

function FlatSetup({ user, onJoined }: { user: User; onJoined: (context: { flatId: string; flatName: string; displayName: string; members: import('./types').FlatMember[] }) => void }) {
  const [mode, setMode] = useState<'create' | 'join'>(new URLSearchParams(window.location.search).has('invite') ? 'join' : 'create')
  const [flatName, setFlatName] = useState('')
  const [name, setName] = useState(user.displayName ?? '')
  const [token, setToken] = useState(new URLSearchParams(window.location.search).get('invite') ?? '')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (busy) return
    setError('')
    if (!name.trim()) {
      setError('Your name is required.')
      return
    }
    if (mode === 'create' && !flatName.trim()) {
      setError('Enter a flat name.')
      return
    }
    if (!user.uid) {
      setError('Authentication required. Please sign in again.')
      return
    }
    setBusy(true)
    try {
      if (mode === 'create') {
        const context = await createFlat(user.uid, name, flatName)
        onJoined(context)
      } else {
        await acceptInvitation(token.trim())
        const context = await getUserFlat(user.uid)
        if (!context) throw new Error('Invitation accepted but flat profile is unavailable')
        onJoined(context)
      }
    }
    catch (error) {
      console.error('Flat setup failed', error)
      setError(getFirebaseErrorMessage(error))
    }
    finally { setBusy(false) }
  }
  return <main className="auth-page"><section className="auth-form-side"><div className="auth-form-wrap"><div className="auth-mobile-brand"><div className="brand-mark">F</div><span>flatmate</span></div><div className="auth-heading"><span className="eyebrow">ONE SHARED REGISTER</span><h2>{mode === 'create' ? 'Create your flat' : 'Accept invitation'}</h2><p>{mode === 'create' ? 'Start a private workspace for your household.' : 'Use the secure invitation sent to your email.'}</p></div><div className="auth-switch"><button type="button" onClick={() => setMode('create')}>Create new flat</button><button type="button" onClick={() => setMode('join')}>Join by invitation</button></div><form className="auth-form" onSubmit={(event) => void submit(event)}><label>Your name<div className="auth-input"><input required value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name" /></div></label>{mode === 'create' ? <label>Flat name<div className="auth-input"><input required value={flatName} onChange={(event) => setFlatName(event.target.value)} placeholder="e.g. Green View Flat" /></div></label> : <label>Invitation code<div className="auth-input"><input required value={token} onChange={(event) => setToken(event.target.value)} placeholder="Paste invitation code" /></div></label>}{error && <div className="auth-message error">{error}</div>}<button className="primary auth-submit" disabled={busy}>{busy ? 'Saving…' : 'Continue'} <ChevronRight size={17} /></button></form></div></section></main>
}

function InvitePerson({ flatId, onClose }: { flatId: string; onClose: () => void }) {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [token, setToken] = useState('')
  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (busy) return
    if (!/^[^\s@]+@gmail\.com$/i.test(email.trim())) {
      setError('Enter a valid Gmail address.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const invitation = await createInvitation(flatId, email)
      setToken(invitation.token)
    } catch (invitationError) {
      console.error('Invite person failed', invitationError)
      setError(getFirebaseErrorMessage(invitationError))
    } finally {
      setBusy(false)
    }
  }
  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><form className="expense-modal invite-modal" onSubmit={(event) => void submit(event)}><div className="modal-heading"><div><p className="eyebrow">YOUR FLAT</p><h2>Add person</h2></div><button type="button" className="close-button" onClick={onClose}><X size={20} /></button></div>{token ? <><div className="auth-message success">Invitation created for {email.trim()}.</div><label>Invitation code<input readOnly value={token} onFocus={(event) => event.currentTarget.select()} /></label><p className="muted">Share this code with the invited person. It expires in 7 days.</p><button type="button" className="primary submit-button" onClick={onClose}>Done</button></> : <><label>Roommate Gmail address<div className="auth-input"><Mail size={17} /><input autoFocus required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="roommate@gmail.com" /></div></label>{error && <div className="auth-message error">{error}</div>}<button className="primary submit-button" disabled={busy}>{busy ? 'Sending…' : 'Send invitation'} <Mail size={17} /></button></>}</form></div>
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
        const credential = await createUserWithEmailAndPassword(auth, email.trim(), password)
        if (name.trim()) await updateProfile(credential.user, { displayName: name.trim() })
        await sendEmailVerification(credential.user)
        setMessage(`Welcome to FlatMate${name.trim() ? `, ${name.trim()}` : ''}! Please verify your email.`)
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

  return <main className="auth-page"><section className="auth-visual"><div className="auth-brand"><div className="brand-mark">F</div><span>flatmate</span></div><div className="auth-visual-copy"><span className="eyebrow">SHARED EXPENSES, SORTED</span><h1>Less notebook.<br /><em>More together.</em></h1><p>Keep your flat expenses simple, transparent and perfectly balanced.</p><div className="auth-preview"><div><span>CURRENT SHARED SPEND</span><strong>₹0</strong></div><div className="auth-check"><Check size={17} /></div><small>All your shared spending in one calm place.</small></div></div></section><section className="auth-form-side"><div className="auth-form-wrap"><div className="auth-mobile-brand"><div className="brand-mark">F</div><span>flatmate</span></div><div className="auth-heading"><span className="eyebrow">{signUp ? 'GET STARTED' : 'WELCOME BACK'}</span><h2>{signUp ? 'Create your account' : 'Welcome back'}</h2><p>{signUp ? 'Start tracking your flat expenses together.' : 'Sign in to see how your flat is doing.'}</p></div><form className="auth-form" onSubmit={(event) => void submit(event)}>{signUp && <label>Your name<div className="auth-input"><CircleUserRound size={17} /><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name" autoComplete="name" /></div></label>}<label>Email address<div className="auth-input"><Mail size={17} /><input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" autoComplete="email" /></div></label><label>Password<div className="auth-input"><LockKeyhole size={17} /><input type="password" required minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 6 characters" autoComplete={signUp ? 'new-password' : 'current-password'} /></div></label>{!signUp && <button type="button" className="forgot-button" onClick={() => void resetPassword()}>Forgot password?</button>}{error && <div className="auth-message error">{error}</div>}{message && <div className="auth-message success">{message}</div>}<button className="primary auth-submit" disabled={busy}>{busy ? 'Please wait…' : signUp ? 'Create account' : 'Sign in'} {!busy && <ChevronRight size={17} />}</button></form><p className="auth-switch">{signUp ? 'Already have an account?' : 'New to FlatMate?'} <button onClick={() => { setSignUp(!signUp); setError(''); setMessage('') }}>{signUp ? 'Sign in' : 'Create an account'}</button></p><p className="auth-security"><LockKeyhole size={13} /> Your data is protected with Firebase Authentication</p></div></section></main>
}

function Dashboard({ userName, flatName, now, total, balances, expenses, onAdd, onInvite, onHistory }: { userName: string; flatName: string; now: Date; total: number; balances: MemberBalance[]; expenses: Expense[]; onAdd: () => void; onInvite: () => void; onHistory: () => void }) {
  const myBalance = balances.find((entry) => entry.displayName === userName)
  const otherBalance = balances.find((entry) => entry.displayName !== userName)
  const balance = Math.abs(myBalance?.netInPaise ?? 0) / 100
  const settlementMessage = !myBalance || myBalance.netInPaise === 0 ? 'All settled up!' : myBalance.netInPaise > 0 ? `${otherBalance?.displayName ?? 'Your flatmate'} owes you ${money(balance)}` : `You owe ${otherBalance?.displayName ?? 'your flatmate'} ${money(balance)}`
  const settlementDescription = !myBalance || myBalance.netInPaise === 0 ? 'You’re both perfectly balanced this month.' : `Based on ${flatName}'s shared expenses.`
  const categories = ['Groceries', 'Utilities', 'Home care', 'Eating out']
  const colors = ['#16b67a', '#f5b940', '#6f8cff', '#ff8b67']
  const categoryData = categories.map((name, index) => {
    const categoryTotal = expenses.filter((expense) => expense.shared && expense.category === name).reduce((sum, expense) => sum + expense.amount, 0)
    return { name, value: total ? Math.round((categoryTotal / total) * 100) : 0, color: colors[index] }
  }).filter((item) => item.value > 0)
  const monthlyData = [{ month: 'Current', total }]
  const expenseCount = expenses.filter((expense) => expense.shared).length
  return <><section className="page-heading"><div><p className="eyebrow">{formatIndiaDate(now)} · {formatIndiaTime(now)}</p><h1>{getGreeting(now)}, {userName} <span>✦</span></h1><p className="muted">{flatName} · How your flat is doing this month.</p></div><div className="dashboard-actions"><button className="secondary" onClick={onInvite}><Users size={16} /> Add person</button><button className="primary desktop-add" onClick={onAdd}><Plus size={18} /> Add expense</button></div></section>
    <section className="balance-card"><div className="balance-top"><div><span className="label">CURRENT MONTH · SHARED EXPENSES</span><h2>{money(total)}</h2><p className="muted">Total across {expenseCount} transaction{expenseCount === 1 ? '' : 's'}</p></div><div className="balance-icon"><WalletCards size={22} /></div></div><div className="settlement"><div className="settlement-icon">{!myBalance || myBalance.netInPaise === 0 ? <Check size={17} /> : <ArrowUpRight size={17} />}</div><div><strong>{settlementMessage}</strong><p>{settlementDescription}</p></div><ChevronRight size={18} /></div></section>
    <section className="stats-grid">{balances.slice(0, 2).map((member, index) => <Stat key={member.uid} label={`${member.displayName} paid`} value={member.paidInPaise / 100} color={index === 0 ? 'green' : 'blue'} initials={initials(member.displayName)} />)}<Stat label="Your share" value={myBalance ? myBalance.shareInPaise / 100 : (balances.length ? total / balances.length : 0)} color="yellow" icon={<Users size={16} />} /></section>
    <div className="section-heading"><div><h3>Recent activity</h3><p className="muted">Latest shared purchases</p></div><button className="text-button" onClick={onHistory}>View all <ChevronRight size={15} /></button></div>
    <div className="transactions">{expenses.slice(0, 4).map((expense) => <Transaction key={expense.id} expense={expense} />)}</div>
    <div className="chart-grid"><section className="panel"><div className="panel-heading"><div><h3>Spending overview</h3><p className="muted">Shared expenses this month</p></div><button className="select-button">Current month <ChevronRight size={14} /></button></div><div className="chart"><ResponsiveContainer width="100%" height={210}><BarChart data={monthlyData} margin={{ left: -18, right: 4, top: 10 }}><XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#9aa2ad', fontSize: 11 }} /><YAxis hide /><Tooltip cursor={{ fill: 'rgba(22,182,122,.06)' }} formatter={(value) => [money(Number(value)), 'Spent']} /><Bar dataKey="total" fill="#16b67a" radius={[5, 5, 0, 0]} barSize={24} /></BarChart></ResponsiveContainer></div></section><section className="panel category-panel"><div className="panel-heading"><div><h3>By category</h3><p className="muted">This month</p></div><button className="more-button">•••</button></div><div className="pie-wrap"><ResponsiveContainer width={150} height={150}><PieChart><Pie data={categoryData} dataKey="value" innerRadius={49} outerRadius={67} paddingAngle={4} stroke="none">{categoryData.map((item) => <Cell key={item.name} fill={item.color} />)}</Pie></PieChart></ResponsiveContainer><div className="pie-label"><strong>{money(total)}</strong><span>total</span></div></div><div className="legend">{categoryData.map((item) => <div key={item.name}><i style={{ background: item.color }} />{item.name}<strong>{item.value}%</strong></div>)}</div></section></div>
  </>
}

function Stat({ label, value, color, initials, icon }: { label: string; value: number; color: string; initials?: string; icon?: React.ReactNode }) { return <div className="stat-card"><div className={`stat-icon ${color}`}>{initials || icon}</div><span className="muted">{label}</span><strong>{money(value)}</strong><small>of total</small></div> }
function Transaction({ expense }: { expense: Expense }) { return <div className="transaction"><div className={`expense-icon ${expense.color}`}>{expense.icon}</div><div className="transaction-main"><strong>{expense.item}</strong><span>{expense.category} · {expense.date}</span></div><div className="transaction-amount"><strong>{money(expense.amount)}</strong><span className="paid">{expense.paidBy} paid</span></div><ChevronRight className="transaction-arrow" size={17} /></div> }

function History({ expenses, onAdd, onDelete }: { expenses: Expense[]; onAdd: () => void; onDelete: (id: string) => void }) { const [search, setSearch] = useState(''); const filtered = expenses.filter((expense) => expense.item.toLowerCase().includes(search.toLowerCase())); return <><section className="page-heading"><div><p className="eyebrow">YOUR FLAT</p><h1>Expense history</h1><p className="muted">Every purchase, all in one place.</p></div><button className="primary desktop-add" onClick={onAdd}><Plus size={18} /> Add expense</button></section><div className="history-toolbar"><div className="search"><Search size={17} /><input placeholder="Search expenses" value={search} onChange={(event) => setSearch(event.target.value)} /></div><button className="filter-button"><CalendarDays size={16} /> This month</button><button className="filter-button">All people</button></div><div className="history-list">{filtered.map((expense) => <div className="history-row" key={expense.id}><Transaction expense={expense} /><button className="delete-button" onClick={() => onDelete(expense.id)} aria-label={`Delete ${expense.item}`}><Trash2 size={16} /></button></div>)}</div></> }
function Reports({ total, balances }: { total: number; balances: MemberBalance[] }) { const myBalance = balances.find((entry) => entry.netInPaise !== 0); const balance = Math.abs(myBalance?.netInPaise ?? 0) / 100; const status = !myBalance ? 'All settled up' : myBalance.netInPaise > 0 ? `${balances.find((entry) => entry.uid !== myBalance.uid)?.displayName ?? 'Your flatmate'} owes you ${money(balance)}` : `You owe ${balances.find((entry) => entry.uid !== myBalance.uid)?.displayName ?? 'your flatmate'} ${money(balance)}`; return <><section className="page-heading"><div><p className="eyebrow">MONTHLY REPORT</p><h1>Current month at a glance</h1><p className="muted">A clear view of your shared spending.</p></div><button className="secondary"><Download size={17} /> Export report</button></section><div className="report-highlight"><div><span className="label">TOTAL SHARED SPEND</span><h2>{money(total)}</h2><p className="muted">Across your shared transactions</p></div>{balances.slice(0, 2).map((member, index) => <div className="report-stat" key={member.uid}><span>{member.displayName}</span><strong>{money(member.paidInPaise / 100)}</strong><div className={index ? 'progress blue-progress' : 'progress'}><i style={{ width: `${total ? (member.paidInPaise / 100 / total) * 100 : 0}%` }} /></div></div>)}</div><div className="report-panels"><section className="panel"><div className="panel-heading"><div><h3>Monthly comparison</h3><p className="muted">Contribution by person</p></div><Tag size={18} /></div><div className="comparison">{balances.slice(0, 2).map((member, index) => <div key={member.uid}><span>{member.displayName}</span><strong>{money(member.paidInPaise / 100)}</strong><i className={index ? 'blue-bar' : ''} style={{ height: `${total ? (member.paidInPaise / 100 / total) * 100 : 0}%` }} /></div>)}</div></section><section className="panel settle-panel"><span className="label">SETTLEMENT STATUS</span><div className="settle-big"><div className="settle-icon">{!myBalance ? <Check size={20} /> : <ArrowUpRight size={20} />}</div><div><h3>{status}</h3><p className="muted">{!myBalance ? 'No pending payments this month.' : 'Pending based on this month’s shared spend.'}</p></div></div></section></div></> }
function Profile({ name, email, dark, setDark }: { name: string; email: string; dark: boolean; setDark: (value: boolean) => void }) { return <><section className="page-heading"><div><p className="eyebrow">YOUR ACCOUNT</p><h1>Profile & settings</h1><p className="muted">Manage your flat and preferences.</p></div></section><section className="profile-card"><div className="profile-avatar">{initials(name)}</div><div><h2>{name}</h2><p className="muted">{email}</p><span className="role-pill">Flat member</span></div><button className="secondary">Edit profile</button></section><section className="settings-list"><div className="settings-row"><div className="settings-icon"><Moon size={18} /></div><div><strong>Dark mode</strong><p className="muted">Use a darker appearance at night</p></div><button className={dark ? 'toggle on' : 'toggle'} onClick={() => setDark(!dark)}><i /></button></div><div className="settings-row"><div className="settings-icon"><Users size={18} /></div><div><strong>Our flat</strong><p className="muted">Shared with your flat members</p></div><ChevronRight size={18} /></div><div className="settings-row"><div className="settings-icon"><Bell size={18} /></div><div><strong>Notifications</strong><p className="muted">Expense and settlement updates</p></div><ChevronRight size={18} /></div></section></> }

function AddExpense({ currentUser, now, onClose, onSave }: { currentUser: string; now: Date; onClose: () => void; onSave: (expense: Expense) => void }) { const [item, setItem] = useState(''); const [amount, setAmount] = useState(''); const [paidBy, setPaidBy] = useState<Person>(currentUser); const [category, setCategory] = useState<Category>('Groceries'); const [purchaseDate, setPurchaseDate] = useState(() => formatIndiaDateTimeInput(now)); const save = () => { const numericAmount = Number(amount); if (!item.trim() || !numericAmount || numericAmount < 1 || !purchaseDate) return; const purchaseTimestamp = indiaDateTimeToUtc(purchaseDate); onSave({ id: crypto.randomUUID(), item: item.trim(), amount: numericAmount, amountInPaise: Math.round(numericAmount * 100), paidBy, category, date: formatIndiaDate(new Date(purchaseTimestamp)), purchaseDate: purchaseTimestamp, icon: '🛒', color: 'mint', shared: true, expenseType: 'shared' }) }; return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><form className="expense-modal" onSubmit={(event) => { event.preventDefault(); save() }}><div className="modal-heading"><div><p className="eyebrow">NEW TRANSACTION</p><h2>Add an expense</h2></div><button type="button" className="close-button" onClick={onClose}><X size={20} /></button></div><label>What did you buy?<input autoFocus value={item} onChange={(event) => setItem(event.target.value)} placeholder="e.g. Rice, milk, electricity" /></label><label>Amount<input value={amount} onChange={(event) => setAmount(event.target.value.replace(/[^\d]/g, ''))} placeholder="₹ 0" inputMode="numeric" /></label><label>Purchase date and time<input type="datetime-local" value={purchaseDate} onChange={(event) => setPurchaseDate(event.target.value)} /></label><div className="form-grid"><label>Category<select value={category} onChange={(event) => setCategory(event.target.value as Category)}><option>Groceries</option><option>Utilities</option><option>Home care</option><option>Eating out</option></select></label><label>Paid by<select value={paidBy} onChange={(event) => setPaidBy(event.target.value)}><option value={currentUser}>{currentUser}</option></select></label></div><label className="upload-field"><span>Receipt image <small>(optional)</small></span><div className="upload-box">📷 <span>Take a photo or choose from gallery</span></div></label><button className="primary submit-button" type="submit"><Plus size={18} /> Save expense</button></form></div> }

export default App
