# Quickstart: SweetCare Fullstack Foundation

**Branch**: `001-sweetcare-fullstack-foundation` | **Date**: 2026-05-27

> Este documento descreve os cenários de integração e validação do produto por história de usuário.
> Use-o para validar manualmente o funcionamento do sistema após cada fase de implementação.

---

## Pré-requisitos

```bash
# Suba a infraestrutura local
docker compose -f infra/docker/compose.dev.yml up -d

# Execute as migrations do banco
pnpm --filter api exec prisma migrate dev

# Instale dependências
pnpm install
```

---

## Cenário 1 — Registro de Cuidados Críticos (US1 · P1)

**Objetivo**: Validar que um cuidador consegue registrar aplicação de insulina e sintomas offline e que os dados sincronizam corretamente ao restaurar a conexão.

### Passo a passo

**1. Criar usuário responsável e perfil da criança**

```http
POST /v1/auth/register
{
  "email": "guardiao@exemplo.com.br",
  "password": "S3nh@F0rte!2026",
  "role": "guardian",
  "display_name": "Maria Responsável"
}

POST /v1/consent
{
  "consent_type": "data_processing",
  "consent_text_version": "1.0.0"
}

POST /v1/patients
{
  "full_name": "Joãozinho",
  "date_of_birth": "2018-03-15",
  "diagnosis_year": 2022,
  "target_glucose_min_mgdl": 70,
  "target_glucose_max_mgdl": 180,
  "insulin_type_bolus": "NovoRapid",
  "insulin_type_basal": "Glargina"
}
```

**Critério de aceitação**: Perfil criado com `id` retornado. Consentimento registrado com `granted_at` preenchido.

---

**2. Simular modo offline — registrar aplicação de insulina localmente**

No app mobile, ative o Modo Avião (ou desative a rede no simulador).

Registre uma aplicação de insulina no formulário:

- Insulina: NovoRapid
- Dose: 4 unidades
- Motivo: cobertura de refeição
- Carboidratos: 45g
- Glicemia antes: 142 mg/dL
- Horário: [agora]

**Critério de aceitação**:

- [ ] Registro salvo no SQLite local com `sync_status = 'pending'`
- [ ] Indicador visual de "aguardando sincronização" exibido no app
- [ ] Nenhuma chamada de rede realizada (verificar no Network Inspector)

---

**3. Restaurar conexão e sincronizar**

Reative a rede. O app deve iniciar a sincronização automaticamente.

**Critério de aceitação**:

- [ ] `POST /v1/sync/batch` enviado com o registro local
- [ ] Resposta: `{ "committed": 1, "conflicts": 0 }`
- [ ] Registro no banco com `sync_status = 'synced'`
- [ ] `AuditEntry` criada com `operation = 'sync_commit'`
- [ ] Indicador de sincronização atualizado para "sincronizado"

---

**4. Tentar enviar o mesmo registro novamente (teste de idempotência)**

```bash
# Reenvie o mesmo payload com o mesmo client_id
POST /v1/sync/batch
{ "records": [{ "client_id": "<mesmo-uuid>", ... }] }
```

**Critério de aceitação**:

- [ ] Resposta: `{ "committed": 0, "conflicts": 0 }` — sem duplicação
- [ ] Banco permanece com exatamente 1 registro para aquele `client_id`

---

**5. Cenário de conflito**

Crie dois registros offline com timestamps sobrepostos para o mesmo paciente e sincronize.

**Critério de aceitação**:

- [ ] Resposta inclui `conflicts: [{ type: "overlapping_insulin_window", ... }]`
- [ ] App exibe tela de resolução de conflito com as duas versões
- [ ] Nenhuma versão é descartada automaticamente sem ação do cuidador

---

## Cenário 2 — Alertas e Orientações de Emergência (US2 · P2)

**Objetivo**: Validar que o registro de sintomas graves dispara alerta e exibe orientação clara e acessível.

### Passo a passo

**1. Registrar sintoma de hipoglicemia grave**

```http
POST /v1/patients/{patientId}/symptoms
{
  "symptom_codes": ["hypoglycemia_mild", "tremor", "confusion"],
  "severity_level": "severe",
  "glucose_reading_mgdl": 48,
  "observed_at": "2026-05-27T14:32:00-03:00"
}
```

**Critério de aceitação**:

