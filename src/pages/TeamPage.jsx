import AdminNav from '../components/AdminNav'
import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

export default function TeamPage({ session }) {
  const [teams, setTeams] = useState([])
  const [selectedTeam, setSelectedTeam] = useState(null)
  const [members, setMembers] = useState([])
  const [joinRequests, setJoinRequests] = useState([])
  const [documents, setDocuments] = useState([])
  const [roster, setRoster] = useState([])
  const [profile, setProfile] = useState(null)
  const [isLeader, setIsLeader] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('members')
  const [uploading, setUploading] = useState(false)
  const [newRoster, setNewRoster] = useState('')
  const [savingRoster, setSavingRoster] = useState(false)
  const [allProfiles, setAllProfiles] = useState([])
  const [addMemberSearch, setAddMemberSearch] = useState('')
  const [showAddMember, setShowAddMember] = useState(false)

  useEffect(() => { fetchProfile() }, [])


  const fetchProfile = async () => {
    const { data } = await supabase
      .from('profiles').select('*').eq('id', session.user.id).single()
    setProfile(data)
    setIsAdmin(data?.is_admin || false)
    await fetchTeams(data)
    setLoading(false)
  }

const fetchTeams = async (profileData) => {
  console.log('is_admin value:', profileData?.is_admin)
  if (profileData?.is_admin === true) {
    const { data } = await supabase.from('teams').select('*').order('name')
    console.log('All teams:', data)
    setTeams(data || [])
  } else {
    const { data } = await supabase
      .from('team_members')
      .select('team_id, teams(*)')
      .eq('profile_id', session.user.id)
    setTeams(data?.map(t => t.teams) || [])
  }
}

  const fetchTeamDetails = async (team) => {
    setSelectedTeam(team)
    setActiveTab('members')
    const leaderCheck = team.leader_id === session.user.id
    setIsLeader(leaderCheck)

    const { data: memberData } = await supabase
      .from('team_members')
      .select('*, profiles(id, first_name, last_name, email, phone)')
      .eq('team_id', team.id)

    const { data: requestData } = await supabase
      .from('team_join_requests')
      .select('*, profiles(first_name, last_name, email)')
      .eq('team_id', team.id)
      .eq('status', 'pending')

    const { data: docData } = await supabase
      .from('team_documents')
      .select('*')
      .eq('team_id', team.id)
      .order('uploaded_at', { ascending: false })

    const { data: rosterData } = await supabase
      .from('rosters')
      .select('*')
      .eq('team_id', team.id)
      .order('week_start', { ascending: false })

    const { data: profileData } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, email')
      .order('last_name')

    setMembers(memberData || [])
    setJoinRequests(requestData || [])
    setDocuments(docData || [])
    setRoster(rosterData || [])
    setAllProfiles(profileData || [])
  }

  const handleRequest = async (requestId, profileId, status) => {
    await supabase
      .from('team_join_requests')
      .update({ status })
      .eq('id', requestId)

    if (status === 'approved') {
      await supabase.from('team_members').insert([{
        team_id: selectedTeam.id,
        profile_id: profileId
      }])
    }
    fetchTeamDetails(selectedTeam)
  }

  const removeMember = async (profileId) => {
    if (!confirm('Remove this member from the team?')) return
    await supabase
      .from('team_members')
      .delete()
      .eq('team_id', selectedTeam.id)
      .eq('profile_id', profileId)
    fetchTeamDetails(selectedTeam)
  }

  const addMember = async (profileId) => {
    const alreadyMember = members.some(m => m.profile_id === profileId)
    if (alreadyMember) { alert('Already a member of this team'); return }
    await supabase.from('team_members').insert([{
      team_id: selectedTeam.id,
      profile_id: profileId
    }])
    setAddMemberSearch('')
    setShowAddMember(false)
    fetchTeamDetails(selectedTeam)
  }

  const uploadDocument = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
    const fileName = `${selectedTeam.id}/${Date.now()}-${file.name}`
    const { error } = await supabase.storage
      .from('team-documents')
      .upload(fileName, file)

    if (!error) {
      const { data: urlData } = supabase.storage
        .from('team-documents')
        .getPublicUrl(fileName)
      await supabase.from('team_documents').insert([{
        team_id: selectedTeam.id,
        name: file.name,
        file_url: urlData.publicUrl,
        uploaded_by: session.user.id
      }])
      fetchTeamDetails(selectedTeam)
    } else {
      alert('Upload error: ' + error.message)
    }
    setUploading(false)
  }

  const deleteDocument = async (doc) => {
    if (!confirm('Delete this document?')) return
    await supabase.from('team_documents').delete().eq('id', doc.id)
    fetchTeamDetails(selectedTeam)
  }

  const saveRoster = async () => {
    if (!newRoster.trim()) return
    setSavingRoster(true)
    await supabase.from('rosters').insert([{
      team_id: selectedTeam.id,
      week_start: new Date().toISOString().split('T')[0],
      details: newRoster
    }])
    setNewRoster('')
    setSavingRoster(false)
    fetchTeamDetails(selectedTeam)
  }

  const canManage = isAdmin || isLeader

  const filteredProfiles = allProfiles.filter(p =>
    `${p.first_name} ${p.last_name} ${p.email}`.toLowerCase()
      .includes(addMemberSearch.toLowerCase()) &&
    !members.some(m => m.profile_id === p.id)
  )

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <p>Loading...</p>
    </div>
  )

