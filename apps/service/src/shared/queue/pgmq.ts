import { db } from '../db/index.js'
import type { Json } from '@combinado/shared'
import {
  dlqOf,
  type ConsumeOptions,
  type Queue,
  type QueueMessage,
  type QueueName,
} from './types.js'

// Implementação da interface Queue sobre PGMQ, via os wrappers públicos
// queue_send / queue_read / queue_delete / queue_deadletter.
// Este é o ÚNICO ponto do código que sabe que a fila é PGMQ.
class PgmqQueue implements Queue {
  async enqueue<T>(queueName: QueueName, message: T): Promise<number> {
    const { data, error } = await db.rpc('queue_send', {
      queue_name: queueName,
      message: message as Json,
    })
    if (error) {
      throw new Error(`enqueue(${queueName}) falhou: ${error.message}`)
    }
    if (data == null) {
      throw new Error(`enqueue(${queueName}) retornou null`)
    }
    return data
  }

  async consume<T>(
    queueName: QueueName,
    opts: ConsumeOptions = {},
  ): Promise<QueueMessage<T>[]> {
    const { data, error } = await db.rpc('queue_read', {
      queue_name: queueName,
      visibility_seconds: opts.visibilitySeconds ?? 30,
      batch_size: opts.batchSize ?? 1,
    })
    if (error) {
      throw new Error(`consume(${queueName}) falhou: ${error.message}`)
    }
    return (data ?? []).map((row) => ({
      msgId: row.msg_id,
      body: row.message as T,
      readCount: row.read_ct,
      enqueuedAt: row.enqueued_at,
    }))
  }

  async ack(queueName: QueueName, msgId: number): Promise<void> {
    const { error } = await db.rpc('queue_delete', {
      queue_name: queueName,
      msg_id: msgId,
    })
    if (error) {
      throw new Error(`ack(${queueName}, ${msgId}) falhou: ${error.message}`)
    }
  }

  async deadletter<T>(
    queueName: QueueName,
    msgId: number,
    message: T,
  ): Promise<void> {
    const { error } = await db.rpc('queue_deadletter', {
      queue_name: queueName,
      dlq_name: dlqOf(queueName),
      msg_id: msgId,
      message: message as Json,
    })
    if (error) {
      throw new Error(
        `deadletter(${queueName}, ${msgId}) falhou: ${error.message}`,
      )
    }
  }
}

export const queue: Queue = new PgmqQueue()
