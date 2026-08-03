# Combinado — Contexto do Produto e da Solução

> **Como usar este documento:** este arquivo existe para dar ao Claude Code o contexto de negócio, produto e arquitetura necessário para construir o MVP com bom senso — sem precisar reperguntar "por que isso existe" ou "por que aquilo foi descartado". Ele resume o conteúdo de seis documentos de pesquisa/estratégia do projeto. Para o passo a passo tarefa-por-tarefa de construção (T0.1, T1.2, etc.), o documento fonte é o **Plano de Construção do MVP** — este arquivo aqui é o "porquê" por trás daquele "como".
>
> Projeto: competição de produto/IA de 6 semanas · Documentos vivos, compilados entre 25/07/2026 e 30/07/2026.

---

## 1. Resumo em uma frase

Golpistas usam IA — clonagem de voz numa ligação, imitação de escrita numa mensagem de WhatsApp — para se passar por parentes e induzir famílias brasileiras a fazer um Pix de emergência. O **Combinado** captura e analisa automaticamente as mensagens de WhatsApp da pessoa protegida em busca desse padrão, e ajuda a família a sempre confirmar com uma **senha secreta combinada** antes de qualquer transferência — um hábito ensaiado com antecedência para funcionar mesmo sob pressão. Começamos pelas famílias brasileiras com um parente mais vulnerável (idoso).

---

## 2. O problema e por que agora

- Entre jul/2024 e jun/2025, **~24 milhões de brasileiros** foram vítimas de golpes com Pix/boleto, prejuízo de **~R$ 29 bilhões** (FBSP). O setor bancário perdeu R$ 10,1 bi em 2024 (+17%, Febraban). O prejuízo total estimado (PF/MJSP) foi de R$ 52 bi em 2024 (+80%).
- O Brasil lidera a América Latina em crescimento de deepfake (+800–830% em um ano) e é projetado pela ACI Worldwide/GlobalData como o **país de maior crescimento mundial em fraude de pagamento em tempo real** — perdas do Pix podem chegar a R$ 11 bi/ano até 2028.
- O golpe de **personificação de um conhecido pedindo dinheiro** está sempre no pódio dos golpes mais comuns do país (28–31% de recorrência, fontes PF/Febraban), empatado entre dois canais: ligação de voz e WhatsApp.
- **Por que o Pix muda tudo:** o pagamento é instantâneo e irreversível (fraude "Authorized Push Payment"). O intervalo entre clonar o WhatsApp e esvaziar a conta caiu para minutos — por isso a defesa precisa ser um **reflexo ensaiado com antecedência**, não uma verificação decidida sob pressão.
- **Perfil de vítima — a distinção que sustenta o produto:** jovens de 16–29 anos são o maior grupo de vítimas de fraude digital *em volume* (27%, DataSenado) — não os idosos (16%). A afirmação correta **não é** "idosos sofrem mais fraude digital"; é que **idosos são o alvo desproporcional deste golpe específico** (personificação de confiança) — o de maior tíquete (R$ 2.200 em média, até R$ 11.700, Procon/MP-PI), maior vulnerabilidade e menor capacidade de recuperação. 68% dos idosos acham praticamente impossível se proteger sozinhos (Fundação Seade).
- **Urgência demográfica:** Censo 2022 — 32,1 milhões de brasileiros com 60+ (15,8% da população, crescendo para 37,8%/75,3 mi até 2070). **5,66 milhões de idosos vivem sozinhos** — o isolamento que o golpista explora artificialmente já existe de fábrica para essas pessoas. É o dado de wedge mais forte do produto.
- **A defesa recomendada já existe, mas ninguém a automatizou em português no trilho do Pix:** o FBI, a FTC e (no Reino Unido) o próprio banco Starling recomendam publicamente combinar uma palavra-código familiar antes de qualquer pedido de dinheiro por voz. O Combinado automatiza exatamente essa recomendação.
- **Validação externa (Y Combinator, Fall 2026):** o Combinado intersecta duas *Requests for Startups* da YC, ambas do mesmo partner (Max Kolysh) — "AI for the Aging Population" (tecnologia para cuidadores de idosos) e "Proving You're Human" (reconstruir a camada de confiança quando ver um rosto e ouvir uma voz não prova mais nada). O caso de abertura da segunda chamada (Arup, US$ 25 milhões perdidos numa videochamada com deepfakes) é citado nos próprios documentos do projeto como o cenário de expansão corporativa futura.

