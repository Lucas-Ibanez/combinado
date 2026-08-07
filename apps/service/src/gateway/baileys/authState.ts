import path from 'node:path'
import { useMultiFileAuthState } from '@whiskeysockets/baileys'

// authState em disco NA FASE DE DEV — pasta apps/service/keys, gitignored.
// A criptografia real do estado (envelope encryption) entra em T11.1.
// Cada protected_person tem seu próprio subdiretório para isolar sessões.
const KEYS_ROOT = path.resolve(process.cwd(), 'keys')

export function keysDirFor(protectedPersonId: string): string {
  return path.join(KEYS_ROOT, protectedPersonId)
}

export async function loadAuthState(protectedPersonId: string) {
  return useMultiFileAuthState(keysDirFor(protectedPersonId))
}
