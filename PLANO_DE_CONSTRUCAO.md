# Combinado — App do Guardião · Plano de Construção do MVP

> **Como usar este arquivo (leia antes de começar).**
> Este é o guia de execução do projeto, escrito para orientar a construção passo a passo com **Claude Code** e **Supabase** (sem Lovable). As tarefas estão em ordem cronológica e cada uma tem uma **caixa de marcação** (`- [ ]` = a fazer · `- [x]` = feito). Ao concluir uma tarefa, troque `[ ]` por `[x]` e faça um commit citando o ID (ex.: `resolve T2.2`).
>
> **Regras para o Claude Code:**
> 1. Siga a **ordem numérica** das fases (F0 → F13). Não pule fases; cada uma assume a anterior pronta.
> 2. Trate os critérios em **"Como garantir"** como condição de conclusão — só marque `[x]` quando eles passarem.
> 3. As **versões** de todas as tecnologias estão em `requirements.txt` (mesma pasta). Use-o como fonte da verdade na instalação. Antes de instalar, verifique a última patch/minor compatível do mesmo major.
> 4. **Nunca** registre em log conteúdo bruto de mensagens, telefones completos ou dados pessoais. Essa disciplina começa no bootstrap (F4) e é inegociável.
> 5. O **LLM é camada de apoio**, nunca autoridade: ele não decide sozinho "é golpe". A política determinística (código auditável) é quem decide.
> 6. Em dúvida de priorização, siga o princípio da arquitetura: **a menor quantidade de pontos de falha alcançável com as ferramentas disponíveis**, sem prometer o que não se entrega (ex.: o MVP não detecta voz clonada em chamada ao vivo).

---

## Convenções

- **IDs de tarefa:** `T<fase>.<n>` (ex.: `T5.4`). Estáveis — use em commits e para pedir ajuda pontual.
- **Local:** cada fase indica onde no monorepo o trabalho acontece (`apps/web`, `apps/service`, `packages/shared`, `supabase/`, raiz).
- **Blocos de comando:** são o caminho feliz; adapte se o ambiente exigir.
- **"Pronto quando":** o teste objetivo que fecha a tarefa.

## Mapa das fases

| Fase | Título | Local |
|---|---|---|
| F0 | Fundações: estrutura do monorepo + instalação de tudo | raiz |
| F1 | Contrato: schema do Supabase | `supabase/` · `packages/shared` |
| F2 | Command API (Edge Functions) | `supabase/functions` |
| F3 | App: esqueleto navegável | `apps/web` |
| F4 | Serviço: bootstrap | `apps/service` |
| F5 | Session Gateway (Baileys) | `apps/service` |
| F6 | Risk Worker (motor de risco) | `apps/service` |
| F7 | Incident Orchestrator (escada de entrega) | `apps/service` |
| F8 | App: Central de Incidentes | `apps/web` |
| F9 | Canais de intervenção reais | `apps/service` |
| F10 | Fluxos de produto | `apps/web` + `apps/service` |
| F11 | Segurança & privacidade | `apps/service` + `apps/web` |
| F12 | Design & acessibilidade | `apps/web` |
| F13 | Deploy & piloto | raiz |

> **Trilhas paralelas:** depois de F1 (schema) pronto, F3 (app) e F4–F5 (serviço) são independentes e só se reencontram em F8. Trabalhando sozinho, siga a ordem; a vantagem do monorepo é que trocar de trilha é só mudar de pasta.

---

# FASE 0 · Fundações — estrutura do monorepo e instalação

**Objetivo:** deixar o terreno inteiro pronto — o monorepo com todas as pastas e arquivos iniciais criados, e **todas as dependências instaladas** conforme o `requirements.txt` — para que as fases seguintes só escrevam lógica, nunca infraestrutura de projeto. **Esta fase termina com o projeto compilando e rodando "vazio" nas três frentes (web, service, shared).**

---

### - [x] T0.1 — Pré-requisitos de ambiente
**O que será feito:** garantir que a máquina tem as ferramentas-base nas versões exigidas, **antes** de instalar qualquer pacote. Ver seção 0 do `requirements.txt`.
- Node.js **22.12+** (exigência do Vite 7 — versões menores quebram o build).
- **pnpm** 9+ (gerenciador do monorepo).
- **Supabase CLI** 2+.
- **git**.

**Como garantir que foi feito corretamente:**
```bash
node -v      # deve ser >= 22.12.0
pnpm -v      # deve ser >= 9
npx supabase --version
git --version
```
Todos respondem sem erro e o Node está na faixa exigida.

**Notas úteis:** se o Node for antigo, instale a linha 22 LTS (via nvm: `nvm install 22 && nvm use 22`). Não prossiga com Node < 20.19 — o Vite 7 recusa.

---

### - [x] T0.2 — Criar contas e guardar segredos
**O que será feito:** criar o projeto no **Supabase** (região São Paulo, senha forte) e abrir as contas dos provedores que só serão configurados na F9, para não travar depois: **Meta/WhatsApp Business** (Cloud API), **Twilio** (conta + número), e gerar um par de chaves **VAPID** para Web Push. Guardar tudo num gerenciador de segredos.

**Como garantir que foi feito corretamente:**
- O painel do Supabase abre e o banco aceita conexão.
- Estão salvos, fora de qualquer repositório: `Project URL`, `anon key`, `service_role key`, `project-ref` (Supabase); credenciais Meta e Twilio; chaves VAPID pública/privada.
- Existe um **número de telefone de teste** (chip separado) reservado para o Baileys.

**Notas úteis:** a `service_role key` dá poder total no banco — **nunca** vai para o front nem para o Git. O número de teste protege sua conta pessoal de um eventual banimento do WhatsApp (o Baileys é não-oficial).

---

### - [x] T0.3 — Criar o repositório único e clonar
**O que será feito:** criar **um** repositório privado `combinado` no GitHub (monorepo — não dois repos) e cloná-lo localmente. O Claude Code opera a partir dessa pasta.

**Como garantir que foi feito corretamente:** o repo existe no GitHub, está clonado, e `git status` responde dentro da pasta.

**Notas úteis:** um só repositório elimina a necessidade de sincronizar tipos entre projetos — app e serviço compartilham `packages/shared` por import.

---

### - [x] T0.4 — Montar a estrutura de pastas e arquivos do monorepo
**O que será feito:** criar **toda** a árvore de diretórios e os arquivos-esqueleto de uma vez, para fixar a organização antes de escrever qualquer lógica. Criar também os arquivos de configuração da raiz (`package.json`, `pnpm-workspace.yaml`, `.gitignore`, `README.md`).

**Comandos (estrutura de pastas):**
```bash
# a partir da raiz do repositório clonado (combinado/)
mkdir -p apps/web apps/service/src packages/shared/src supabase/migrations supabase/functions/_shared

# pastas do serviço (três papéis + http + shared)
mkdir -p apps/service/src/{gateway/baileys,gateway/normalize,risk/rules,risk/classifier,risk/llm,risk/policy,orchestrator/ladder,orchestrator/channels,http,shared/queue,shared/db,shared/crypto,shared/config,shared/logging}
mkdir -p apps/service/{keys,tests}

# esqueleto de arquivos índice do serviço (evita imports quebrados)
touch apps/service/src/{gateway/index.ts,risk/index.ts,orchestrator/index.ts,index.ts}
```

**`package.json` da raiz (workspaces):**
```json
{
  "name": "combinado",
  "private": true,
  "packageManager": "pnpm@9.0.0",
  "workspaces": ["apps/*", "packages/*"]
}
```

**`pnpm-workspace.yaml`:**
```yaml
packages:
  - "apps/*"
  - "packages/*"
```

**`.gitignore` (raiz):**
```
node_modules/
dist/
.env
.env.*
!.env.example
apps/service/keys/
.DS_Store
```

**Como garantir que foi feito corretamente:**
- A árvore bate com a estrutura definida no plano (apps/web, apps/service/src com os três papéis + http + shared, packages/shared, supabase/).
- `pnpm -r list` reconhece a estrutura de workspaces (ainda vazia, sem erro).
- `keys/` e `.env` estão no `.gitignore`.

**Notas úteis:** a pasta `apps/service/src/http` é o servidor de **webhooks** (Twilio/WhatsApp), separado da Command API por ter um modelo de confiança diferente (assinatura de provedor, não JWT de usuário). A pasta `keys/` guarda o estado do Baileys em dev e **jamais** é commitada.

---

### - [x] T0.5 — Linkar a Supabase CLI ao projeto
**O que será feito:** inicializar a config local do Supabase e vincular ao projeto remoto (T0.2). Isso cria `supabase/config.toml` e habilita gerenciar migrations e Edge Functions por CLI.

**Comandos:**
```bash
npx supabase init
npx supabase link --project-ref <REF>   # REF salvo em T0.2
```

**Como garantir que foi feito corretamente:** `supabase/config.toml` existe no repo e a CLI está linkada (sem erro de autenticação).

**Notas úteis:** a partir daqui, mudanças de schema são feitas por migration versionada, não pelo painel — assim o banco fica reproduzível.

