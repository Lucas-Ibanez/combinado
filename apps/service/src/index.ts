import { config } from './shared/config/index.js'
import { db } from './shared/db/index.js'

async function main() {
  console.log(`[service] iniciando em modo ${config.NODE_ENV}`)

  const { count, error } = await db
    .from('families')
    .select('*', { count: 'exact', head: true })

  if (error) {
    console.error('[service] falha ao consultar Supabase:', error.message)
    process.exit(1)
  }

  console.log(`[service] conexão com Supabase OK — ${count ?? 0} famílias no banco`)
}

main().catch((err) => {
  console.error('[service] erro fatal na inicialização:', err)
  process.exit(1)
})
