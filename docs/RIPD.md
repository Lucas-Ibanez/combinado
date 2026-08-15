# Relatorio de Impacto a Protecao de Dados Pessoais (RIPD)

**Produto:** Combinado — protecao familiar contra golpes de personificacao por IA
**Controlador:** [nome juridico da empresa a definir]
**Encarregado (DPO):** [a nomear antes do lancamento publico]
**Data de inicio:** 2026-08-15
**Status:** EM ANDAMENTO — versao inicial para MVP, sujeita a revisao juridica

> Este documento atende ao Art. 38 da LGPD (Lei 13.709/2018) e as orientacoes da
> ANPD sobre Relatorio de Impacto a Protecao de Dados Pessoais. Deve ser revisado
> por assessoria juridica especializada antes de qualquer lancamento ao publico.

---

## 1. Descricao do tratamento

### 1.1 Finalidade

Prevenir golpes de personificacao (voz clonada e mensagens falsas pedindo Pix) contra
membros vulneraveis de familias brasileiras, mediante:

- Monitoramento automatizado de mensagens de WhatsApp do protegido
- Analise de risco baseada em sinais (padroes linguisticos, metadados)
- Alerta multicanal ao guardiao (app, push, SMS, ligacao)
- Verificacao por senha combinada (out-of-band)

### 1.2 Natureza do tratamento

- **Coleta**: metadados e sinais extraidos de mensagens de WhatsApp (NUNCA o conteudo bruto)
- **Analise**: pipeline automatizado de regras + classificador + LLM (apenas para casos ambiguos)
- **Armazenamento**: banco de dados gerenciado (Supabase/PostgreSQL)
- **Compartilhamento**: limitado a membros da mesma familia (RLS)
- **Exclusao**: automatizada por TTL (ver secao 5)

### 1.3 Escopo

| Categoria de dado | Exemplo | Classificacao LGPD |
|---|---|---|
| Dados cadastrais do guardiao | nome, e-mail, telefone | Dado pessoal |
| Dados do protegido | nome, telefone | Dado pessoal |
| Identificador WhatsApp (JID) | 5511999990000@s.whatsapp.net | Dado pessoal |
| Sinais de risco extraidos | pix_mention, urgency_language, unknown_sender | Dado pessoal derivado |
| Decisao do motor de risco | block/review/allow + severity | Dado pessoal derivado |
| Senha combinada (hash) | bcrypt hash | Dado pessoal |
| Logs de auditoria | acao, ator, timestamp | Dado pessoal |
| Chaves de sessao Baileys | criptografadas (AES-256-GCM, envelope encryption) | Dado pessoal sensivel |

**Dados que NAO sao coletados/armazenados:**
- Conteudo bruto de mensagens (texto, audio, video, imagens)
- Telefones completos em logs (apenas hash ou ultimos 4 digitos)
- Historico de conversas
- Dados biometricos
- Dados de localizacao

---

## 2. Bases legais

### 2.1 Base primaria: Legitimo interesse (Art. 7, IX)

**Teste de proporcionalidade (LIA — Legitimate Interest Assessment):**

| Criterio | Avaliacao |
|---|---|
| **Legitimidade** | Prevencao a fraude financeira — interesse reconhecido pela LGPD (Art. 10, I) e pelo sistema financeiro brasileiro |
| **Necessidade** | O monitoramento automatizado e necessario porque golpes de personificacao exploram urgencia (minutos entre contato e transferencia Pix). Verificacao manual pos-facto nao previne a perda |
| **Balanceamento** | Minimizacao rigorosa: apenas sinais sao extraidos, nunca conteudo bruto. O protegido consente via opt-in explicito no onboarding. O guardiao so ve resumo de sinais, nao mensagens |
| **Salvaguardas** | RLS por familia, TTL de dados, envelope encryption, audit log, MFA obrigatorio, step-up auth |

### 2.2 Base complementar: Consentimento (Art. 7, I)

- **Guardiao**: consente ao criar conta e aceitar termos de uso
- **Protegido**: opt-in explicito no onboarding (exibido ao guardiao para coletar junto ao protegido)

> **Ressalva para dado sensivel:** as chaves de sessao do Baileys podem ser
> consideradas dado sensivel por viabilizarem acesso a comunicacoes privadas.
> A base legal para este tratamento especifico e o consentimento explicito
> (Art. 11, I) do titular da sessao WhatsApp (o protegido), coletado no
> fluxo de pareamento. A protecao tecnica adicional inclui envelope encryption
> com chave mestra isolada (vault).

### 2.3 Base para menores

O produto destina-se a adultos (guardioes) protegendo outros adultos (idosos).
Caso menores de 18 anos sejam cadastrados como protegidos, o consentimento
especifico do responsavel legal sera exigido conforme Art. 14, parr. 1.

