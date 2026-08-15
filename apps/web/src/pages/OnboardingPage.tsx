import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import StepCircleSetup from '@/features/onboarding/components/StepCircleSetup'
import StepPairWhatsApp from '@/features/onboarding/components/StepPairWhatsApp'
import StepChannelCeremony from '@/features/onboarding/components/StepChannelCeremony'
import StepTestNotification from '@/features/onboarding/components/StepTestNotification'
import StepComplete from '@/features/onboarding/components/StepComplete'
import EmotionalModeFrame from '@/components/common/EmotionalModeFrame'
import { Check, Circle } from 'lucide-react'

const STEP_LABELS = [
  'Círculo',
  'WhatsApp',
  'Canal',
  'Notificações',
  'Conclusão',
]

export default function OnboardingPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [protectedPersonId, setProtectedPersonId] = useState<string | null>(null)
  const [protectedName, setProtectedName] = useState('')

  function handleCircleComplete(result: { protectedPersonId: string; protectedName: string }) {
    setProtectedPersonId(result.protectedPersonId)
    setProtectedName(result.protectedName)
    setStep(1)
  }

  function handleFinish() {
    navigate('/', { replace: true })
  }

  return (
    <EmotionalModeFrame mode="normal" className="min-h-screen">
      <div className="max-w-md mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-lg font-bold text-brand text-center">Combinado</h1>
          <p className="text-xs text-text-muted text-center mt-0.5">Configurar proteção</p>
        </div>

        {/* Stepper */}
        <ol className="flex items-start gap-1 mb-8" aria-label="Progresso da configuração">
          {STEP_LABELS.map((label, i) => (
            <li
              key={label}
              className="flex flex-1 flex-col items-center"
              aria-current={i === step ? 'step' : undefined}
            >
              <span
                className={`mb-1.5 flex h-7 w-7 items-center justify-center rounded-full border text-xs font-bold transition-colors ${
                  i < step
                    ? 'border-brand bg-brand text-brand-foreground'
                    : i === step
                      ? 'border-2 border-brand bg-brand-surface text-brand-dark'
                      : 'border-border bg-surface text-text-muted'
                }`}
                aria-label={i < step ? `Etapa ${i + 1} concluída` : i === step ? `Etapa ${i + 1} atual` : `Etapa ${i + 1} pendente`}
              >
                {i < step ? (
                  <Check className="h-4 w-4" aria-hidden="true" />
                ) : i === step ? (
                  <Circle className="h-3 w-3 fill-current" aria-hidden="true" />
                ) : (
                  i + 1
                )}
              </span>
              <span
                className={`text-[10px] leading-tight ${
                  i === step ? 'text-brand font-medium' : 'text-text-muted'
                }`}
              >
                {label}
              </span>
            </li>
          ))}
        </ol>

        {/* Steps */}
        {step === 0 && (
          <StepCircleSetup
            onComplete={(result) => {
              handleCircleComplete(result)
            }}
          />
        )}

        {step === 1 && protectedPersonId && (
          <StepPairWhatsApp
            protectedPersonId={protectedPersonId}
            onComplete={() => setStep(2)}
            onSkip={() => setStep(2)}
          />
        )}

        {step === 2 && (
          <StepChannelCeremony
            protectedName={protectedName}
            onComplete={() => setStep(3)}
            onSkip={() => setStep(3)}
          />
        )}

        {step === 3 && (
          <StepTestNotification
            onComplete={() => setStep(4)}
            onSkip={() => setStep(4)}
          />
        )}

        {step === 4 && protectedPersonId && (
          <StepComplete
            protectedPersonId={protectedPersonId}
            onFinish={handleFinish}
          />
        )}
      </div>
    </EmotionalModeFrame>
  )
}