---

### - [x] T0.6 — Inicializar `packages/shared` e instalar suas deps
**O que será feito:** criar o pacote compartilhado (tipos + contratos) que web e service vão importar. Sem dependências de runtime — só TypeScript.

**Comandos:**
```bash
cd packages/shared
pnpm init
pnpm add -D typescript@^5.9.0
mkdir -p src && touch src/db-types.ts src/contracts.ts src/index.ts
# nomear o pacote como @combinado/shared no package.json (campo "name")
cd ../..
```

**Como garantir que foi feito corretamente:** `packages/shared/package.json` tem `"name": "@combinado/shared"` e o pacote pode ser referenciado por outro workspace sem erro.

**Notas úteis:** os tipos do banco (`db-types.ts`) serão **gerados** na F1 (T1.7). Por ora ficam vazios. `contracts.ts` guardará os formatos de comando/evento/incidente conforme forem surgindo.

---

### - [x] T0.7 — Scaffold e instalação do `apps/web`
**O que será feito:** criar o app React+Vite+TS e instalar **todas** as dependências do front listadas no `requirements.txt` (seção 2), já com o setup **correto do Tailwind v4**.

**Comandos:**
```bash
cd apps
pnpm create vite@latest web -- --template react-ts
cd web

# núcleo (as versões vêm no template; alinhar ao requirements se preciso)
pnpm install

# Tailwind v4 — SETUP NOVO (sem postcss/autoprefixer, sem init -p)
pnpm add tailwindcss@^4.3.0 @tailwindcss/vite@^4.3.0

# dados / estado / rotas / PWA / drawers
pnpm add @supabase/supabase-js@^2.40.0 @tanstack/react-query@^5.101.0 react-router-dom@^7.0.0 vaul@^1.1.0
pnpm add -D vite-plugin-pwa@^1.0.0

# shadcn/ui (copia componentes para src/components/ui e adiciona libs)
pnpm dlx shadcn@latest init
pnpm dlx shadcn@latest add button card input dialog
cd ../..
```

**Configuração obrigatória do Tailwind v4** (o setup mudou — atenção):
- Em `apps/web/vite.config.ts`, adicionar o plugin:
  ```ts
  import { defineConfig } from 'vite'
  import react from '@vitejs/plugin-react'
  import tailwindcss from '@tailwindcss/vite'
  export default defineConfig({ plugins: [react(), tailwindcss()] })
  ```
- No CSS base (ex.: `src/index.css`), **substituir** as antigas diretivas por:
  ```css
  @import "tailwindcss";
  ```
- **NÃO** rodar `npx tailwindcss init -p`, **NÃO** instalar `postcss`/`autoprefixer`, **NÃO** criar `tailwind.config.js`. Os design tokens (F3/T3.4) vão num bloco `@theme { ... }` no próprio CSS.

**Como garantir que foi feito corretamente:**
```bash
cd apps/web && pnpm dev
```
- O app Vite abre no navegador.
- Uma classe Tailwind de teste (ex.: `class="text-green-700"`) aplica cor — confirma que o v4 está ativo.
- Um `<Button>` do shadcn renderiza e um drawer do Vaul abre.

**Notas úteis:** se as classes Tailwind não aplicarem, o erro quase sempre é (1) faltou `@import "tailwindcss";` no CSS ou (2) faltou o `tailwindcss()` no `vite.config.ts`. Foi a mudança mais comum de tropeço na migração para o v4.

---

### - [x] T0.8 — Scaffold e instalação do `apps/service`
**O que será feito:** criar o workspace do serviço Node e instalar **todas** as dependências de backend do `requirements.txt` (seção 3), incluindo Baileys estável, Hono (webhooks), Twilio, Web Push, Zod e o SDK da Anthropic.

**Comandos:**
```bash
cd apps/service
pnpm init
# runtime / build
pnpm add -D typescript@^5.9.0 tsx@^4.19.0 @types/node@^22.0.0
npx tsc --init    # ajustar "strict": true

# banco + tipos compartilhados
pnpm add @supabase/supabase-js@^2.40.0 @combinado/shared

# captura WhatsApp (Baileys ESTÁVEL — linha 6, ver requirements)
pnpm add @whiskeysockets/baileys@6.17.16 qrcode-terminal@^0.12.0

# servidor HTTP p/ webhooks
pnpm add hono@^4.6.0 @hono/node-server@^1.13.0

# canais de intervenção
pnpm add twilio@^5.3.0 web-push@^3.6.0

# validação + LLM de apoio
pnpm add zod@^3.23.0 @anthropic-ai/sdk@^0.30.0

# arquivo de exemplo de ambiente
printf "SUPABASE_URL=\nSUPABASE_SERVICE_ROLE_KEY=\nANTHROPIC_API_KEY=\nTWILIO_ACCOUNT_SID=\nTWILIO_AUTH_TOKEN=\nVAPID_PUBLIC_KEY=\nVAPID_PRIVATE_KEY=\n" > .env.example
cd ../..
```

**Como garantir que foi feito corretamente:**
- `apps/service/package.json` lista todas as deps acima.
- Um `apps/service/src/index.ts` mínimo que imprime `"serviço no ar"` roda com:
  ```bash
  cd apps/service && pnpm exec tsx src/index.ts
  ```
- `.env.example` existe documentando as variáveis (sem valores).

**Notas úteis sobre o Baileys:** fixamos a **6.17.16** (última estável da linha 6) de propósito. A linha 7 (`7.0.0-rc*`) tem breaking changes e ainda é release candidate — mais risco e menos documentação para um MVP. Migração futura: ler `https://baileys.wiki/docs/migration/to-v7.0.0/`. Existe também o pacote `baileys` (sem escopo) como espelho do mesmo projeto — use **apenas um** dos dois para não duplicar.

---

### - [x] T0.9 — Verificação final da Fase 0 (tudo compila e roda vazio)
**O que será feito:** confirmar que o monorepo inteiro está de pé antes de escrever lógica.

**Como garantir que foi feito corretamente:**
- `pnpm -r list` mostra os três workspaces (`@combinado/shared`, o web e o service) sem erro.
- `apps/web` roda (`pnpm dev`) e mostra tela.
- `apps/service` roda o `index.ts` de teste.
- `supabase/config.toml` existe e a CLI está linkada.
- Nada sensível está rastreado pelo Git (`git status` não lista `.env` nem `keys/`).

**Notas úteis:** este é o "marco zero". A partir daqui, cada fase agrega comportamento sobre uma base que já compila — o que torna qualquer erro futuro fácil de isolar.


---

# FASE 1 · Contrato — schema do Supabase

**Objetivo:** modelar o banco que serve de **contrato e barramento** entre os dois lados e publicar os tipos no pacote compartilhado. Depois desta fase, app e serviço evoluem contra uma interface estável. **Local:** `supabase/migrations` e `packages/shared` — tudo via Supabase CLI.

---

### - [x] T1.1 — Desenhar o modelo lógico das entidades
**O que será feito:** antes de escrever SQL, mapear entidades, colunas-chave e relações. Conjunto mínimo do MVP:
- `families` — a unidade (a "família").
- `guardians` — usuários guardiões (liga ao Supabase Auth).
- `protected_persons` — os protegidos (idosos).
- `guardian_links` — N:N guardião↔protegido, com papel e permissões.
- `incidents` — o núcleo: estado, severidade, timestamps.
- `incident_deliveries` — cada envio da escada (canal, `sent_at`, `delivered_at`, `acknowledged_at`, `acknowledged_by`, motivo de falha).
- `risk_events` — decisões do motor de risco (sinal, **não** conteúdo bruto).
- `simulations` — ensaios agendados e resultados.
- `secrets_family` — a palavra-código (armazenada de forma protegida).
- `audit_log` — toda intervenção e acesso sensível.

**Como garantir que foi feito corretamente:** existe um diagrama (mesmo simples, em texto ou imagem) com as tabelas, suas colunas principais e as relações entre elas.

**Notas úteis:** todo o que é escopável por família recebe `family_id` — é a base da RLS (T1.4). Pense nos estados possíveis de um `incident` desde já (ex.: `open` → `notifying` → `acknowledged` / `expired`), porque a máquina de estados da F7 vai depender disso.

---

### - [x] T1.2 — Migration inicial (tabelas de aplicação)
**O que será feito:** criar a primeira migration com as tabelas de T1.1. PKs UUID, `created_at`/`updated_at`, e `family_id` em tudo que é escopável por família.

**Comandos:**
```bash
npx supabase migration new init_app_tables
# escrever o SQL das tabelas no arquivo gerado, depois:
npx supabase db push
```

**Como garantir que foi feito corretamente:** a migration aplica sem erro e as tabelas aparecem no painel do Supabase (Table Editor).

**Notas úteis:** prefira `timestamptz` para datas, `uuid` com `gen_random_uuid()` para PKs, e defina as foreign keys explicitamente — elas ajudam a RLS e a integridade. Mantenha o SQL na migration versionada, nunca só no painel.

