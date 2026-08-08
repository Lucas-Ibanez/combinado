import type { MinimalEvent } from '@combinado/shared'

// Interface do classificador — pronta para trocar a implementação por um modelo
// treinado quando houver dados. O contrato é: recebe um MinimalEvent (sinais,
// nunca texto), devolve um score em [0, 1] e a versão do classificador.
export interface ClassifierResult {
  score: number
  version: string
}

export interface Classifier {
  classify(event: MinimalEvent): ClassifierResult
}

// Pesos calibrados à mão para o MVP. Cada sinal tem um peso proporcional à
// frequência com que aparece em golpes reais de impersonação por WhatsApp.
// Combinações multiplicativas (money+urgency) já são tratadas pelas regras
// (T6.2); o classificador atua nos casos que as regras não fecharam — por isso
// os pesos são aditivos e mais conservadores.
const SIGNAL_WEIGHTS: Record<string, number> = {
  pix_mention:          0.25,
  urgency_language:     0.20,
  impersonation_pattern: 0.20,
  secrecy_demand:       0.20,
  device_excuse:        0.18,
  unknown_sender:       0.15,
  voice_note:           0.10,
  link_suspicious:      0.10,
  forwarded:            0.05,
}

const CLASSIFIER_VERSION = 'weighted-sum-v1'

function clamp(v: number, min: number, max: number): number {
  return Math.min(Math.max(v, min), max)
}

export class WeightedSumClassifier implements Classifier {
  classify(event: MinimalEvent): ClassifierResult {
    let raw = 0

    for (const [signal, weight] of Object.entries(SIGNAL_WEIGHTS)) {
      if (event.signals[signal] === true) {
        raw += weight
      }
    }

    const score = clamp(raw, 0, 1)

    return { score, version: CLASSIFIER_VERSION }
  }
}

export const classifier: Classifier = new WeightedSumClassifier()
