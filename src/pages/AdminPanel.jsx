import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

const calculateAge = (dob) => {
  if (!dob) return null
  const today = new Date()
  const birth = new Date(dob)
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  return age
}

const getGroupAssignment = (age) => {
  if (age <= 2) return 'Toddlers'
  if (age <= 6) return 'Go Kidz'
  if (age <= 12) return 'Youth'
  return 'Adult'
}

const formatDate = (date) => {
  if (!date) return 'Not provided'
  return new Date(date).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric'
  })
}

const emptyNewMember = {
  first_name: '', last_name: '', email: '', phone: '',
  date_of_birth: '', first_visit_date: new Date().toISOString().split('T')[0],
  member_type: 'visitor', is_admin: false,
  attends_go_greet: false, attends_training: false, attends_baptism: false
}

export default function AdminPanel({ session }) {
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('all')
  const [selectedMember, setSelectedMember] = useState(null)
  const [children, setChildren] = useState([])
  const [editChildren, setEditChildren] = useState([])
  const [notes, setNotes] = useState([])
  const [newNote, setNewNote] = useState('')
  const [savingNote, setSavingNote] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [editForm, setEditForm] = useState({})
  const [memberTeams, setMemberTeams] = useState([])
  const [showNewMember, setShowNewMember] = useState(false)
  const [newMember, setNewMember] = useState(emptyNewMember)
  const [newMemberChildren, setNewMemberChildren] = useState([])
  const [savingNew, setSavingNew] = useState(false)
  const [newMemberError, setNewMemberError] = useState(null)

  useEffect(() => { fetchMembers() }, [])

  const fetchMembers = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('last_name', { ascending: true })
    if (!error) setMembers(data)
    setLoading(false)
  }

  const fetchMemberDetails = async (member) => {
    setSelectedMember(member)
    setEditForm(member)
    setEditMode(false)
    setShowNewMember(false)

    const { data: childData } = await supabase
      .from('children').select('*').eq('profile_id', member.id)

    const { data: noteData } = await supabase
      .from('admin_notes')
      .select('*, profiles!admin_notes_created_by_fkey(first_name, last_name)')
      .eq('profile_id', member.id)
      .order('created_at', { ascending: false })

    const { data: teamData } = await supabase
      .from('team_members').select('team_id, teams(name)').eq('profile_id', member.id)

    setChildren(childData || [])
    setEditChildren(childData || [])
    setNotes(noteData || [])
    setMemberTeams(teamData || [])
  }
