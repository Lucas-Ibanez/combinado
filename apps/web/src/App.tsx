import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Drawer } from 'vaul'

function App() {
  const [open, setOpen] = useState(false)

  return (
    <div className="min-h-screen bg-brand flex flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-3xl font-bold text-white font-sans">Combinado</h1>
      <p className="text-white/80">Proteção familiar contra golpes</p>

      <Button variant="outline" onClick={() => setOpen(true)}>
        Abrir Drawer
      </Button>

      <Drawer.Root open={open} onOpenChange={setOpen}>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 bg-black/40" />
          <Drawer.Content className="bg-white flex flex-col rounded-t-xl h-fit fixed bottom-0 left-0 right-0 outline-none">
            <div className="p-4 bg-white rounded-t-xl flex-1">
              <div className="mx-auto w-12 h-1.5 flex-shrink-0 rounded-full bg-neutral-300 mb-8" />
              <div className="max-w-md mx-auto">
                <Drawer.Title className="font-medium text-lg mb-2">Vaul Drawer</Drawer.Title>
                <p className="text-neutral-600 mb-4">O drawer do Vaul está funcionando.</p>
                <Button onClick={() => setOpen(false)} className="w-full">Fechar</Button>
              </div>
            </div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    </div>
  )
}

export default App