---

## 3. A solução — escopo atual

### 3.1 Dentro do escopo agora
- **Captura automatizada de mensagens de WhatsApp** da própria conta da pessoa protegida — via biblioteca **Baileys**, sem encaminhamento manual, sem bot separado.
- **Um único pilar comportamental: Implementation Intentions.** A senha da família vira um hábito incondicional ensaiado com antecedência (base: meta-análise de Gollwitzer & Sheeran). O gatilho nunca é "a pessoa desconfiou" — é sempre "existe um pedido de dinheiro alegando ser de um familiar", sem exceção.
- **Proteção para dois canais de ataque:**
  - **Mensagem de WhatsApp** — com apoio automatizado de detecção (o motor de risco).
  - **Ligação de voz** — apoiada inteiramente no hábito ensaiado, **sem apoio tecnológico** (ver limitação técnica abaixo).
- **Painel onde a família configura a senha** e pratica o ritual com simulações leves e periódicas.
- A senha é **fixa**, escolhida pela família (não rotativa) — trocar com frequência mina a formação do hábito e vai contra a recomendação atual do NIST de evitar troca periódica obrigatória. Troca só ocorre sob suspeita real de comprometimento.

### 3.2 Fora de escopo — removido ou descartado deliberadamente
**Importante: não reintroduzir isto sem decisão explícita do time.**
- **Confirmação por uma segunda pessoa (princípio dos "quatro olhos")** — chegou a ser desenhada em detalhe (inspirada em prevenção de fraude corporativa, redução de até 85% em transferências não autorizadas), mas foi **removida do escopo atual**. Consequência aceita: a robustez do produto depende inteiramente do hábito ensaiado, sem uma segunda trava estrutural.
- **Bot separado no WhatsApp para encaminhamento manual** — substituído pela captura automatizada via Baileys.
- **Detecção biométrica de deepfake** (voz/rosto) — território de Reality Defender, GetReal, Sensity. O Combinado deliberadamente **não compete em detecção**.
- Golpe de loja falsa, pirâmide financeira, golpe romântico sem pedido de dinheiro — não há relação de confiança prévia sendo personificada; mecanismo não se aplica.
- Golpe de APK/malware — segurança de dispositivo, território de antivírus.
- Bloqueio técnico automático da transferência Pix — exigiria parceria bancária/PSP; visão de longo prazo, não do MVP.
- Bots em redes sociais, verificação de apps de namoro, avaliações verificadas — descartados por exigirem infraestrutura demais ou terem baixo reaproveitamento do que já existe.

### 3.3 Nome e posicionamento
**Combinado** — referência direta ao "tá combinado?" do dia a dia familiar brasileiro. Carrega o conceito do produto sem precisar explicar, e é neutro o suficiente para expansão futura além do público inicial de idosos.

---

## 4. Público-alvo — três papéis, um só comprador

| Papel | Quem é | Função |
|---|---|---|
| **Protegido** | O idoso — usuário e beneficiário. | Não instala nada, não é o comprador. Fricção zero é pré-condição de produto. |
| **Guardião** | O filho adulto. | **Comprador e pagador — o foco de toda a venda e do produto.** Alta intenção emocional (culpa/ansiedade de não estar presente) + capacidade de gasto. |
| **Família / círculo** | A unidade de venda. | Um plano protege vários; proteger um puxa os demais para o produto (efeito de rede doméstica, como Life360). Cobrar **por círculo, não por pessoa**. |

**Wedge inicial:** famílias brasileiras com um parente mais vulnerável — majoritariamente idosos — e alguém que administra a segurança dele à distância. A arquitetura por baixo é geral; a porta de entrada é estreita de propósito, para validar rápido em 6 semanas.

