import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@combinado/shared'
import { db } from './index.js'

interface ScopeOptions {
  tables: string[]
  allowVault?: boolean
}

export function createScopedDb(
  role: string,
  opts: ScopeOptions,
): SupabaseClient<Database> {
  const allowed = new Set(opts.tables)
  const allowVault = opts.allowVault ?? false

  return new Proxy(db, {
    get(target, prop, receiver) {
      if (prop === 'from') {
        return (table: string) => {
          if (!allowed.has(table)) {
            throw new Error(
              `[${role}] acesso negado: tabela "${table}". ` +
              `Permitidas: ${opts.tables.join(', ')}`,
            )
          }
          return target.from(table as any)
        }
      }

      if (prop === 'schema') {
        return (schema: string) => {
          if (schema === 'vault_baileys' && !allowVault) {
            throw new Error(
              `[${role}] acesso negado: schema vault_baileys`,
            )
          }
          return target.schema(schema as any)
        }
      }

      if (prop === '_scopeRole') return role
      if (prop === '_scopeTables') return [...allowed]
      if (prop === '_scopeAllowVault') return allowVault

      return Reflect.get(target, prop, receiver)
    },
  })
}
