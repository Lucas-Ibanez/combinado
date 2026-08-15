import path from 'node:path'
import { useMultiFileAuthState } from '@whiskeysockets/baileys'
import { config } from '../../shared/config/index.js'
import { loadVaultAuthState } from './vaultAuthState.js'

const KEYS_ROOT = path.resolve(process.cwd(), 'keys')

export function keysDirFor(protectedPersonId: string): string {
  return path.join(KEYS_ROOT, protectedPersonId)
}

export async function loadAuthState(protectedPersonId: string) {
  if (config.VAULT_MASTER_KEY) {
    return loadVaultAuthState(protectedPersonId)
  }
  return useMultiFileAuthState(keysDirFor(protectedPersonId))
}

export async function loadOfficialAuthState() {
  if (config.VAULT_MASTER_KEY) {
    return loadVaultAuthState('_official')
  }
  return useMultiFileAuthState(path.join(KEYS_ROOT, '_official'))
}
