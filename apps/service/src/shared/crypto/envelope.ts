import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12
const KEY_LENGTH = 32
const AUTH_TAG_LENGTH = 16

export interface EncryptedBlob {
  ciphertext: Buffer
  iv: Buffer
  authTag: Buffer
}

export function generateDEK(): Buffer {
  return randomBytes(KEY_LENGTH)
}

export function deriveKEK(masterKeyHex: string): Buffer {
  const buf = Buffer.from(masterKeyHex, 'hex')
  if (buf.length !== KEY_LENGTH) {
    throw new Error(`VAULT_MASTER_KEY must be exactly ${KEY_LENGTH * 2} hex chars (${KEY_LENGTH} bytes)`)
  }
  return buf
}

export function encrypt(plaintext: Buffer, key: Buffer): EncryptedBlob {
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH })
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()])
  const authTag = cipher.getAuthTag()
  return { ciphertext, iv, authTag }
}

export function decrypt(blob: EncryptedBlob, key: Buffer): Buffer {
  const decipher = createDecipheriv(ALGORITHM, key, blob.iv, {
    authTagLength: AUTH_TAG_LENGTH,
  })
  decipher.setAuthTag(blob.authTag)
  return Buffer.concat([decipher.update(blob.ciphertext), decipher.final()])
}

export function encryptDEK(dek: Buffer, kek: Buffer): EncryptedBlob {
  return encrypt(dek, kek)
}

export function decryptDEK(blob: EncryptedBlob, kek: Buffer): Buffer {
  return decrypt(blob, kek)
}

export function encryptData(data: string, dek: Buffer): EncryptedBlob {
  return encrypt(Buffer.from(data, 'utf8'), dek)
}

export function decryptData(blob: EncryptedBlob, dek: Buffer): string {
  return decrypt(blob, dek).toString('utf8')
}