Referência de comportamento do cuidador (dado dos EUA, tratar como **analogia, não medição nacional** — não existe pesquisa brasileira equivalente ainda): AARP estima 63 milhões de cuidadores nos EUA (~1 em 4 adultos), gastando em média US$ 7.242–8.728/ano cuidando de um parente à distância; 84% desses cuidadores são os principais decisores financeiros do lar. Validar a disposição a pagar real no Brasil é, em si, um objetivo do MVP.

---

## 5. Modelo de negócio

### 5.1 Os três horizontes (sequenciais — só abrir o próximo quando o anterior estiver provado)

| Horizonte | O quê | Papel |
|---|---|---|
| **H1 — Beachhead B2C** | Assinatura familiar anual, cobra o filho (não o idoso). | Prova modelo + unit economics. Wedge: idosos que vivem sós. |
| **H2 — Escala B2B2C** | Embed/white-label via bancos, seguradoras, operadoras, associações de aposentados. | Colapsa o CAC e empresta confiança — **condição de sobrevivência da economia unitária em escala**, não luxo de fase 2. |
| **H3 — Receita nova/global** | B2B corporativo (proteção contra personificação de executivo/CEO fraud) + licença de sinal de risco a bancos/PSPs + expansão internacional. | Segunda linha de produto/receita, entra depois, não no lugar do núcleo familiar. |

**B2B puro (venda direta a empresas) não é o ponto de partida:** ciclo de vendas de 6–18 meses, integração/compliance pesados — inviável para provar produto em 6 semanas.

### 5.2 Precificação e economia unitária
- **Âncora de preço anual: R$ 180–300/ano** (coerente com Savi nos EUA, US$ 63/ano).
- **Modelo híbrido, não "um ou outro":** camada **grátis** para o protocolo (círculo familiar, palavra-código, simulação, verificador manual — o que espalha a rede) + camada **paga** para a proteção ativa (monitoramento contínuo, código rotativo, acionamento do guardião, orientação ao MED). Dado que resolve essa bifurcação (RevenueCat, >115 mil apps): hard paywall converte ~11% até o dia 35 vs. ~2% do freemium puro, mas a retenção em 1 ano é quase idêntica (27% vs. 28%) — logo, grátis o hábito, pago o guardião.
- **Guardrail de unit economics a respeitar (não usar números otimistas demais):** o CAC completo precisa ficar **abaixo de ~R$ 80–90** no B2C para o modelo fechar a uma razão LTV:CAC de 3:1 no cenário-base. Alcançar o filho adulto por mídia paga raramente cabe nesse teto — **por isso o B2B2C não é opcional**, é a peça que faz a conta fechar.
- ⚠️ **Não usar como número âncora:** um cálculo de LTV/CAC de 8,57× que aparece em uma das pesquisas de mercado depende de três premissas otimistas simultâneas (churn de só 20%, CAC de R$ 150, preço de R$ 299) sem nenhum dado real de retenção de família brasileira ainda. Tratar como hipótese, não como fato.
- **A matemática do seguro (mensagem de venda):** uma assinatura de ~R$ 25/mês se paga evitando um golpe a cada sete anos, contra um prejuízo médio de R$ 2.200 por vítima — e o mecanismo estatal de devolução (MED) só recupera ~9,3% do valor depois do fato.

### 5.3 Comparáveis de mercado (para calibrar expectativa, não para prometer)
- **Life360** — o melhor benchmark público: US$ 489,5 mi de receita 2025 (+32%), margem de assinatura ~86%, primeiro ano de lucro. Prova que segurança familiar por assinatura escala.
- **Savi** (US$ 7,99/mês) e **Antigrift** (US$ 9–39/mês) — validam o preço, mas sem dado financeiro público (não usar como prova de receita). Antigrift usa palavra **estática** + ímã de geladeira — reforça o diferencial do Combinado (código dinâmico/rotativo + análise automática).
- **Aura** — valuation de US$ 1,6 bi é bem fontada; a receita divulgada (~US$ 385 mi) vem de agregador não verificado — usar só a valuation.
- **True Link** — modelo quase idêntico (proteção financeira de idosos) e prova de que o canal B2B2C funciona: white-label para 250+ bancos/fiduciárias nos EUA.

---