---

## 3. Agentes de tratamento

| Papel | Entidade | Funcao |
|---|---|---|
| **Controlador** | Combinado [entidade juridica] | Define finalidade e meios do tratamento |
| **Operador — Infraestrutura** | Supabase Inc. | Hospedagem de banco de dados (PostgreSQL), autenticacao, Edge Functions |
| **Operador — IA** | NVIDIA Corp. (API NIM) | Analise de sinais em casos ambiguos (sem acesso a conteudo bruto) |
| **Operador — Comunicacao** | Twilio Inc. | Envio de SMS e ligacoes (alerta ao guardiao/protegido) |
| **Sub-operador — Cloud** | AWS (us-east-1 para Supabase) | Infraestrutura cloud subjacente ao Supabase |

---

## 4. Localidade dos dados e transferencia internacional

### 4.1 Mapeamento de residencia

| Dado | Localidade | Provedor |
|---|---|---|
| Banco de dados (PostgreSQL) | **sa-east-1 (Sao Paulo)** — configuracao-alvo | Supabase (AWS) |
| Autenticacao e sessoes | sa-east-1 (Sao Paulo) | Supabase Auth |
| Edge Functions | Regiao mais proxima (preferencialmente sa-east-1) | Supabase/Deno Deploy |
| Chaves Baileys (vault) | sa-east-1 (Sao Paulo) | Supabase (mesmo cluster) |
| Audit log | sa-east-1 (Sao Paulo) | Supabase (mesmo cluster) |
| Chamadas LLM | EUA (NVIDIA NIM API) | NVIDIA |
| SMS/Ligacoes | EUA (Twilio) | Twilio |

### 4.2 Transferencia internacional

Dados enviados para NVIDIA e Twilio configuram transferencia internacional.
Mecanismos de adequacao conforme Resolucao CD/ANPD n. 19/2024:

| Operador | Dados transferidos | Mecanismo |
|---|---|---|
| **NVIDIA** | Apenas sinais de risco (flags booleanas + metadados numericos). NENHUM dado pessoal identificavel. Headers `X-No-Training` e `X-No-Logging` em toda requisicao | Clausulas contratuais padrao + minimizacao que elimina dado pessoal do payload |
| **Twilio** | Telefone do destinatario + texto de alerta generico (sem conteudo de mensagem) | Clausulas contratuais padrao (Twilio GDPR DPA, aderente a modelo ANPD) |

### 4.3 Acoes pendentes para producao

- [ ] Confirmar regiao sa-east-1 no projeto Supabase de producao
- [ ] Assinar DPA (Data Processing Agreement) com Supabase, NVIDIA e Twilio
- [ ] Verificar se NVIDIA NIM possui endpoint em regiao brasileira (reduz transferencia)
- [ ] Avaliar alternativa de LLM on-premise ou em regiao BR caso exigido

---

## 5. Ciclo de vida dos dados e retencao

| Dado | Retencao | Justificativa |
|---|---|---|
| Conteudo de mensagens | **Zero** — nunca armazenado | Minimizacao por design: apenas sinais sao extraidos em memoria |
| Mensagens sem sinais de risco | **Descartadas imediatamente** | Nao enfileiradas, nao persistidas (hasActiveSignals gate) |
| risk_events | 90 dias | Necessario para auditoria e deteccao de padroes |
| key_access_log | 30 dias | Log de acesso ao vault — auditoria de seguranca |
| Convites expirados | 30 dias apos expiracao | Dados obsoletos sem finalidade |
| Incidentes encerrados | 365 dias | Historico para o guardiao e eventual pericia |
| Dados cadastrais | Duracao da conta | Exclusao mediante solicitacao (Art. 18, VI) |
| Chaves Baileys | Duracao do pareamento | Revogadas ao despairear; criptografadas em repouso |

**Implementacao tecnica:** funcao `cleanup_expired_data()` executada a cada 6 horas
pelo servico Node, com datas absolutas (nao relativas a atividade do usuario).

---

## 6. Riscos identificados e mitigacoes

### 6.1 Matriz de riscos

