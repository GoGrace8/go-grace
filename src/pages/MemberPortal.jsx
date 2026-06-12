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

const formatDate = (date) => {
  if (!date) return 'Not provided'
  return new Date(date).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric'
  })
}

const getGroupAssignment = (age) => {
  if (age <= 2) return 'Toddlers'
  if (age <= 6) return 'Go Kidz'
  if (age <= 12) return 'Youth'
  return 'Adult'
}

export default function MemberPortal({ session }) {
  const [profile, setProfile] = useState(null)
  const [children, setChildren] = useState([])
  const [memberTeams, setMemberTeams] = useState([])
  const [allTeams, setAllTeams] = useState([])
  const [joinRequests, setJoinRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [editMode, setEditMode] = useState(false)
  const [editForm, setEditForm] = useState({})
  const [editChildren, setEditChildren] = useState([])
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('profile')
  const [selectedTeam, setSelectedTeam] = useState('')
  const [requestSent, setRequestSent] = useState(false)

  useEffect(() => {
    fetchAll()
  }, [])

  const fetchAll = async () => {
    setLoading(true)

    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single()

    const { data: childData } = await supabase
      .from('children')
      .select('*')
      .eq('profile_id', session.user.id)

    const { data: teamData } = await supabase
      .from('team_members')
      .select('team_id, teams(name)')
      .eq('profile_id', session.user.id)

    const { data: allTeamData } = await supabase
      .from('teams')
      .select('*')
      .order('name')

    const { data: requestData } = await supabase
      .from('team_join_requests')
      .select('*, teams(name)')
      .eq('profile_id', session.user.id)

    setProfile(profileData)
    setEditForm(profileData || {})
    setChildren(childData || [])
    setEditChildren(childData || [])
    setMemberTeams(teamData || [])
    setAllTeams(allTeamData || [])
    setJoinRequests(requestData || [])
    setLoading(false)
  }

  const saveProfile = async () => {
    setSaving(true)

    const { error } = await supabase
      .from('profiles')
      .update({
        first_name: editForm.first_name,
        last_name: editForm.last_name,
        phone: editForm.phone,
        date_of_birth: editForm.date_of_birth || null,
      })
      .eq('id', session.user.id)

    if (error) { alert('Error saving: ' + error.message); setSaving(false); return }

    for (const child of editChildren) {
      const age = calculateAge(child.date_of_birth)
      const group = age !== null ? getGroupAssignment(age) : child.group_assignment
      if (child.id && !child.id.startsWith('new-')) {
        await supabase.from('children').update({
          first_name: child.first_name,
          date_of_birth: child.date_of_birth || null,
          age: age,
          group_assignment: group
        }).eq('id', child.id)
      } else {
        await supabase.from('children').insert([{
          profile_id: session.user.id,
          first_name: child.first_name,
          date_of_birth: child.date_of_birth || null,
          age: age,
          group_assignment: group
        }])
      }
    }

    setEditMode(false)
    setSaving(false)
    fetchAll()
  }

  const sendJoinRequest = async () => {
    if (!selectedTeam) return
    const alreadyMember = memberTeams.some(t => t.team_id === selectedTeam)
    const alreadyRequested = joinRequests.some(r => r.team_id === selectedTeam && r.status === 'pending')
    if (alreadyMember) { alert('You are already a member of this team!'); return }
    if (alreadyRequested) { alert('You already have a pending request for this team!'); return }

    const { error } = await supabase
      .from('team_join_requests')
      .insert([{
        team_id: selectedTeam,
        profile_id: session.user.id,
        status: 'pending'
      }])

    if (!error) {
      setRequestSent(true)
      setSelectedTeam('')
      fetchAll()
      setTimeout(() => setRequestSent(false), 3000)
    }
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <p>Loading...</p>
    </div>
  )

  const availableTeams = allTeams.filter(t =>
    !memberTeams.some(mt => mt.team_id === t.id)
  )

  return (
    <div style={{ fontFamily: 'sans-serif', background: '#f9fafb', minHeight: '100vh' }}>

      {/* Header */}
      <div style={{
        background: '#1a56db', padding: '1rem 2rem',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
      }}>
        <div>
          <h1 style={{ color: 'white', margin: 0, fontSize: '1.3rem' }}>Go Grace</h1>
          <p style={{ color: '#bfdbfe', margin: 0, fontSize: '0.85rem' }}>Member Portal</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ color: '#bfdbfe', fontSize: '0.85rem' }}>
            {profile?.first_name} {profile?.last_name}
          </span>
          <button
            onClick={() => supabase.auth.signOut()}
            style={{
              padding: '0.4rem 1rem', background: 'rgba(255,255,255,0.15)',
              color: 'white', border: '1px solid rgba(255,255,255,0.3)',
              borderRadius: '8px', cursor: 'pointer', fontSize: '0.85rem'
            }}
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        background: 'white', borderBottom: '1px solid #e5e7eb',
        padding: '0 2rem', display: 'flex', gap: '0'
      }}>
        {[
          { id: 'profile', label: '👤 My Profile' },
          { id: 'teams', label: '👥 My Teams' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '1rem 1.5rem', border: 'none', background: 'none',
              cursor: 'pointer', fontSize: '0.95rem', fontWeight: '500',
              color: activeTab === tab.id ? '#1a56db' : '#6b7280',
              borderBottom: activeTab === tab.id ? '2px solid #1a56db' : '2px solid transparent'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div style={{ padding: '2rem', maxWidth: '700px', margin: '0 auto' }}>

        {/* Profile Tab */}
        {activeTab === 'profile' && (
          <>
            {/* Profile Card */}
            <div style={{
              background: 'white', borderRadius: '12px', padding: '1.5rem',
              marginBottom: '1rem', boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h2 style={{ margin: 0, color: '#111827' }}>
                    {profile?.first_name} {profile?.last_name}
                  </h2>
                  <p style={{ margin: '0.25rem 0 0', color: '#6b7280' }}>{profile?.email}</p>
                  <p style={{ margin: '0.25rem 0 0', color: '#6b7280' }}>{profile?.phone || 'No phone added'}</p>
                  <p style={{ margin: '0.25rem 0 0', color: '#6b7280' }}>
                    Date of Birth: {formatDate(profile?.date_of_birth)}
                  </p>
                  <p style={{ margin: '0.25rem 0 0', color: '#6b7280' }}>
                    First Visit: {formatDate(profile?.first_visit_date)}
                  </p>
                  <span style={{
                    display: 'inline-block', marginTop: '0.5rem',
                    fontSize: '0.8rem', padding: '0.25rem 0.75rem', borderRadius: '999px',
                    background: profile?.member_type === 'leader' ? '#fef3c7' :
                      profile?.member_type === 'member' ? '#d1fae5' : '#e0e7ff',
                    color: profile?.member_type === 'leader' ? '#92400e' :
                      profile?.member_type === 'member' ? '#065f46' : '#3730a3'
                  }}>
                    {profile?.member_type}
                  </span>
                </div>
                <button
                  onClick={() => { setEditMode(!editMode); setEditChildren(children) }}
                  style={{
                    padding: '0.6rem 1.2rem',
                    background: editMode ? '#f3f4f6' : '#1a56db',
                    color: editMode ? '#374151' : 'white',
                    border: 'none', borderRadius: '8px',
                    cursor: 'pointer', fontWeight: '500'
                  }}
                >
                  {editMode ? 'Cancel' : 'Edit Profile'}
                </button>
              </div>
            </div>

            {/* Edit Form */}
            {editMode && (
              <div style={{
                background: 'white', borderRadius: '12px', padding: '1.5rem',
                marginBottom: '1rem', boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
              }}>
                <h3 style={{ margin: '0 0 1rem', color: '#111827' }}>Edit My Details</h3>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  {[
                    { label: 'First Name', key: 'first_name' },
                    { label: 'Last Name', key: 'last_name' },
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

                <div style={{ marginTop: '1rem' }}>
                  <label style={labelStyle}>Phone Number</label>
                  <input
                    value={editForm.phone || ''}
                    onChange={e => setEditForm(prev => ({ ...prev, phone: e.target.value }))}
                    style={inputStyle}
                  />
                </div>

                <div style={{ marginTop: '1rem' }}>
                  <label style={labelStyle}>Date of Birth</label>
                  <input
                    type="date"
                    value={editForm.date_of_birth || ''}
                    onChange={e => setEditForm(prev => ({ ...prev, date_of_birth: e.target.value }))}
                    style={inputStyle}
                  />
                </div>

                {/* Children */}
                <div style={{ marginTop: '1.5rem', borderTop: '1px solid #e5e7eb', paddingTop: '1.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h4 style={{ margin: 0, color: '#111827' }}>Children</h4>
                    <button
                      type="button"
                      onClick={() => setEditChildren(prev => [...prev, { id: 'new-' + Date.now(), first_name: '', date_of_birth: '' }])}
                      style={{
                        padding: '0.4rem 0.8rem', background: '#1a56db',
                        color: 'white', border: 'none', borderRadius: '8px',
                        cursor: 'pointer', fontSize: '0.85rem', fontWeight: '600'
                      }}
                    >
                      + Add Child
                    </button>
                  </div>

                  {editChildren.map((child, index) => {
                    const age = calculateAge(child.date_of_birth)
                    return (
                      <div key={child.id} style={{
                        background: '#f9fafb', borderRadius: '8px',
                        padding: '1rem', marginBottom: '0.75rem'
                      }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '0.75rem', alignItems: 'end' }}>
                          <div>
                            <label style={labelStyle}>Name</label>
                            <input
                              value={child.first_name}
                              onChange={e => setEditChildren(prev => prev.map((c, i) =>
                                i === index ? { ...c, first_name: e.target.value } : c
                              ))}
                              style={inputStyle}
                            />
                          </div>
                          <div>
                            <label style={labelStyle}>Date of Birth</label>
                            <input
                              type="date"
                              value={child.date_of_birth || ''}
                              onChange={e => setEditChildren(prev => prev.map((c, i) =>
                                i === index ? { ...c, date_of_birth: e.target.value } : c
                              ))}
                              style={inputStyle}
                            />
                          </div>
                          <button
                            type="button"
                            onClick={async () => {
                              if (!child.id.startsWith('new-')) {
                                await supabase.from('children').delete().eq('id', child.id)
                              }
                              setEditChildren(prev => prev.filter((_, i) => i !== index))
                            }}
                            style={{
                              padding: '0.6rem', background: '#fee2e2',
                              color: '#dc2626', border: 'none',
                              borderRadius: '8px', cursor: 'pointer'
                            }}
                          >
                            ✕
                          </button>
                        </div>
                        {age !== null && (
                          <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem' }}>
                            <span style={{
                              fontSize: '0.8rem', background: '#e0e7ff',
                              color: '#3730a3', padding: '0.2rem 0.6rem', borderRadius: '999px'
                            }}>
                              Age: {age}
                            </span>
                            <span style={{
                              fontSize: '0.8rem', background: '#eff6ff',
                              color: '#1a56db', padding: '0.2rem 0.6rem', borderRadius: '999px'
                            }}>
                              Group: {getGroupAssignment(age)}
                            </span>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                <button
                  onClick={saveProfile}
                  disabled={saving}
                  style={{
                    marginTop: '1.5rem', padding: '0.75rem 2rem',
                    background: '#1a56db', color: 'white', border: 'none',
                    borderRadius: '8px', cursor: 'pointer', fontWeight: '600',
                    opacity: saving ? 0.7 : 1
                  }}
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            )}

            {/* Attendance */}
            <div style={{
              background: 'white', borderRadius: '12px', padding: '1.5rem',
              marginBottom: '1rem', boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
            }}>
              <h3 style={{ margin: '0 0 1rem', color: '#111827' }}>My Attendance</h3>
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                {[
                  { key: 'attends_go_greet', label: 'Go Greet' },
                  { key: 'attends_training', label: 'Training' },
                  { key: 'attends_baptism', label: 'Baptism' },
                ].map(item => (
                  <span key={item.key} style={{
                    padding: '0.4rem 1rem', borderRadius: '999px', fontSize: '0.85rem',
                    background: profile?.[item.key] ? '#d1fae5' : '#f3f4f6',
                    color: profile?.[item.key] ? '#065f46' : '#9ca3af'
                  }}>
                    {profile?.[item.key] ? '✓' : '✗'} {item.label}
                  </span>
                ))}
              </div>
            </div>

            {/* Children Display */}
            {children.length > 0 && (
              <div style={{
                background: 'white', borderRadius: '12px', padding: '1.5rem',
                marginBottom: '1rem', boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
              }}>
                <h3 style={{ margin: '0 0 1rem', color: '#111827' }}>My Children</h3>
                {children.map(child => {
                  const age = calculateAge(child.date_of_birth) ?? child.age
                  const group = age !== null ? getGroupAssignment(age) : child.group_assignment
                  return (
                    <div key={child.id} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '0.75rem', background: '#f9fafb',
                      borderRadius: '8px', marginBottom: '0.5rem'
                    }}>
                      <span style={{ fontWeight: '500' }}>{child.first_name}</span>
                      <span style={{ color: '#6b7280', fontSize: '0.85rem' }}>
                        {child.date_of_birth ? formatDate(child.date_of_birth) : ''} {age !== null ? `(Age ${age})` : ''}
                      </span>
                      <span style={{
                        background: '#eff6ff', color: '#1a56db',
                        padding: '0.2rem 0.75rem', borderRadius: '999px', fontSize: '0.8rem'
                      }}>
                        {group}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}

        {/* Teams Tab */}
        {activeTab === 'teams' && (
          <>
            {/* Current Teams */}
            <div style={{
              background: 'white', borderRadius: '12px', padding: '1.5rem',
              marginBottom: '1rem', boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
            }}>
              <h3 style={{ margin: '0 0 1rem', color: '#111827' }}>My Teams</h3>
              {memberTeams.length === 0 ? (
                <p style={{ color: '#9ca3af' }}>You haven't joined any teams yet.</p>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {memberTeams.map(t => (
                    <span key={t.team_id} style={{
                      background: '#eff6ff', color: '#1a56db',
                      padding: '0.5rem 1.25rem', borderRadius: '999px',
                      fontSize: '0.9rem', fontWeight: '500'
                    }}>
                      {t.teams.name}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Join a Team */}
            <div style={{
              background: 'white', borderRadius: '12px', padding: '1.5rem',
              marginBottom: '1rem', boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
            }}>
              <h3 style={{ margin: '0 0 1rem', color: '#111827' }}>Apply to Join a Team</h3>

              {requestSent && (
                <div style={{
                  background: '#d1fae5', color: '#065f46', padding: '0.75rem',
                  borderRadius: '8px', marginBottom: '1rem', fontSize: '0.9rem'
                }}>
                  ✓ Request sent! The team leader will review your application.
                </div>
              )}

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <select
                  value={selectedTeam}
                  onChange={e => setSelectedTeam(e.target.value)}
                  style={{ flex: 1, padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.9rem' }}
                >
                  <option value="">Select a team...</option>
                  {availableTeams.map(team => (
                    <option key={team.id} value={team.id}>{team.name}</option>
                  ))}
                </select>
                <button
                  onClick={sendJoinRequest}
                  disabled={!selectedTeam}
                  style={{
                    padding: '0.75rem 1.5rem', background: '#1a56db',
                    color: 'white', border: 'none', borderRadius: '8px',
                    cursor: selectedTeam ? 'pointer' : 'not-allowed',
                    fontWeight: '600', opacity: selectedTeam ? 1 : 0.5
                  }}
                >
                  Request
                </button>
              </div>
            </div>

            {/* Pending Requests */}
            {joinRequests.length > 0 && (
              <div style={{
                background: 'white', borderRadius: '12px', padding: '1.5rem',
                marginBottom: '1rem', boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
              }}>
                <h3 style={{ margin: '0 0 1rem', color: '#111827' }}>My Requests</h3>
                {joinRequests.map(req => (
                  <div key={req.id} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '0.75rem', background: '#f9fafb',
                    borderRadius: '8px', marginBottom: '0.5rem'
                  }}>
                    <span style={{ fontWeight: '500' }}>{req.teams.name}</span>
                    <span style={{
                      fontSize: '0.8rem', padding: '0.25rem 0.75rem', borderRadius: '999px',
                      background: req.status === 'approved' ? '#d1fae5' :
                        req.status === 'denied' ? '#fee2e2' : '#fef3c7',
                      color: req.status === 'approved' ? '#065f46' :
                        req.status === 'denied' ? '#dc2626' : '#92400e'
                    }}>
                      {req.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

const labelStyle = {
  display: 'block',
  marginBottom: '0.4rem',
  color: '#374151',
  fontWeight: '500',
  fontSize: '0.85rem'
}

const inputStyle = {
  width: '100%',
  padding: '0.75rem',
  border: '1px solid #d1d5db',
  borderRadius: '8px',
  fontSize: '0.9rem',
  boxSizing: 'border-box'
}
