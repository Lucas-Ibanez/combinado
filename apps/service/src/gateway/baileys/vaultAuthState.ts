import type { AuthenticationCreds, AuthenticationState, SignalDataTypeMap, SignalDataSet } from '@whiskeysockets/baileys'
import { proto, initAuthCreds, BufferJSON } from '@whiskeysockets/baileys'
import { db } from '../../shared/db/index.js'
import {
  generateDEK,
  deriveKEK,
  encryptDEK,
  decryptDEK,
  encryptData,
  decryptData,
  type EncryptedBlob,
} from '../../shared/crypto/envelope.js'
import { config } from '../../shared/config/index.js'

function getKEK(): Buffer {
  if (!config.VAULT_MASTER_KEY) {
    throw new Error('VAULT_MASTER_KEY is required for vault auth state')
  }
  return deriveKEK(config.VAULT_MASTER_KEY)
}

async function auditLog(entityId: string, operation: string, keyCount = 0): Promise<void> {
  await db.schema('vault_baileys' as any).from('key_access_log').insert({
    entity_id: entityId,
    operation,
    key_count: keyCount,
  })
}

async function getOrCreateDEK(entityId: string): Promise<Buffer> {
  const kek = getKEK()

  const { data: existing } = await db
    .schema('vault_baileys' as any)
    .from('data_keys')
    .select('encrypted_dek, dek_iv, dek_auth_tag')
    .eq('entity_id', entityId)
    .maybeSingle()

  if (existing) {
    const blob: EncryptedBlob = {
      ciphertext: Buffer.from(existing.encrypted_dek as unknown as number[]),
      iv: Buffer.from(existing.dek_iv as unknown as number[]),
      authTag: Buffer.from(existing.dek_auth_tag as unknown as number[]),
    }
    await auditLog(entityId, 'load_dek')
    return decryptDEK(blob, kek)
  }

  const dek = generateDEK()
  const encrypted = encryptDEK(dek, kek)

  await db.schema('vault_baileys' as any).from('data_keys').insert({
    entity_id: entityId,
    encrypted_dek: bufToArray(encrypted.ciphertext),
    dek_iv: bufToArray(encrypted.iv),
    dek_auth_tag: bufToArray(encrypted.authTag),
  })

  await auditLog(entityId, 'create_dek')
  return dek
}

function bufToArray(buf: Buffer): number[] {
  return Array.from(buf)
}

async function loadEncryptedState(
  entityId: string,
  keyType: string,
  keyId: string,
  dek: Buffer,
): Promise<string | null> {
  const { data } = await db
    .schema('vault_baileys' as any)
    .from('auth_state')
    .select('encrypted_data, data_iv, data_auth_tag')
    .eq('entity_id', entityId)
    .eq('key_type', keyType)
    .eq('key_id', keyId)
    .maybeSingle()

  if (!data) return null

  const blob: EncryptedBlob = {
    ciphertext: Buffer.from(data.encrypted_data as unknown as number[]),
    iv: Buffer.from(data.data_iv as unknown as number[]),
    authTag: Buffer.from(data.data_auth_tag as unknown as number[]),
  }

  return decryptData(blob, dek)
}

async function saveEncryptedState(
  entityId: string,
  keyType: string,
  keyId: string,
  plaintext: string,
  dek: Buffer,
): Promise<void> {
  const encrypted = encryptData(plaintext, dek)

  await db.schema('vault_baileys' as any).from('auth_state').upsert(
    {
      entity_id: entityId,
      key_type: keyType,
      key_id: keyId,
      encrypted_data: bufToArray(encrypted.ciphertext),
      data_iv: bufToArray(encrypted.iv),
      data_auth_tag: bufToArray(encrypted.authTag),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'entity_id,key_type,key_id' },
  )
}

async function deleteEncryptedState(
  entityId: string,
  keyType: string,
  keyIds: string[],
): Promise<void> {
  await db
    .schema('vault_baileys' as any)
    .from('auth_state')
    .delete()
    .eq('entity_id', entityId)
    .eq('key_type', keyType)
    .in('key_id', keyIds)
}

export async function loadVaultAuthState(
  entityId: string,
): Promise<{ state: AuthenticationState; saveCreds: () => Promise<void> }> {
  const dek = await getOrCreateDEK(entityId)

  let creds: AuthenticationCreds
  const credsJson = await loadEncryptedState(entityId, 'creds', '', dek)
  if (credsJson) {
    creds = JSON.parse(credsJson, BufferJSON.reviver)
    await auditLog(entityId, 'load_creds')
  } else {
    creds = initAuthCreds()
  }

  const state: AuthenticationState = {
    creds,
    keys: {
      get: async <T extends keyof SignalDataTypeMap>(type: T, ids: string[]) => {
        const result: Record<string, SignalDataTypeMap[T]> = {}
        let loaded = 0

        for (const id of ids) {
          const json = await loadEncryptedState(entityId, type, id, dek)
          if (json) {
            const parsed = JSON.parse(json, BufferJSON.reviver)
            if (type === 'app-state-sync-key' && parsed) {
              result[id] = proto.Message.AppStateSyncKeyData.fromObject(parsed) as any
            } else {
              result[id] = parsed
            }
            loaded++
          }
        }

        if (loaded > 0) {
          await auditLog(entityId, 'load_keys', loaded)
        }

        return result
      },

      set: async (data: SignalDataSet) => {
        let saved = 0
        for (const [type, entries] of Object.entries(data)) {
          for (const [id, value] of Object.entries(entries ?? {})) {
            if (value) {
              const json = JSON.stringify(value, BufferJSON.replacer)
              await saveEncryptedState(entityId, type, id, json, dek)
              saved++
            } else {
              await deleteEncryptedState(entityId, type, [id])
            }
          }
        }
        if (saved > 0) {
          await auditLog(entityId, 'save_keys', saved)
        }
      },
    },
  }

  const saveCreds = async () => {
    const json = JSON.stringify(state.creds, BufferJSON.replacer)
    await saveEncryptedState(entityId, 'creds', '', json, dek)
    await auditLog(entityId, 'save_creds')
  }

  return { state, saveCreds }
}

export async function deleteVaultAuthState(entityId: string): Promise<void> {
  await db
    .schema('vault_baileys' as any)
    .from('auth_state')
    .delete()
    .eq('entity_id', entityId)

  await db
    .schema('vault_baileys' as any)
    .from('data_keys')
    .delete()
    .eq('entity_id', entityId)

  await auditLog(entityId, 'delete')
}
