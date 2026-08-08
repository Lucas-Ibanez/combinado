import { z } from 'zod'

try {
  process.loadEnvFile()
} catch {
  // sem .env — segue com as variáveis do ambiente do processo
}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Supabase (obrigatório a partir de T4.2)
  SUPABASE_URL: z.string().url({ message: 'deve ser uma URL válida do Supabase' }),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20, { message: 'chave de service role muito curta' }),

  // LLM — obrigatório a partir da F6 (motor de risco)
  NVIDIA_API_KEY: z.string().min(1).optional(),

  // Canais — obrigatórios a partir da F9 (orquestrador)
  TWILIO_ACCOUNT_SID: z.string().min(1).optional(),
  TWILIO_AUTH_TOKEN: z.string().min(1).optional(),
  VAPID_PUBLIC_KEY: z.string().min(1).optional(),
  VAPID_PRIVATE_KEY: z.string().min(1).optional(),
})

export type Config = z.infer<typeof envSchema>

function loadConfig(): Config {
  const parsed = envSchema.safeParse(process.env)
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  • ${i.path.join('.')}: ${i.message}`)
      .join('\n')
    console.error(
      `\n[config] variáveis de ambiente inválidas ou ausentes:\n${issues}\n\n` +
        `dica: copie apps/service/.env.example para apps/service/.env e preencha os valores.\n`,
    )
    process.exit(1)
  }
  return parsed.data
}

export const config: Config = loadConfig()
