import { supabase } from '../supabaseClient'

export default function Dashboard({ session }) {
  return (
    <div style={{ padding: '2rem' }}>
      <h1>Welcome to Go Grace</h1>
      <p>Logged in as: {session.user.email}</p>
      <button onClick={() => supabase.auth.signOut()}>Sign Out</button>
    </div>
  )
}