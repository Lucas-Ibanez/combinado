import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { QRCodeSVG } from 'qrcode.react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { supabase } from '@/lib/supabase'
import { CheckCircle2, CircleAlert, Loader2, Smartphone } from 'lucide-react'
import { SystemStateNotice } from '@/components/common/SystemStatus'

interface Props {
  protectedPersonId: string
  onComplete: () => void
  onSkip: () => void
}

export default function StepPairWhatsApp({ protectedPersonId, onComplete, onSkip }: Props) {
  const [debugInfo, setDebugInfo] = useState('')

  const { data: status, error: pollError } = useQuery({
    queryKey: ['pairing-status', protectedPersonId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('protected_persons')
        .select('baileys_status, baileys_pairing_qr')
        .eq('id', protectedPersonId)
        .maybeSingle()
      if (error) {
        setDebugInfo(`err: ${error.code} ${error.message}`)
        throw error
      }
      if (!data) {
        setDebugInfo(`no row for ${protectedPersonId.slice(0, 8)}`)
        return null
      }
      setDebugInfo(`st=${data.baileys_status} qr=${data.baileys_pairing_qr ? data.baileys_pairing_qr.length + 'ch' : 'null'} id=${protectedPersonId.slice(0, 8)}`)
      return data
    },
    refetchInterval: 2000,
    staleTime: 0,
    retry: 1,
  })

  const pairMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('pair-device', {
        body: { protected_person_id: protectedPersonId },
      })
      if (error) throw new Error(error.message ?? 'Erro ao iniciar pareamento')
      if (!data?.ok) throw new Error(data?.error ?? 'Erro desconhecido')
      return data
    },
  })

  const isPaired = status?.baileys_status === 'paired'
  const isPairing = status?.baileys_status === 'pairing' || status?.baileys_status === 'pairing_requested'
  const qrCode = status?.baileys_pairing_qr
  const pairingStarted = pairMutation.isSuccess || isPairing

  if (isPaired) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <div className="w-14 h-14 rounded-full bg-success-surface flex items-center justify-center mx-auto mb-3">
            <CheckCircle2 className="h-7 w-7 text-success-dark" aria-hidden="true" />
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
          <Smartphone className="h-7 w-7 text-brand" aria-hidden="true" />
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
              <QRCodeSVG
                value={qrCode}
                size={192}
                level="M"
              />
            </div>
            <p className="mt-3 flex items-center gap-2 text-xs text-text-muted" role="status">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              Aguardando conexão...
            </p>
          </CardContent>
        </Card>
      )}

      {pairingStarted && !qrCode && (
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="flex items-center justify-center gap-2 text-sm text-text-muted" role="status">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              Gerando QR Code...
            </p>
          </CardContent>
        </Card>
      )}

      {debugInfo && (
        <p className="text-[10px] text-text-muted text-center font-mono break-all">
          [debug] {debugInfo}
        </p>
      )}

      {(pairMutation.error || pollError) && (
        <SystemStateNotice
          icon={CircleAlert}
          title="Erro no pareamento"
          description={pairMutation.error?.message ?? (pollError as Error)?.message ?? 'Erro desconhecido'}
          tone="attention"
          actionLabel="Tentar novamente"
          onAction={() => pairMutation.mutate()}
          live="assertive"
        />
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
