# CLAUDE.md

> Este arquivo é lido no início de cada sessão de trabalho neste repositório. Ele define **como trabalhar aqui**. O **quê** fazer está no `PLANO_DE_CONSTRUCAO.md`; o **porquê** está no `CONTEXTO_PRODUTO.md`. Este arquivo não substitui nenhum dos dois — ele diz como usá-los, nessa ordem, em toda tarefa.

## O projeto em uma frase

Combinado é um produto de proteção familiar contra golpes de personificação por IA (voz clonada e mensagens falsas de "parentes" pedindo Pix urgente). Este repositório é o **monorepo do MVP**: um app do guardião (React/Vite) + um serviço Node (captura de WhatsApp via Baileys, motor de risco, orquestração de incidentes) + Supabase (banco, auth, filas, Edge Functions). Para o mercado, o modelo de negócio e os aprendizados por trás das decisões de produto, ver `CONTEXTO_PRODUTO.md`.

## Os quatro arquivos deste projeto

| Arquivo | Papel | Quando abrir |
|---|---|---|
| **`CLAUDE.md`** (este) | Como trabalhar: fluxo, disciplina, guardrails | Sempre, no início de cada sessão |
| **`PLANO_DE_CONSTRUCAO.md`** | **Fonte de verdade operacional** — o que fazer, em que ordem, e o critério de "pronto" | Antes de qualquer tarefa de código, sem exceção |
| **`requirements.txt`** | Versões e travas de compatibilidade de cada tecnologia | Antes de instalar qualquer dependência |
| **`CONTEXTO_PRODUTO.md`** | O porquê do produto: mercado, modelo de negócio, aprendizados estratégicos | Quando uma tarefa parecer ambígua ou uma decisão de UX/regra de negócio puder ir em duas direções |

---

## Regra central: toda tarefa começa no PLANO_DE_CONSTRUCAO.md

Este projeto é construído tarefa por tarefa, na ordem das 14 fases (F0→F13) definidas no plano. Antes de escrever qualquer código:

1. **Localize a próxima tarefa** — a primeira ainda não marcada, na ordem das fases:
   ```bash
   grep -n "^### - \[ \]" PLANO_DE_CONSTRUCAO.md | head -1
   ```
2. **Não pule fases nem tarefas.** Se uma fase anterior tem tarefas não marcadas, resolva-as antes de avançar — cada fase assume a anterior pronta.
3. **Trabalhe uma tarefa por vez.** Leia os três campos da tarefa antes de começar: **"O que será feito"**, **"Como garantir que foi feito corretamente"** e **"Notas úteis"** (elas guardam o porquê de decisões que evitam retrabalho).
4. **Só marque `- [x]`** depois de de fato verificar o critério de "Como garantir" — rode o comando/teste indicado, não assuma que passou.
5. **Marque o progresso editando o próprio `PLANO_DE_CONSTRUCAO.md`** (trocar `[ ]` por `[x]`) e cite o ID da tarefa no commit (ex.: `feat: conexão Baileys como dispositivo vinculado (T5.1)`).
6. **Antes de instalar qualquer pacote**, confira `requirements.txt` — ele tem as versões-alvo e as travas de compatibilidade (Node 22.12+, setup do Tailwind v4, Baileys 6.x estável) que, se ignoradas, quebram o ambiente.

Não invente tarefas fora do plano, não reordene fases por conta própria e não marque uma tarefa como concluída "por estar próxima o suficiente". Se identificar que falta algo importante no plano ou que uma tarefa não faz mais sentido, **sinalize ao usuário** em vez de decidir sozinho e seguir em frente.

---

## Estrutura do monorepo (referência rápida)