## 6. Panorama competitivo

**Confirmado por quatro pesquisas independentes: não existe, hoje, nenhum concorrente brasileiro verificável que una análise automática de conversa + protocolo de palavra-código familiar localizado para Pix/WhatsApp.**

| Concorrente | O que faz | A lacuna que deixa |
|---|---|---|
| Savi (EUA) | Monitoramento de ligação ao vivo + texto | Protege cada pessoa isolada; sem protocolo de senha; "adicionar à ligação" ainda exige decisão manual sob pressão |
| WhatsApp (Scam Alert) | Detecta golpe de contato desconhecido, on-device | Só contato desconhecido; sem protocolo familiar |
| Google (Scam Detection) | Gemini Nano on-device, já em português no Brasil (jul/2026) | Só Pixel, só notificações; não autentica família |
| Antigrift (EUA) | Protocolo de senha familiar, sem app para o protegido | Palavra **estática** (esquecível/vazável); sem análise de conversa; só inglês |
| Truecaller Family | Guardião recebe alerta e encerra chamada suspeita | Maior ameaça funcional de curto prazo; ainda sem código familiar e sem Brasil |
| Aura+Qoria / Life360 | Grafo familiar pronto, >US$ 300 mi ARR, ~9 mi de famílias | Falta a camada de segredo — podem adicioná-la ou adquirir alguém que já a tenha |
| Bancos + BioCatch/Feedzai | Detectam coação na sessão bancária | Dentro do banco, sem o contexto da conversa que veio antes — **potenciais parceiros, não concorrentes** |
| MED 2.0 (Banco Central) | Rastreia e tenta reaver o dinheiro, obrigatório desde fev/2026 | Recupera só **~9,3%** do valor contestado (2025) — prova que recuperação não é prevenção |

### Diferenciais (defensáveis, um por frase)
1. Automatizamos o que hoje só um banco (Starling, Reino Unido) recomenda manualmente — e de forma **dinâmica**, não estática como a Antigrift.
2. **Detecção é gatilho, não promessa** — não competimos na corrida armamentista do deepfake (um benchmark acadêmico, Deepfake-Eval-2024, mostrou detectores perdendo ~48–50% de acurácia contra deepfakes recentes).
3. O guardião recebe **o evento de risco, não a conversa** (modelo "Trusted Advocate" da EverSafe) — cuidado, não vigilância.
4. Prevenimos **antes** do Pix ser feito; o MED só age (mal) depois.

### Honestidade — o que ainda não é fosso
O código rotativo local já existe em produtos como Family Moat e Trust Onion — **não é vantagem competitiva por si só**. O fosso real só nasce com (a) dados comportamentais brasileiros consentidos (padrões de urgência, linguagem de golpe, primeira transferência a uma chave nova) e (b) distribuição via instituições de confiança (bancos, operadoras, associações). Não apresentar a posição atual como já sendo um fosso construído.

---

## 7. Arquitetura técnica

> Esta seção é a mais relevante para a construção em si. Ver o **Plano de Construção do MVP** para as tarefas T#.# detalhadas por fase — aqui vai o "porquê" de cada decisão estrutural.

### 7.1 As três decisões estruturais do plano atual
1. **Um monorepo único** (`combinado`) com workspaces: `apps/web` (o app do guardião), `apps/service` (o serviço Node persistente), `packages/shared` (tipos e contratos compartilhados), `supabase/` (schema + Edge Functions). Não há mais dois repositórios nem truque de sincronizar tipos via CLI — é um `import` direto.
2. **Supabase compartilhado como contrato e barramento**: schema (Postgres), RLS, filas (PGMQ), Auth+MFA. É a interface estável que separa o app do serviço.
3. **A Command API continua sendo Edge Functions do Supabase** — por razão de **segurança** (roda com a permissão do usuário, nunca com `service_role`), não por conveniência de ferramenta. O serviço Node, que usa `service_role`, fica isolado dela.

