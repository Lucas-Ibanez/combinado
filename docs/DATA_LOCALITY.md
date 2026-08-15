# Localidade de Dados — Combinado

**Ultima atualizacao:** 2026-08-15
**Referencia:** RIPD secao 4 | Resolucao CD/ANPD n. 19/2024

---

## Principio

Todo dado pessoal do Combinado deve residir no Brasil (regiao AWS sa-east-1,
Sao Paulo), exceto quando houver necessidade tecnica justificada e mecanismo
formal de transferencia internacional ativo.

---

## Mapa de residencia

| Componente | Dado | Regiao | Provedor | Pessoal? |
|---|---|---|---|---|
| PostgreSQL (Supabase) | Cadastro, incidentes, audit_log, risk_events | **sa-east-1** | Supabase (AWS) | Sim |
| Supabase Auth | Sessoes, MFA, tokens | **sa-east-1** | Supabase (AWS) | Sim |
| Vault Baileys | Chaves de sessao WhatsApp (AES-256-GCM) | **sa-east-1** | Supabase (AWS) | Sim (sensivel) |
| Edge Functions | Logica de comando (stateless) | **sa-east-1** (preferencial) | Supabase/Deno Deploy | Transiente |
| Servico Node | Gateway + Risk + Orchestrator | **sa-east-1** (deploy) | [a definir: Railway/Fly/EC2] | Em memoria apenas |
| NVIDIA NIM API | Sinais de risco (flags booleanas) | **us-east-1** (EUA) | NVIDIA | **Nao** — payload anonimizado |
| Twilio | Telefone + texto de alerta generico | **us-east-1** (EUA) | Twilio | Sim (telefone) |

---

## Transferencias internacionais

### NVIDIA NIM API (LLM)

- **O que e transferido:** sinais booleanos (pix_mention, urgency_language, etc.),
  metadados numericos (text_length, wa_timestamp), tipo de mensagem. NENHUM dado
  pessoal identificavel (sem nome, telefone, JID, conteudo de mensagem).
- **Mecanismo:** minimizacao que elimina dado pessoal do payload. Headers
  `X-No-Training` e `X-No-Logging` em toda requisicao.
- **Risco residual:** baixo — o payload nao contem informacao que permita
  identificar o titular mesmo combinando todos os campos.
- **Acao pendente:** firmar DPA com NVIDIA; avaliar endpoint em regiao BR.

### Twilio (SMS e ligacoes)

- **O que e transferido:** numero de telefone do destinatario + corpo da mensagem
  (texto padrao do sistema, sem conteudo de conversa do usuario).
- **Mecanismo:** clausulas contratuais padrao. Twilio possui GDPR DPA aderente
  ao modelo da ANPD.
- **Risco residual:** medio — o telefone e dado pessoal. A minimizacao e que o
  corpo da mensagem e template fixo, sem conteudo variavel do usuario.
- **Acao pendente:** assinar Twilio DPA; verificar aderencia ao modelo ANPD 2024.

---

## Checklist para producao

- [ ] Projeto Supabase de producao criado na regiao sa-east-1 (Sao Paulo)
- [ ] Deploy do servico Node em regiao sa-east-1
- [ ] DPA assinado com Supabase
- [ ] DPA assinado com NVIDIA
- [ ] DPA assinado com Twilio
- [ ] Verificar disponibilidade de endpoint NVIDIA NIM em regiao BR
- [ ] Edge Functions configuradas para preferencialmente rodar em sa-east-1
- [ ] Auditoria periodica (semestral) de localidade com revisao deste documento

---

## Decisoes tecnicas condicionadas pela localidade

1. **Supabase sa-east-1 obrigatorio:** o projeto de producao DEVE ser criado
   nesta regiao. Projetos de desenvolvimento podem usar outra regiao.

2. **LLM sem dado pessoal:** o pipeline de risco (MinimalEvent) foi desenhado
   para NUNCA enviar dado pessoal ao LLM. Se um futuro modelo exigir contexto
   textual, a transferencia deve ser reavaliada com o DPO.

3. **Servico Node co-localizado:** o servico que processa mensagens do Baileys
   deve rodar na mesma regiao do banco (sa-east-1) para que dados pessoais
   nunca transitem por regiao diferente em texto claro.

4. **Twilio — numero BR:** usar numero de origem brasileiro (+55) para SMS e
   ligacoes, mantendo a infraestrutura de comunicacao no pais quando possivel.