```
── apps/
│   ├── web/ # App do Guardião — React/Vite/TS
│   │   ├── src/
│   │   │   ├── components/
│   │   │   │   ├── ui/ # shadcn/ui + Vaul
│   │   │   │   └── common/ # componentes próprios
│   │   │   ├── features/ # por domínio, não por tipo
│   │   │   │   ├── onboarding/
│   │   │   │   ├── incidents/ # Central de Incidentes (núcleo)
│   │   │   │   ├── protection/ # estado da proteção
│   │   │   │   ├── simulations/
│   │   │   │   └── chat/ # chat de verificação in-app
│   │   │   ├── pages/ # rotas/telas
│   │   │   ├── hooks/ # TanStack Query
│   │   │   ├── lib/
│   │   │   │   ├── supabase.ts          # client (anon key)
│   │   │   │   └── utils.ts
│   │   │   ├── styles/ # tokens: dois modos emocionais
│   │   │   ├── App.tsx
│   │   │   └── main.tsx
│   │   ├── public/ # manifest PWA, ícones
│   │   ├── index.html
│   │   ├── vite.config.ts               # + vite-plugin-pwa
│   │   ├── tailwind.config.ts
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   └── service/ # Serviço Node persistente
│       ├── src/
│       │   ├── gateway/ # A · Session Gateway (Baileys)
│       │   │   ├── baileys/ # conexão, authState, reconexão
│       │   │   ├── normalize/ # evento bruto → evento mínimo
│       │   │   └── index.ts
│       │   ├── risk/ # B · Risk Worker (pipeline)
│       │   │   ├── rules/ # regras determinísticas
│       │   │   ├── classifier/ # classificador estreito
│       │   │   ├── llm/ # camada LLM (apoio, JSON validado)
│       │   │   ├── policy/ # política determinística
│       │   │   └── index.ts
│       │   ├── orchestrator/ # C · Incident Orchestrator
│       │   │   ├── ladder/ # escada de entrega + escalonamento
│       │   │   ├── channels/ # whatsapp, twilio, push, sms
│       │   │   └── index.ts
│       │   ├── http/ # servidor p/ webhooks (Twilio/WhatsApp)
│       │   ├── shared/ # específico do serviço
│       │   │   ├── queue/ # interface de fila (impl. PGMQ)
│       │   │   ├── db/ # client service-role
│       │   │   ├── crypto/ # envelope encryption das chaves
│       │   │   ├── config/ # env + segredos (validado)
│       │   │   └── logging/ # logger sem PII
│       │   └── index.ts                 # bootstrap: sobe os três papéis + http
│       ├── keys/ # (gitignored) authState em dev
│       ├── tests/
│       ├── .env.example
│       ├── Dockerfile
│       ├── tsconfig.json
│       └── package.json
│
├── packages/
│   └── shared/ # COMPARTILHADO entre web e service
│       ├── src/
│       │   ├── db-types.ts              # tipos gerados do Supabase
│       │   ├── contracts.ts             # tipos de comandos/eventos/incidentes
│       │   └── index.ts
│       ├── tsconfig.json
│       └── package.json
│
├── supabase/
│   ├── migrations/ # schema versionado (fonte da verdade)
│   ├── functions/ # Command API (Edge Functions, Deno)
│   │   ├── _shared/ # auth guard, validação, rate limit
│   │   ├── start-simulation/
│   │   ├── acknowledge-incident/
│   │   └── pair-device/
│   └── config.toml                      # config da Supabase CLI
│
├── .gitignore                           # keys/, .env, node_modules, dist
├── package.json                         # workspaces root
├── pnpm-workspace.yaml                  # (se pnpm)
├── README.md
├── CLAUDE.md                            # Como trabalhar: fluxo, disciplina, guardrails
├── PLANO_DE_CONSTRUCAO.md               # Fonte de verdade operacional — o que fazer, em que ordem, e o critério de "pronto"          
├── CONTEXTO_PRODUTO.md                  # O porquê do produto: mercado, modelo de negócio, aprendizados estratégicos
└── requirements.txt                     # Versões e travas de compatibilidade de cada tecnologia
```

Se tiver dúvida sobre onde um código deveria morar, o **"Local"** indicado no cabeçalho de cada fase do plano resolve isso diretamente.

---

## Princípios não-negociáveis (valem em qualquer tarefa, de qualquer fase)

Estas são decisões já tomadas na arquitetura consolidada do produto — não as reconsidere tarefa a tarefa, apenas as respeite:

