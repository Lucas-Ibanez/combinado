// Nomes das filas do MVP (batem com as criadas em T1.5).
export type QueueName = 'risk_queue' | 'command_outbox' | 'delivery_queue'

const dlqMap: Record<QueueName, string> = {
  risk_queue: 'risk_queue_dlq',
  command_outbox: 'command_outbox_dlq',
  delivery_queue: 'delivery_queue_dlq',
}

export function dlqOf(queueName: QueueName): string {
  return dlqMap[queueName]
}

// Mensagem consumida da fila. `msgId` é o handle para ack/deadletter;
// o consumidor DEVE usar o ID+corpo para garantir idempotência de sua ação.
export interface QueueMessage<T> {
  msgId: number
  body: T
  readCount: number
  enqueuedAt: string
}

export interface ConsumeOptions {
  // Janela em segundos em que a mensagem fica invisível para outros consumidores
  // depois do read. Default: 30s.
  visibilitySeconds?: number
  // Quantas mensagens ler numa chamada. Default: 1.
  batchSize?: number
}

// A interface é o contrato — todos os módulos importam ISSO, não a implementação.
// Trocar PGMQ por SQS/NATS no futuro = escrever outra implementação; os papéis
// (Gateway, Risk, Orchestrator) não mudam.
export interface Queue {
  enqueue<T>(queueName: QueueName, message: T): Promise<number>
  consume<T>(queueName: QueueName, opts?: ConsumeOptions): Promise<QueueMessage<T>[]>
  ack(queueName: QueueName, msgId: number): Promise<void>
  deadletter<T>(queueName: QueueName, msgId: number, message: T): Promise<void>
}
