import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import StepCircleSetup from '@/features/onboarding/components/StepCircleSetup'
import StepPairWhatsApp from '@/features/onboarding/components/StepPairWhatsApp'
import StepChannelCeremony from '@/features/onboarding/components/StepChannelCeremony'
import StepTestNotification from '@/features/onboarding/components/StepTestNotification'
import StepComplete from '@/features/onboarding/components/StepComplete'
import EmotionalModeFrame from '@/components/common/EmotionalModeFrame'

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
        <div className="flex items-center gap-1 mb-8">
          {STEP_LABELS.map((label, i) => (
            <div key={label} className="flex-1 flex flex-col items-center">
              <div
                className={`w-full h-1.5 rounded-full mb-1.5 transition-colors ${
                  i <= step ? 'bg-brand' : 'bg-border'
                }`}
              />
              <span
                className={`text-[10px] leading-tight ${
                  i === step ? 'text-brand font-medium' : 'text-text-muted'
                }`}
              >
                {label}
              </span>
            </div>
          ))}
        </div>

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
