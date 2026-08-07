# T5.3 — Retest live agendado

**Contexto:** em 2026-08-07 a validação end-to-end do listener `messages.upsert` foi bloqueada porque o WhatsApp aplicou rate-limit no número de teste após dois pareamentos Baileys no mesmo dia (T5.1 + T5.2). Nem QR nem código de 8 dígitos passaram — "Não é possível conectar novos dispositivos no momento".

A **lógica** foi validada por `tests/messages-upsert.smoke.ts` (31/31 asserts em `filterInbound` + `dispatchInbound`), mas falta ver o handler disparar com uma mensagem de WhatsApp de verdade.

## O que rodar amanhã (ou quando o rate-limit expirar)

Em terminais separados:

```bash
pnpm --filter @combinado/service start
```

```bash
pnpm --filter @combinado/service test:msg-upsert
```

Isso:
1. Cria uma família + protegido de teste no banco
2. Chama `pair_device_tx` → gera QR
3. Imprime o QR no terminal do teste

Você:
4. Escaneia o QR no WhatsApp do celular de teste (`5511917321422`)
5. De **outro número**, manda uma mensagem qualquer (texto e/ou áudio) para o número pareado
6. Ctrl+C encerra o teste (limpa o protegido do banco)

## O que observar

No log do serviço deve aparecer, para **cada** mensagem inbound:

```json
{"level":"info","module":"gateway","msg":"mensagem inbound recebida","subsystem":"pairing","protected_person_id":"...","wa_msg_id":"...","remote_jid":"***XXXX@s.whatsapp.net","timestamp":...,"payload_types":["conversation"]}
```

Verificações:
- `remote_jid` mascarado (últimos 4 dígitos)
- Sem conteúdo da mensagem no log (o `payload_types` mostra só o tipo)
- Mensagens enviadas DO número pareado (fromMe) NÃO devem aparecer

## Se o rate-limit continuar

- Remover dispositivos Baileys antigos: WhatsApp → Dispositivos conectados → tocar em cada um → Desconectar
- Se ainda falhar: usar `DEV_PAIRING_PHONE=<E.164 sem +> pnpm start` para tentar o código de 8 dígitos
- Se ainda falhar: parear com uma segunda conta WhatsApp (celular diferente) — em geral o bloqueio é per-account