### 7.2 Estrutura do monorepo (alvo da Fase 0)
```
combinado/
├── apps/
│   ├── web/                    # App do Guardião — React/Vite/TS
│   │   └── src/{components,features,pages,hooks,lib,styles}
│   └── service/                 # Serviço Node persistente
│       └── src/
│           ├── gateway/         # A · Session Gateway (Baileys)
│           ├── risk/            # B · Risk Worker (pipeline de risco)
│           ├── orchestrator/    # C · Incident Orchestrator (escada)
│           ├── http/             # servidor p/ webhooks (Twilio/WhatsApp)
│           └── shared/           # fila, db (service_role), crypto, config, logging
├── packages/
│   └── shared/                   # tipos do banco + contratos — SEM segredos
├── supabase/
│   ├── migrations/                # schema versionado (fonte da verdade)
│   ├── functions/                  # Command API (Edge Functions, Deno)
│   └── config.toml
```

**Regra que separa contrato de segredo:** `packages/shared` guarda só o que os dois lados precisam conhecer em comum (tipos gerados do Supabase, formatos de comando/evento/incidente). Tudo que envolve segredo ou poder — cliente `service_role`, criptografia de chaves, implementação da fila — fica isolado em `apps/service/src/shared`, nunca no pacote compartilhado.

**Nota sobre runtimes:** as Edge Functions rodam em Deno, não Node — não participam do workspace npm/pnpm. É o único ponto do monorepo com dois runtimes convivendo.

### 7.3 Os três papéis do serviço (o núcleo técnico do produto)

| Papel | Responsabilidade | Não faz |
|---|---|---|
| **Session Gateway** | Conecta como dispositivo vinculado ao WhatsApp via **Baileys**; escuta `messages.upsert`; normaliza para um "evento mínimo" (sinais, não conteúdo bruto); publica na `risk_queue`; reconecta sozinho. | Não analisa risco, não decide nada. |
| **Risk Worker** | Pipeline em camadas: **regras determinísticas** (número novo, urgência, menção a Pix, "aparelho quebrado") → **classificador estreito** (score para casos intermediários) → **LLM como apoio** (só para ambíguos, JSON validado, sem ferramentas, nunca decide sozinho) → **política determinística** (a autoridade final, auditável e reproduzível). | Não mantém sessão do WhatsApp; não toca chaves. |
| **Incident Orchestrator** | Cria/agrupa incidentes; aplica cooldown/dedup (para um golpista não disparar dezenas de alertas); roda a **escada de entrega** (push → WhatsApp/SMS → ligação → 2º guardião → sem confirmação); registra cada tentativa com timestamps. | Não decide risco, só executa a política já decidida. |

**Princípio central de IA no pipeline: a LLM é apoio, nunca autoridade.** Quem decide se abre incidente e em que severidade é a política determinística (código auditável), não o modelo de linguagem. Isso existe para que a decisão seja sempre reproduzível e defensável.

### 7.4 Modelo de dados (conjunto mínimo do MVP)
`families` · `guardians` · `protected_persons` · `guardian_links` (N:N com papel/permissões) · `incidents` (estado, severidade, timestamps) · `incident_deliveries` (canal, enviado/entregue/confirmado, motivo de falha) · `risk_events` (sinal, nunca conteúdo bruto) · `simulations` · `secrets_family` (a palavra-código, protegida) · `audit_log`.

Todas as tabelas de aplicação usam **RLS** (Row Level Security): um guardião só lê/escreve linhas cujo `family_id` pertence a uma família à qual ele está vinculado. As chaves de sessão do Baileys ficam num **schema isolado** (`vault_baileys`), fora do `public`, acessível só pela role própria do Session Gateway.

### 7.5 Segurança e privacidade — não-negociáveis
- **Envelope encryption** das chaves do Baileys, chave por protegido via KMS.
- **Menor privilégio entre papéis**: o Gateway não usa `service_role` geral; o Risk Worker não acessa chaves; a LLM não vê número completo nem dado de auth; o Orchestrator só executa política.
- **"Subir sinal, não conteúdo bruto"**: processar em memória sempre que possível; não persistir conversas completas; TTL curto para áudio/mídia; fornecedor de IA sem treinamento nem retenção. O guardião nunca vê o conteúdo bruto da conversa, só o alerta de risco.
- **MFA (TOTP) obrigatório** para o guardião; step-up auth para ações sensíveis (adicionar protegido, trocar número).
- **Confirmação fora do canal comprometido**: o guardião confirma no app (canal independente do WhatsApp potencialmente comprometido); o idoso recebe confirmação por contato previamente conhecido.
- Base LGPD: iniciar RIPD (Relatório de Impacto), dados no Brasil ou mecanismo formal de transferência (ANPD 2024).

