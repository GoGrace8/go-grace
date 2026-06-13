import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../supabaseClient'

export default function AdminNav({ session }) {
  const navigate = useNavigate()
  const location = useLocation()

  const links = [
    { path: '/admin', label: '👥 Members' },
    { path: '/teams', label: '🏠 Teams' },
    { path: '/birthday-calendar', label: '🎂 Birthdays' },
    { path: '/intake', label: '📋 Intake Form' },
  ]

  return (
    <div style={{
      background: '#1e3a8a', padding: '0 2rem',
      display: 'flex', alignItems: 'center',
      justifyContent: 'space-between', height: '56px',
      flexShrink: 0
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span style={{ color: 'white', fontWeight: '700', fontSize: '1.1rem', marginRight: '1rem' }}>
          Go Grace
        </span>
        {links.map(link => (
          <button
            key={link.path}
            onClick={() => navigate(link.path)}
            style={{
              padding: '0.4rem 0.9rem',
              background: location.pathname === link.path ? 'rgba(255,255,255,0.2)' : 'transparent',
              color: 'white',
              border: location.pathname === link.path ? '1px solid rgba(255,255,255,0.4)' : '1px solid transparent',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '0.85rem',
              fontWeight: location.pathname === link.path ? '600' : '400'
            }}
          >
            {link.label}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <span style={{ color: '#bfdbfe', fontSize: '0.8rem' }}>{session?.user?.email}</span>
        <button
          onClick={() => supabase.auth.signOut()}
          style={{
            padding: '0.35rem 0.9rem', background: 'rgba(255,255,255,0.1)',
            color: 'white', border: '1px solid rgba(255,255,255,0.3)',
            borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem'
          }}
        >
          Sign Out
        </button>
      </div>
    </div>
  )
}