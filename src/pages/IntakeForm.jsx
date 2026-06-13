import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { supabase } from '../supabaseClient'

const getGroupAssignment = (age) => {
  if (age <= 2) return 'Toddlers'
  if (age <= 6) return 'Go Kidz'
  if (age <= 12) return 'Youth'
  return 'Adult'
}

export default function IntakeForm() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState(null)
  const [children, setChildren] = useState([])

  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    date_of_birth: '',
    member_type: 'visitor',
    attends_go_greet: false,
    attends_training: false,
    attends_baptism: false,
  })

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }))
  }

  const addChild = () => {
    setChildren(prev => [...prev, { first_name: '', age: '' }])
  }

  const updateChild = (index, field, value) => {
    setChildren(prev => prev.map((child, i) =>
      i === index ? { ...child, [field]: value } : child
    ))
  }

  const removeChild = (index) => {
    setChildren(prev => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const { data: profileId, error: profileError } = await supabase
        .rpc('create_profile', {
          p_email: form.email,
          p_first_name: form.first_name,
          p_last_name: form.last_name,
          p_phone: form.phone,
          p_date_of_birth: form.date_of_birth || null,
          p_member_type: form.member_type,
          p_attends_go_greet: form.attends_go_greet,
          p_attends_training: form.attends_training,
          p_attends_baptism: form.attends_baptism
        })

      if (profileError) throw profileError

      if (children.length > 0) {
        const childrenData = children.map(child => ({
          profile_id: profileId,
          first_name: child.first_name,
          age: parseInt(child.age),
          group_assignment: getGroupAssignment(parseInt(child.age))
        }))

        const { error: childrenError } = await supabase
          .from('children')
          .insert(childrenData)

        if (childrenError) throw childrenError
      }

      setSuccess(true)
    } catch (err) {
      setError(err.message)
    }

    setLoading(false)
  }

  if (success) return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', background: '#f0f4f8'
    }}>
      <div style={{
        background: 'white', padding: '3rem', borderRadius: '12px',
        textAlign: 'center', boxShadow: '0 4px 24px rgba(0,0,0,0.08)'
      }}>
        <div style={{ fontSize: '4rem' }}>✅</div>
        <h2 style={{ color: '#1a56db' }}>Welcome to Go Grace!</h2>
        <p style={{ color: '#6b7280' }}>Profile created successfully.</p>
        <button
          onClick={() => {
            setSuccess(false)
            setForm({
              first_name: '', last_name: '', email: '', phone: '',
              date_of_birth: '', member_type: 'visitor',
              attends_go_greet: false, attends_training: false, attends_baptism: false
            })
            setChildren([])
          }}
          style={{
            marginTop: '1rem', padding: '0.75rem 2rem',
            background: '#1a56db', color: 'white', border: 'none',
            borderRadius: '8px', cursor: 'pointer', fontWeight: '600'
          }}
        >
          Add Another Person
        </button>
      </div>
    </div>
  )

  return (
    <div style={{ background: '#f0f4f8', minHeight: '100vh', padding: '2rem', position: 'relative' }}>
      <div style={{ maxWidth: '600px', margin: '0 auto' }}>

        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <button
            onClick={() => navigate('/admin')}
            style={{
              position: 'absolute', top: '1rem', left: '1rem',
              background: 'none', border: 'none', color: '#1a56db',
              cursor: 'pointer', fontSize: '0.9rem', textDecoration: 'underline'
            }}
          >
            ← Back to Admin
          </button>
          <h1 style={{ color: '#1a56db', margin: 0 }}>Go Grace</h1>
          <p style={{ color: '#6b7280' }}>New Member Registration</p>
        </div>

        {error && (
          <div style={{
            background: '#fee2e2', color: '#dc2626',
            padding: '1rem', borderRadius: '8px', marginBottom: '1rem'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>

          <div style={cardStyle}>
            <h3 style={headingStyle}>Personal Details</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={labelStyle}>First Name</label>
                <input name="first_name" value={form.first_name} onChange={handleChange} required style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Last Name</label>
                <input name="last_name" value={form.last_name} onChange={handleChange} required style={inputStyle} />
              </div>
            </div>
            <div style={{ marginTop: '1rem' }}>
              <label style={labelStyle}>Email Address</label>
              <input name="email" type="email" value={form.email} onChange={handleChange} required style={inputStyle} />
            </div>
            <div style={{ marginTop: '1rem' }}>
              <label style={labelStyle}>Phone Number</label>
              <input name="phone" type="tel" value={form.phone} onChange={handleChange} style={inputStyle} />
            </div>
            <div style={{ marginTop: '1rem' }}>
              <label style={labelStyle}>Date of Birth</label>
              <input name="date_of_birth" type="date" value={form.date_of_birth} onChange={handleChange} style={inputStyle} />
            </div>
          </div>

          <div style={cardStyle}>
            <h3 style={headingStyle}>Attendance Status</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
              {['visitor', 'member', 'leader'].map(type => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setForm(prev => ({ ...prev, member_type: type }))}
                  style={{
                    padding: '0.75rem',
                    border: `2px solid ${form.member_type === type ? '#1a56db' : '#e5e7eb'}`,
                    borderRadius: '8px',
                    background: form.member_type === type ? '#eff6ff' : 'white',
                    color: form.member_type === type ? '#1a56db' : '#6b7280',
                    fontWeight: form.member_type === type ? '600' : '400',
                    cursor: 'pointer',
                    textTransform: 'capitalize'
                  }}
                >
                  {type === 'visitor' ? '👋 Visitor' : type === 'member' ? '⛪ Member' : '✝️ Leader'}
                </button>
              ))}
            </div>
          </div>

          <div style={cardStyle}>
            <h3 style={headingStyle}>Additional Groups</h3>
            {[
              { name: 'attends_go_greet', label: 'Go Greet' },
              { name: 'attends_training', label: 'Training' },
              { name: 'attends_baptism', label: 'Baptism' },
            ].map(item => (
              <label key={item.name} style={{
                display: 'flex', alignItems: 'center',
                gap: '0.75rem', marginBottom: '0.75rem', cursor: 'pointer'
              }}>
                <input
                  type="checkbox"
                  name={item.name}
                  checked={form[item.name]}
                  onChange={handleChange}
                  style={{ width: '20px', height: '20px' }}
                />
                <span style={{ color: '#374151', fontSize: '1rem' }}>{item.label}</span>
              </label>
            ))}
          </div>

          <div style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, color: '#111827' }}>Children</h3>
              <button
                type="button"
                onClick={addChild}
                style={{
                  padding: '0.5rem 1rem', background: '#1a56db',
                  color: 'white', border: 'none', borderRadius: '8px',
                  cursor: 'pointer', fontWeight: '600'
                }}
              >
                + Add Child
              </button>
            </div>

            {children.length === 0 && (
              <p style={{ color: '#9ca3af', textAlign: 'center', margin: '1rem 0' }}>
                No children added yet
              </p>
            )}

            {children.map((child, index) => (
              <div key={index} style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 40px', gap: '0.75rem', alignItems: 'end' }}>
                  <div>
                    <label style={labelStyle}>Name</label>
                    <input
                      value={child.first_name}
                      onChange={(e) => updateChild(index, 'first_name', e.target.value)}
                      placeholder="Child's name"
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Age</label>
                    <input
                      type="number"
                      value={child.age}
                      onChange={(e) => updateChild(index, 'age', e.target.value)}
                      placeholder="Age"
                      min="0"
                      max="17"
                      style={inputStyle}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeChild(index)}
                    style={{
                      padding: '0.75rem', background: '#fee2e2',
                      color: '#dc2626', border: 'none',
                      borderRadius: '8px', cursor: 'pointer'
                    }}
                  >
                    ✕
                  </button>
                </div>
                {child.age !== '' && (
                  <div style={{ marginTop: '0.5rem' }}>
                    <span style={{
                      fontSize: '0.85rem', color: '#1a56db',
                      background: '#eff6ff', padding: '0.25rem 0.75rem',
                      borderRadius: '999px'
                    }}>
                      → Assigned to: {getGroupAssignment(parseInt(child.age))}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', padding: '1rem', background: '#1a56db',
              color: 'white', border: 'none', borderRadius: '8px',
              fontSize: '1.1rem', fontWeight: '600',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
              marginBottom: '2rem'
            }}
          >
            {loading ? 'Saving...' : 'Save Profile'}
          </button>

        </form>
      </div>
    </div>
  )
}

const cardStyle = {
  background: 'white',
  padding: '1.5rem',
  borderRadius: '12px',
  marginBottom: '1rem',
  boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
}

const headingStyle = {
  margin: '0 0 1rem',
  color: '#111827'
}

const labelStyle = {
  display: 'block',
  marginBottom: '0.4rem',
  color: '#374151',
  fontWeight: '500',
  fontSize: '0.9rem'
}

const inputStyle = {
  width: '100%',
  padding: '0.75rem',
  border: '1px solid #d1d5db',
  borderRadius: '8px',
  fontSize: '1rem',
  boxSizing: 'border-box'
}