- [ ] HTTP 201 retornado
- [ ] `AlertEvent` criado com `alert_type = 'severe_hypoglycemia'` e `severity_level = 'critical'`
- [ ] Push notification enviada para todos os usuários em `notified_user_ids`
- [ ] `AuditEntry` com `operation = 'alert_generated'` registrada

---

**2. Verificar experiência de emergência no app**

**Critério de aceitação**:

- [ ] Tela de alerta carrega em ≤ 2 segundos
- [ ] Orientação de emergência (`HYPO_SEVERE_PROTOCOL`) exibida em destaque
- [ ] Botão "Chamar Emergência" (112 / SAMU 192) visível com target de toque ≥ 44px
- [ ] Texto legível sem zoom (mínimo 16sp para orientações críticas)
- [ ] Tela passa em verificação automatizada de acessibilidade (WCAG 2.1 AA)

---

**3. Registrar sintoma de emergência (inconsciência)**

```http
POST /v1/patients/{patientId}/symptoms
{
  "symptom_codes": ["loss_of_consciousness"],
  "severity_level": "emergency",
  "observed_at": "2026-05-27T14:35:00-03:00"
}
```

**Critério de aceitação**:

- [ ] `AlertEvent` com `alert_type = 'emergency_response_required'` e `severity_level = 'emergency'`
- [ ] App navega automaticamente para a tela de protocolo de emergência

---

**4. Resolver alerta**

```http
PATCH /v1/alerts/{alertId}/resolve
{}
```

**Critério de aceitação**:

- [ ] `resolved_at` preenchido no banco
- [ ] `AuditEntry` com `operation = 'update'` registrada
- [ ] App remove indicador de alerta ativo

---

## Cenário 3 — Insights e Relatórios (US3 · P3)

**Objetivo**: Validar que insights explícitos e seguros são gerados com base em dados históricos.

> Pré-requisito: Cenário 1 executado com pelo menos 7 dias de registros históricos (use fixtures).

### Passo a passo

**1. Solicitar relatório semanal**

```http
POST /v1/patients/{patientId}/insights
{
  "report_type": "weekly_summary",
  "period_start": "2026-05-20",
  "period_end": "2026-05-26"
}
```

**Critério de aceitação**:

- [ ] HTTP 202 retornado com `{ "report_id": "...", "status": "processing" }`
- [ ] Webhook ou polling retorna relatório em ≤ 30 segundos
- [ ] Relatório contém `summary_text`, `pattern_findings`, e `disclaimer_key`

---

**2. Verificar disclaimer obrigatório**

**Critério de aceitação**:

- [ ] Texto de aviso legal exibido antes do conteúdo do relatório
- [ ] Disclaimer inclui "Este relatório não substitui orientação médica profissional"
- [ ] `ConsentRecord` do tipo `ai_analysis` verificado antes de gerar

---

**3. Simular indisponibilidade do serviço de IA**

Pare o container do AI service: `docker stop sweetcare-ai-service`

Solicite um relatório.

**Critério de aceitação**:

- [ ] API Fastify retorna HTTP 503 com `{ "error": "INSIGHTS_SERVICE_UNAVAILABLE" }`
- [ ] App exibe mensagem "Relatório temporariamente indisponível" sem expor detalhes técnicos
- [ ] Core caregiving flows (registro de insulina, sintomas) **não são afetados**

---

## Critérios de Performance

Execute após cada fase para validar:

```bash
# Benchmark do endpoint crítico de registro
pnpm --filter api run benchmark:critical-writes

# Esperado: p95 <= 300ms para POST /v1/sync/batch (payload padrão de 10 registros)
```

| Endpoint                         | Meta p95 | Medição |
| -------------------------------- | -------- | ------- |
| `POST /v1/insulin-records`       | ≤ 300ms  | —       |
| `POST /v1/symptoms`              | ≤ 300ms  | —       |
| `POST /v1/sync/batch`            | ≤ 500ms  | —       |
| `GET /v1/patients/{id}/timeline` | ≤ 300ms  | —       |

---

## Checklist de Validação de Segurança (após cada fase)

- [ ] Nenhum campo PHI aparece em logs de aplicação (verificar saída do Pino)
- [ ] Token de acesso expira em 15 minutos (verificar `exp` no JWT)
- [ ] Reuso de refresh token após rotação revoga a família inteira
- [ ] Endpoint de registro sem autenticação retorna HTTP 401 (não 403)
- [ ] CORS configurado para rejeitar origens não autorizadas
- [ ] Headers de segurança presentes: `Strict-Transport-Security`, `X-Content-Type-Options`, `X-Frame-Options`
