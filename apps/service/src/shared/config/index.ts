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

  // Twilio — número de origem para ligações e SMS (T9.4)
  TWILIO_PHONE_NUMBER: z.string().min(1).optional(),

  // Vault — master key para envelope encryption das chaves do Baileys (T11.1)
  // 64 hex chars = 32 bytes AES-256. Obrigatório em produção.
  VAULT_MASTER_KEY: z.string().length(64).regex(/^[0-9a-fA-F]+$/).optional(),

  // Servidor HTTP para webhooks (T9.1)
  WEBHOOK_PORT: z.coerce.number().int().positive().default(3100),
  WEBHOOK_BASE_URL: z.string().url().optional(),
  WHATSAPP_VERIFY_TOKEN: z.string().min(1).optional(),
  WHATSAPP_APP_SECRET: z.string().min(1).optional(),
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