---

### - [x] T1.3 — Schema isolado para as chaves do Baileys
**O que será feito:** criar um **schema separado** (ex.: `vault_baileys`) para a tabela `baileys_sessions` — o material criptográfico da sessão. Isolado do schema `public`, com acesso restrito a uma role de serviço própria (não a `service_role` geral). Só o Session Gateway toca aqui.

**Como garantir que foi feito corretamente:** o schema `vault_baileys` existe e **não** é alcançável pelas policies/roles do app (um cliente com a `anon key` não consegue lê-lo).

**Notas úteis:** as chaves do Baileys não são "só um login" — são material que descriptografa a sessão do WhatsApp. Perdê-las força novo QR; vazá-las amplia muito o impacto de um incidente. Por isso o isolamento em schema próprio já nasce aqui (a criptografia forte vem na F11/T11.1).

---

### - [x] T1.4 — Habilitar RLS e escrever as policies por família
**O que será feito:** ligar Row Level Security em **todas** as tabelas de aplicação. Policy central: um guardião só lê/escreve linhas cujo `family_id` pertence a uma família à qual ele está vinculado (via `guardian_links`). Indexar as colunas usadas nas policies.

**Como garantir que foi feito corretamente:** com dois guardiões de teste em famílias diferentes, o guardião A **não** consegue ler nenhum dado da família do guardião B (testar com a `anon key` + sessão de cada um).

**Notas úteis:** RLS é a espinha de segurança do multi-tenant. Teste o caso negativo (não conseguir ver o que não é seu), não só o positivo. Índices nas colunas de policy (`family_id`, ids de vínculo) evitam que a RLS pese nas queries.

---

### - [x] T1.5 — Habilitar PGMQ e criar as filas
**O que será feito:** ativar a extensão de filas (PGMQ / Supabase Queues) por migration e criar as filas do MVP:
- `risk_queue` — eventos capturados → Risk Worker.
- `command_outbox` — jobs publicados pela Command API → serviço.
- `delivery_queue` — passos da escada de entrega.

Configurar visibility timeout e uma **dead-letter** por fila.

**Como garantir que foi feito corretamente:** dá para enfileirar e consumir uma mensagem de teste em **cada** fila (via SQL ou um script rápido).

**Notas úteis:** PGMQ resolve o padrão de fila dentro do próprio Postgres — sem precisar de Redis. A dead-letter é onde vão as mensagens que falharam N vezes; sem ela, um job problemático trava a fila.

---

### - [x] T1.6 — Configurar Auth e ativar MFA (TOTP)
**O que será feito:** habilitar login por e-mail/senha (e magic link, se quiser) e ativar **MFA por TOTP** — obrigatório para o guardião, por ser conta de alto valor. Passkeys ficam para depois.

**Como garantir que foi feito corretamente:** um usuário de teste consegue se cadastrar e ativar o segundo fator (TOTP) no painel/fluxo do Supabase.

**Notas úteis:** a conta do guardião controla vinculação de WhatsApp e disparo de alertas — comprometê-la é grave. MFA obrigatório é a primeira linha; o step-up auth para ações sensíveis vem na F11/T11.4.

---

### - [x] T1.7 — Gerar os tipos no pacote `shared`
**O que será feito:** gerar os tipos TypeScript do schema direto para dentro de `packages/shared` — é a fonte única de tipos para app e serviço. Preencher também `contracts.ts` com os formatos de comando/evento/incidente conforme já conhecidos.

**Comandos:**
```bash
npx supabase gen types typescript --linked > packages/shared/src/db-types.ts
# exportar em packages/shared/src/index.ts:  export * from './db-types'; export * from './contracts';
```

**Como garantir que foi feito corretamente:** `packages/shared` exporta os tipos e eles refletem as tabelas criadas; outro workspace consegue importar (`import type { Database } from '@combinado/shared'`) sem erro de compilação.

**Notas úteis:** **repita este comando sempre que o schema mudar** (nova migration). É o mecanismo que mantém app e serviço em sincronia com o banco sem gambiarra — a grande vantagem do monorepo.

---

# FASE 2 · Command API — Edge Functions que validam e publicam

**Objetivo:** construir a camada estreita entre o app e o serviço. Toda ação do guardião passa por uma Edge Function que valida (com a **permissão do usuário**, não a `service_role`) e publica um job. Mantê-la separada do serviço Node é uma **fronteira de segurança** (menor privilégio). **Local:** `supabase/functions` (Deno).

---

### - [x] T2.1 — Criar a pasta de functions e o módulo `_shared`
**O que será feito:** estruturar `supabase/functions/` e escrever no `_shared/` os utilitários que toda function usa: verificação do JWT do usuário (auth guard), checagem do vínculo guardião↔protegido, helper de **rate limit** e de **idempotency key**.

**Comandos:**
```bash
npx supabase functions new start-simulation
# criar também _shared/ com os utilitários (auth, vínculo, rate limit, idempotency)
```

**Como garantir que foi feito corretamente:** os utilitários existem em `_shared/` e são importáveis pelas functions (uma function de teste importa e usa o auth guard).

**Notas úteis:** as Edge Functions rodam em **Deno**, não Node — as dependências vêm por URL de import (ex.: `import { createClient } from "jsr:@supabase/supabase-js@2"`), não pelo pnpm. Elas não participam do workspace.

---

### - [x] T2.2 — `start-simulation` (a function-template)
**O que será feito:** a primeira Command API, que serve de molde para as demais. Fluxo: valida o guardião → confirma que ele guarda aquele protegido → checa cooldown/limite → numa **única transação**, grava a `simulation` e publica um job em `command_outbox`. Nunca dispara nada diretamente; só enfileira (transactional outbox).

**Como garantir que foi feito corretamente:** a chamada com um guardião válido cria a `simulation` **e** o job na mesma transação (ou falha inteira — testar que uma falha não deixa registro órfão). Uma chamada de guardião inválido é barrada.

**Notas úteis:** o padrão "transactional outbox" (gravar estado + publicar job na mesma transação) elimina o cenário "a UI diz 'agendado' mas nada aconteceu". Os consumidores no serviço devem ser **idempotentes** (um job pode chegar mais de uma vez).

---

### - [x] T2.3 — `acknowledge-incident`
**O que será feito:** function que recebe a confirmação do guardião sobre um incidente. Valida vínculo, registra `acknowledged_at`/`acknowledged_by` e muda o estado do incidente. É o que "para" a escada de entrega quando uma pessoa confirma.

**Como garantir que foi feito corretamente:** confirmar um incidente muda seu estado no banco e gera uma entrada no `audit_log`.

**Notas úteis:** esta function é o ponto de contato entre o "modo incidente" do app (F8) e a interrupção da escada no Orchestrator (F7). O estado do incidente é a fonte da verdade — o app apenas reflete.

---

### - [x] T2.4 — `pair-device`
**O que será feito:** function que inicia o pareamento do Baileys para um protegido: valida o guardião e enfileira um job que o Session Gateway consome para gerar o QR/código. O QR volta pelo estado no banco (o app lê e exibe).

**Como garantir que foi feito corretamente:** a chamada enfileira o pedido de pareamento em `command_outbox` sem erro, e o registro do protegido reflete o estado "aguardando pareamento".

**Notas úteis:** o QR **não** é gerado aqui (Edge Function é efêmera) — quem gera é o Gateway persistente (F5/T5.2). A function só sinaliza a intenção; o serviço executa.

---

### - [x] T2.5 — Deploy e teste das functions
**O que será feito:** publicar as functions via CLI e testar cada uma com token de guardião válido e inválido, confirmando que a autorização barra o inválido.

**Comandos:**
```bash
npx supabase functions deploy start-simulation
npx supabase functions deploy acknowledge-incident
npx supabase functions deploy pair-device
```

**Como garantir que foi feito corretamente:** as três respondem em produção; chamadas autenticadas funcionam e chamadas sem autorização (ou de guardião de outra família) são recusadas.

**Notas úteis:** teste sempre o caminho negativo (não autorizado deve falhar). Uma Command API que não valida direito vira uma porta aberta para disparar simulações/ligações — exatamente o que a separação em Edge Function existe para conter.


---

# FASE 3 · App navegável — esqueleto do App do Guardião

**Objetivo:** erguer o app até o ponto de logar, ativar MFA e navegar entre as quatro áreas com telas placeholder. Sem lógica de incidentes ainda (vem na F8). **Local:** `apps/web`. (A instalação já foi feita em T0.7; aqui é configuração e telas.)

---

