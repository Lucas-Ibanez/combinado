import type { Tables, TablesInsert } from './db-types'

// ---------------------------------------------------------------------------
// Aliases de conveniência para as entidades principais
// ---------------------------------------------------------------------------
export type Family = Tables<'families'>
export type Guardian = Tables<'guardians'>
export type ProtectedPerson = Tables<'protected_persons'>
export type GuardianLink = Tables<'guardian_links'>
export type SecretFamily = Tables<'secrets_family'>
export type Incident = Tables<'incidents'>
export type IncidentDelivery = Tables<'incident_deliveries'>
export type RiskEvent = Tables<'risk_events'>
export type Simulation = Tables<'simulations'>
export type AuditLogEntry = Tables<'audit_log'>

// ---------------------------------------------------------------------------
// Enums derivados dos CHECK constraints do schema
// ---------------------------------------------------------------------------
export type IncidentStatus =
  | 'open'
  | 'notifying'
  | 'acknowledged'
  | 'escalated'
  | 'expired'
  | 'closed'

export type Severity = 'low' | 'medium' | 'high' | 'critical'

export type DeliveryChannel = 'push' | 'whatsapp' | 'sms' | 'call'

export type BaileysStatus = 'unpaired' | 'pairing' | 'paired' | 'disconnected'

export type SimulationStatus = 'scheduled' | 'sent' | 'responded' | 'expired'

export type GuardianRole = 'primary' | 'secondary'

export type ActorType = 'guardian' | 'system' | 'service'

// ---------------------------------------------------------------------------
// Comandos — payloads que o app envia via Edge Functions (command_outbox)
// ---------------------------------------------------------------------------
export interface StartSimulationCommand {
  type: 'start_simulation'
  guardian_id: string
  protected_person_id: string
  family_id: string
  scheduled_at?: string
}

export interface AcknowledgeIncidentCommand {
  type: 'acknowledge_incident'
  incident_id: string
  guardian_id: string
}

export interface PairDeviceCommand {
  type: 'pair_device'
  protected_person_id: string
  guardian_id: string
  family_id: string
}

export type Command =
  | StartSimulationCommand
  | AcknowledgeIncidentCommand
  | PairDeviceCommand

// ---------------------------------------------------------------------------
// Eventos de risco — sinais emitidos pelo Risk Worker (risk_queue)
// ---------------------------------------------------------------------------
export interface RiskSignals {
  pix_mention?: boolean
  urgency_language?: boolean
  unknown_sender?: boolean
  voice_note?: boolean
  link_suspicious?: boolean
  impersonation_pattern?: boolean
  [key: string]: boolean | undefined
}

export interface RiskQueueMessage {
  family_id: string
  protected_person_id: string
  signals: RiskSignals
  source_contact_hash?: string
  timestamp: string
}

// ---------------------------------------------------------------------------
// Evento mínimo — o que o gateway publica em risk_queue depois de normalizar
// uma mensagem recebida. Contém SINAIS (flags e metadados), NUNCA o conteúdo
// bruto. É a materialização da privacidade em T5.4/F11: quem processar isso
// pra frente (Risk Worker, LLM, logs) não tem acesso ao texto da conversa.
// ---------------------------------------------------------------------------
export type MinimalEventMessageType =
  | 'text'
  | 'audio'
  | 'image'
  | 'video'
  | 'document'
  | 'sticker'
  | 'other'

export interface MinimalEvent {
  // Idempotência: msg id do WhatsApp — o mesmo evento nunca vira dois na fila
  event_id: string
  family_id: string
  protected_person_id: string
  // JID do terceiro (não do protegido). O risk worker precisa desse valor
  // para casar contra a lista de contatos e olhar histórico.
  sender_jid: string
  // Tipo do payload — decide qual pipeline o risk aplica.
  message_type: MinimalEventMessageType
  // Sinal de tamanho — útil para heurísticas (ex.: "mensagem muito longa
  // e cheia de urgência"), NÃO o texto.
  text_length: number | null
  signals: RiskSignals
  // Momento em que o gateway recebeu o evento (ISO). Diferente do
  // messageTimestamp do WhatsApp — este é o "observado por nós".
  captured_at: string
  // messageTimestamp do WhatsApp (segundos) — para reconstituir ordem
  // relativa e detectar burst.
  wa_timestamp: number | null
}

// ---------------------------------------------------------------------------
// Entrega — passos da escada publicados na delivery_queue
// ---------------------------------------------------------------------------
export interface DeliveryStep {
  incident_id: string
  channel: DeliveryChannel
  target_guardian_id: string
  target_phone?: string
  step_order: number
  escalation_deadline_seconds: number
}

// ---------------------------------------------------------------------------
// Helpers de inserção (quando precisar criar registros)
// ---------------------------------------------------------------------------
export type NewIncident = TablesInsert<'incidents'>
export type NewDelivery = TablesInsert<'incident_deliveries'>
export type NewRiskEvent = TablesInsert<'risk_events'>
export type NewSimulation = TablesInsert<'simulations'>
export type NewAuditLog = TablesInsert<'audit_log'>