| # | Risco | Probabilidade | Impacto | Mitigacao |
|---|---|---|---|---|
| R1 | Acesso nao autorizado as chaves Baileys | Baixa | Critico | Envelope encryption AES-256-GCM, vault isolado, master key em env var, acesso restrito ao gateway (scoped DB) |
| R2 | Vazamento de conteudo de mensagens | Muito baixa | Critico | Conteudo nunca e armazenado — apenas sinais. Logs sem PII. Normalize pipeline extrai flags, descarta texto |
| R3 | Re-identificacao por sinais combinados | Baixa | Alto | Sinais sao flags booleanas genericas; sem contexto textual, re-identificacao requer acesso ao banco + conhecimento da familia |
| R4 | Acesso cross-family a dados | Baixa | Alto | RLS em todas as tabelas, teste negativo obrigatorio, service_role nunca exposta ao frontend |
| R5 | Comprometimento da conta do guardiao | Media | Alto | MFA obrigatorio, step-up auth para acoes sensiveis, sessoes revogaveis, audit log |
| R6 | LLM treinando com dados do produto | Baixa | Medio | Headers `X-No-Training`/`X-No-Logging`, DPA com NVIDIA, payload sem dado pessoal |
| R7 | Retencao excessiva de dados | Baixa | Medio | TTL automatizado (cleanup a cada 6h), politica documentada |
| R8 | Falha na confirmacao out-of-band | Media | Alto | Escada multicanal (push > WhatsApp > SMS > ligacao > 2o guardiao), confirmacao pos-ack via SMS/ligacao |
| R9 | Uso indevido do sistema (stalking) | Baixa | Alto | Opt-in explicito do protegido, painel do protegido com revogacao independente, audit log de todas as acoes |

### 6.2 Avaliacao de necessidade e proporcionalidade

O tratamento e **necessario** porque:
- Golpes de personificacao exploram janelas de minutos (Pix instantaneo/irreversivel)
- O protegido tipicamente nao consegue avaliar a ameaca sozinho (68% dos idosos, Seade)
- A alternativa (verificacao manual pos-facto) nao previne a perda

O tratamento e **proporcional** porque:
- Apenas sinais sao processados, nunca conteudo
- O protegido mantem autonomia (opt-in, painel proprio, revogacao)
- Dados tem TTL automatizado
- Acesso e restrito por RLS a membros da familia

---

## 7. Direitos dos titulares (Art. 18)

| Direito | Como e atendido |
|---|---|
| Confirmacao e acesso (I, II) | Tela de configuracoes com historico de atividades (audit_log) |
| Correcao (III) | Edicao de dados cadastrais no app |
| Anonimizacao/bloqueio/eliminacao (IV) | Exclusao de conta remove dados; TTL elimina dados historicos |
| Portabilidade (V) | [A implementar — exportacao de dados em formato estruturado] |
| Eliminacao (VI) | Solicitacao via app ou e-mail; prazo de 15 dias uteis |
| Informacao sobre compartilhamento (VII) | Este documento + politica de privacidade |
| Revogacao de consentimento (IX) | Desparear dispositivo remove monitoramento; excluir conta remove tudo |
| Oposicao (XV) | Canal de contato para contestar tratamento |

---

## 8. Medidas de seguranca tecnicas e organizacionais

### 8.1 Tecnicas

- Criptografia em transito: TLS 1.2+ em todas as conexoes
- Criptografia em repouso: PostgreSQL com encryption at rest (Supabase/AWS)
- Envelope encryption para chaves Baileys (AES-256-GCM + master key isolada)
- Row Level Security (RLS) em todas as tabelas de aplicacao
- Menor privilegio: clientes DB escopados por papel (Proxy-based runtime enforcement)
- MFA obrigatorio (TOTP) + step-up auth para acoes sensiveis
- Sessoes revogaveis (sign-out global)
- Logger sem PII (telefones truncados, sem conteudo de mensagem)
- Validacao de entrada com Zod em todo boundary

### 8.2 Organizacionais

- [ ] Politica de privacidade publica (a redigir com assessoria juridica)
- [ ] Termos de uso com clausulas de consentimento explicito
- [ ] Processo de resposta a incidentes de seguranca
- [ ] Treinamento da equipe sobre protecao de dados
- [ ] Nomeacao de Encarregado (DPO)
- [ ] Contrato/DPA com cada operador (Supabase, NVIDIA, Twilio)

---

## 9. Consulta a partes interessadas

| Parte | Status |
|---|---|
| Assessoria juridica (LGPD) | **PENDENTE** — necessario antes do lancamento |
| ANPD (consulta previa, se aplicavel) | A avaliar com assessoria juridica |
| Titulares (protegidos/guardioes) | Testes de usabilidade em andamento |

---

## 10. Parecer e aprovacao

| Etapa | Responsavel | Data | Status |
|---|---|---|---|
| Elaboracao inicial | Equipe tecnica | 2026-08-15 | CONCLUIDO |
| Revisao juridica | [assessoria juridica] | — | PENDENTE |
| Aprovacao DPO | [a nomear] | — | PENDENTE |
| Revisao periodica | DPO + equipe tecnica | Semestral | — |

---

## Historico de revisoes

| Data | Versao | Descricao |
|---|---|---|
| 2026-08-15 | 0.1 | Versao inicial para MVP — elaborada pela equipe tecnica |
