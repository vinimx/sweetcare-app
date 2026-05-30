<div align="center">

<br />

# 🩺 SweetCare

### Plataforma mobile‑first de suporte a cuidadores de crianças com Diabetes Mellitus Tipo 1

<p>
  Registro seguro de insulina e sintomas &nbsp;·&nbsp; Alertas de emergência baseados em regras &nbsp;·&nbsp; Insights com IA &nbsp;·&nbsp; Operação offline completa
</p>

<br />

![Expo](https://img.shields.io/badge/Expo_SDK_54-000020?style=for-the-badge&logo=expo&logoColor=white)
![React Native](https://img.shields.io/badge/React_Native_0.81-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript_5.7-3178C6?style=for-the-badge&logo=typescript&logoColor=white)

![Node.js](https://img.shields.io/badge/Node.js_20_LTS-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![Fastify](https://img.shields.io/badge/Fastify_5-000000?style=for-the-badge&logo=fastify&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma_6-2D3748?style=for-the-badge&logo=prisma&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL_16-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)
![Redis](https://img.shields.io/badge/Redis_7-DC382D?style=for-the-badge&logo=redis&logoColor=white)

![Python](https://img.shields.io/badge/Python_3.12-3776AB?style=for-the-badge&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI_0.115-009688?style=for-the-badge&logo=fastapi&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)
![Prometheus](https://img.shields.io/badge/Prometheus-E6522C?style=for-the-badge&logo=prometheus&logoColor=white)
![Grafana](https://img.shields.io/badge/Grafana-F46800?style=for-the-badge&logo=grafana&logoColor=white)

<br />

![pnpm](https://img.shields.io/badge/pnpm_9-F69220?style=flat-square&logo=pnpm&logoColor=white)
![Turborepo](https://img.shields.io/badge/Turborepo_2-EF4444?style=flat-square&logo=turborepo&logoColor=white)
![Zod](https://img.shields.io/badge/Zod_3-3E67B1?style=flat-square&logo=zod&logoColor=white)
![Vitest](https://img.shields.io/badge/Vitest_2-6E9F18?style=flat-square&logo=vitest&logoColor=white)
![ESLint](https://img.shields.io/badge/ESLint_9-4B32C3?style=flat-square&logo=eslint&logoColor=white)
![Prettier](https://img.shields.io/badge/Prettier_3-F7B93E?style=flat-square&logo=prettier&logoColor=black)
![LGPD](https://img.shields.io/badge/LGPD_Art._14-009c3b?style=flat-square&logoColor=white)
![WCAG](https://img.shields.io/badge/WCAG_2.1_AA-005A9C?style=flat-square&logoColor=white)
![OWASP](https://img.shields.io/badge/OWASP_Top_10-000000?style=flat-square&logoColor=white)

<br />

</div>

---

## 📖 Sobre o Projeto

**SweetCare** é uma plataforma _safety-critical_ desenvolvida para apoiar responsáveis e cuidadores de crianças diagnosticadas com **Diabetes Mellitus Tipo 1 (T1DM)**. O sistema cobre todo o ciclo de cuidado diário: do registro de aplicações de insulina à análise estatística de padrões glicêmicos, passando por alertas de emergência e sincronização offline segura.

O projeto foi construído como um **monorepo full-stack** com três aplicações independentes — API TypeScript, app React Native e microserviço Python — compartilhando tipos e schemas de validação via pacotes internos.

> **Por que isso importa:** Decisões tomadas com base nos dados registrados afetam diretamente a saúde de crianças. Cada camada do sistema foi projetada com esse nível de criticidade em mente — da imutabilidade dos registros médicos no banco até a geração síncrona de alertas de emergência.

---

## ✨ Funcionalidades

|     | Funcionalidade            | Descrição                                                                                                                                                      |
| :-: | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 💉  | **Registro de insulina**  | CRUD completo com fila offline — dados salvos em SQLite criptografado quando sem conexão, sincronizados automaticamente ao reconectar                          |
| 🤒  | **Registro de sintomas**  | Picker de sintomas com severidade calculada automaticamente; sintomas críticos disparam alerta de emergência na mesma transação                                |
| 🚨  | **Alertas de emergência** | Motor de regras avalia 5 critérios clínicos a cada registro de sintoma; guidance estruturado passo a passo + contatos de emergência (SAMU/Bombeiros)           |
| 🤖  | **Insights com IA**       | Análise estatística de padrões em 30 dias via microserviço FastAPI isolado; relatórios interativos com gráficos de confiança e exportação para consulta médica |
| 📡  | **Offline-first**         | SQLite + React Query; API de sincronização em batch com detecção de conflitos e idempotência via `client_id` UUIDv4                                            |
| 👨‍👩‍👧  | **Multi-paciente**        | Uma conta gerencia múltiplos perfis de paciente; RBAC com papéis guardian / caregiver / read-only                                                              |
| 🔐  | **Conformidade LGPD**     | Exportação de dados (`GET /users/me/data-export`) e direito ao esquecimento (`DELETE /users/me`); rastreamento de consentimento por finalidade                 |
| 📊  | **Observabilidade**       | Endpoint Prometheus `/metrics` + dashboard Grafana; logs Pino estruturados com redação de PHI; Correlation ID em toda resposta                                 |

---

## 🏗️ Arquitetura

```
┌─────────────────────────────────────────────────────────────────┐
│  📱 Mobile  (Expo SDK 54 / React Native 0.81)                   │
│  • Expo Router 6 — navegação file-based (New Architecture)      │
│  • React Query 5 — server state + fila de mutações offline      │
│  • SQLite (expo-sqlite 16) — PHI criptografado no dispositivo   │
│  • expo-secure-store — tokens (iOS Keychain / Android Keystore) │
└───────────────────────────┬─────────────────────────────────────┘
                            │ HTTPS / TLS 1.3
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  🖥️ API  (Fastify 5 / TypeScript / Node.js 20 LTS)              │
│  • Zod type provider — validação schema-first                   │
│  • JWT HS256 15 min (access) + opaque refresh 7 dias            │
│  • Prisma 6 + extensão AES-256-GCM por campo PHI                │
│  • Pino — logging estruturado, 15 caminhos PHI redatados        │
└──────────┬──────────────────────────┬───────────────────────────┘
           │ PostgreSQL               │ HTTP (rede Docker interna)
           ▼                          ▼
┌──────────────────┐      ┌──────────────────────────────────────┐
│  🐘 PostgreSQL   │      │  🤖 AI Service (FastAPI / Python 3.12)│
│  • pgcrypto      │      │  • Rede Docker interna isolada       │
│  • Row Level     │      │  • Recebe apenas métricas agregadas  │
│    Security      │      │  • PHI NUNCA entra neste serviço     │
│  • Triggers de   │      │  • 5 detectores estatísticos         │
│    imutabilidade │      │    (scikit-learn + numpy + pandas)   │
│  • pgaudit       │      └──────────────────────────────────────┘
└────────┬─────────┘
         │
┌────────┴──────────┐
│  🔴 Redis 7       │
│  • Cache de sessão│
│  • Rate limiting  │
└───────────────────┘
```

### Princípios arquiteturais

| Princípio                     | Implementação                                                                                                            |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| 🛡️ **Safety-critical first**  | Registros médicos imutáveis por triggers no banco; alertas de emergência criados síncronos na mesma transação do sintoma |
| 🔒 **Defense-in-depth**       | TLS → RBAC → RLS → AES-256-GCM por campo → audit trail append-only                                                       |
| 🔕 **PHI zero-trust em logs** | Redação Pino — apenas UUIDs de correlação, zero dado clínico nos logs                                                    |
| 📴 **Offline-first**          | Fila SQLite + React Query; sync batch com detecção de conflitos e upserts idempotentes                                   |
| 🧠 **IA isolada**             | FastAPI recebe apenas métricas sem PHI; proxy Fastify remove todos os dados pessoais antes de encaminhar                 |
| 🔄 **Imutabilidade**          | Triggers `BEFORE UPDATE OR DELETE` em todas as tabelas médicas; `AuditEntry` somente append                              |

---

## 🗂️ Estrutura do Monorepo

```
sweetcare-app/
│
├── 📦 packages/
│   ├── shared-types/          # Tipos TypeScript de domínio (sem deps de runtime)
│   ├── shared-validation/     # Schemas Zod compartilhados (API + mobile)
│   └── shared-config/         # Schemas de env + constantes clínicas
│
├── 🚀 apps/
│   ├── api/                   # Fastify 5 API — 30+ endpoints, 14 arquivos de rota
│   │   ├── prisma/            # Schema (11 entidades, 13 enums) + SQL de RLS
│   │   └── src/
│   │       ├── domain/        # Entidades + regras de negócio puras
│   │       ├── application/   # Services, auditoria, auth
│   │       ├── infrastructure/# DB, JWT, sessões, cliente AI, logging
│   │       └── presentation/  # Rotas HTTP
│   │
│   ├── mobile/                # Expo SDK 54 / React Native 0.81
│   │   ├── app/               # Páginas Expo Router (file-based)
│   │   │   ├── (tabs)/        # Início · Registrar · Insights · Perfil
│   │   │   ├── auth/          # Login e Cadastro
│   │   │   ├── patients/      # Criar e editar perfil de paciente
│   │   │   ├── records/       # Detalhe e edição de registros médicos
│   │   │   └── alerts/        # Detalhe de alerta + resolução
│   │   └── src/
│   │       ├── design/        # Design system (tokens, componentes, tema)
│   │       ├── features/      # Telas por funcionalidade
│   │       └── infrastructure/# API client, AuthContext, DB offline, sync engine
│   │
│   └── ai-service/            # FastAPI — microserviço de análise estatística
│       └── app/
│           ├── api/           # POST /v1/analyze
│           ├── schemas/       # Modelos Pydantic
│           └── services/      # 5 detectores + scoring de confiança
│
└── 🐳 infra/
    ├── docker/
    │   ├── compose.dev.yml        # postgres + redis + ai-service
    │   └── compose.monitoring.yml # Prometheus + Grafana (opcional)
    └── monitoring/
        └── grafana/dashboards/    # Dashboard com 5 painéis
```

---

## 🔒 Modelo de Segurança

### Camadas de proteção em cascata

```
 HTTPS / TLS 1.3
   └─► HSTS 2 anos + CSP completo (frameAncestors, formAction, scriptSrc)
         └─► JWT HS256 15 min (access) + refresh opaco 7 dias
               └─► argon2id (64 MB · 3 iterações · parallelism=1)
                     └─► Family invalidation de sessão + detecção de roubo
                           └─► RBAC (guardian / caregiver / read_only / admin)
                                 └─► Verificação de CaregiverAssignment por request
                                       └─► Row Level Security (has_patient_access())
                                             └─► AES-256-GCM por campo PHI
                                                   └─► AuditEntry append-only (nunca UPDATE/DELETE)
```

### Conformidade LGPD Art. 14 (dados de menores)

| Requisito                       | Implementação                                                                 |
| ------------------------------- | ----------------------------------------------------------------------------- |
| ✅ Consentimento do responsável | `ConsentRecord` criado atomicamente com o `PatientProfile`                    |
| ✅ Revogação                    | `DELETE /consent/:id` — congela processamento imediatamente                   |
| ✅ Minimização de dados         | Apenas campos clinicamente necessários são coletados                          |
| ✅ Direito de acesso            | `GET /users/me/data-export` — exportação completa em JSON                     |
| ✅ Direito ao esquecimento      | `DELETE /users/me` — anonimização + exclusão em cascata dos registros médicos |

### Isolamento do serviço de IA

O microserviço FastAPI opera em **rede Docker interna** (`internal: true`). O proxy Fastify remove todos os dados de identificação pessoal antes de encaminhar ao `/v1/analyze` — apenas métricas estatísticas agregadas (valores de glicose, doses, códigos de sintoma) chegam ao Python. PHI nunca entra no serviço de IA.

---

## 🚀 Como Executar

### Pré-requisitos

- **Node.js** 20 LTS
- **pnpm** 9.x → `npm install -g pnpm`
- **Docker Desktop** (PostgreSQL, Redis, AI service)
- **Expo Go** (app no celular) ou simulador iOS / Android

### 1️⃣ Clonar o repositório

```bash
git clone https://github.com/vinimx/sweetcare-app.git
cd sweetcare-app
```

### 2️⃣ Instalar dependências

```bash
pnpm install
```

### 3️⃣ Configurar variáveis de ambiente

```bash
cp apps/api/.env.example apps/api/.env
cp apps/mobile/.env.example apps/mobile/.env.local
cp apps/ai-service/.env.example apps/ai-service/.env
```

Gere os secrets para `apps/api/.env`:

```bash
# PHI_ENCRYPTION_KEY — exatamente 64 caracteres hex (32 bytes)
openssl rand -hex 32

# JWT_ACCESS_SECRET e JWT_REFRESH_SECRET — valores DIFERENTES entre si
openssl rand -hex 32
openssl rand -hex 32
```

Valores mínimos necessários em `apps/api/.env`:

```env
DATABASE_URL=postgresql://sweetcare:changeme@127.0.0.1:5433/sweetcare_dev
REDIS_URL=redis://:changeme_redis@127.0.0.1:6379
JWT_ACCESS_SECRET=<64-hex-chars>
JWT_REFRESH_SECRET=<64-hex-chars-diferente-do-access>
PHI_ENCRYPTION_KEY=<64-hex-chars>
NODE_ENV=development
```

> [!WARNING]
> **PHI_ENCRYPTION_KEY**: a perda desta chave resulta na perda permanente de todos os registros médicos criptografados. Em produção, utilize AWS Secrets Manager ou HashiCorp Vault.

### 4️⃣ Subir a infraestrutura

```bash
docker compose -f infra/docker/compose.dev.yml up -d
```

Isso inicializa PostgreSQL 16 (porta **5433**), Redis 7 (porta **6379**) e o AI service (porta **8000**).

Verifique se os containers estão saudáveis:

```bash
docker compose -f infra/docker/compose.dev.yml ps
```

### 5️⃣ Preparar o banco de dados

```bash
# Gerar Prisma Client
pnpm --filter "@sweetcare/api" db:generate

# Rodar migrations
pnpm --filter "@sweetcare/api" db:migrate

# Aplicar políticas RLS e triggers de imutabilidade (executar uma vez)
docker exec -i sweetcare-postgres psql -U sweetcare -d sweetcare_dev \
  < apps/api/prisma/manual/rls-policies.sql
```

### 6️⃣ Build dos pacotes compartilhados

```bash
pnpm --filter "@sweetcare/shared-*" build
```

### 7️⃣ Iniciar a API

```bash
pnpm --filter "@sweetcare/api" dev
```

API disponível em `http://localhost:3000`. Verifique: `GET /api/v1/health`

### 8️⃣ Iniciar o app mobile

```bash
pnpm --filter "@sweetcare/mobile" start
```

> [!NOTE]
> Para testar em um dispositivo físico, defina o IP local da sua máquina em `apps/mobile/.env.local`:
>
> ```env
> EXPO_PUBLIC_API_URL=http://192.168.x.x:3000/api/v1
> ```
>
> Escaneie o QR code com o app **Expo Go** ou a câmera do iPhone.

---

## ⚙️ Variáveis de Ambiente

### `apps/api/.env`

| Variável             | Obrigatório | Padrão                  | Descrição                                            |
| -------------------- | :---------: | ----------------------- | ---------------------------------------------------- |
| `DATABASE_URL`       |     ✅      | —                       | Connection string PostgreSQL (porta 5433 com Docker) |
| `JWT_ACCESS_SECRET`  |     ✅      | —                       | Mín. 32 chars — chave de assinatura JWT              |
| `JWT_REFRESH_SECRET` |     ✅      | —                       | Mín. 32 chars — diferente do access secret           |
| `PHI_ENCRYPTION_KEY` |     ✅      | —                       | 64 hex chars (32 bytes) para AES-256-GCM             |
| `REDIS_URL`          |     ✅      | —                       | Connection string Redis                              |
| `NODE_ENV`           |     ✅      | —                       | `development` \| `test` \| `production`              |
| `PORT`               |      —      | `3000`                  | Porta HTTP                                           |
| `AI_SERVICE_URL`     |      —      | `http://localhost:8000` | URL interna do AI service                            |
| `LOG_LEVEL`          |      —      | `info`                  | `trace` \| `debug` \| `info` \| `warn` \| `error`    |

### `apps/mobile/.env.local`

| Variável              | Descrição                                                  |
| --------------------- | ---------------------------------------------------------- |
| `EXPO_PUBLIC_API_URL` | URL completa da API (ex: `http://192.168.1.5:3000/api/v1`) |
| `EXPO_PUBLIC_ENV`     | `development` \| `staging` \| `production`                 |

---

## 🧪 Testes

```bash
# Todos os testes do monorepo
pnpm test

# API — testes de integração com cobertura (threshold: 80%)
pnpm --filter "@sweetcare/api" test:coverage

# API — modo watch durante desenvolvimento
pnpm --filter "@sweetcare/api" test:watch

# AI Service — testes de contrato
cd apps/ai-service && pytest -v

# Lint e typecheck em todo o monorepo
pnpm lint
pnpm typecheck
```

### Cobertura atual

| Camada                | Framework     | Casos |  Status   |
| --------------------- | ------------- | :---: | :-------: |
| API — integração      | Vitest        |  49   |    ✅     |
| AI Service — contrato | pytest        |  13   |    ✅     |
| Mobile — componentes  | Vitest + RNTL |   —   | Planejado |
| E2E mobile            | Detox         |   —   | Planejado |

---

## 📊 Monitoramento

A stack de monitoramento é **opcional** e roda separadamente:

```bash
docker compose -f infra/docker/compose.monitoring.yml up -d
```

| Serviço       | URL                   | Acesso           |
| ------------- | --------------------- | ---------------- |
| 📈 Grafana    | http://localhost:3001 | admin / changeme |
| 🔥 Prometheus | http://localhost:9090 | —                |

A API expõe métricas no formato Prometheus em `GET /api/v1/metrics` — sem dependências externas, usando `process.memoryUsage()` + `process.uptime()`. O dashboard Grafana inclui 5 painéis: uptime, heap usado, RSS, série temporal de heap e memória do processo.

---

## 📡 Referência da API

Todos os endpoints têm prefixo `/api/v1`. Toda resposta inclui `X-Correlation-Id` e `X-API-Version: 1`.

<details>
<summary><strong>🔐 Autenticação e Sessão</strong></summary>

| Método   | Endpoint         |      Auth      | Descrição                                  |
| -------- | ---------------- | :------------: | ------------------------------------------ |
| `POST`   | `/auth/register` |       —        | Cadastro + auto-login (retorna tokens)     |
| `POST`   | `/auth/login`    |       —        | Login (access token + cookie de refresh)   |
| `POST`   | `/auth/refresh`  | Cookie ou body | Rotacionar refresh token                   |
| `POST`   | `/auth/logout`   |     Bearer     | Invalidar família de sessão                |
| `GET`    | `/users/me`      |     Bearer     | Dados do usuário autenticado               |
| `PATCH`  | `/users/me`      |     Bearer     | Atualizar perfil                           |
| `POST`   | `/consent`       |     Bearer     | Conceder consentimento (ex: `ai_analysis`) |
| `DELETE` | `/consent/:id`   |     Bearer     | Revogar consentimento                      |

</details>

<details>
<summary><strong>👶 Pacientes e Registros Médicos</strong></summary>

| Método   | Endpoint                             | Descrição                                    |
| -------- | ------------------------------------ | -------------------------------------------- |
| `POST`   | `/patients`                          | Criar perfil de paciente                     |
| `GET`    | `/patients/:id`                      | Consultar perfil                             |
| `PATCH`  | `/patients/:id`                      | Atualizar perfil                             |
| `POST`   | `/patients/:id/insulin-records`      | Registrar aplicação de insulina              |
| `GET`    | `/patients/:id/insulin-records`      | Listar registros de insulina                 |
| `PATCH`  | `/patients/:id/insulin-records/:rid` | Atualizar registro                           |
| `DELETE` | `/patients/:id/insulin-records/:rid` | Excluir registro                             |
| `POST`   | `/patients/:id/symptoms`             | Registrar sintoma (dispara motor de alertas) |
| `GET`    | `/patients/:id/symptoms`             | Listar registros de sintoma                  |
| `PATCH`  | `/patients/:id/symptoms/:rid`        | Atualizar registro                           |
| `DELETE` | `/patients/:id/symptoms/:rid`        | Excluir registro                             |
| `GET`    | `/patients/:id/timeline`             | Timeline mesclada (insulina + sintomas)      |

</details>

<details>
<summary><strong>🚨 Alertas de Emergência</strong></summary>

| Método  | Endpoint               | Descrição                                    |
| ------- | ---------------------- | -------------------------------------------- |
| `GET`   | `/patients/:id/alerts` | Listar alertas do paciente                   |
| `GET`   | `/alerts/:id`          | Detalhe do alerta com guidance passo a passo |
| `PATCH` | `/alerts/:id/resolve`  | Marcar alerta como resolvido                 |

</details>

<details>
<summary><strong>📡 Sincronização Offline</strong></summary>

| Método | Endpoint                  | Descrição                                        |
| ------ | ------------------------- | ------------------------------------------------ |
| `POST` | `/sync/batch`             | Enviar lote de fila offline (máx. 100 registros) |
| `GET`  | `/sync/status/:patientId` | Verificar status da sincronização                |
| `POST` | `/sync/resolve-conflict`  | Resolver conflito de sincronização               |

</details>

<details>
<summary><strong>🤖 Insights com IA</strong></summary>

| Método | Endpoint                | Descrição                                   |
| ------ | ----------------------- | ------------------------------------------- |
| `POST` | `/insights/reports`     | Solicitar análise (assíncrono, retorna 202) |
| `GET`  | `/insights/reports/:id` | Consultar status ou relatório concluído     |
| `GET`  | `/insights/reports`     | Listar relatórios do paciente               |

> O fluxo é: `POST` → 202 (processing) → polling a cada 5s → `completed` ou `failed`.
> Exige consentimento `ai_analysis` ativo.

</details>

<details>
<summary><strong>⚖️ Direitos LGPD</strong></summary>

| Método   | Endpoint                | Descrição                                    |
| -------- | ----------------------- | -------------------------------------------- |
| `GET`    | `/users/me/data-export` | Exportar todos os dados pessoais (Art. 18)   |
| `DELETE` | `/users/me`             | Excluir conta (requer confirmação por senha) |

</details>

<details>
<summary><strong>📊 Operações</strong></summary>

| Método | Endpoint   | Descrição           |
| ------ | ---------- | ------------------- |
| `GET`  | `/health`  | Liveness check      |
| `GET`  | `/ready`   | Readiness check     |
| `GET`  | `/metrics` | Métricas Prometheus |

</details>

---

## 🛠️ Comandos Úteis

```bash
# Infraestrutura Docker
docker compose -f infra/docker/compose.dev.yml up -d        # Subir tudo
docker compose -f infra/docker/compose.dev.yml down -v      # Parar e limpar volumes
docker compose -f infra/docker/compose.dev.yml logs -f      # Ver logs em tempo real

# Banco de dados
pnpm --filter "@sweetcare/api" db:studio                    # Prisma Studio (localhost:5555)
pnpm --filter "@sweetcare/api" db:migrate                   # Rodar migrations pendentes

# Build
pnpm build                                                  # Build completo do monorepo
pnpm --filter "@sweetcare/shared-*" build                   # Rebuild dos pacotes compartilhados

# Mobile
pnpm --filter "@sweetcare/mobile" ios                       # Executar no simulador iOS
pnpm --filter "@sweetcare/mobile" android                   # Executar no emulador Android
```

---

## 🗺️ Modelo de Domínio

```
User (guardian) ──< CaregiverAssignment >── PatientProfile
User (guardian) ──< ConsentRecord ──────── PatientProfile
PatientProfile  ──< InsulinApplicationRecord ── AuditEntry
PatientProfile  ──< SymptomRecord ──────────── AlertEvent ── AuditEntry
PatientProfile  ──< InsightReport
User            ──< UserSession   (famílias de tokens com detecção de roubo)
```

**Invariantes clínicas aplicadas pela API:**

- Dose de insulina: `0,01 ≤ unidades ≤ 100`
- Glicemia: `20 ≤ mg/dL ≤ 600`
- Timestamps: não mais de 5 minutos no futuro
- `severity = emergency` → alerta criado síncronamente na mesma transação DB

---

<div align="center">

Desenvolvido como projeto de portfólio · Marcos V. · 2026

</div>