### - [x] T3.1 — Configurar o cliente Supabase e as variáveis do front
**O que será feito:** criar `apps/web/src/lib/supabase.ts` com o cliente usando a `anon key` via `import.meta.env`. Criar `.env.local` (gitignored) com `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.

**Como garantir que foi feito corretamente:** o app faz uma chamada trivial ao Supabase (ex.: `auth.getSession()`) e recebe resposta sem erro de credencial.

**Notas úteis:** no Vite, variáveis expostas ao browser **precisam** do prefixo `VITE_`. **Só** a `anon key` vai no front — a `service_role` jamais.

---

### - [x] T3.2 — Definir os design tokens dos dois modos emocionais
**O que será feito:** no CSS base do Tailwind v4, dentro do bloco `@theme { ... }`, centralizar a paleta: **verde profundo** (modo normal), **âmbar** (atenção), **vermelho reservado** só para crise (modo incidente). Tipografia legível e grande (ex.: Inter).

**Exemplo (CSS, Tailwind v4):**
```css
@import "tailwindcss";
@theme {
  --color-brand: #1F4D3F;      /* verde profundo — confiança/calma */
  --color-attention: #B45309;  /* âmbar — atenção */
  --color-danger: #B0503F;     /* vermelho — SÓ modo incidente */
  --font-sans: "Inter", system-ui, sans-serif;
}
```

**Como garantir que foi feito corretamente:** as cores e a tipografia estão em tokens reutilizáveis (usados via classes como `bg-brand`), não espalhadas em valores mágicos pelo código.

**Notas úteis:** no v4 os tokens vivem no CSS (`@theme`), não num `tailwind.config.js`. Deixe o vermelho fora do uso normal — ele só deve aparecer no modo incidente (F8/F12), para que, quando surja, signifique algo.

---

### - [x] T3.3 — Roteamento + TanStack Query
**O que será feito:** configurar o React Router (rotas) e o TanStack Query (provider na raiz). Estabelecer o padrão "buscar estado autoritativo" que a F8 vai reusar.

**Como garantir que foi feito corretamente:** há rotas navegáveis e o Query provider está ativo (um hook de leitura de teste funciona).

**Notas úteis:** o TanStack Query será a base de como o app lê incidentes na F8 — sempre buscando o estado do banco, com o Realtime servindo só de "dica" para revalidar.

---

### - [x] T3.4 — Importar os tipos de `@combinado/shared`
**O que será feito:** adicionar `@combinado/shared` como dependência do workspace `web` e usar um tipo do banco no app, validando que o monorepo compartilha tipos sem gambiarra.

**Comandos:**
```bash
cd apps/web && pnpm add @combinado/shared --workspace && cd ../..
```

**Como garantir que foi feito corretamente:** um tipo de `shared` (ex.: uma Row de tabela) é usado no app sem erro de compilação.

**Notas úteis:** se o import falhar, confira o `"name"` em `packages/shared/package.json` e se o `index.ts` do shared re-exporta os tipos.

---

### - [x] T3.5 — Telas de cadastro e login (Supabase Auth)
**O que será feito:** construir as telas de signup e login usando o Supabase Auth. Tratar estados de erro com clareza e no tom calmo do design.

**Como garantir que foi feito corretamente:** um usuário consegue se cadastrar e fazer login pelo app.

**Notas úteis:** mensagens de erro devem ser humanas ("e-mail ou senha incorretos"), nunca códigos técnicos. O guardião pode estar ansioso — o tom importa desde o login.

---

### - [x] T3.6 — Fluxo de MFA (TOTP)
**O que será feito:** fluxo de ativação do segundo fator no primeiro acesso (mostrar o QR do authenticator, validar o código) e exigência do TOTP nos logins seguintes.

**Como garantir que foi feito corretamente:** um novo usuário ativa o MFA e, no login seguinte, precisa do código do authenticator para entrar.

**Notas úteis:** o MFA foi habilitado no Supabase em T1.6; aqui é a interface do fluxo. Deixe claro para o usuário como ele recupera acesso se perder o authenticator (a recuperação robusta vem em F11).

---

### - [x] T3.7 — Guard de rotas protegidas
**O que será feito:** proteger as rotas internas atrás de sessão autenticada; redirecionar quem não está logado para o login.

**Como garantir que foi feito corretamente:** acessar uma rota interna sem sessão redireciona para o login; com sessão, entra normalmente.

---

### - [x] T3.8 — Shell de navegação com as quatro áreas
**O que será feito:** navegação inferior mobile-first com quatro abas — **Início · Alertas · Proteção · Chat** — cada uma abrindo uma tela placeholder plausível. Uma ação primária por tela (regra do modo normal).

**Como garantir que foi feito corretamente:** as quatro abas navegam e cada uma mostra seu placeholder.

**Notas úteis:** "Alertas" vira a Central de Incidentes na F8; "Proteção" vira o estado da proteção. Por ora, placeholders com um estado vazio bem desenhado ("nenhum alerta no momento") já ajudam a validar a navegação.

---

### - [x] T3.9 — Finalizar o PWA (manifest + service worker base)
**O que será feito:** completar a configuração do `vite-plugin-pwa` (instalado em T0.7): manifest (nome, ícones, tema) e service worker base. O push entra na F9/F12; aqui é só deixar instalável.

**Como garantir que foi feito corretamente:** o navegador oferece "instalar" o app (ícone de instalação aparece na barra de endereço em navegadores compatíveis).

**Notas úteis:** no iOS, o Web Push só funciona depois que o app é **instalado** na tela inicial — por isso o PWA precisa estar sólido antes de a F9 ligar o push. O onboarding (F10) vai incluir um teste de notificação para confirmar a entrega.

---

# FASE 4 · Serviço: bootstrap — estrutura e fundações

**Objetivo:** montar o esqueleto do serviço com os três papéis como módulos, a interface de fila, o cliente de banco, config e logging sem PII — sem lógica de negócio ainda. **Local:** `apps/service`. (Instalação em T0.8; aqui é a estrutura interna.)

---

### - [x] T4.1 — `shared/config` — variáveis validadas
**O que será feito:** carregar e **validar** (com Zod) as variáveis de ambiente na inicialização — falhar cedo e com mensagem clara se faltar algo. Centralizar aqui as credenciais do Supabase, das filas e (depois) dos canais.

**Como garantir que foi feito corretamente:** o serviço **recusa subir** se uma variável obrigatória estiver ausente, apontando qual falta.

**Notas úteis:** validar env na largada evita o erro clássico de "funciona na minha máquina" e falhas silenciosas em produção. Use um schema Zod para as variáveis.

---

### - [x] T4.2 — `shared/db` — cliente Supabase (service role)
**O que será feito:** instanciar o cliente com a `service_role`, **isolado neste módulo**, importando os tipos de `@combinado/shared`. Nenhum outro módulo cria cliente próprio — todos passam por aqui.

**Como garantir que foi feito corretamente:** o serviço faz um `select` simples numa tabela e recebe resposta.

**Notas úteis:** concentrar o acesso privilegiado num só módulo é o que permite auditar e limitar quem usa poder total. O Risk Worker e o LLM **não** devem tocar em dados de auth nem chaves.

---

### - [x] T4.3 — `shared/queue` — a interface de fila (impl. PGMQ)
**O que será feito:** definir a **interface** (`enqueue`, `consume`, `ack`, `deadletter`) e implementá-la sobre o PGMQ. Consumidores idempotentes por contrato.

**Como garantir que foi feito corretamente:** um teste enfileira e consome uma mensagem via a interface (não chamando o PGMQ diretamente).

**Notas úteis:** a interface é a abstração que permite trocar PGMQ por SQS/NATS no futuro **sem tocar nos três papéis**. Barato agora, evita reescrita depois.

---

### - [x] T4.4 — `shared/logging` — logger sem PII
**O que será feito:** logger estruturado que **nunca** registra texto de mensagem, telefone completo ou conteúdo bruto — só IDs, tipos de evento e metadados.

**Como garantir que foi feito corretamente:** inspecionar os logs de um fluxo de teste e confirmar que **nenhum** dado pessoal sensível aparece.

**Notas úteis:** essa disciplina é requisito de privacidade (F11) e **nasce aqui**, no bootstrap — enfiar depois é retrabalho garantido. Ao logar um evento, logue o `id` e o `tipo`, nunca o conteúdo.

---

### - [x] T4.5 — `index.ts` — bootstrap dos papéis
**O que será feito:** orquestrar a subida dos três módulos (e, depois, do servidor HTTP da F9) no mesmo processo — separação **lógica**. Deixar claro no código onde cada papel começa, para a separação física futura ser um recorte limpo.

**Como garantir que foi feito corretamente:** subir o serviço inicializa os três papéis (ainda sem lógica) e fica escutando, conectado ao Supabase e lendo (vazio) de uma fila PGMQ.

**Notas úteis:** no MVP os três papéis vivem no mesmo processo. A separação que importa agora é **lógica** (módulos distintos com fronteiras claras); a separação física (escala horizontal) vem só quando o volume exigir.


---

# FASE 5 · Session Gateway — captura via Baileys

**Objetivo:** conectar ao WhatsApp de teste como dispositivo vinculado, parear, capturar mensagens em tempo real, normalizar para um evento mínimo e publicá-lo na fila de risco. Reconectar sozinho. **Local:** `apps/service/src/gateway`. Esta é a primeira peça que **produz dado real**.

---

### - [x] T5.1 — Conexão Baileys como dispositivo vinculado
**O que será feito:** implementar a conexão multi-device do Baileys em `gateway/baileys`. Em dev, persistir o `authState` localmente (pasta `keys/`, gitignored); a criptografia forte das chaves entra na F11/T11.1.

**Como garantir que foi feito corretamente:** o serviço estabelece uma sessão com o WhatsApp do número de teste (a conexão fica "open").

**Notas úteis:** use `useMultiFileAuthState` (ou equivalente) apontando para `keys/`. O Baileys opera no nível do protocolo do WhatsApp Web — funciona igual para iOS e Android do protegido, porque não depende do sistema do celular dele.

---

### - [x] T5.2 — Pareamento acionado por job
**O que será feito:** consumir o job de `pair-device` (F2): gerar o QR ou o código de pareamento e gravar no estado do protegido (o app lê e exibe). Tratar o ciclo "aguardando pareamento → pareado".

**Como garantir que foi feito corretamente:** pedir o pareamento pelo fluxo (via Command API) gera um QR que, ao ser escaneado, vincula o número — e o estado do protegido muda para "pareado".

**Notas úteis:** em dev, dá para usar `qrcode-terminal` para exibir o QR no console e validar rápido. Em produção, o QR vai para o app (o guardião pareia presencialmente com o idoso).

---

### - [x] T5.3 — Escutar `messages.upsert`
**O que será feito:** registrar o listener de mensagens recebidas. Filtrar ruído (status, mensagens próprias) e focar no que interessa: mensagens de terceiros para o protegido.

**Como garantir que foi feito corretamente:** cada mensagem recebida no número de teste dispara o handler.

**Notas úteis:** ignore `key.fromMe` e mensagens de status/broadcast. O foco são mensagens de **entrada** para o protegido — é onde o golpe chega.

---
### - [x] T5.4 — Normalizar para o "evento mínimo"
**O que será feito:** em `gateway/normalize`, extrair só o necessário para avaliação de risco: remetente é contato conhecido? número novo? há valor/menção a Pix? tipo (texto/áudio)? — **sem carregar a conversa inteira**. Para áudio, guardar uma referência para transcrição posterior, não o binário na fila.

**Como garantir que foi feito corretamente:** o evento gerado contém **sinais** (flags e metadados), não o conteúdo bruto completo da conversa.

**Notas úteis:** este é o ponto onde a privacidade se materializa (F11/T11.3): o que sai daqui é sinal, não conteúdo. Extrair "menciona Pix? sim/não" em vez de carregar o texto reduz drasticamente o dado sensível que trafega.

---

### - [x] T5.5 — Publicar o evento mínimo em `risk_queue`
**O que será feito:** enfileirar o evento normalizado via a interface de fila (T4.3). Este é o ponto de entrega do Gateway — ele **não espera análise**, só publica e volta ao loop.

**Como garantir que foi feito corretamente:** enviar uma mensagem de teste coloca um evento na `risk_queue`.

**Notas úteis:** o desacoplamento é proposital — uma análise lenta (LLM) nunca pode travar a captura. O Gateway captura, publica e segue.

---

### - [x] T5.6 — Reconexão automática e health check
**O que será feito:** tratar quedas de conexão com reconexão (com jitter) e expor um sinal de **saúde da sessão** (conectada/desconectada) que o app vai mostrar em destaque na tela de Proteção.

**Como garantir que foi feito corretamente:** derrubar a rede e voltar reconecta **sem** novo QR, e o sinal de saúde reflete o estado real.

**Notas úteis:** "a família acha que está protegida, mas a sessão caiu" é o **estado mais perigoso** do produto. Por isso o health check nasce aqui e a tela de Proteção (F8/T8.5) o destaca — desconexão nunca pode ser um detalhe escondido.

---

# FASE 6 · Risk Worker — o motor de risco em pipeline

**Objetivo:** consumir o evento mínimo e passá-lo pelos níveis: **regras rápidas → classificador → LLM (só ambíguos) → política determinística** que decide ação e severidade. **Local:** `apps/service/src/risk`. Princípio central: o **LLM é apoio, nunca autoridade**.

---

### - [x] T6.1 — Consumir a `risk_queue`
**O que será feito:** loop de consumo idempotente sobre a fila de risco. Este worker **não** mantém sessão do WhatsApp nem toca nas chaves — escala independente do Gateway.

**Como garantir que foi feito corretamente:** eventos enfileirados são consumidos e logados (sem PII).

**Notas úteis:** por não ter estado de sessão, este worker pode ser replicado horizontalmente no futuro sem afetar a captura — a separação de papéis da F4 paga aqui.

---

### - [x] T6.2 — Camada 1: regras determinísticas
**O que será feito:** em `risk/rules`, implementar os gatilhos baratos e explicáveis: número novo, palavras de urgência, menção a Pix/chave, "aparelho quebrado", "não ligue/não conte a ninguém", pedido de valor. Para o alto risco **óbvio**, a regra já decide "pare e confirme por outro canal" — o LLM **não** entra no caminho crítico.

**Como garantir que foi feito corretamente:** mensagens com o padrão clássico de golpe são marcadas de alto risco **só** pelas regras, em milissegundos.

**Notas úteis:** as regras são a primeira e mais rápida linha. Para o caso óbvio, a ação sai imediatamente; a explicação detalhada do LLM (se houver) pode chegar segundos depois, fora do caminho crítico.

---

### - [x] T6.3 — Camada 2: classificador estreito
**O que será feito:** em `risk/classifier`, produzir uma probabilidade calibrada de golpe para os casos que as regras não fecham. No MVP, uma heurística de pontuação combinando os sinais; a interface fica pronta para um modelo treinado depois.

**Como garantir que foi feito corretamente:** casos intermediários recebem um score coerente (nem alto nem baixo demais para o que são).

**Notas úteis:** não precisa de ML de verdade no MVP — uma soma ponderada de sinais já serve. O importante é a **interface** ficar pronta para trocar por um modelo treinado quando houver dados.

---

### - [x] T6.4 — Camada 3: LLM como apoio (blindado)
**O que será feito:** em `risk/llm`, chamar a API do Claude (SDK `@anthropic-ai/sdk`) **só para casos ambíguos**. Regras de segurança obrigatórias:
- Conteúdo entra **delimitado como dado não-confiável** (mensagens do atacante são entrada adversarial).
- O modelo **não tem ferramentas**.
- Resposta em **JSON validado** contra um schema (Zod).
- **Timeout curto** e **fallback** se falhar.
- Registrar versão de modelo/prompt.
- **Nunca** emite sozinho "é golpe confirmado".

**Como garantir que foi feito corretamente:** um caso ambíguo recebe uma avaliação em JSON válido; e ao simular falha/timeout do LLM, o **fallback** assume sem quebrar o pipeline.

**Notas úteis:** as mensagens vêm de um possível atacante — podem tentar manipular o prompt. Tratar o conteúdo como dado (delimitado, sem execução, sem ferramentas) é o que blinda contra injeção. O LLM **sugere**; quem decide é a camada 4.

---

### - [x] T6.5 — Camada 4: política determinística (a autoridade)
**O que será feito:** em `risk/policy`, combinar os sinais (regras + classificador + LLM) numa **decisão e severidade** por código auditável. É esta camada — **não** o LLM — que decide se abre incidente e em que nível.

**Como garantir que foi feito corretamente:** a decisão final é **reproduzível** e explicável a partir dos sinais de entrada (dado o mesmo conjunto de sinais, a mesma decisão).

**Notas úteis:** num sistema que dispara ligações e mensagens, a decisão precisa ser auditável — código determinístico, não caixa-preta. É isso que permite explicar, na banca e num incidente real, por que o sistema agiu.

---

### - [x] T6.6 — Gravar a decisão e encaminhar ao Orchestrator
**O que será feito:** persistir o `risk_event` (sinal + severidade, **sem** conteúdo bruto) e publicar a decisão para o Incident Orchestrator (via fila ou tabela observada). Descartar da memória o que não precisa ser guardado.

**Como garantir que foi feito corretamente:** uma decisão de alto risco chega ao próximo estágio (o Orchestrator recebe).

**Notas úteis:** grave o sinal e a severidade, não a mensagem. O descarte do conteúdo bruto após a decisão é parte da disciplina de privacidade (F11/T11.3).

---

# FASE 7 · Incident Orchestrator — incidentes e escada de entrega

**Objetivo:** transformar decisões de risco em incidentes com estado, aplicar cooldown/dedup, e rodar a **escada de entrega** com escalonamento e registro de cada tentativa. Canais reais entram na F9; aqui a **mecânica**. **Local:** `apps/service/src/orchestrator`.

---

### - [x] T7.1 — Criar/atualizar o incidente
**O que será feito:** ao receber uma decisão, abrir um `incident` com estado inicial e severidade. Se já houver incidente aberto para o mesmo contato/conversa, **agrupar** em vez de criar outro (base do antídoto a alert fatigue).

**Como garantir que foi feito corretamente:** decisões viram incidentes; repetições do mesmo contato agrupam no mesmo incidente em vez de criar vários.

---

### - [x] T7.2 — Cooldown e deduplicação
**O que será feito:** implementar janela de cooldown por contato e deduplicação de eventos, para que um golpista não consiga disparar dezenas de alertas repetidos e desarmar a família.

**Como garantir que foi feito corretamente:** rajadas do mesmo padrão **não** geram uma enxurrada de alertas.

**Notas úteis:** alert fatigue é um **vetor de ataque** — o golpista pode martelar termos-gatilho até a família desativar os alertas. Cooldown e dedup são a defesa. Complementa o "silenciar contato sem desativar a proteção" (F10).

---

### - [x] T7.3 — Máquina de estados da escada de entrega
**O que será feito:** em `orchestrator/ladder`, modelar os degraus e os timers de escalonamento: **push → WhatsApp/SMS → ligação → 2º guardião → estado "sem confirmação"**. Cada transição dispara a próxima **só se** não houve confirmação na janela.

**Como garantir que foi feito corretamente:** sem confirmação, a escada avança sozinha de degrau em degrau até o estado final "sem confirmação" (testar com canais mockados).

**Notas úteis:** o princípio central: um incidente **não** é considerado tratado quando a notificação é enviada — **só quando uma pessoa confirma**. É isso que torna o sistema "autônomo" e não um mero painel de alertas.

---

### - [x] T7.4 — Registrar cada delivery com telemetria
**O que será feito:** para cada tentativa, gravar em `incident_deliveries`: canal, `sent_at`, `delivered_at`, `acknowledged_at`, `acknowledged_by`, prazo de escalonamento e motivo de falha.

**Como garantir que foi feito corretamente:** a linha do tempo de um incidente mostra cada tentativa (por qual canal, quando, com que desfecho).

**Notas úteis:** essa telemetria é o que diferencia "tratado = alguém confirmou" de "notificação enviada". Também é a base do histórico que o app mostra e do dado comportamental que constrói o diferencial do produto.

---

### - [x] T7.5 — Encerrar/reabrir e reagir à confirmação
**O que será feito:** ao receber o ack (via `acknowledge-incident`), parar a escada e fechar o incidente. Permitir reabertura se novo sinal chegar. Garantir que o Orchestrator funciona mesmo se o Risk Worker ou o app reiniciarem.

**Como garantir que foi feito corretamente:** confirmar interrompe a escada; um novo sinal pode reabrir um incidente relacionado.

**Notas úteis:** a resiliência a reinícios importa — o Orchestrator é o "primeiro respondente" e não pode depender de o app estar aberto ou de o Worker estar no ar naquele instante.


---

# FASE 8 · App: Central de Incidentes — as trilhas se reencontram

**Objetivo:** ligar o app ao que o serviço produz — listar e detalhar incidentes lendo o **estado autoritativo**, usar Realtime só como dica, reconciliar ao abrir, entrar em modo incidente e permitir a confirmação. Mais a tela de estado da proteção. **Local:** `apps/web` (features `incidents/` e `protection/`).

---

### - [x] T8.1 — Lista e detalhe de incidentes (estado autoritativo)
**O que será feito:** tela que lista os incidentes da família e um detalhe com a linha do tempo das entregas. A fonte é **sempre** o banco (busca autoritativa), não um cache de eventos.

**Como garantir que foi feito corretamente:** incidentes reais gerados pelo serviço aparecem no app com seu histórico de entregas.

**Notas úteis:** use o TanStack Query (F3/T3.3) para as buscas. A regra de ouro: o banco é a verdade; a UI reflete.

---

### - [x] T8.2 — Realtime como dica + reconciliação
**O que será feito:** assinar o Supabase Realtime **só** para saber "há algo novo" e então **buscar o estado** por ID. Ao abrir/reconectar, carregar todos os incidentes não reconhecidos e reconciliar **antes** de voltar a ouvir.

**Como garantir que foi feito corretamente:** desligar e religar a rede **não** faz o app perder incidentes (ele reconcilia buscando o estado autoritativo).

**Notas úteis:** o Realtime nunca é a fonte da verdade — é só um aviso de "vá buscar". Se o WebSocket perder eventos (metrô, 4G oscilando), a reconciliação por busca cobre o buraco. **Nunca** dependa do Realtime como garantia de entrega de alerta — essa garantia é da escada multicanal (F7/F9).

---

### - [x] T8.3 — Modo incidente (UI de crise)
**O que será feito:** quando há incidente ativo, o app **rompe o tom calmo**: ação primária **"Ligar para minha mãe"** e alternativas **visíveis** (*"Fui eu quem pediu"*, *"Não reconheço este pedido"*, *"Chamar outro guardião"*) — nunca escondidas em menu. Linguagem direta, sem probabilidade ("pedido urgente de Pix de número novo", não "risco 0,87").

**Como garantir que foi feito corretamente:** um incidente ativo mostra a tela diretiva com a ação primária e as alternativas visíveis.

**Notas úteis:** aqui o vermelho reservado (T3.2) finalmente aparece. No modo incidente, a regra "uma ação por tela" dá lugar a "ação recomendada + alternativas visíveis" — sob estresse, o guardião precisa das opções à vista, não em submenu.

---

### - [x] T8.4 — Confirmação → `acknowledge-incident`
**O que será feito:** as ações do modo incidente chamam a Command API de confirmação (F2/T2.3), que muda o estado e para a escada. Refletir o novo estado na UI na hora.

**Como garantir que foi feito corretamente:** confirmar no app interrompe a escada no serviço (o incidente muda de estado e a escalada para).

---

### - [x] T8.5 — Tela "Estado da Proteção"
**O que será feito:** painel que mostra, com **destaque**, a saúde da sessão (conectada/desconectada), última mensagem processada, canais de alerta ativos, opt-in do protegido e guardião de plantão. Desconexão **nunca** é um pontinho cinza — é um aviso proeminente com ação de reconexão.

**Como garantir que foi feito corretamente:** derrubar a sessão do Gateway acende um alerta claro de "proteção interrompida" nesta tela.

**Notas úteis:** esta tela consome o health check da F5/T5.6. Lembre: o estado mais perigoso é "a família acha que está protegida, mas a sessão caiu" — por isso a desconexão tem que gritar, não sussurrar.

---

# FASE 9 · Canais de intervenção reais

**Objetivo:** conectar a escada aos canais reais e montar o servidor HTTP do serviço para receber os webhooks dos provedores — com todos os cuidados que evitam falha e desconfiança. **Local:** `apps/service/src/{channels,http}` + config de provedores.

---

### - [x] T9.1 — Servidor HTTP para webhooks
**O que será feito:** em `src/http`, subir um servidor leve (Hono + `@hono/node-server`) **só** para os webhooks dos provedores (Twilio, status do WhatsApp). Autenticados por **assinatura do provedor**.

**Como garantir que foi feito corretamente:** um webhook de teste chega e é **validado por assinatura** (rejeita requisição sem assinatura válida).

**Notas úteis:** os webhooks têm modelo de confiança **diferente** da Command API (assinatura de provedor, não JWT de usuário) — por isso vivem no serviço Node, não nas Edge Functions. Manter os dois separados é parte do menor privilégio.

---

### - [x] T9.2 — Canal WhatsApp oficial via Baileys (envio)
**O que será feito:** criar uma **segunda sessão Baileys** dedicada ao número oficial do Combinado (5511917321422, WhatsApp Business). Essa sessão é usada **exclusivamente para enviar** mensagens de protocolo e alerta ao protegido — separada da sessão de captura (que monitora o WhatsApp do protegido). Implementar: (1) `OfficialSession` — gerência da conexão Baileys do número oficial com authState próprio, reconexão automática e health check; (2) `WhatsAppChannel` — implementação do `ChannelDispatcher` que envia mensagem via essa sessão; (3) delays naturais entre envios (2–5s aleatório) para comportamento humanizado.

**Como garantir que foi feito corretamente:** (1) `OfficialSession` conecta, reconecta e reporta health; (2) `WhatsAppChannel.send()` envia uma mensagem de texto a um JID de teste e retorna `{ sent: true }`; (3) testes unitários do canal passam sem socket real (mock do sock.sendMessage); (4) o `ChannelDispatcher` roteia `'whatsapp'` para o `WhatsAppChannel` real em vez do mock.

**Notas úteis:** a Cloud API da Meta ficou bloqueada (verificação de número não funciona). Para o MVP com volume mínimo (2 famílias, ~10 msgs), Baileys é viável e gratuito. **Sem** biblioteca anti-ban — o volume é baixo demais para precisar. Os delays naturais (2–5s) são suficientes. A separação de sessões continua: sessão 1 (captura do protegido) ≠ sessão 2 (envio pelo oficial). Cada uma tem seu próprio keys dir.

---

### - [x] T9.3 — Enviar o protocolo ao protegido
**O que será feito:** ligar o degrau "protocolo ao idoso" da escada ao envio real via a sessão Baileys oficial (T9.2). A mensagem de protocolo é texto simples com a orientação de pedir a senha combinada. Monitorar o ack do WhatsApp (message sent callback do Baileys) e ter **fallback** para o próximo degrau da escada se o envio falhar.

**Como garantir que foi feito corretamente:** um incidente entrega a mensagem de protocolo ao número de teste do "idoso" via a sessão oficial Baileys.

**Notas úteis:** a mensagem de protocolo é o gatilho dos Implementation Intentions ("recebeu isso → peça a senha"). Precisa chegar de um número que o idoso **já reconhece** (salvo na cerimônia de canal, F10/T10.1). Sem templates da Meta — Baileys envia texto livre, o que na verdade simplifica o fluxo.

---

### - [x] T9.4 — Twilio: ligação de intervenção
**O que será feito:** disparar a ligação em alto risco com: mensagem **imediata** ao atender, número previamente salvo, identificação repetida, **sem AMD síncrono** (a detecção de secretária eletrônica insere silêncio que faz o idoso desligar), e opção "pressione 1 para ligar para seu familiar". **Nunca** pede senha/Pix/código. Webhooks de progresso (iniciada/tocou/atendida/terminou).

**Como garantir que foi feito corretamente:** em alto risco, a ligação toca e reproduz a mensagem **sem atraso** ao ser atendida.

**Notas úteis:** o "sem AMD síncrono" é específico e importante — o silêncio de detecção de secretária eletrônica é o que faz idosos desligarem antes da mensagem. A ligação é intervenção (nós ligamos), não detecção (não conseguimos ouvir uma chamada clonada — isso está fora do escopo do MVP).

---

### - [x] T9.5 — Push (Web Push) + SMS ao guardião
**O que será feito:** implementar os degraus de alerta ao guardião: Web Push (biblioteca `web-push` com as chaves VAPID, integrando com o service worker do app) e SMS de fallback (Twilio). Registrar entrega/ack como nos demais canais.

**Como garantir que foi feito corretamente:** o guardião recebe o push e, na ausência de confirmação, recebe o SMS.

**Notas úteis:** o push do PWA (sobretudo no iOS) **não** é garantia de entrega — por isso ele é só o **primeiro** degrau, com SMS/ligação/2º guardião atrás. A garantia vem da redundância da escada, não de um canal isolado.

---

### - [x] T9.6 — Rate limit e circuit breaker por canal
**O que será feito:** cada canal ganha limite próprio e um disjuntor: se um provedor falhar em série, o sistema **para de martelar** aquele canal e segue a escada, sem derrubar o resto.

**Como garantir que foi feito corretamente:** simular a falha de um canal (ex.: Twilio fora) **não** trava os outros — a escada segue pelos canais restantes.

**Notas úteis:** isolar falhas por canal é mais um "ponto de falha a menos" — uma indisponibilidade da Twilio não pode paralisar push nem WhatsApp.


---

# FASE 10 · Fluxos de produto

**Objetivo:** fechar os fluxos que fazem o produto funcionar de ponta a ponta para uma família nova — incluindo a cerimônia de canal e as proteções contra abuso do guardião. **Local:** `apps/web` (telas) + `apps/service` (disparos e lógica).

---

### - [x] T10.1 — Onboarding completo do círculo
**O que será feito:** encadear o fluxo inteiro: criar família → adicionar protegido → definir a **palavra-código** (fixa, com guia de boas práticas) → **pareamento** do Baileys presencial → **cerimônia do canal** (salvar o número oficial no WhatsApp do idoso + opt-in + mensagem de teste) → **teste de notificação** do próprio guardião → **1ª simulação**.

**Como garantir que foi feito corretamente:** uma família nova completa todos os passos e termina "protegida de verdade" — com os canais verificados (o push do guardião testado e o número oficial reconhecido pelo idoso).

**Notas úteis:** a **cerimônia de canal** é crítica — sem ela, o idoso pode achar que o próprio Combinado é um golpe (uma mensagem de número empresarial dizendo "há um golpe" é justo o que ensinamos a desconfiar). Salvar o número oficial, rodar uma simulação e ensinar "o Combinado nunca pede senha/Pix" é pré-condição para o protocolo funcionar.

---

### - [x] T10.2 — Simulações periódicas (o ensaio do hábito)
**O que será feito:** agendamento e disparo das simulações via Command API (com cooldown/limite), envio pelo WhatsApp, registro do resultado e um painel de **progresso do hábito** para o guardião.

**Como garantir que foi feito corretamente:** uma simulação chega ao protegido e o resultado atualiza o progresso no app.

**Notas úteis:** é o **coração dos Implementation Intentions** — o hábito de pedir a senha precisa ser ensaiado até virar reflexo que compete com a instrução do golpista. Quanto mais o idoso praticou, mais automática a resposta sob estresse.

---

### - [x] T10.3 — Chat de verificação (WhatsApp + in-app)
**O que será feito:** canal para checar mensagens suspeitas sob demanda. Primário no **WhatsApp** (qualquer um encaminha ao número oficial e recebe uma avaliação); secundário **in-app** com mais contexto. Aplicar a **regra de honestidade**: nunca dar falsa segurança — no ambíguo, orientar a pedir a senha mesmo assim.

**Como garantir que foi feito corretamente:** encaminhar uma mensagem retorna uma avaliação honesta de risco (e, no caso ambíguo, a orientação de pedir a senha).

**Notas úteis:** um "parece seguro" que erre **uma vez** destrói a confiança na ferramenta. Para o ambíguo, a resposta correta é: "Não identifiquei padrões claros de golpe, mas se há pedido de dinheiro, peça a senha combinada mesmo assim."

---

### - [x] T10.4 — Painel do protegido (contra abuso do guardião)
**O que será feito:** superfície onde o idoso vê **quem são os guardiões**, **revoga acesso**, consulta as intervenções feitas e pede ajuda independente. Adicionar novo guardião **exige confirmação do idoso**.

**Como garantir que foi feito corretamente:** o protegido consegue ver e **revogar** um guardião.

**Notas úteis:** o threat model inclui o "guardião mal-intencionado" (familiar controlador, disputa patrimonial, ex-cônjuge). O guardião **não** acessa mensagens brutas — só o tipo de risco. Dar ao idoso visibilidade e poder de revogar é requisito ético, não opcional.

---

### - [x] T10.5 — Múltiplos guardiões (rede + redundância)
**O que será feito:** permitir irmãos compartilhando a proteção do mesmo protegido — que também vira o degrau "2º guardião" da escada de entrega.

**Como garantir que foi feito corretamente:** dois guardiões acompanham o mesmo protegido e a escada aciona o segundo quando o primeiro não confirma.

**Notas úteis:** além do efeito de rede (mais gente na família = mais valor), o 2º guardião é **redundância** na escada — se o primeiro está dormindo, o segundo recebe.

---

# FASE 11 · Segurança & privacidade

**Objetivo:** aplicar as proteções que separam um protótipo ingênuo de um produto defensável — criptografia das chaves, menor privilégio, descarte de dados e a base de conformidade LGPD. **Local:** `apps/service` (grande parte) + `apps/web` (políticas e telas de consentimento).

---

### - [x] T11.1 — Envelope encryption das chaves do Baileys
**O que será feito:** substituir a persistência local de dev (`keys/`) por **envelope encryption** com chave por protegido, guardada via KMS, no schema isolado (`vault_baileys`), acessível só pela role do Gateway. Rotação e trilha de acesso.

**Como garantir que foi feito corretamente:** as chaves **nunca** aparecem em claro — nem em log, nem no filesystem, nem fora do Gateway.

**Notas úteis:** as chaves do Baileys descriptografam a sessão do WhatsApp — são credencial de alto impacto. Só o Session Gateway toca nelas. Este é o "endurecimento" do que a F1/T1.3 já isolou.

---

### - [x] T11.2 — Menor privilégio entre os papéis
**O que será feito:** garantir na prática que: o Gateway **não** usa a `service_role` geral; o Risk Worker **não** acessa chaves; o LLM **não** vê número completo nem dado de auth; o Orchestrator **só** executa política; o servidor HTTP de webhooks é isolado.

**Como garantir que foi feito corretamente:** cada papel só consegue tocar no que precisa (testar que, ex., o Risk Worker não tem acesso ao `vault_baileys`).

**Notas úteis:** cada fronteira dessas é um **ponto de falha a menos**. Uma falha num endpoint público não pode encostar no que tem poder total.

---

### - [x] T11.3 — Privacidade de terceiros: descarte e TTL
**O que será feito:** processar em memória sempre que possível; **descartar mensagens sem sinal**; não persistir conversas completas; guardar só features e excertos mínimos; TTL curto para áudio/mídia; garantir que o fornecedor de IA está **sem treinamento** e com **retenção desativada**. O guardião **nunca** vê conteúdo bruto.

**Como garantir que foi feito corretamente:** nada de conversa integral fica armazenado; áudios expiram sozinhos; os logs (T4.4) não têm conteúdo.

**Notas úteis:** ao vincular o WhatsApp do idoso, capturamos incidentalmente conteúdo de **terceiros** (médicos, advogados, familiares) que nunca consentiram. Isso é um risco existencial (LGPD/ANPD) — a arquitetura "subir sinal, não conteúdo" é a mitigação, e ela se materializa aqui.

---

### - [x] T11.4 — Endurecimento da conta do guardião
**O que será feito:** MFA obrigatório (já ativo, T1.6/T3.6), **step-up auth** para ações sensíveis (adicionar protegido, trocar número), sessões revogáveis e um `audit_log` de todas as intervenções. Recuperação que **não** dependa só de e-mail.

**Como garantir que foi feito corretamente:** ações sensíveis exigem reautenticação e ficam registradas no `audit_log`.

**Notas úteis:** a conta do guardião é alvo de alto valor (vincula WhatsApp, dispara alertas). Step-up auth pede o segundo fator de novo na hora da ação crítica, mesmo com sessão aberta.

---

### - [x] T11.5 — Confirmação fora do canal comprometido
**O que será feito:** assegurar que a verificação final **não** ocorre só no mesmo WhatsApp possivelmente comprometido: o guardião confirma no app (canal independente) e o idoso recebe a confirmação por contato/ligação previamente conhecidos. A palavra-código opera **dentro** dessa confirmação out-of-band, não no lugar dela.

**Como garantir que foi feito corretamente:** o caminho de confirmação usa um canal **distinto** do canal da suspeita.

**Notas úteis:** se a verificação acontece no mesmo canal já comprometido, você corre o risco de autenticar a própria sessão comprometida. A confirmação por canal independente é o que fecha esse buraco.

---

### - [x] T11.6 — Relatório de Impacto (LGPD) e localidade de dados
**O que será feito:** iniciar o Relatório de Impacto à Proteção de Dados (RIPD), documentar bases legais (prevenção à fraude/legítimo interesse, com as ressalvas para dado sensível) e garantir dados no Brasil ou mecanismo formal de transferência internacional (ANPD 2024). Buscar orientação jurídica específica.

**Como garantir que foi feito corretamente:** existe um RIPD em andamento e a localidade dos dados está definida.

**Notas úteis:** isto é tão importante quanto a stack para a defensabilidade do produto. Não é tarefa de código — é de conformidade — mas condiciona decisões técnicas (onde os dados moram, qual fornecedor de IA).

---

# FASE 12 · Design & acessibilidade

**Objetivo:** polir a experiência para que o tom "calma e confiança" e a clareza de crise fiquem consistentes, acessíveis e à prova de toque acidental. **Local:** `apps/web`.

---

### - [x] T12.1 — Consolidar os dois modos emocionais
**O que será feito:** modo normal calmo e discreto; modo incidente diretivo e enfático. Garantir a transição clara entre eles e que o vermelho só aparece na crise.

**Como garantir que foi feito corretamente:** os dois modos estão visualmente distintos e coerentes entre si.

---

### - [ ] T12.2 — Nunca só cor (WCAG)
**O que será feito:** todo estado combina **texto + ícone + forma + cor + ação** ("proteção ativa" com ícone de confirmação; "desconectado" com plugue interrompido).

**Como garantir que foi feito corretamente:** em tons de cinza (simulando daltonismo), ainda se distingue cada estado.

**Notas úteis:** essencial para daltônicos e para leitura sob estresse. Cor sozinha nunca carrega significado crítico.

---

### - [ ] T12.3 — Vaul para drawers e anti-toque acidental
**O que será feito:** usar o Vaul (instalado em T0.7) para drawers nativos no mobile. Ações críticas (acionar/bloquear) com gesto deliberado, tipo "deslize para confirmar", evitando disparo no bolso.

**Como garantir que foi feito corretamente:** os drawers se comportam bem no celular e a ação crítica exige um gesto deliberado (não um toque simples).

---

### - [ ] T12.4 — Acessibilidade e instalação PWA
**O que será feito:** contraste AA, alvos de toque ~44×44px, zoom de texto sem quebra. Finalizar manifest e service worker; incluir o **teste de notificação** no onboarding para confirmar que a escada chega ao aparelho do guardião.

**Como garantir que foi feito corretamente:** o app instala na tela inicial e o teste de push confirma a entrega.

**Notas úteis:** o teste de notificação no onboarding não é enfeite — ele verifica, no iOS especialmente, que o push do PWA realmente chega. Sem essa confirmação, o painel poderia dizer "protegido" enquanto o aparelho não consegue alertar.

---

# FASE 13 · Deploy & piloto

**Objetivo:** publicar os dois lados, documentar o modelo de ameaças, testar ponta a ponta e rodar o piloto que é o marco do projeto. **Local:** raiz — deploy a partir das pastas do monorepo.

---

### - [ ] T13.1 — Deploy do app (Vercel ou Cloudflare Pages)
**O que será feito:** publicar `apps/web` na Vercel ou Cloudflare Pages, apontando o build para a subpasta do monorepo e configurando as variáveis (`VITE_SUPABASE_*`). Confirmar PWA e push em produção.

**Como garantir que foi feito corretamente:** o app está numa URL pública, instalável, e o push funciona em produção.

**Notas úteis:** num monorepo, configure o "root directory" do deploy para `apps/web` (ou o comando de build equivalente). As variáveis `VITE_*` vão nos secrets da plataforma.

---

### - [ ] T13.2 — Deploy do serviço Node
**O que será feito:** publicar `apps/service` em Railway/Render/Fly.io como processo persistente único, com **volume persistente** para as chaves e reconexão automática. Configurar variáveis e segredos de produção, e a URL pública dos webhooks.

**Como garantir que foi feito corretamente:** o serviço fica no ar 24/7 e mantém a sessão do Baileys (sobrevive a reinícios via volume persistente).

**Notas úteis:** o serviço **precisa** de um processo persistente (não serverless) por causa da sessão Baileys com estado. O volume persistente guarda as chaves entre reinícios — sem ele, cada restart forçaria novo QR.

---

### - [ ] T13.3 — Produção do Supabase e backups
**O que será feito:** revisar limites do plano, backups e retenção. Confirmar que RLS e as filas se comportam sob carga real mínima. Deploy final das migrations e functions.

**Como garantir que foi feito corretamente:** backups ativos e políticas revisadas; migrations e functions publicadas em produção.

---

### - [ ] T13.4 — Threat model documentado
**O que será feito:** escrever o modelo de ameaças (captura não-oficial via Baileys, abuso do guardião, alert fatigue, canal comprometido, comprometimento de conta) e as mitigações.

**Como garantir que foi feito corretamente:** o threat model cobre os riscos do documento de arquitetura, com a mitigação de cada um.

**Notas úteis:** é entregável do projeto **e** proteção na banca — demonstra maturidade. Cada risco listado deve apontar para a tarefa/mecanismo que o mitiga.

---

### - [ ] T13.5 — Teste ponta a ponta em staging
**O que será feito:** rodar o fluxo completo com contas de teste: onboarding → mensagem suspeita → incidente → escada → confirmação → registro. Corrigir o que quebrar antes de tocar em famílias reais.

**Como garantir que foi feito corretamente:** o fluxo inteiro passa sem intervenção manual.

**Notas úteis:** este é o ensaio geral. Se algo exige "empurrão manual" para funcionar, ainda não está pronto para famílias reais.

---

### - [ ] T13.6 — Piloto com 2–3 famílias reais
**O que será feito:** onboarding assistido de famílias reais, com consentimento claro. Acompanhar de perto, coletar métricas de adoção (ensaios feitos, incidentes, confirmações) e feedback qualitativo.

**Como garantir que foi feito corretamente:** as famílias usam o produto e há dados reais de adoção — o **marco final do MVP**.

**Notas úteis:** consentimento claro e acompanhamento próximo são obrigatórios — são pessoas reais, idosas, num contexto sensível. As métricas de adoção (quantos ensaios, quantos incidentes, taxa de confirmação) são o que valida a tese do produto.

---

## Encerramento — como manter este arquivo vivo

- **Marque o progresso:** troque `[ ]` por `[x]` ao concluir cada tarefa e faça commit citando o ID (`resolve T5.4`).
- **Regenere os tipos** (`packages/shared`) sempre que o schema mudar — é o que mantém app e serviço em sincronia.
- **Atualize o `requirements.txt`** se subir a versão de algum pacote (e registre o porquê, sobretudo em mudança de major).
- **Volte ao princípio** em qualquer dúvida de escopo: a menor quantidade de pontos de falha alcançável com as ferramentas disponíveis, sem prometer o que não se entrega.
- **Escopo consciente do MVP:** o produto protege o canal de voz por hábito ensaiado + intervenção pós-detecção textual — **não** detecta voz clonada em chamada ao vivo. Isso é uma decisão de arquitetura, não uma lacuna a "consertar" no MVP.

> **Próximos dois passos sugeridos ao começar a construir:** depois da Fase 0, detalhar (a) o SQL da migration inicial (T1.2) e (b) os contratos das Edge Functions (F2). São as duas peças cujo acerto no início evita mais retrabalho depois.
