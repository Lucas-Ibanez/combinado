import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { supabase } from '@/lib/supabase'

interface Props {
  protectedPersonId: string
  onFinish: () => void
}

export default function StepComplete({ protectedPersonId, onFinish }: Props) {
  const [simulationSent, setSimulationSent] = useState(false)

  const simulationMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('start-simulation', {
        body: { protected_person_id: protectedPersonId },
      })
      if (error) throw new Error(error.message ?? 'Erro ao iniciar simulação')
      if (!data?.ok) throw new Error(data?.error ?? 'Erro desconhecido')
      return data
    },
    onSuccess: () => {
      setSimulationSent(true)
    },
  })

  return (
    <div className="space-y-6">
      <div className="text-center mb-2">
        <div className="w-14 h-14 rounded-full bg-success-surface flex items-center justify-center mx-auto mb-3">
          <span className="text-2xl">🎉</span>
        </div>
        <h2 className="text-xl font-bold text-text">Tudo Pronto!</h2>
        <p className="text-sm text-text-muted mt-1">
          Seu círculo de proteção foi configurado com sucesso
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="text-success text-lg">✓</span>
              <span className="text-sm text-text">Família criada</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-success text-lg">✓</span>
              <span className="text-sm text-text">Protegido adicionado</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-success text-lg">✓</span>
              <span className="text-sm text-text">Senha combinada definida</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {!simulationSent && (
        <Card>
          <CardContent className="pt-6 space-y-3">
            <p className="text-sm text-text-muted">
              Recomendamos enviar uma <strong>simulação de teste</strong> para verificar que tudo funciona.
              O protegido receberá uma mensagem simulada e você poderá praticar a resposta correta.
            </p>
            {simulationMutation.error && (
              <p className="text-sm text-danger">
                {simulationMutation.error.message}
              </p>
            )}
            <Button
              variant="outline"
              className="w-full"
              onClick={() => simulationMutation.mutate()}
              disabled={simulationMutation.isPending}
            >
              {simulationMutation.isPending ? 'Enviando...' : 'Enviar 1ª Simulação'}
            </Button>
          </CardContent>
        </Card>
      )}

      {simulationSent && (
        <Card className="border-success-surface border-2">
          <CardContent className="pt-6 text-center">
            <p className="text-sm text-success-dark">
              Simulação enviada! O protegido receberá uma mensagem de teste pelo WhatsApp.
            </p>
          </CardContent>
        </Card>
      )}

      <Button className="w-full" onClick={onFinish}>
        Ir para o Painel
      </Button>
    </div>
  )
}