const sendWelcomeEmail = async (member) => {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    const response = await fetch(
      'https://yaeyehydnjoqqjfxrfsx.supabase.co/functions/v1/send-welcome-email',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ email: member.email })
      }
    )
    const result = await response.json()
    if (result.error) throw new Error(result.error)
    alert(`Welcome email sent to ${member.email}!`)
  } catch (err) {
    alert('Error sending email: ' + err.message)
  }
}

  const saveNote = async () => {
    if (!newNote.trim()) return
    setSavingNote(true)
    const { data, error } = await supabase
      .from('admin_notes')
      .insert([{ profile_id: selectedMember.id, note: newNote, created_by: session.user.id }])
      .select('*, profiles!admin_notes_created_by_fkey(first_name, last_name)')
    if (!error && data) {
      setNotes(prev => [data[0], ...prev])
      setNewNote('')
    } else {
      alert('Error saving note: ' + error?.message)
    }
    setSavingNote(false)
  }

  const saveEdit = async () => {
    const { error } = await supabase
      .from('profiles')
      .update({
        first_name: editForm.first_name, last_name: editForm.last_name,
        email: editForm.email, phone: editForm.phone,
        date_of_birth: editForm.date_of_birth || null,
        first_visit_date: editForm.first_visit_date || null,
        member_type: editForm.member_type, is_admin: editForm.is_admin,
        attends_go_greet: editForm.attends_go_greet,
        attends_training: editForm.attends_training,
        attends_baptism: editForm.attends_baptism,
      })
      .eq('id', editForm.id)

    if (error) { alert('Error saving: ' + error.message); return }

    for (const child of editChildren) {
      const age = calculateAge(child.date_of_birth)
      const group = age !== null ? getGroupAssignment(age) : child.group_assignment
      if (child.id && !child.id.startsWith('new-')) {
        await supabase.from('children').update({
          first_name: child.first_name, date_of_birth: child.date_of_birth || null,
          age, group_assignment: group
        }).eq('id', child.id)
      } else {
        await supabase.from('children').insert([{
          profile_id: selectedMember.id, first_name: child.first_name,
          date_of_birth: child.date_of_birth || null, age, group_assignment: group
        }])
      }
    }

    setSelectedMember(editForm)
    setEditMode(false)
    fetchMembers()
    fetchMemberDetails(editForm)
  }

  const saveNewMember = async () => {
    if (!newMember.first_name || !newMember.last_name || !newMember.email) {
      setNewMemberError('First name, last name and email are required.')
      return
    }
    setSavingNew(true)
    setNewMemberError(null)

    const { data: profileId, error: profileError } = await supabase
      .rpc('create_profile', {
        p_email: newMember.email,
        p_first_name: newMember.first_name,
        p_last_name: newMember.last_name,
        p_phone: newMember.phone,
        p_date_of_birth: newMember.date_of_birth || null,
        p_member_type: newMember.member_type,
        p_attends_go_greet: newMember.attends_go_greet,
        p_attends_training: newMember.attends_training,
        p_attends_baptism: newMember.attends_baptism
      })

    if (profileError) {
      setNewMemberError(profileError.message)
      setSavingNew(false)
      return
    }

    // Update extra fields not in the function
    await supabase.from('profiles').update({
      first_visit_date: newMember.first_visit_date || null,
      is_admin: newMember.is_admin
    }).eq('id', profileId)

    // Save children
    for (const child of newMemberChildren) {
      const age = calculateAge(child.date_of_birth)
      const group = age !== null ? getGroupAssignment(age) : 'Go Kidz'
      await supabase.from('children').insert([{
        profile_id: profileId, first_name: child.first_name,
        date_of_birth: child.date_of_birth || null, age, group_assignment: group
      }])
    }

    setSavingNew(false)
    setShowNewMember(false)
    setNewMember(emptyNewMember)
    setNewMemberChildren([])
    fetchMembers()
  }

  const addEditChild = () => {
    setEditChildren(prev => [...prev, { id: 'new-' + Date.now(), first_name: '', date_of_birth: '' }])
  }

  const removeEditChild = async (child) => {
    if (!child.id.startsWith('new-')) {
      await supabase.from('children').delete().eq('id', child.id)
    }
    setEditChildren(prev => prev.filter(c => c.id !== child.id))
  }

  const filtered = members.filter(m => {
    const matchesSearch =
      `${m.first_name} ${m.last_name}`.toLowerCase().includes(search.toLowerCase()) ||
      m.email?.toLowerCase().includes(search.toLowerCase())
    const matchesFilter = filterType === 'all' || m.member_type === filterType
    return matchesSearch && matchesFilter
  })

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'sans-serif' }}>

      {/* Sidebar */}
      <div style={{
        width: '320px', background: 'white', borderRight: '1px solid #e5e7eb',
        display: 'flex', flexDirection: 'column', flexShrink: 0
      }}>
        <div style={{ padding: '1.25rem', borderBottom: '1px solid #e5e7eb', background: '#1a56db' }}>
          <h2 style={{ color: 'white', margin: 0, fontSize: '1.2rem' }}>Go Grace Admin</h2>
          <p style={{ color: '#bfdbfe', margin: '0.25rem 0 0', fontSize: '0.8rem' }}>{session.user.email}</p>
        </div>

        <div style={{ padding: '1rem', borderBottom: '1px solid #e5e7eb' }}>
          <button
            onClick={() => { setShowNewMember(true); setSelectedMember(null) }}
            style={{
              width: '100%', padding: '0.6rem', background: '#1a56db',
              color: 'white', border: 'none', borderRadius: '8px',
              cursor: 'pointer', fontWeight: '600', marginBottom: '0.75rem',
              fontSize: '0.9rem'
            }}
          >
            + New Member
          </button>
          <input
            placeholder="Search members..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: '100%', padding: '0.6rem', border: '1px solid #d1d5db',
              borderRadius: '8px', fontSize: '0.9rem', boxSizing: 'border-box'
            }}
          />
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
            {['all', 'visitor', 'member', 'leader'].map(type => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                style={{
                  padding: '0.3rem 0.6rem', borderRadius: '999px', border: 'none',
                  background: filterType === type ? '#1a56db' : '#f3f4f6',
                  color: filterType === type ? 'white' : '#6b7280',
                  fontSize: '0.75rem', cursor: 'pointer', fontWeight: '500',
                  textTransform: 'capitalize'
                }}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        <div style={{ overflowY: 'auto', flex: 1 }}>
          {loading ? (
            <p style={{ textAlign: 'center', color: '#9ca3af', padding: '2rem' }}>Loading...</p>
          ) : filtered.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#9ca3af', padding: '2rem' }}>No members found</p>
          ) : filtered.map(member => (
            <div
              key={member.id}
              onClick={() => fetchMemberDetails(member)}
              style={{
                padding: '1rem', borderBottom: '1px solid #f3f4f6', cursor: 'pointer',
                background: selectedMember?.id === member.id ? '#eff6ff' : 'white',
                borderLeft: selectedMember?.id === member.id ? '3px solid #1a56db' : '3px solid transparent'
              }}
            >
              <div style={{ fontWeight: '600', color: '#111827' }}>
                {member.first_name} {member.last_name}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '0.2rem' }}>
                {member.email}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.2rem' }}>
                First visit: {formatDate(member.first_visit_date)}
              </div>
              <div style={{ marginTop: '0.4rem', display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                <span style={{
                  fontSize: '0.7rem', padding: '0.2rem 0.5rem', borderRadius: '999px',
                  background: member.member_type === 'leader' ? '#fef3c7' :
                    member.member_type === 'member' ? '#d1fae5' : '#e0e7ff',
                  color: member.member_type === 'leader' ? '#92400e' :
                    member.member_type === 'member' ? '#065f46' : '#3730a3'
                }}>
                  {member.member_type}
                </span>
                {member.is_admin && (
                  <span style={{
                    fontSize: '0.7rem', padding: '0.2rem 0.5rem', borderRadius: '999px',
                    background: '#fff7ed', color: '#92400e'
                  }}>
                    ⚙️ admin
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        <div style={{ padding: '1rem', borderTop: '1px solid #e5e7eb' }}>
          <button
            onClick={() => supabase.auth.signOut()}
            style={{
              width: '100%', padding: '0.6rem', background: '#f3f4f6',
              border: 'none', borderRadius: '8px', cursor: 'pointer',
              color: '#374151', fontWeight: '500'
            }}
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, overflowY: 'auto', background: '#f9fafb' }}>

        {/* New Member Form */}
        {showNewMember && (
          <div style={{ padding: '2rem', maxWidth: '800px' }}>
            <div style={{
              background: 'white', borderRadius: '12px', padding: '1.5rem',
              marginBottom: '1rem', boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <h2 style={{ margin: 0, color: '#111827' }}>New Member</h2>
              <button
                onClick={() => { setShowNewMember(false); setNewMember(emptyNewMember); setNewMemberChildren([]) }}
                style={{
                  padding: '0.6rem 1.2rem', background: '#f3f4f6',
                  border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '500'
                }}
              >
                Cancel
              </button>
            </div>

            {newMemberError && (
              <div style={{
                background: '#fee2e2', color: '#dc2626', padding: '1rem',
                borderRadius: '8px', marginBottom: '1rem'
              }}>
                {newMemberError}
              </div>
            )}

            <div style={{
              background: 'white', borderRadius: '12px', padding: '1.5rem',
              marginBottom: '1rem', boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
            }}>
              <h3 style={{ margin: '0 0 1rem', color: '#111827' }}>Personal Details</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                {[
                  { label: 'First Name *', key: 'first_name' },
                  { label: 'Last Name *', key: 'last_name' },
                  { label: 'Email *', key: 'email' },
                  { label: 'Phone', key: 'phone' },
                ].map(field => (
                  <div key={field.key}>
                    <label style={labelStyle}>{field.label}</label>
                    <input
                      value={newMember[field.key] || ''}
                      onChange={e => setNewMember(prev => ({ ...prev, [field.key]: e.target.value }))}
                      style={inputStyle}
                    />
                  </div>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
                <div>
                  <label style={labelStyle}>Date of Birth</label>
                  <input type="date" value={newMember.date_of_birth || ''}
                    onChange={e => setNewMember(prev => ({ ...prev, date_of_birth: e.target.value }))}
                    style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>First Visit Date</label>
                  <input type="date" value={newMember.first_visit_date || ''}
                    onChange={e => setNewMember(prev => ({ ...prev, first_visit_date: e.target.value }))}
                    style={inputStyle} />
                </div>
              </div>
              <div style={{ marginTop: '1rem' }}>
                <label style={labelStyle}>Member Type</label>
                <select value={newMember.member_type}
                  onChange={e => setNewMember(prev => ({ ...prev, member_type: e.target.value }))}
                  style={inputStyle}>
                  <option value="visitor">Visitor</option>
                  <option value="member">Member</option>
                  <option value="leader">Leader</option>
                </select>
              </div>
              <div style={{ marginTop: '1rem', display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                {[
                  { key: 'attends_go_greet', label: 'Go Greet' },
                  { key: 'attends_training', label: 'Training' },
                  { key: 'attends_baptism', label: 'Baptism' },
                ].map(item => (
                  <label key={item.key} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                    <input type="checkbox" checked={newMember[item.key] || false}
                      onChange={e => setNewMember(prev => ({ ...prev, [item.key]: e.target.checked }))} />
                    {item.label}
                  </label>
                ))}
              </div>
              <div style={{
                marginTop: '1rem', padding: '1rem', background: '#fff7ed',
                borderRadius: '8px', border: '1px solid #fed7aa'
              }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={newMember.is_admin || false}
                    onChange={e => setNewMember(prev => ({ ...prev, is_admin: e.target.checked }))}
                    style={{ width: '18px', height: '18px' }} />
                  <div>
                    <span style={{ fontWeight: '600', color: '#92400e' }}>System Admin Access</span>
                    <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: '#b45309' }}>
                      Grants access to the admin panel. Only assign to trusted team leaders.
                    </p>
                  </div>
                </label>
              </div>
            </div>

            {/* New Member Children */}
            <div style={{
              background: 'white', borderRadius: '12px', padding: '1.5rem',
              marginBottom: '1rem', boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ margin: 0, color: '#111827' }}>Children</h3>
                <button
                  onClick={() => setNewMemberChildren(prev => [...prev, { id: 'new-' + Date.now(), first_name: '', date_of_birth: '' }])}
                  style={{
                    padding: '0.4rem 0.8rem', background: '#1a56db', color: 'white',
                    border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '0.85rem'
                  }}
                >
                  + Add Child
                </button>
              </div>
              {newMemberChildren.length === 0 && (
                <p style={{ color: '#9ca3af', fontSize: '0.9rem' }}>No children added</p>
              )}
              {newMemberChildren.map((child, index) => {
                const age = calculateAge(child.date_of_birth)
                return (
                  <div key={child.id} style={{ background: '#f9fafb', borderRadius: '8px', padding: '1rem', marginBottom: '0.75rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '0.75rem', alignItems: 'end' }}>
                      <div>
                        <label style={labelStyle}>Name</label>
                        <input value={child.first_name}
                          onChange={e => setNewMemberChildren(prev => prev.map((c, i) =>
                            i === index ? { ...c, first_name: e.target.value } : c))}
                          style={inputStyle} />
                      </div>
                      <div>
                        <label style={labelStyle}>Date of Birth</label>
                        <input type="date" value={child.date_of_birth || ''}
                          onChange={e => setNewMemberChildren(prev => prev.map((c, i) =>
                            i === index ? { ...c, date_of_birth: e.target.value } : c))}
                          style={inputStyle} />
                      </div>
                      <button
                        onClick={() => setNewMemberChildren(prev => prev.filter((_, i) => i !== index))}
                        style={{ padding: '0.6rem', background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
                      >✕</button>
                    </div>
                    {age !== null && (
                      <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.8rem', background: '#e0e7ff', color: '#3730a3', padding: '0.2rem 0.6rem', borderRadius: '999px' }}>
                          Age: {age}
                        </span>
                        <span style={{ fontSize: '0.8rem', background: '#eff6ff', color: '#1a56db', padding: '0.2rem 0.6rem', borderRadius: '999px' }}>
                          Group: {getGroupAssignment(age)}
                        </span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            <button
              onClick={saveNewMember}
              disabled={savingNew}
              style={{
                width: '100%', padding: '1rem', background: '#1a56db',
                color: 'white', border: 'none', borderRadius: '8px',
                fontSize: '1rem', fontWeight: '600', cursor: savingNew ? 'not-allowed' : 'pointer',
                opacity: savingNew ? 0.7 : 1, marginBottom: '2rem'
              }}
            >
              {savingNew ? 'Saving...' : 'Create Member'}
            </button>
          </div>
        )}

        {/* Member Profile */}
        {!showNewMember && !selectedMember && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <div style={{ textAlign: 'center', color: '#9ca3af' }}>
              <div style={{ fontSize: '3rem' }}>👥</div>
              <p>Select a member to view their profile</p>
              <p style={{ fontSize: '0.9rem' }}>{members.length} total members</p>
            </div>
          </div>
        )}

        {!showNewMember && selectedMember && (
          <div style={{ padding: '2rem', maxWidth: '800px' }}>

            {/* Profile Header */}
            <div style={{
              background: 'white', borderRadius: '12px', padding: '1.5rem',
              marginBottom: '1rem', boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'
            }}>
              <div>
                <h2 style={{ margin: 0, color: '#111827' }}>
                  {selectedMember.first_name} {selectedMember.last_name}
                </h2>
                <p style={{ margin: '0.25rem 0 0', color: '#6b7280' }}>{selectedMember.email}</p>
                <p style={{ margin: '0.25rem 0 0', color: '#6b7280' }}>{selectedMember.phone}</p>
                <p style={{ margin: '0.25rem 0 0', color: '#6b7280' }}>Date of Birth: {formatDate(selectedMember.date_of_birth)}</p>
                <p style={{ margin: '0.25rem 0 0', color: '#6b7280' }}>First Visit Date: {formatDate(selectedMember.first_visit_date)}</p>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                  <span style={{
                    fontSize: '0.8rem', padding: '0.25rem 0.75rem', borderRadius: '999px',
                    background: selectedMember.member_type === 'leader' ? '#fef3c7' :
                      selectedMember.member_type === 'member' ? '#d1fae5' : '#e0e7ff',
                    color: selectedMember.member_type === 'leader' ? '#92400e' :
                      selectedMember.member_type === 'member' ? '#065f46' : '#3730a3'
                  }}>
                    {selectedMember.member_type}
                  </span>
                  {selectedMember.is_admin && (
                    <span style={{ fontSize: '0.8rem', padding: '0.25rem 0.75rem', borderRadius: '999px', background: '#fff7ed', color: '#92400e' }}>
                      ⚙️ System Admin
                    </span>
                  )}
                </div>
              </div>
             <button
  onClick={() => sendWelcomeEmail(selectedMember)}
  style={{
    padding: '0.6rem 1.2rem', background: '#059669',
    color: 'white', border: 'none', borderRadius: '8px',
    cursor: 'pointer', fontWeight: '500', marginRight: '0.5rem'
  }}
>
  ✉️ Send Welcome Email
</button>
              <button
                onClick={() => { setEditMode(!editMode); setEditChildren(children) }}
                style={{
                  padding: '0.6rem 1.2rem', background: editMode ? '#f3f4f6' : '#1a56db',
                  color: editMode ? '#374151' : 'white', border: 'none',
                  borderRadius: '8px', cursor: 'pointer', fontWeight: '500'
                }}
              >
                {editMode ? 'Cancel' : 'Edit Profile'}
              </button>
            </div>

            {/* Edit Form */}
            {editMode && (
              <div style={{
                background: 'white', borderRadius: '12px', padding: '1.5rem',
                marginBottom: '1rem', boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
              }}>
                <h3 style={{ margin: '0 0 1rem', color: '#111827' }}>Edit Profile</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  {[
                    { label: 'First Name', key: 'first_name' },
                    { label: 'Last Name', key: 'last_name' },
                    { label: 'Email', key: 'email' },
                    { label: 'Phone', key: 'phone' },
                  ].map(field => (
                    <div key={field.key}>
                      <label style={labelStyle}>{field.label}</label>
                      <input
                        value={editForm[field.key] || ''}
                        onChange={e => setEditForm(prev => ({ ...prev, [field.key]: e.target.value }))}
                        style={inputStyle}
                      />
                    </div>
                  ))}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
                  <div>
                    <label style={labelStyle}>Date of Birth</label>
                    <input type="date" value={editForm.date_of_birth || ''}
                      onChange={e => setEditForm(prev => ({ ...prev, date_of_birth: e.target.value }))}
                      style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>First Visit Date</label>
                    <input type="date" value={editForm.first_visit_date || ''}
                      onChange={e => setEditForm(prev => ({ ...prev, first_visit_date: e.target.value }))}
                      style={inputStyle} />
                  </div>
                </div>
                <div style={{ marginTop: '1rem' }}>
                  <label style={labelStyle}>Member Type</label>
                  <select value={editForm.member_type}
                    onChange={e => setEditForm(prev => ({ ...prev, member_type: e.target.value }))}
                    style={inputStyle}>
                    <option value="visitor">Visitor</option>
                    <option value="member">Member</option>
                    <option value="leader">Leader</option>
                  </select>
                </div>
                <div style={{
                  marginTop: '1rem', padding: '1rem', background: '#fff7ed',
                  borderRadius: '8px', border: '1px solid #fed7aa'
                }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                    <input type="checkbox" checked={editForm.is_admin || false}
                      onChange={e => setEditForm(prev => ({ ...prev, is_admin: e.target.checked }))}
                      style={{ width: '18px', height: '18px' }} />
                    <div>
                      <span style={{ fontWeight: '600', color: '#92400e' }}>System Admin Access</span>
                      <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: '#b45309' }}>
                        Grants access to the admin panel. Only assign to trusted team leaders.
                      </p>
                    </div>
                  </label>
                </div>
                <div style={{ marginTop: '1rem', display: 'flex', gap: '1.5rem' }}>
                  {[
                    { key: 'attends_go_greet', label: 'Go Greet' },
                    { key: 'attends_training', label: 'Training' },
                    { key: 'attends_baptism', label: 'Baptism' },
                  ].map(item => (
                    <label key={item.key} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                      <input type="checkbox" checked={editForm[item.key] || false}
                        onChange={e => setEditForm(prev => ({ ...prev, [item.key]: e.target.checked }))} />
                      {item.label}
                    </label>
                  ))}
                </div>

                {/* Edit Children */}
                <div style={{ marginTop: '1.5rem', borderTop: '1px solid #e5e7eb', paddingTop: '1.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h4 style={{ margin: 0, color: '#111827' }}>Children</h4>
                    <button onClick={addEditChild} style={{
                      padding: '0.4rem 0.8rem', background: '#1a56db', color: 'white',
                      border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '600'
                    }}>+ Add Child</button>
                  </div>
                  {editChildren.map((child, index) => {
                    const age = calculateAge(child.date_of_birth)
                    return (
                      <div key={child.id} style={{ background: '#f9fafb', borderRadius: '8px', padding: '1rem', marginBottom: '0.75rem' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '0.75rem', alignItems: 'end' }}>
                          <div>
                            <label style={labelStyle}>Name</label>
                            <input value={child.first_name}
                              onChange={e => setEditChildren(prev => prev.map((c, i) =>
                                i === index ? { ...c, first_name: e.target.value } : c))}
                              style={inputStyle} />
                          </div>
                          <div>
                            <label style={labelStyle}>Date of Birth</label>
                            <input type="date" value={child.date_of_birth || ''}
                              onChange={e => setEditChildren(prev => prev.map((c, i) =>
                                i === index ? { ...c, date_of_birth: e.target.value } : c))}
                              style={inputStyle} />
                          </div>
                          <button onClick={() => removeEditChild(child)}
                            style={{ padding: '0.6rem', background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
                            ✕
                          </button>
                        </div>
                        {age !== null && (
                          <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem' }}>
                            <span style={{ fontSize: '0.8rem', background: '#e0e7ff', color: '#3730a3', padding: '0.2rem 0.6rem', borderRadius: '999px' }}>
                              Age: {age}
                            </span>
                            <span style={{ fontSize: '0.8rem', background: '#eff6ff', color: '#1a56db', padding: '0.2rem 0.6rem', borderRadius: '999px' }}>
                              Group: {getGroupAssignment(age)}
                            </span>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                <button onClick={saveEdit} style={{
                  marginTop: '1.5rem', padding: '0.75rem 2rem', background: '#1a56db',
                  color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600'
                }}>
                  Save All Changes
                </button>
              </div>
            )}

            {/* Attendance */}
            <div style={{ background: 'white', borderRadius: '12px', padding: '1.5rem', marginBottom: '1rem', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <h3 style={{ margin: '0 0 1rem', color: '#111827' }}>Attendance</h3>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                {[
                  { key: 'attends_go_greet', label: 'Go Greet' },
                  { key: 'attends_training', label: 'Training' },
                  { key: 'attends_baptism', label: 'Baptism' },
                ].map(item => (
                  <span key={item.key} style={{
                    padding: '0.4rem 1rem', borderRadius: '999px', fontSize: '0.85rem',
                    background: selectedMember[item.key] ? '#d1fae5' : '#f3f4f6',
                    color: selectedMember[item.key] ? '#065f46' : '#9ca3af'
                  }}>
                    {selectedMember[item.key] ? '✓' : '✗'} {item.label}
                  </span>
                ))}
              </div>
            </div>

            {/* Teams */}
            <div style={{ background: 'white', borderRadius: '12px', padding: '1.5rem', marginBottom: '1rem', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <h3 style={{ margin: '0 0 1rem', color: '#111827' }}>Teams</h3>
              {memberTeams.length === 0 ? (
                <p style={{ color: '#9ca3af', fontSize: '0.9rem' }}>Not part of any team yet</p>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {memberTeams.map(t => (
                    <span key={t.team_id} style={{
                      background: '#eff6ff', color: '#1a56db',
                      padding: '0.4rem 1rem', borderRadius: '999px', fontSize: '0.85rem', fontWeight: '500'
                    }}>
                      {t.teams.name}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Children */}
            {children.length > 0 && (
              <div style={{ background: 'white', borderRadius: '12px', padding: '1.5rem', marginBottom: '1rem', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                <h3 style={{ margin: '0 0 1rem', color: '#111827' }}>Children</h3>
                {children.map(child => {
                  const age = calculateAge(child.date_of_birth) ?? child.age
                  const group = age !== null ? getGroupAssignment(age) : child.group_assignment
                  return (
                    <div key={child.id} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '0.75rem', background: '#f9fafb', borderRadius: '8px', marginBottom: '0.5rem'
                    }}>
                      <span style={{ fontWeight: '500' }}>{child.first_name}</span>
                      <span style={{ color: '#6b7280', fontSize: '0.85rem' }}>
                        {child.date_of_birth ? `DOB: ${formatDate(child.date_of_birth)}` : ''} {age !== null ? `(Age ${age})` : ''}
                      </span>
                      <span style={{ background: '#eff6ff', color: '#1a56db', padding: '0.2rem 0.75rem', borderRadius: '999px', fontSize: '0.8rem' }}>
                        {group}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Admin Notes */}
            <div style={{ background: 'white', borderRadius: '12px', padding: '1.5rem', marginBottom: '1rem', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <h3 style={{ margin: '0 0 1rem', color: '#111827' }}>Admin Notes</h3>
              <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
                <textarea
                  value={newNote}
                  onChange={e => setNewNote(e.target.value)}
                  placeholder="Add a private note about this member..."
                  rows={3}
                  style={{ flex: 1, padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.9rem', resize: 'vertical' }}
                />
                <button onClick={saveNote} disabled={savingNote} style={{
                  padding: '0.75rem 1.25rem', background: '#1a56db', color: 'white',
                  border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', alignSelf: 'flex-start'
                }}>
                  {savingNote ? '...' : 'Add'}
                </button>
              </div>
              {notes.length === 0 ? (
                <p style={{ color: '#9ca3af', fontSize: '0.9rem' }}>No notes yet</p>
              ) : notes.map(note => (
                <div key={note.id} style={{
                  padding: '0.75rem', background: '#fffbeb', borderRadius: '8px',
                  marginBottom: '0.5rem', borderLeft: '3px solid #f59e0b'
                }}>
                  <p style={{ margin: 0, color: '#374151' }}>{note.note}</p>
                  <p style={{ margin: '0.4rem 0 0', fontSize: '0.75rem', color: '#9ca3af' }}>
                    {note.profiles ? `${note.profiles.first_name} ${note.profiles.last_name} · ` : ''}
                    {new Date(note.created_at).toLocaleDateString('en-GB', {
                      day: 'numeric', month: 'short', year: 'numeric',
                      hour: '2-digit', minute: '2-digit'
                    })}
                  </p>
                </div>
              ))}
            </div>

          </div>
        )}
      </div>
    </div>
  )
}

const labelStyle = {
  display: 'block', marginBottom: '0.4rem',
  color: '#374151', fontWeight: '500', fontSize: '0.85rem'
}

const inputStyle = {
  width: '100%', padding: '0.6rem', border: '1px solid #d1d5db',
  borderRadius: '8px', fontSize: '0.9rem', boxSizing: 'border-box'
}