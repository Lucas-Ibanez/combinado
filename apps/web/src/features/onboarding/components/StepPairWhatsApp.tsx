import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { supabase } from '@/lib/supabase'

interface Props {
  protectedPersonId: string
  onComplete: () => void
  onSkip: () => void
}

export default function StepPairWhatsApp({ protectedPersonId, onComplete, onSkip }: Props) {
  const [pairingStarted, setPairingStarted] = useState(false)

  const pairMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('pair-device', {
        body: { protected_person_id: protectedPersonId },
      })
      if (error) throw new Error(error.message ?? 'Erro ao iniciar pareamento')
      if (!data?.ok) throw new Error(data?.error ?? 'Erro desconhecido')
      return data
    },
    onSuccess: () => {
      setPairingStarted(true)
    },
  })

  const { data: status } = useQuery({
    queryKey: ['pairing-status', protectedPersonId],
    queryFn: async () => {
      const { data } = await supabase
        .from('protected_persons')
        .select('baileys_status, baileys_pairing_qr')
        .eq('id', protectedPersonId)
        .single()
      return data
    },
    enabled: pairingStarted,
    refetchInterval: pairingStarted ? 3000 : false,
  })

  const isPaired = status?.baileys_status === 'paired'
  const qrCode = status?.baileys_pairing_qr

  if (isPaired) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <div className="w-14 h-14 rounded-full bg-success-surface flex items-center justify-center mx-auto mb-3">
            <span className="text-2xl">✅</span>
          </div>
          <h2 className="text-xl font-bold text-text">WhatsApp Pareado!</h2>
          <p className="text-sm text-text-muted mt-1">
            O WhatsApp do protegido foi conectado com sucesso.
          </p>
        </div>
        <Button className="w-full" onClick={onComplete}>
          Continuar
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="text-center mb-2">
        <div className="w-14 h-14 rounded-full bg-brand-surface flex items-center justify-center mx-auto mb-3">
          <span className="text-2xl">📱</span>
        </div>
        <h2 className="text-xl font-bold text-text">Parear WhatsApp</h2>
        <p className="text-sm text-text-muted mt-1">
          Conecte o WhatsApp do protegido para monitorar mensagens suspeitas
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Como funciona</CardTitle>
          <CardDescription>
            O pareamento deve ser feito presencialmente, com o celular do protegido em mãos
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <ol className="space-y-2 text-sm text-text-muted">
            <li className="flex gap-2">
              <span className="font-bold text-brand shrink-0">1.</span>
              Clique em "Iniciar Pareamento" abaixo
            </li>
            <li className="flex gap-2">
              <span className="font-bold text-brand shrink-0">2.</span>
              No celular do protegido, abra o WhatsApp
            </li>
            <li className="flex gap-2">
              <span className="font-bold text-brand shrink-0">3.</span>
              Vá em Configurações &gt; Dispositivos Conectados &gt; Conectar Dispositivo
            </li>
            <li className="flex gap-2">
              <span className="font-bold text-brand shrink-0">4.</span>
              Escaneie o QR Code que aparecerá aqui
            </li>
          </ol>
        </CardContent>
      </Card>

      {pairingStarted && qrCode && (
        <Card>
          <CardContent className="pt-6 flex flex-col items-center">
            <p className="text-sm font-medium text-text mb-3">Escaneie este QR Code:</p>
            <div className="bg-white p-4 rounded-lg border border-border">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrCode)}`}
                alt="QR Code para pareamento"
                className="w-48 h-48"
              />
            </div>
            <p className="text-xs text-text-muted mt-3">Aguardando conexão...</p>
          </CardContent>
        </Card>
      )}

      {pairingStarted && !qrCode && (
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-sm text-text-muted">Gerando QR Code...</p>
          </CardContent>
        </Card>
      )}

      {pairMutation.error && (
        <p className="text-sm text-danger text-center">
          {pairMutation.error.message}
        </p>
      )}

      {!pairingStarted && (
        <Button
          className="w-full"
          onClick={() => pairMutation.mutate()}
          disabled={pairMutation.isPending}
        >
          {pairMutation.isPending ? 'Iniciando...' : 'Iniciar Pareamento'}
        </Button>
      )}

      <Button variant="ghost" className="w-full" onClick={onSkip}>
        Pular por agora
      </Button>
    </div>
  )
}