return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', fontFamily: 'sans-serif' }}>
      <AdminNav session={session} />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

      {/* Sidebar */}
      <div style={{
        width: '280px', background: 'white', borderRight: '1px solid #e5e7eb',
        display: 'flex', flexDirection: 'column', flexShrink: 0
      }}>
        <div style={{ padding: '1.25rem', background: '#1a56db', borderBottom: '1px solid #e5e7eb' }}>
          <h2 style={{ color: 'white', margin: 0, fontSize: '1.2rem' }}>Go Grace</h2>
          <p style={{ color: '#bfdbfe', margin: '0.25rem 0 0', fontSize: '0.8rem' }}>Team Pages</p>
        </div>

        <div style={{ overflowY: 'auto', flex: 1 }}>
          {teams.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#9ca3af', padding: '2rem' }}>No teams found</p>
          ) : teams.map(team => (
            <div
              key={team.id}
              onClick={() => fetchTeamDetails(team)}
              style={{
                padding: '1rem', borderBottom: '1px solid #f3f4f6', cursor: 'pointer',
                background: selectedTeam?.id === team.id ? '#eff6ff' : 'white',
                borderLeft: selectedTeam?.id === team.id ? '3px solid #1a56db' : '3px solid transparent'
              }}
            >
              <div style={{ fontWeight: '600', color: '#111827' }}>{team.name}</div>
            </div>
          ))}
        </div>

        <div style={{ padding: '1rem', borderTop: '1px solid #e5e7eb' }}>
          <button
            onClick={() => supabase.auth.signOut()}
            style={{
              width: '100%', padding: '0.6rem', background: '#f3f4f6',
              border: 'none', borderRadius: '8px', cursor: 'pointer', color: '#374151', fontWeight: '500'
            }}
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, overflowY: 'auto', background: '#f9fafb' }}>
        {!selectedTeam ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <div style={{ textAlign: 'center', color: '#9ca3af' }}>
              <div style={{ fontSize: '3rem' }}>👥</div>
              <p>Select a team to view details</p>
            </div>
          </div>
        ) : (
          <div style={{ padding: '2rem' }}>

            {/* Team Header */}
            <div style={{
              background: 'white', borderRadius: '12px', padding: '1.5rem',
              marginBottom: '1rem', boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <div>
                <h2 style={{ margin: 0, color: '#111827' }}>{selectedTeam.name}</h2>
                <p style={{ margin: '0.25rem 0 0', color: '#6b7280', fontSize: '0.9rem' }}>
                  {members.length} members
                  {isLeader && (
                    <span style={{ marginLeft: '0.5rem', color: '#1a56db', fontWeight: '600' }}>
                      · You are the team leader
                    </span>
                  )}
                </p>
              </div>
              {joinRequests.length > 0 && canManage && (
                <span style={{
                  background: '#fee2e2', color: '#dc2626',
                  padding: '0.4rem 0.75rem', borderRadius: '999px', fontSize: '0.85rem', fontWeight: '600'
                }}>
                  {joinRequests.length} pending request{joinRequests.length > 1 ? 's' : ''}
                </span>
              )}
            </div>

            {/* Tabs */}
            <div style={{
              background: 'white', borderRadius: '12px', marginBottom: '1rem',
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)', display: 'flex', overflow: 'hidden'
            }}>
              {[
                { id: 'members', label: '👥 Members' },
                { id: 'requests', label: `📋 Requests${joinRequests.length > 0 ? ` (${joinRequests.length})` : ''}` },
                { id: 'roster', label: '📅 Roster' },
                { id: 'documents', label: '📁 Documents' },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    padding: '1rem 1.5rem', border: 'none', background: 'none',
                    cursor: 'pointer', fontSize: '0.9rem', fontWeight: '500',
                    color: activeTab === tab.id ? '#1a56db' : '#6b7280',
                    borderBottom: activeTab === tab.id ? '2px solid #1a56db' : '2px solid transparent'
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Members Tab */}
            {activeTab === 'members' && (
              <div style={{
                background: 'white', borderRadius: '12px', padding: '1.5rem',
                boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h3 style={{ margin: 0, color: '#111827' }}>Team Members</h3>
                  {canManage && (
                    <button
                      onClick={() => setShowAddMember(!showAddMember)}
                      style={{
                        padding: '0.5rem 1rem', background: '#1a56db', color: 'white',
                        border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '0.85rem'
                      }}
                    >
                      + Add Member
                    </button>
                  )}
                </div>

                {showAddMember && canManage && (
                  <div style={{ marginBottom: '1rem', padding: '1rem', background: '#f9fafb', borderRadius: '8px' }}>
                    <input
                      placeholder="Search by name or email..."
                      value={addMemberSearch}
                      onChange={e => setAddMemberSearch(e.target.value)}
                      style={{
                        width: '100%', padding: '0.6rem', border: '1px solid #d1d5db',
                        borderRadius: '8px', fontSize: '0.9rem', boxSizing: 'border-box', marginBottom: '0.5rem'
                      }}
                    />
                    {addMemberSearch && filteredProfiles.slice(0, 5).map(p => (
                      <div key={p.id} style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '0.5rem 0.75rem', background: 'white', borderRadius: '8px',
                        marginBottom: '0.25rem', border: '1px solid #e5e7eb'
                      }}>
                        <span>{p.first_name} {p.last_name} — {p.email}</span>
                        <button
                          onClick={() => addMember(p.id)}
                          style={{
                            padding: '0.3rem 0.75rem', background: '#1a56db', color: 'white',
                            border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem'
                          }}
                        >Add</button>
                      </div>
                    ))}
                  </div>
                )}

                {members.length === 0 ? (
                  <p style={{ color: '#9ca3af' }}>No members yet</p>
                ) : members.map(m => (
                  <div key={m.id} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '0.75rem', background: '#f9fafb', borderRadius: '8px', marginBottom: '0.5rem'
                  }}>
                    <div>
                      <div style={{ fontWeight: '500' }}>{m.profiles.first_name} {m.profiles.last_name}</div>
                      <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>{m.profiles.email}</div>
                    </div>
                    {canManage && m.profiles.id !== session.user.id && (
                      <button
                        onClick={() => removeMember(m.profile_id)}
                        style={{
                          padding: '0.3rem 0.75rem', background: '#fee2e2', color: '#dc2626',
                          border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem'
                        }}
                      >Remove</button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Requests Tab */}
            {activeTab === 'requests' && (
              <div style={{
                background: 'white', borderRadius: '12px', padding: '1.5rem',
                boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
              }}>
                <h3 style={{ margin: '0 0 1rem', color: '#111827' }}>Join Requests</h3>
                {!canManage ? (
                  <p style={{ color: '#9ca3af' }}>Only team leaders and admins can manage requests.</p>
                ) : joinRequests.length === 0 ? (
                  <p style={{ color: '#9ca3af' }}>No pending requests</p>
                ) : joinRequests.map(req => (
                  <div key={req.id} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '0.75rem', background: '#f9fafb', borderRadius: '8px', marginBottom: '0.5rem'
                  }}>
                    <div>
                      <div style={{ fontWeight: '500' }}>{req.profiles.first_name} {req.profiles.last_name}</div>
                      <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>{req.profiles.email}</div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        onClick={() => handleRequest(req.id, req.profile_id, 'approved')}
                        style={{
                          padding: '0.3rem 0.75rem', background: '#d1fae5', color: '#065f46',
                          border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '600'
                        }}
                      >Approve</button>
                      <button
                        onClick={() => handleRequest(req.id, req.profile_id, 'denied')}
                        style={{
                          padding: '0.3rem 0.75rem', background: '#fee2e2', color: '#dc2626',
                          border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '600'
                        }}
                      >Deny</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Roster Tab */}
            {activeTab === 'roster' && (
              <div style={{
                background: 'white', borderRadius: '12px', padding: '1.5rem',
                boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
              }}>
                <h3 style={{ margin: '0 0 1rem', color: '#111827' }}>Weekly Roster</h3>
                {canManage && (
                  <div style={{ marginBottom: '1.5rem', padding: '1rem', background: '#f9fafb', borderRadius: '8px' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#374151' }}>
                      Add this week's roster
                    </label>
                    <textarea
                      value={newRoster}
                      onChange={e => setNewRoster(e.target.value)}
                      placeholder="Enter roster details for this week..."
                      rows={4}
                      style={{
                        width: '100%', padding: '0.75rem', border: '1px solid #d1d5db',
                        borderRadius: '8px', fontSize: '0.9rem', resize: 'vertical', boxSizing: 'border-box'
                      }}
                    />
                    <button
                      onClick={saveRoster}
                      disabled={savingRoster}
                      style={{
                        marginTop: '0.75rem', padding: '0.6rem 1.5rem', background: '#1a56db',
                        color: 'white', border: 'none', borderRadius: '8px',
                        cursor: 'pointer', fontWeight: '600'
                      }}
                    >
                      {savingRoster ? 'Saving...' : 'Post Roster'}
                    </button>
                  </div>
                )}
                {roster.length === 0 ? (
                  <p style={{ color: '#9ca3af' }}>No rosters posted yet</p>
                ) : roster.map(r => (
                  <div key={r.id} style={{
                    padding: '1rem', background: '#f9fafb', borderRadius: '8px',
                    marginBottom: '0.75rem', borderLeft: '3px solid #1a56db'
                  }}>
                    <div style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: '0.5rem' }}>
                      Week of {new Date(r.week_start).toLocaleDateString('en-GB', {
                        day: 'numeric', month: 'short', year: 'numeric'
                      })}
                    </div>
                    <div style={{ color: '#111827', whiteSpace: 'pre-wrap' }}>{r.details}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Documents Tab */}
            {activeTab === 'documents' && (
              <div style={{
                background: 'white', borderRadius: '12px', padding: '1.5rem',
                boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h3 style={{ margin: 0, color: '#111827' }}>Documents</h3>
                  {canManage && (
                    <label style={{
                      padding: '0.5rem 1rem', background: '#1a56db', color: 'white',
                      borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '0.85rem'
                    }}>
                      {uploading ? 'Uploading...' : '+ Upload Document'}
                      <input type="file" onChange={uploadDocument} style={{ display: 'none' }} />
                    </label>
                  )}
                </div>
                {documents.length === 0 ? (
                  <p style={{ color: '#9ca3af' }}>No documents uploaded yet</p>
                ) : documents.map(doc => (
                  <div key={doc.id} style={{
                    display: 'flex', alignItems: 'center', gap: '0.75rem',
                    padding: '0.75rem', background: '#f9fafb',
                    borderRadius: '8px', marginBottom: '0.5rem', border: '1px solid #e5e7eb'
                  }}>
                    <span style={{ fontSize: '1.5rem' }}>📄</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: '500' }}>{doc.name}</div>
                      <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                        {new Date(doc.uploaded_at).toLocaleDateString('en-GB', {
                          day: 'numeric', month: 'short', year: 'numeric'
                        })}
                      </div>
                    </div>
                    <a
                      href={doc.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        padding: '0.3rem 0.75rem', background: '#eff6ff', color: '#1a56db',
                        borderRadius: '6px', fontSize: '0.8rem', textDecoration: 'none', fontWeight: '500'
                      }}
                    >Download</a>
                    {canManage && (
                      <button
                        onClick={() => deleteDocument(doc)}
                        style={{
                          padding: '0.3rem 0.75rem', background: '#fee2e2', color: '#dc2626',
                          border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem'
                        }}
                      >Delete</button>
                    )}
                  </div>
                ))}
              </div>
            )}

          </div>
        )}
      </div>
    </div>
    </div> 
  )
}