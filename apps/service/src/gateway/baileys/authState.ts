import path from 'node:path'
import { useMultiFileAuthState } from '@whiskeysockets/baileys'

// authState em disco NA FASE DE DEV — pasta apps/service/keys, gitignored.
// A criptografia real do estado (envelope encryption) entra em T11.1.
const KEYS_DIR = path.resolve(process.cwd(), 'keys')

export async function loadAuthState() {
  return useMultiFileAuthState(KEYS_DIR)
}

export function getKeysDir(): string {
  return KEYS_DIR
}
