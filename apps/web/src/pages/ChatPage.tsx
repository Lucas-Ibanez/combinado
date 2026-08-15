import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { useCheckMessage, type CheckMessageResult } from '@/features/chat'
import { CheckCircle2, CircleAlert, ShieldAlert } from 'lucide-react'
import { SystemStateNotice, SystemStatusBadge } from '@/components/common/SystemStatus'

const SIGNAL_LABELS: Record<string, string> = {
  pix_mention: 'Pix / dinheiro / transferência',
  urgency_language: 'Linguagem de urgência',
  impersonation_pattern: 'Menção a relação familiar',
  secrecy_demand: 'Pedido de sigilo',
  device_excuse: 'Troca de aparelho / número',
  link_suspicious: 'Link encurtado suspeito',
  voice_note: 'Mensagem de áudio',
  unknown_sender: 'Remetente desconhecido',
  forwarded: 'Mensagem encaminhada',
}

function RiskBadge({ level }: { level: string }) {
  if (level === 'dangerous') {
    return <SystemStatusBadge icon={ShieldAlert} label="Alto risco" tone="attention" />
  }
  if (level === 'suspicious') {
    return <SystemStatusBadge icon={CircleAlert} label="Suspeito" tone="attention" />
  }
  return <SystemStatusBadge icon={CheckCircle2} label="Sem padrões de golpe" tone="normal" />
}

function ResultCard({ result }: { result: CheckMessageResult }) {
  const activeSignals = Object.entries(result.signals)
    .filter(([, v]) => v)
    .map(([k]) => ({ key: k, label: SIGNAL_LABELS[k] ?? k }))

  return (
    <Card className={
      result.risk_level === 'dangerous'
        ? 'border-attention border-2'
        : result.risk_level === 'suspicious'
          ? 'border-attention border-2'
          : 'border-success border-2'
    }>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Resultado da Verificação</CardTitle>
          <RiskBadge level={result.risk_level} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {activeSignals.length > 0 && (
          <div>
            <p className="text-xs font-medium text-text-muted mb-2">Sinais detectados:</p>
            <div className="flex flex-wrap gap-1.5">
              {activeSignals.map((s) => (
                <span
                  key={s.key}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-2 py-1 text-xs text-text"
                >
                  <CircleAlert className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  {s.label}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="bg-surface rounded-lg p-3">
          <p className="text-sm text-text whitespace-pre-line">{result.advice}</p>
        </div>
      </CardContent>
    </Card>
  )
}

export default function ChatPage() {
  const [text, setText] = useState('')
  const [result, setResult] = useState<CheckMessageResult | null>(null)
  const checkMutation = useCheckMessage()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim()) return
    setResult(null)
    checkMutation.mutate(text.trim(), {
      onSuccess: (data) => setResult(data),
    })
  }

  function handleClear() {
    setText('')
    setResult(null)
    checkMutation.reset()
  }

  return (
    <div className="p-6 space-y-6 max-w-lg mx-auto">
      <div>
        <h1 className="text-xl font-bold text-text">Chat de Verificação</h1>
        <p className="text-sm text-text-muted mt-1">
          Cole aqui uma mensagem suspeita para verificar se é golpe
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Como usar</CardTitle>
          <CardDescription>Dois canais disponíveis:</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex gap-2 items-start">
            <span className="text-sm shrink-0">1.</span>
            <p className="text-sm text-text-muted">
              <strong>WhatsApp:</strong> Encaminhe a mensagem suspeita para o número
              do Combinado (+55 11 91732-1422) e receba a avaliação direto no chat.
            </p>
          </div>
          <div className="flex gap-2 items-start">
            <span className="text-sm shrink-0">2.</span>
            <p className="text-sm text-text-muted">
              <strong>Aqui no app:</strong> Cole o texto da mensagem abaixo para uma análise completa.
            </p>
          </div>
        </CardContent>
      </Card>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label htmlFor="check-text" className="text-sm font-medium text-text block mb-1.5">
            Mensagem para verificar
          </label>
          <textarea
            id="check-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Cole aqui a mensagem que recebeu..."
            rows={5}
            maxLength={5000}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand resize-none"
          />
          <p className="text-xs text-text-muted mt-1 text-right">
            {text.length} / 5000
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            type="submit"
            className="flex-1"
            disabled={!text.trim() || checkMutation.isPending}
          >
            {checkMutation.isPending ? 'Analisando...' : 'Verificar Mensagem'}
          </Button>
          {(result || text) && (
            <Button type="button" variant="outline" onClick={handleClear}>
              Limpar
            </Button>
          )}
        </div>
      </form>

      {checkMutation.error && (
        <SystemStateNotice
          icon={CircleAlert}
          title="Não foi possível verificar a mensagem"
          description={checkMutation.error.message}
          tone="attention"
          actionLabel="Tentar novamente"
          onAction={() => text.trim() && checkMutation.mutate(text.trim(), { onSuccess: setResult })}
          live="assertive"
        />
      )}

      {result && <ResultCard result={result} />}

      <Card className="bg-surface">
        <CardContent className="pt-4 pb-4">
          <p className="text-xs text-text-muted text-center">
            O Combinado analisa padrões de texto em português brasileiro. Nenhuma ferramenta
            é infalível — na dúvida, <strong>peça a senha combinada</strong> mesmo assim.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
