import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Eye, EyeOff, Lock, Mail, ArrowLeft } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'

export default function LoginPage() {
  const { profile, signIn, resetPassword } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [mode, setMode] = useState<'login' | 'reset'>('login')

  if (profile) return <Navigate to="/dashboard" replace />

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const err = await signIn(email, password)
    setLoading(false)
    if (err) setError('Correo o contraseña incorrectos.')
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const err = await resetPassword(email)
    setLoading(false)
    if (err) setError('No se pudo enviar el correo de recuperación.')
    else setMessage('Enlace enviado. Revisa tu bandeja de entrada.')
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', paddingLeft: '40px', paddingRight: '16px',
    paddingTop: '11px', paddingBottom: '11px',
    borderRadius: '8px', border: '1.5px solid #e2e8f0',
    fontSize: '14px', color: '#2d3748', outline: 'none',
    backgroundColor: '#f8fafc', boxSizing: 'border-box',
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(160deg, #081b40 0%, #0D2D6B 60%, #16468E 100%)',
      padding: '16px', fontFamily: "'Inter', system-ui, sans-serif",
    }}>
      <div style={{
        backgroundColor: 'white', borderRadius: '16px',
        boxShadow: '0 25px 60px rgba(0,0,0,0.4)',
        width: '100%', maxWidth: '400px', overflow: 'hidden',
      }}>
        {/* Header azul con logo */}
        <div style={{
          background: 'linear-gradient(135deg, #0D2D6B 0%, #16468E 100%)',
          padding: '32px 32px 24px',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px',
        }}>
          <img
            src={`${import.meta.env.BASE_URL}logo-white.png`}
            alt="CAC Santa Bárbara"
            style={{ height: '56px', width: 'auto', objectFit: 'contain' }}
          />
          <div style={{ textAlign: 'center' }}>
            <h1 style={{ color: 'white', fontSize: '18px', fontWeight: 700, margin: 0, letterSpacing: '0.3px' }}>
              BI Gestión Clínica
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px', margin: '4px 0 0' }}>
              Clínica de Alta Complejidad Santa Bárbara
            </p>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '28px 32px 32px' }}>
          {mode === 'login' ? (
            <>
              <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#0D2D6B', marginBottom: '20px', textAlign: 'center' }}>
                Iniciar Sesión
              </h2>

              <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: '#4a5568' }}>Correo electrónico</label>
                  <div style={{ position: 'relative' }}>
                    <Mail style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', width: '16px', height: '16px', color: '#9ca3af' }} />
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                      placeholder="usuario@cacsantabarbara.co" required style={inputStyle} />
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: '#4a5568' }}>Contraseña</label>
                  <div style={{ position: 'relative' }}>
                    <Lock style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', width: '16px', height: '16px', color: '#9ca3af' }} />
                    <input type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••" required style={{ ...inputStyle, paddingRight: '44px' }} />
                    <button type="button" onClick={() => setShowPass(!showPass)}
                      style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', display: 'flex', padding: 0 }}>
                      {showPass ? <EyeOff style={{ width: '16px', height: '16px' }} /> : <Eye style={{ width: '16px', height: '16px' }} />}
                    </button>
                  </div>
                </div>

                {error && (
                  <div style={{ backgroundColor: '#fff5f5', border: '1px solid #fed7d7', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: '#c53030' }}>
                    {error}
                  </div>
                )}

                <button type="submit" disabled={loading}
                  style={{
                    width: '100%', padding: '12px', borderRadius: '8px',
                    background: loading ? '#7494d4' : 'linear-gradient(135deg, #0D2D6B 0%, #16468E 100%)',
                    color: 'white', fontWeight: 700, fontSize: '15px',
                    border: 'none', cursor: loading ? 'not-allowed' : 'pointer', marginTop: '4px',
                  }}>
                  {loading ? 'Ingresando...' : 'Ingresar'}
                </button>

                <button type="button" onClick={() => { setMode('reset'); setError(''); setMessage('') }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#16468E', fontSize: '13px', textDecoration: 'underline', textAlign: 'center' }}>
                  ¿Olvidaste tu contraseña?
                </button>
              </form>
            </>
          ) : (
            <>
              <button onClick={() => { setMode('login'); setError(''); setMessage('') }}
                style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', cursor: 'pointer', color: '#718096', fontSize: '13px', marginBottom: '16px', padding: 0 }}>
                <ArrowLeft style={{ width: '14px', height: '14px' }} /> Volver al inicio de sesión
              </button>

              <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#0D2D6B', marginBottom: '8px' }}>Recuperar contraseña</h2>
              <p style={{ fontSize: '13px', color: '#718096', marginBottom: '20px', lineHeight: 1.5 }}>
                Ingresa tu correo y te enviaremos un enlace para restablecer tu contraseña.
              </p>

              <form onSubmit={handleReset} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: '#4a5568' }}>Correo electrónico</label>
                  <div style={{ position: 'relative' }}>
                    <Mail style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', width: '16px', height: '16px', color: '#9ca3af' }} />
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                      placeholder="usuario@cacsantabarbara.co" required style={inputStyle} />
                  </div>
                </div>

                {error && (
                  <div style={{ backgroundColor: '#fff5f5', border: '1px solid #fed7d7', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: '#c53030' }}>
                    {error}
                  </div>
                )}
                {message && (
                  <div style={{ backgroundColor: '#f0fff4', border: '1px solid #9ae6b4', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: '#276749' }}>
                    ✓ {message}
                  </div>
                )}

                <button type="submit" disabled={loading || !!message}
                  style={{
                    width: '100%', padding: '12px', borderRadius: '8px',
                    background: (loading || !!message) ? '#7494d4' : 'linear-gradient(135deg, #0D2D6B 0%, #16468E 100%)',
                    color: 'white', fontWeight: 700, fontSize: '15px', border: 'none',
                    cursor: (loading || !!message) ? 'not-allowed' : 'pointer',
                  }}>
                  {loading ? 'Enviando...' : 'Enviar enlace de recuperación'}
                </button>
              </form>
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '0 32px 20px', textAlign: 'center' }}>
          <p style={{ fontSize: '11px', color: '#a0aec0', margin: 0 }}>
            © {new Date().getFullYear()} Clínica Santa Bárbara — Sistema Interno
          </p>
        </div>
      </div>
    </div>
  )
}
