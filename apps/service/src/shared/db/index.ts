import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@combinado/shared'
import { config } from '../config/index.js'

// Cliente único com service_role. Este é o ÚNICO ponto do serviço que
// instancia acesso privilegiado ao banco — todos os módulos importam daqui.
// Risk Worker e camada LLM NÃO devem receber este client diretamente para
// operações que envolvam dados de auth ou chaves.
export const db: SupabaseClient<Database> = createClient<Database>(
  config.SUPABASE_URL,
  config.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  },
)
