import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import Login from './pages/Login'
import AdminPanel from './pages/AdminPanel'
import MemberPortal from './pages/MemberPortal'
import IntakeForm from './pages/IntakeForm'
import TeamPage from './pages/TeamPage'

function App() {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) fetchProfile(session.user.id)
      else setLoading(false)
    })
    supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) fetchProfile(session.user.id)
      else { setProfile(null); setLoading(false) }
    })
  }, [])

  const fetchProfile = async (userId) => {
    const { data } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', userId)
      .single()
    setProfile(data)
    setLoading(false)
  }

  if (loading) return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', fontSize: '1.2rem', color: '#6b7280'
    }}>
      Loading...
    </div>
  )

  const home = session
    ? (profile?.is_admin ? '/admin' : '/portal')
    : '/login'

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={!session ? <Login /> : <Navigate to={home} />} />
        <Route path="/admin" element={session && profile?.is_admin ? <AdminPanel session={session} /> : <Navigate to={home} />} />
        <Route path="/portal" element={session ? <MemberPortal session={session} /> : <Navigate to="/login" />} />
        <Route path="/intake" element={<IntakeForm />} />
        <Route path="*" element={<Navigate to={home} />} />
        <Route path="/teams" element={session ? <TeamPage session={session} /> : <Navigate to="/login" />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App