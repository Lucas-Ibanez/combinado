import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

function App() {
  const [status, setStatus] = useState('checking...')

  useEffect(() => {
    supabase.auth.getSession().then(({ error }) => {
      setStatus(error ? `error: ${error.message}` : 'connected')
    })
  }, [])

  return (
    <div className="min-h-screen bg-surface p-8 font-sans">
      <h1 className="text-3xl font-bold text-text mb-2">Combinado — Design Tokens</h1>
      <p className="text-text-muted mb-6">Supabase: {status}</p>

      <div className="grid grid-cols-1 gap-4 max-w-md">
        <div className="rounded-lg p-4 bg-brand text-brand-foreground">
          bg-brand (modo normal)
        </div>
        <div className="rounded-lg p-4 bg-brand-light text-brand-foreground">
          bg-brand-light
        </div>
        <div className="rounded-lg p-4 bg-brand-surface text-text border border-border">
          bg-brand-surface
        </div>

        <div className="rounded-lg p-4 bg-attention text-attention-foreground">
          bg-attention (modo atenção)
        </div>
        <div className="rounded-lg p-4 bg-attention-surface text-text border border-border">
          bg-attention-surface
        </div>

        <div className="rounded-lg p-4 bg-danger text-danger-foreground">
          bg-danger (SÓ modo incidente)
        </div>
        <div className="rounded-lg p-4 bg-danger-surface text-text border border-border">
          bg-danger-surface
        </div>

        <div className="rounded-lg p-4 bg-success text-white">
          bg-success
        </div>

        <div className="rounded-lg p-4 bg-surface-muted text-text-muted border border-border">
          bg-surface-muted + text-text-muted
        </div>
      </div>
    </div>
  )
}

export default App
