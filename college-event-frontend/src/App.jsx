import { useEffect, useMemo, useState } from 'react'
import { Link, NavLink, Route, Routes, useNavigate } from 'react-router-dom'
import {
  ArrowRight, CalendarDays, Check, ChevronDown, Clock3, Compass, GraduationCap,
  LayoutDashboard, LogIn, LogOut, Menu, Plus, Search, Sparkles, Ticket, Trash2,
  Users, X, MapPin, PartyPopper, ShieldCheck
} from 'lucide-react'

const initialEvents = [
  { id: 1, title: 'Ignite 2026: Annual Fest', category: 'Fest', date: '2026-10-24', time: '10:00 AM', venue: 'Main Campus Grounds', description: 'A full day of music, dance, games, food stalls and unforgettable campus memories.', image: 'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?auto=format&fit=crop&w=1200&q=85', registrations: 248, tag: 'Featured' },
  { id: 2, title: 'CodeSprint Hackathon', category: 'Technology', date: '2026-10-28', time: '9:00 AM', venue: 'Innovation Lab', description: 'Build useful ideas with your team in a fast-paced coding challenge.', image: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=1200&q=85', registrations: 96, tag: 'Popular' },
  { id: 3, title: 'Battle of the Bands', category: 'Music', date: '2026-11-02', time: '5:30 PM', venue: 'Open Air Theatre', description: 'Cheer for campus bands and discover the next big sound.', image: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=1200&q=85', registrations: 134, tag: 'Music' },
  { id: 4, title: 'Design & Create Workshop', category: 'Workshop', date: '2026-11-06', time: '11:00 AM', venue: 'Seminar Hall B', description: 'Learn creative problem-solving and turn your ideas into prototypes.', image: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=85', registrations: 52, tag: 'Learn' },
  { id: 5, title: 'Inter-College Sports Meet', category: 'Sports', date: '2026-11-12', time: '8:00 AM', venue: 'College Sports Complex', description: 'Bring your team spirit to a day of friendly competition.', image: 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&w=1200&q=85', registrations: 180, tag: 'Sports' },
  { id: 6, title: 'Photography Walk', category: 'Arts', date: '2026-11-18', time: '7:30 AM', venue: 'North Gate', description: 'Explore campus through your lens and share your best shots.', image: 'https://images.unsplash.com/photo-1452587925148-ce544e77e70d?auto=format&fit=crop&w=1200&q=85', registrations: 41, tag: 'Creative' },
]
const CATEGORIES = ['All events', 'Fest', 'Technology', 'Music', 'Workshop', 'Sports', 'Arts']
const moneyDate = value => new Date(`${value}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })

function useEvents() {
  const [events, setEvents] = useState(() => {
    try { return JSON.parse(localStorage.getItem('campuspulse-events')) || initialEvents }
    catch { return initialEvents }
  })

  useEffect(() => {
    fetch('/api/events')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setEvents(data)
          localStorage.setItem('campuspulse-events', JSON.stringify(data))
        }
      })
      .catch(err => console.warn('Backend API offline, using local data:', err))
  }, [])

  useEffect(() => localStorage.setItem('campuspulse-events', JSON.stringify(events)), [events])
  return [events, setEvents]
}
function useSession() {
  const [session, setSession] = useState(() => {
    try { return JSON.parse(localStorage.getItem('campuspulse-session')) }
    catch { return null }
  })
  useEffect(() => {
    if (session) localStorage.setItem('campuspulse-session', JSON.stringify(session))
    else localStorage.removeItem('campuspulse-session')
  }, [session])
  return [session, setSession]
}

function Header({ session, logout }) {
  const [menuOpen, setMenuOpen] = useState(false)
  return <header className="header">
    <div className="nav-wrap">
      <Link to="/" className="brand" onClick={() => setMenuOpen(false)}><span className="brand-mark"><Sparkles size={20}/></span><span>Campus<span className="brand-light">Pulse</span></span></Link>
      <button className="mobile-menu icon-button" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle navigation">{menuOpen ? <X/> : <Menu/>}</button>
      <nav className={menuOpen ? 'nav-links open' : 'nav-links'}>
        <NavLink to="/" end onClick={() => setMenuOpen(false)}>Discover</NavLink>
        {session?.role === 'student' && <NavLink to="/student" onClick={() => setMenuOpen(false)}>My events</NavLink>}
        {session?.role === 'admin' && <NavLink to="/admin" onClick={() => setMenuOpen(false)}>Admin panel</NavLink>}
        {!session ? <Link className="btn btn-primary nav-login" to="/login" onClick={() => setMenuOpen(false)}>Sign in <ArrowRight size={16}/></Link> :
          <button className="user-pill" onClick={logout}><span className="avatar">{session.name?.charAt(0)?.toUpperCase() || 'U'}</span><span>{session.name}</span><LogOut size={15}/></button>}
      </nav>
    </div>
  </header>
}

function EventCard({ event, onRegister, registered, session }) {
  return <article className="event-card">
    <div className="event-image-wrap">
      <img src={event.image} alt={event.title} className="event-image" onError={e => { e.currentTarget.src = 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&w=1200&q=80' }}/>
      <span className="event-tag">{event.tag || event.category}</span>
      <button className={`save-dot ${registered ? 'saved' : ''}`} title={registered ? 'Registered' : 'Register for event'} onClick={() => onRegister(event)}>{registered ? <Check size={18}/> : <ArrowRight size={18}/>}</button>
    </div>
    <div className="event-content">
      <div className="event-category">{event.category}</div>
      <h3>{event.title}</h3>
      <p className="event-description">{event.description}</p>
      <div className="event-meta"><span><CalendarDays size={15}/>{moneyDate(event.date)}</span><span><Clock3 size={15}/>{event.time}</span></div>
      <div className="event-meta"><span><MapPin size={15}/>{event.venue}</span></div>
      <div className="event-card-footer"><span className="attendees"><Users size={15}/>{event.registrations || 0} interested</span><button className={registered ? 'btn btn-success btn-small' : 'btn btn-outline btn-small'} onClick={() => onRegister(event)}>{registered ? 'Registered' : 'Join event'}</button></div>
    </div>
  </article>
}

function Home({ events, session, registrations, onRegister }) {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All events')
  const [sort, setSort] = useState('soon')
  const filtered = useMemo(() => events.filter(e => (category === 'All events' || e.category === category) &&
    `${e.title} ${e.category} ${e.venue}`.toLowerCase().includes(search.toLowerCase()))
    .sort((a,b) => sort === 'soon' ? a.date.localeCompare(b.date) : b.registrations - a.registrations), [events, category, search, sort])
  const featured = events[0]
  return <main>
    <section className="hero">
      <div className="hero-glow glow-one"></div><div className="hero-glow glow-two"></div>
      <div className="hero-inner">
        <div className="hero-copy">
          <div className="eyebrow"><span className="live-dot"></span> YOUR CAMPUS. YOUR MOMENT.</div>
          <h1>Make campus<br/>life <span className="gradient-text">unforgettable.</span></h1>
          <p className="hero-subtitle">Discover events, meet your people, and be part of something bigger. Your next college memory starts here.</p>
          <div className="hero-actions"><a href="#events" className="btn btn-white">Explore events <ArrowRight size={17}/></a><Link to={session ? (session.role === 'admin' ? '/admin' : '/student') : '/login'} className="btn btn-ghost"> {session ? 'Open dashboard' : 'Get started'} </Link></div>
          <div className="hero-proof"><div className="avatar-stack"><span>🎓</span><span>🎨</span><span>🎸</span><span>💻</span></div><span><strong>{events.reduce((sum, e) => sum + Number(e.registrations || 0), 0).toLocaleString()}+</strong> student interests</span><span className="proof-divider"></span><span><strong>{events.length}</strong> upcoming events</span></div>
        </div>
        <div className="hero-art">
          <div className="art-orbit orbit-a"></div><div className="art-orbit orbit-b"></div>
          <div className="hero-emoji">🎉</div>
          <div className="floating-card float-top"><span className="float-icon purple"><CalendarDays size={18}/></span><div><strong>Something exciting</strong><small>is happening soon</small></div><span className="float-check"><Check size={14}/></span></div>
          <div className="floating-card float-bottom"><span className="float-icon orange"><Users size={18}/></span><div><strong>Find your people</strong><small>Make memories together</small></div></div>
          <div className="art-spark spark-one">✦</div><div className="art-spark spark-two">✧</div><div className="art-spark spark-three">✦</div>
        </div>
      </div>
      <div className="hero-bottom"><span><ShieldCheck size={16}/> Made for student communities</span><span><Compass size={16}/> Explore. Join. Experience.</span><span><Ticket size={16}/> One place for every event</span></div>
    </section>
    <section className="stats-strip"><div className="stat"><span className="stat-icon"><CalendarDays/></span><div><strong>{events.length.toString().padStart(2,'0')}</strong><small>Events listed</small></div></div><div className="stat"><span className="stat-icon peach"><Users/></span><div><strong>{events.reduce((s,e)=>s+Number(e.registrations||0),0).toLocaleString()}+</strong><small>Student interests</small></div></div><div className="stat"><span className="stat-icon mint"><PartyPopper/></span><div><strong>{new Set(events.map(e=>e.category)).size}</strong><small>Event categories</small></div></div><div className="stat"><span className="stat-icon blue"><GraduationCap/></span><div><strong>1 campus</strong><small>Endless experiences</small></div></div></section>
    <section className="events-section page-width" id="events">
      <div className="section-heading"><div><div className="section-kicker">FIND YOUR NEXT THING</div><h2>Events worth showing up for<span className="period">.</span></h2><p>From big-stage moments to hands-on workshops, there is a place for you.</p></div><span className="upcoming-count"><span className="live-dot"></span> {filtered.length} events found</span></div>
      <div className="event-toolbar"><div className="search-box"><Search size={18}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search events, venues..."/></div><div className="category-list">{CATEGORIES.map(c=><button key={c} className={category===c?'category-chip active':'category-chip'} onClick={()=>setCategory(c)}>{c}</button>)}</div><label className="sort-select"><span>Sort:</span><select value={sort} onChange={e=>setSort(e.target.value)}><option value="soon">Soonest</option><option value="popular">Most popular</option></select><ChevronDown size={14}/></label></div>
      {filtered.length ? <div className="events-grid">{filtered.map(event=><EventCard key={event.id} event={event} session={session} registered={registrations.includes(event.id)} onRegister={onRegister}/>)}</div> : <div className="empty-state"><Search size={32}/><h3>No events found</h3><p>Try a different search or category.</p><button className="btn btn-outline" onClick={()=>{setSearch('');setCategory('All events')}}>Clear filters</button></div>}
    </section>
    <section className="cta-section page-width"><div className="cta-icon"><Sparkles size={26}/></div><div><h2>Got an event idea?</h2><p>Bring your campus community together. Talk to your college event admin to get it listed.</p></div><Link className="btn btn-primary" to={session?.role==='admin'?'/admin':'/login'}>{session?.role==='admin'?'Create an event':'Get involved'} <ArrowRight size={16}/></Link></section>
  </main>
}

function Login({ setSession }) {
  const navigate = useNavigate()
  const [role, setRole] = useState('student')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  async function submit(e) {
    e.preventDefault()
    if (!name.trim() || !email.trim() || !password.trim()) { setError('Please fill in every field.'); return }
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password: password.trim(), role })
      })
      if (res.ok) {
        const data = await res.json()
        setSession({ name: data.name || name.trim(), email: data.email || email.trim(), role: data.role })
        navigate(data.role === 'admin' ? '/admin' : '/student')
        return
      }
    } catch (err) {
      console.warn('Backend login unavailable, continuing in demo mode:', err)
    }
    setSession({ name: name.trim(), email: email.trim(), role })
    navigate(role === 'admin' ? '/admin' : '/student')
  }
  return <main className="auth-page"><div className="auth-decoration auth-deco-one"></div><div className="auth-decoration auth-deco-two"></div><div className="auth-card">
    <Link to="/" className="brand auth-brand"><span className="brand-mark"><Sparkles size={20}/></span><span>Campus<span className="brand-light">Pulse</span></span></Link>
    <div className="auth-kicker">WELCOME TO YOUR CAMPUS</div><h1>Let's make it<br/><span className="gradient-text">happen.</span></h1><p className="auth-intro">Sign in to discover events and be part of the action.</p>
    <div className="role-tabs"><button className={role==='student'?'role-tab active':''} onClick={()=>setRole('student')}><GraduationCap size={17}/> Student</button><button className={role==='admin'?'role-tab active':''} onClick={()=>setRole('admin')}><LayoutDashboard size={17}/> Admin</button></div>
    <form onSubmit={submit} className="auth-form"><label>Full name<input value={name} onChange={e=>setName(e.target.value)} placeholder="Enter your name" autoComplete="name"/></label><label>Email address<input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@college.edu" autoComplete="email"/></label><label>Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Enter any demo password" autoComplete="current-password"/></label>
      {error && <div className="form-error">{error}</div>}<button className="btn btn-primary auth-submit" type="submit">Continue as {role==='admin'?'Admin':'Student'} <ArrowRight size={17}/></button></form>
    <p className="demo-note"><ShieldCheck size={15}/> Demo login: any name, email and password work. This is not secure authentication.</p><Link to="/" className="back-link">← Back to discover events</Link>
  </div><div className="auth-side"><div className="auth-side-content"><span className="side-badge"><Sparkles size={15}/> YOUR CAMPUS, CONNECTED</span><h2>Small moments.<br/>Big memories.</h2><p>One place to discover the events, people and experiences that make college special.</p><div className="side-mini-card"><div className="mini-date"><b>24</b><span>OCT</span></div><div><strong>Ignite 2026: Annual Fest</strong><small><MapPin size={13}/> Main Campus Grounds</small></div><span className="mini-star">✦</span></div></div></div></main>
}

function StudentDashboard({ session, events, registrations, onRegister }) {
  const mine = events.filter(e=>registrations.includes(e.id))
  return <main className="dashboard page-width"><div className="dashboard-top"><div><div className="section-kicker">STUDENT SPACE</div><h1>Hey, {session?.name?.split(' ')[0] || 'there'} <span>✦</span></h1><p>Your next campus memory is just around the corner.</p></div><Link to="/#events" className="btn btn-primary">Discover events <ArrowRight size={16}/></Link></div>
    <div className="welcome-banner"><div><span className="welcome-label">YOUR CAMPUS LIFE, AMPLIFIED</span><h2>Make room for something amazing.</h2><p>Explore what is happening around campus and save your spot.</p><Link className="btn btn-white" to="/#events">Browse all events <ArrowRight size={16}/></Link></div><div className="welcome-emoji">🎟️</div></div>
    <div className="dashboard-metrics"><div className="metric-card"><span className="metric-icon"><Ticket/></span><div><strong>{mine.length}</strong><small>Events joined</small></div></div><div className="metric-card"><span className="metric-icon peach"><CalendarDays/></span><div><strong>{events.length}</strong><small>Events to explore</small></div></div><div className="metric-card"><span className="metric-icon mint"><Sparkles/></span><div><strong>Make it count</strong><small>Your campus journey</small></div></div></div>
    <div className="dashboard-section-title"><div><h2>My registered events</h2><p>Keep track of the events you plan to attend.</p></div><Link to="/#events">Explore more <ArrowRight size={15}/></Link></div>
    {mine.length ? <div className="events-grid">{mine.map(event=><EventCard key={event.id} event={event} registered onRegister={onRegister} session={session}/>)}</div> : <div className="empty-state"><Ticket size={34}/><h3>Your event list is waiting</h3><p>Join an event to see it listed here.</p><Link to="/#events" className="btn btn-primary">Explore events</Link></div>}
  </main>
}

function AdminDashboard({ events, setEvents }) {
  const blank = { title:'', category:'Technology', date:'', time:'10:00 AM', venue:'', description:'', image:'', tag:'New' }
  const [form, setForm] = useState(blank)
  const [showForm, setShowForm] = useState(false)
  const [message, setMessage] = useState('')
  function update(key, value) { setForm(old=>({...old,[key]:value})) }
  async function addEvent(e) {
    e.preventDefault()
    if (!form.title.trim() || !form.date || !form.venue.trim() || !form.description.trim()) { setMessage('Please fill in title, date, venue and description.'); return }
    const event = { ...form, id: Date.now(), image: form.image || 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&w=1200&q=80', registrations: 0 }
    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(event)
      })
      if (res.ok) {
        const created = await res.json()
        if (created.id) event.id = created.id
      }
    } catch (err) {
      console.warn('Backend sync failed:', err)
    }
    setEvents(old=>[event,...old])
    setForm(blank); setShowForm(false); setMessage('Event created successfully!')
    setTimeout(()=>setMessage(''), 3500)
  }
  async function removeEvent(id) {
    if (window.confirm('Delete this event?')) {
      try {
        await fetch(`/api/events/${id}`, { method: 'DELETE' })
      } catch (err) {
        console.warn('Backend sync failed:', err)
      }
      setEvents(old=>old.filter(e=>e.id!==id))
    }
  }
  const totalRegistrations = events.reduce((s,e)=>s+Number(e.registrations||0),0)
  return <main className="dashboard page-width"><div className="dashboard-top"><div><div className="section-kicker">EVENT CONTROL CENTER</div><h1>Admin dashboard <span>✦</span></h1><p>Create events and keep your campus community in the loop.</p></div><button className="btn btn-primary" onClick={()=>setShowForm(!showForm)}>{showForm?<X size={17}/>:<Plus size={18}/>} {showForm?'Close form':'Create event'}</button></div>
    {message && <div className="success-banner"><Check size={17}/>{message}</div>}
    <div className="dashboard-metrics"><div className="metric-card"><span className="metric-icon"><CalendarDays/></span><div><strong>{events.length}</strong><small>Total events</small></div></div><div className="metric-card"><span className="metric-icon peach"><Users/></span><div><strong>{totalRegistrations.toLocaleString()}</strong><small>Student interests</small></div></div><div className="metric-card"><span className="metric-icon mint"><LayoutDashboard/></span><div><strong>{new Set(events.map(e=>e.category)).size}</strong><small>Categories</small></div></div></div>
    {showForm && <section className="admin-form-panel"><div className="panel-heading"><div><h2>Create a new event</h2><p>Fill out the details below to publish an event on the home page.</p></div><span className="form-heading-icon"><Plus/></span></div><form onSubmit={addEvent} className="event-form">
      <label>Event title *<input value={form.title} onChange={e=>update('title',e.target.value)} placeholder="e.g. Annual Tech Fest"/></label>
      <label>Category *<select value={form.category} onChange={e=>update('category',e.target.value)}>{CATEGORIES.filter(c=>c!=='All events').map(c=><option key={c}>{c}</option>)}</select></label>
      <label>Date *<input type="date" min={new Date().toISOString().slice(0,10)} value={form.date} onChange={e=>update('date',e.target.value)}/></label>
      <label>Time<input value={form.time} onChange={e=>update('time',e.target.value)} placeholder="10:00 AM"/></label>
      <label>Venue *<input value={form.venue} onChange={e=>update('venue',e.target.value)} placeholder="e.g. Main Auditorium"/></label>
      <label>Image URL (optional)<input type="url" value={form.image} onChange={e=>update('image',e.target.value)} placeholder="https://..."/></label>
      <label className="full-field">Description *<textarea rows="3" value={form.description} onChange={e=>update('description',e.target.value)} placeholder="Tell students what makes this event special..."/></label>
      <div className="full-field form-actions"><button className="btn btn-primary" type="submit"><Plus size={17}/> Publish event</button><button className="btn btn-outline" type="button" onClick={()=>{setShowForm(false);setForm(blank);setMessage('')}}>Cancel</button></div>
    </form></section>}
    <section className="admin-table-panel"><div className="panel-heading"><div><h2>Manage events</h2><p>Events are saved in this browser for the demo.</p></div><span className="table-count">{events.length} total</span></div>
      <div className="table-scroll"><table><thead><tr><th>Event</th><th>Category</th><th>Date</th><th>Interests</th><th>Action</th></tr></thead><tbody>{events.slice().sort((a,b)=>a.date.localeCompare(b.date)).map(e=><tr key={e.id}><td><div className="table-event"><img src={e.image} alt=""/><div><strong>{e.title}</strong><small>{e.venue}</small></div></div></td><td><span className="table-category">{e.category}</span></td><td>{moneyDate(e.date)}</td><td>{e.registrations||0}</td><td><button className="delete-button" onClick={()=>removeEvent(e.id)} aria-label={`Delete ${e.title}`}><Trash2 size={16}/></button></td></tr>)}</tbody></table></div>
    </section>
    <p className="admin-warning"><ShieldCheck size={16}/> Frontend demo only: event changes are stored in your browser. Connect an API and database before using this for a real college.</p>
  </main>
}

function Footer() {
  return <footer className="footer"><div className="footer-inner"><Link to="/" className="brand"><span className="brand-mark"><Sparkles size={18}/></span><span>Campus<span className="brand-light">Pulse</span></span></Link><span>Built for campus communities, powered by big ideas.</span><span>© 2026 CampusPulse</span></div></footer>
}

export default function App() {
  const [events, setEvents] = useEvents()
  const [session, setSession] = useSession()
  const [registrations, setRegistrations] = useState(() => {
    try { return JSON.parse(localStorage.getItem('campuspulse-registrations')) || [] }
    catch { return [] }
  })
  useEffect(()=>localStorage.setItem('campuspulse-registrations',JSON.stringify(registrations)),[registrations])
  function logout() { setSession(null) }
  function register(event) {
    if (!session) { window.location.href = '/login'; return }
    if (session.role === 'admin') { window.alert('Student accounts can register for events.'); return }
    if (registrations.includes(event.id)) {
      setRegistrations(old=>old.filter(id=>id!==event.id))
      setEvents(old=>old.map(e=>e.id===event.id?{...e,registrations:Math.max(0,(e.registrations||0)-1)}:e))
    } else {
      setRegistrations(old=>[...old,event.id])
      setEvents(old=>old.map(e=>e.id===event.id?{...e,registrations:(e.registrations||0)+1}:e))
    }
  }
  return <><Header session={session} logout={logout}/><Routes>
    <Route path="/" element={<Home events={events} session={session} registrations={registrations} onRegister={register}/>}/>
    <Route path="/login" element={<Login setSession={setSession}/>}/>
    <Route path="/student" element={session?.role==='student'?<StudentDashboard session={session} events={events} registrations={registrations} onRegister={register}/>:<Login setSession={setSession}/>}/>
    <Route path="/admin" element={session?.role==='admin'?<AdminDashboard events={events} setEvents={setEvents}/>:<Login setSession={setSession}/>}/>
    <Route path="*" element={<main className="empty-state page-width"><h2>Page not found</h2><Link className="btn btn-primary" to="/">Return home</Link></main>}/>
  </Routes><Footer/></>
}