### 7.6 Limitações técnicas conhecidas (não tentar "resolver" sem decisão explícita)
- **Baileys é uma abordagem não-oficial** (não é a API de negócios da Meta). Existe risco real de banimento da conta pessoal se o padrão de uso for identificado como automação. Mitigação atual: validar sempre em número de teste (chip separado) antes de produção — nunca usar a conta pessoal do protegido para testes.
- **Não existe, hoje, forma legítima de um app de terceiros escutar automaticamente uma ligação em segundo plano** em iOS ou Android — nem a Savi (com capital e engenharia próprios) contorna isso de verdade (o recurso dela mescla uma terceira linha manualmente). Por isso, a proteção no canal de voz depende **inteiramente** do hábito ensaiado, sem nenhum apoio tecnológico. Um experimento paralelo do programa investiga se existe algum caminho viável (encaminhamento condicional de chamada, mesclagem de linha) — mas isso é exploração à parte, **não faz parte do caminho crítico do MVP**.

---

## 8. Plano de construção — visão das 14 fases

> Detalhamento completo (tarefas T0.1...T13.6, comandos, critérios de "pronto quando") está no documento **Plano de Construção do MVP**. Este é só o mapa de navegação.

| Fase | O que entrega | Local no monorepo |
|---|---|---|
| F0 | Fundações — contas, monorepo com workspaces, ambiente, segredos | raiz |
| F1 | Contrato: schema do Supabase — tabelas, RLS, schema isolado de chaves, filas PGMQ, Auth+MFA, tipos gerados | `supabase/`, `packages/shared` |
| F2 | Command API — Edge Functions que validam e publicam jobs | `supabase/functions` |
| F3 | App: esqueleto navegável — scaffold Vite/Tailwind/shadcn, tokens, Auth+MFA, shell das 4 áreas | `apps/web` |
| F4 | Serviço: bootstrap — estrutura dos 3 papéis, config, logging sem PII, cliente Supabase, interface de fila | `apps/service` |
| F5 | Session Gateway — Baileys, pareamento, captura de `messages.upsert`, evento mínimo na fila, reconexão | `apps/service` |
| F6 | Risk Worker — pipeline regras → classificador → LLM (apoio) → política determinística | `apps/service` |
| F7 | Incident Orchestrator — cria incidente, cooldown/dedup, escada, registro de deliveries | `apps/service` |
| F8 | App: Central de Incidentes — lista/detalhe, Realtime como dica, reconciliação, modo incidente, confirmação | `apps/web` |
| F9 | Canais de intervenção reais — WhatsApp Business, Twilio, Push+SMS, servidor de webhooks | `apps/service` |
| F10 | Fluxos de produto — onboarding, simulações, chat de verificação, painel do protegido, múltiplos guardiões | `web` + `service` |
| F11 | Segurança & privacidade — criptografia de chaves, menor privilégio, TTL/descarte, rate limits, LGPD | `service` + `web` |
| F12 | Design & acessibilidade — dois modos emocionais, nunca-só-cor, Vaul, anti-toque acidental, PWA | `apps/web` |
| F13 | Deploy & piloto — deploy do app (Vercel/CF) e do serviço, threat model, teste ponta a ponta, piloto com 2–3 famílias reais | raiz |

**Ordem de execução:** depois que o schema (F1) estiver de pé, o app (F3) e o serviço (F4–F5) são trilhas tecnicamente independentes — só se reencontram na F8. Trabalhando sozinho, seguir a ordem numérica é o caminho seguro.

**Critério de priorização quando houver dúvida:** a menor quantidade de pontos de falha alcançável com as ferramentas disponíveis, sem prometer o que não se entrega. Uma peça simples que funciona ponta a ponta vale mais, nesta fase, do que uma sofisticada que ninguém opera em seis semanas.

