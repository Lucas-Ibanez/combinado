import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'

function App() {
  const [status, setStatus] = useState('checking...')

  useEffect(() => {
    supabase.auth.getSession().then(({ error }) => {
      setStatus(error ? `error: ${error.message}` : 'connected')
    })
  }, [])

  return (
    <div className="min-h-screen bg-brand flex flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-3xl font-bold text-white font-sans">Combinado</h1>
      <p className="text-white/80">Proteção familiar contra golpes</p>
      <p className="text-sm text-white/60">Supabase: {status}</p>
      <Button variant="outline">Teste</Button>
    </div>
  )
}

export default App