- **O LLM é apoio, nunca autoridade.** O motor de risco decide por camadas: regras determinísticas → classificador → LLM (só para casos ambíguos) → política determinística (código auditável). O LLM nunca emite sozinho "é golpe confirmado", não tem ferramentas, e recebe conteúdo de mensagem **delimitado como dado não-confiável** (é entrada potencialmente adversarial — pode ter sido escrita por um golpista tentando manipular a análise).
- **Nunca logar nem persistir conteúdo bruto.** Texto de mensagem, áudio e telefones completos não vão para logs nem são armazenados além do necessário. O que trafega entre módulos é **sinal** (flags, metadados, scores), não conteúdo. Essa disciplina nasce no bootstrap do serviço (Fase 4) — não é algo para "adicionar depois" na Fase 11.
- **Menor privilégio entre os módulos.** Só o Session Gateway toca nas chaves do Baileys. O Risk Worker não acessa chaves nem a `service_role` geral. O app (front) nunca tem `service_role` — só a `anon key`. A Command API (Edge Functions) valida com a permissão do usuário logado; o serviço Node usa `service_role` — os dois ficam propositalmente isolados um do outro.
- **Realtime é dica, nunca garantia de entrega.** Qualquer alerta depende de uma escada multicanal com confirmação (push → WhatsApp/SMS → ligação → 2º guardião → "sem confirmação"), nunca de um único canal. Um incidente só é considerado "tratado" quando **uma pessoa confirma** — não quando uma notificação é apenas enviada.
- **Honestidade de escopo do MVP.** O produto **não** detecta voz clonada em chamada telefônica ao vivo — isso é tecnicamente inviável de forma legítima com as ferramentas disponíveis, e ficar fora do escopo é uma decisão consciente, não uma lacuna a "consertar" por conta própria. O canal de voz é protegido por hábito ensaiado (senha combinada) + intervenção pós-detecção textual.
- **RLS sempre, por família.** Toda tabela de aplicação tem Row Level Security ativa; um guardião só acessa dados da própria família. Ao testar, verifique sempre o caso **negativo** (não deveria conseguir ver X) além do positivo.
- **O app nunca escreve direto numa fila.** Comandos do guardião passam por uma Edge Function que valida (autorização, vínculo, cooldown, idempotência) e só então publica um job — nunca uma escrita direta e não validada.

---

## Quando consultar o CONTEXTO_PRODUTO.md

Abra esse arquivo para entender o **porquê** por trás de uma tarefa — não para decidir o que fazer (isso vem do plano), mas para não implementar algo que contradiga a tese do produto. Sinais de que vale a pena abrir:

- Está implementando uma tela e não tem certeza do tom/linguagem certos para o guardião ou para o protegido.
- Uma decisão de UX ou de regra de negócio parece poder ir em duas direções e o plano não resolve qual.
- Precisa entender por que uma funcionalidade existe do jeito que existe (ex.: por que a senha é fixa e não rotativa; por que não há app para o idoso; por que o LLM não decide sozinho).

---

## O que fazer quando travar

- **Tarefa ambígua ou parece incompleta:** releia a tarefa no plano e a seção correspondente do `CONTEXTO_PRODUTO.md`. Se ainda não resolver, **pergunte ao usuário** — não assuma e siga em frente numa direção que pode contradizer a arquitetura.
- **Versão de pacote no `requirements.txt` parece desatualizada:** verifique a última patch/minor do mesmo major antes de instalar. Não suba de major (ex.: Baileys 6→7, Tailwind v3→v4) sem avisar o usuário — majors trazem breaking changes documentados que merecem decisão consciente.
- **Um critério de "Como garantir" não passa:** não marque a tarefa como concluída. Corrija primeiro; se travar de verdade, explique o que tentou e pergunte antes de pular a validação.

## Convenções de commit

- `feat: <o que foi feito> (T<fase>.<número>)` para tarefas novas.
- `fix: <o que foi corrigido> (T<fase>.<número>)` para correções.
- Ao concluir uma fase inteira, vale revisar o cabeçalho da fase seguinte no plano antes de começar — ele diz o que essa fase assume como já pronto.