**Deploy:** app em Vercel ou Cloudflare Pages; serviço Node (processo persistente, precisa manter a sessão do Baileys) em Railway, Render ou Fly.io.

**Marco final do projeto:** piloto testável de ponta a ponta com 2–3 famílias reais, gerando dados reais de adoção do hábito — não hipóteses.

---

## 9. Princípios de design e produto

- **Dois modos emocionais, nada entre eles:** modo normal (calmo, discreto — verde profundo, uma ação primária por tela) e modo incidente (diretivo, enfático — âmbar para atenção, vermelho **reservado só para crise**).
- **Nunca só cor (WCAG):** todo estado combina texto + ícone + forma + cor + ação. "Desconectado" nunca é um pontinho cinza discreto — é aviso claro com ação de reconexão, porque "a família acha que está protegida, mas a sessão caiu" é o estado mais perigoso do produto.
- **Fricção zero para o protegido:** o idoso não instala nem aprende nada; quem configura é a família.
- **Anti-toque acidental:** ações críticas (acionar/bloquear) exigem gesto deliberado ("deslize para confirmar"), não um toque único.
- **Painel do protegido contra abuso do guardião:** o idoso pode ver quem são os guardiões, revogar acesso e consultar intervenções. Adicionar um novo guardião exige confirmação do idoso — requisito ético do threat model, não um detalhe.
- **Privacy-first como promessa de venda, não só como arquitetura:** "sem biometria, e nunca precisamos ouvir uma ligação."

---

## 10. Riscos e limitações conhecidas (resumo)

| Risco | Natureza | Mitigação atual |
|---|---|---|
| Banimento de conta via Baileys | Técnico/ToS | Validar sempre em número de teste; tratar como trade-off consciente, nunca ocultar |
| Sem segunda camada estrutural (o "quatro olhos" foi removido do escopo) | Produto | Aceito nesta fase; robustez depende inteiramente do hábito ensaiado |
| Ligação de voz sem apoio tecnológico | Técnico | Coberto só pelo ritual; experimento paralelo à parte investigando alternativa |
| Comoditização da camada de detecção | Mercado | Google, WhatsApp, Savi, McAfee avançam rápido — por isso o produto não compete em detecção |
| Senha estática pode ser exposta uma vez | Segurança | Troca só sob suspeita real de comprometimento, reforçada por ensaio contínuo |
| Economia unitária ainda não provada | Negócio | Usar o guardrail de CAC (< R$80–90), não o número otimista de LTV/CAC; validar no piloto |
| Ausência de dado brasileiro de disposição a pagar do cuidador | Negócio | Tratar dados dos EUA (AARP/True Link) como analogia; medir de verdade no MVP |

---

## 11. Glossário rápido

- **Implementation Intentions** — pilar comportamental do produto: planos do tipo "se [situação X], então eu faço [ação Y]", formados com antecedência, que disparam quase automaticamente mesmo sob estresse (Gollwitzer & Sheeran).
- **Baileys** — biblioteca (TypeScript/WebSocket) que implementa o protocolo oficial multi-dispositivo do WhatsApp (desde 2021), permitindo que o backend se conecte como um "aparelho" vinculado à conta do protegido e receba mensagens em tempo real via o evento `messages.upsert`.
- **MED** — Mecanismo Especial de Devolução (Banco Central), rastreia e tenta reaver valores de fraude no Pix; recupera hoje só ~9,3% do valor contestado.
- **APP fraud (Authorized Push Payment)** — fraude em que a própria vítima autoriza a transferência sob engano; como o pagamento é instantâneo e irreversível, o alvo migra do banco (quase invulnerável a fraude lenta) para o ser humano.
- **Guardião** — o filho adulto que administra a segurança do protegido à distância; comprador e pagador do produto.
- **Protegido** — o idoso (ou parente vulnerável) cuja conta de WhatsApp é monitorada; usuário, não comprador.
- **Escada de entrega** — sequência de canais de alerta em caso de incidente (push → WhatsApp/SMS → ligação → 2º guardião), com escalonamento automático se não houver confirmação.
