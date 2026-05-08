# MERGE GUIDE — Etapa 5A (Importação OFX + Auto-match Rígido)

Branch sugerida: `etapa-5a-ofx-import`

Esta etapa entrega:

1. **Backend** — schema, migration e implementação real do módulo `ofx/`
   (substitui o stub atual que retornava 501 em todos os endpoints).
2. **Conserto da tela `Extrato.jsx`** — adiciona o endpoint
   `GET /api/transactions/extrato` que estava sendo chamado mas **não
   existia** (a página estava silenciosamente quebrada).

A tela de conciliação propriamente dita (UI de matching manual + ações de
link/unlink/ignore) virá na **Etapa 5B**. O quick-create de lançamento direto
da entry OFX virá na **Etapa 5C**. Os endpoints dessas etapas já existem
neste pacote, mas respondem `501 NOT_IMPLEMENTED` por enquanto.

---

## 1. Dependências novas

Apenas uma — `multer` (upload de arquivos):

```bash
cd backend
npm install multer
```

---

## 2. Schema Prisma

Cinco alterações no `backend/prisma/schema.prisma`. **Importante:** o arquivo
`prisma/schema.prisma` neste pacote já contém o schema completo atualizado.
Você pode substituir o seu pelo do pacote, ou aplicar os patches manualmente.
A lista abaixo descreve cada mudança caso prefira o segundo caminho.

### 2.1 Modelo `Tenant` — adicionar relação

```diff
   ofxImports        OfxImport[]
+  ofxEntries        OfxEntry[]
   stockAdjustments  StockAdjustment[]
```

### 2.2 Modelo `BankAccount` — adicionar relação

```diff
   ofxImports   OfxImport[]
+  ofxEntries   OfxEntry[]
```

### 2.3 Modelo `Category` — adicionar relação nomeada

```diff
   ofxPatterns     OfxPattern[]
+  ofxEntriesSugeridas OfxEntry[] @relation("OfxEntrySuggestedCategory")
```

### 2.4 Modelo `Transaction` — campo + relação + índice

```diff
   exportado       Boolean  @default(false)
+  conciliadoEm    DateTime? @map("conciliado_em")
   criadoPor       String?  @map("criado_por")
```

```diff
   supplier    Supplier?    @relation(fields: [supplierId], references: [id])
+  ofxEntry    OfxEntry?

   @@index([tenantId])
```

```diff
   @@index([tenantId, supplierId])
+  @@index([tenantId, conciliadoEm])
   @@map("transactions")
```

### 2.5 Modelo `OfxImport` — campo + relação + unique

```diff
   nomeArquivo    String?  @map("nome_arquivo") @db.VarChar(255)
+  hashArquivo    String?  @map("hash_arquivo") @db.VarChar(64)
```

```diff
   importador  User?       @relation(fields: [importadoPor], references: [id])
+  entries     OfxEntry[]

+  @@unique([tenantId, hashArquivo])
   @@map("ofx_imports")
```

### 2.6 Novo modelo `OfxEntry`

Adicionar **logo após** o `OfxImport`. Conteúdo completo está no arquivo do
pacote — copiar inteiro.

---

## 3. Migration SQL

O pacote inclui a migration pronta em
`backend/prisma/migrations/20260507_etapa5a_ofx/migration.sql`.

**Antes de executar**, rode o gerador para garantir que o cliente Prisma
reflita o novo schema:

```bash
cd backend
npx prisma generate
```

Depois aplique a migration. **Atenção:** o nome do diretório que está no
pacote (`20260507_etapa5a_ofx`) tem timestamp curto pra organização.
Você pode renomear pra seguir o padrão do projeto (`YYYYMMDDHHMMSS_nome`)
antes de copiar pra `backend/prisma/migrations/`.

```bash
# Em desenvolvimento (gera o nome canônico automaticamente):
npx prisma migrate dev --name etapa5a_ofx

# OU em produção, depois de revisar o SQL:
npx prisma migrate deploy
```

> **Dica:** se preferir usar `migrate dev` em vez do SQL pronto, apenas
> aplique os patches do schema (item 2) e rode `npx prisma migrate dev
> --name etapa5a_ofx`. O Prisma vai gerar o SQL automaticamente — compare
> com o do pacote pra ver se bate.

---

## 4. Arquivos novos

```
backend/src/modules/ofx/ofx-parser.js          ← NOVO (parser puro, sem deps)
```

---

## 5. Arquivos a substituir

Os três stubs atuais entram no lugar dos deste pacote:

```
backend/src/modules/ofx/ofx.service.js         ← substitui stub
backend/src/modules/ofx/ofx.controller.js      ← substitui stub
backend/src/modules/ofx/ofx.routes.js          ← substitui stub
```

Diferenças principais em `ofx.routes.js`:

- Importa `multer` e configura upload em memória (limite 5 MB, aceita `.ofx`).
- Adiciona endpoints novos:
  - `GET /api/ofx/imports`
  - `GET /api/ofx/imports/:id`
  - `GET /api/ofx/imports/:id/entries`
  - `POST /api/ofx/import` (multipart, campo `file` + body `bankAccountId`)
  - `DELETE /api/ofx/imports/:id`
- Mantém endpoints da 5B/5C como stubs 501 (`/entries/:id/link`,
  `/entries/:id/unlink`, `/entries/:id/ignore`, `/entries/:id/quick-create`).

---

## 6. Modificações cirúrgicas no módulo `transactions`

Três mudanças pra resolver o bug do `/transactions/extrato`. Os arquivos
completos estão no pacote em `backend/src/modules/transactions/`.

### 6.1 `transactions.routes.js`

Adicionar **uma rota** (deve vir **antes** de qualquer rota com parâmetro
`/:id`, embora o módulo atual não tenha `GET /:id` ainda):

```diff
 router.use(auth, tGuard);
+router.get('/extrato', rGuard([1,2]),   ctrl.extrato);
 router.get('/',        rGuard([1,2]),   ctrl.list);
```

### 6.2 `transactions.controller.js`

Adicionar **um handler** no padrão dos demais (uma linha):

```diff
 exports.remove = async(req,res)=>{ try{ ok(res, await svc.remove(req.params.id, req.tenantId)) }catch(e){err(res,e)} };
+exports.extrato = async(req,res)=>{ try{ ok(res, await svc.extrato(req.tenantId, req.query)) }catch(e){err(res,e)} };
```

### 6.3 `transactions.service.js`

Adicionar a função `extrato` ao final e exportá-la. Conteúdo completo está
no arquivo do pacote — bloco de ~60 linhas claramente comentado.
**Não modificar** as funções `list`, `create`, `update`, `remove`.

```diff
-module.exports = { list, create, update, remove };
+module.exports = { list, create, update, remove, extrato };
```

---

## 7. Comandos de validação

Depois de copiar tudo:

```bash
cd backend
npm install                       # garante multer + deps
npx prisma generate               # regenera client
npx prisma migrate deploy         # aplica migration (ou migrate dev)
npm run dev                       # sobe backend
```

Smoke tests sugeridos com `curl`:

```bash
# 1. Tela de extrato (deve voltar a funcionar)
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/api/transactions/extrato?bankAccountId=$BANK&dataInicio=2026-04-01&dataFim=2026-04-30"

# 2. Importar um OFX
curl -H "Authorization: Bearer $TOKEN" \
  -F "file=@/caminho/extrato.ofx" \
  -F "bankAccountId=$BANK" \
  http://localhost:3000/api/ofx/import

# 3. Listar imports
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/ofx/imports

# 4. Ver entries do último import
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/api/ofx/imports/$ID/entries?status=pendente"
```

---

## 8. Comportamento esperado

### Auto-match rígido

Para cada linha do OFX, procura no banco uma `Transaction` com:

- mesmo `bankAccountId`
- mesma `dataLancamento` (DATE exata)
- mesmo `valor` (DECIMAL exato)
- mesma direção (`tipo='receita'` para crédito OFX, `tipo='despesa'` para débito)
- ainda não conciliada (`conciliadoEm IS NULL`) e sem entry vinculado
- status diferente de `cancelado`

Quando encontra:

- Seta `OfxEntry.transactionId`, `status='conciliado'`, `conciliadoEm=now()`.
- Seta `Transaction.conciliadoEm=now()`.

A conciliação **não trava** o lançamento — você pediu conferência, não
fechamento. `update`/`delete` no Transaction continuam permitidos pelas
regras existentes (a única trava ainda é `exportado=true`).

### Sugestão de categoria

Após o auto-match, entries pendentes recebem `suggestedCategoryId` baseado
em `OfxPattern` (Etapa 2). A regra: o texto `descricao + memo` da entry
contém o `textoHistorico` do padrão (case-insensitive). É só sugestão —
a Etapa 5C vai usar como pré-seleção no quick-create.

### Dedup

- Por **arquivo**: SHA256 do conteúdo, único por tenant. Reimportar o mesmo
  arquivo retorna 409 com referência ao import original.
- Por **transação**: par `(bankAccountId, fitid)` é único. Mesmo importando
  arquivos diferentes mas com período sobreposto, transações já vistas
  (mesmo FITID) não são duplicadas — apenas contadas como
  `duplicatasFitid` na resposta.

### Remoção de import

`DELETE /api/ofx/imports/:id` (apenas `roleGuard([1])` — Gerencial):

1. Desfaz a conciliação dos `Transaction`s vinculados (zera `conciliadoEm`).
2. Apaga as `OfxEntry`s do import.
3. Apaga o `OfxImport`.

**Não apaga** Transactions. Importante: na Etapa 5C, quick-create vai criar
Transactions com `origem='ofx'` e `ofxImportId` setado. Se o usuário deletar
o import depois, essas Transactions ficam órfãs (`ofxImportId` aponta pra
nada). Vamos resolver isso na 5C com um cleanup explícito.

---

## 9. Bugs pré-existentes anotados (NÃO consertados nesta etapa)

Encontrei dois bugs durante a implementação. Não os toquei pra manter o
escopo da 5A enxuto, mas vale registrar pra decidir o que fazer:

### 9.1 `roleGuard` aceita array mas middleware espera número

O middleware `backend/src/middleware/roleGuard.js` recebe um número:

```js
function roleGuard(nivelMinimo) {
  return (req, res, next) => {
    if (role > nivelMinimo) { /* nega */ }
    ...
```

Mas em **todos os módulos** do projeto, as rotas chamam `rGuard([1,2])`,
`rGuard([1,2,3])`, etc., passando array. A comparação `role > [1,2]`
sempre retorna `false` em JS (array vira string `"1,2"` que vira `NaN`),
então **as guards com array deixam todos os perfis passarem.**

Na prática, hoje:

- `rGuard([1])`        → só nível 1 passa (correto, sem array)
- `rGuard([1,2])`      → todos passam (BUG)
- `rGuard([1,2,3])`    → todos passam (não tem efeito prático, é o esperado)

**Risco real:** rotas como `transactions.list` (`rGuard([1,2])`) ou
`payables.cancelar` que deveriam ser bloqueadas pra perfil 3 (Básico) hoje
estão abertas pra todo mundo.

**Correção sugerida (numa etapa futura):** alterar `roleGuard.js` pra
aceitar array — basicamente mudar:

```js
function roleGuard(niveis) {
  return (req, res, next) => {
    const lista = Array.isArray(niveis) ? niveis : [niveis];
    if (!lista.includes(role)) { /* nega */ }
    ...
```

Zero alteração nos módulos, só no middleware. Mas precisa testar com calma
porque vai começar a bloquear coisas que hoje passam silenciosamente.

### 9.2 Módulo `payables` referencia tabela inexistente

O `backend/src/modules/payables/payables.service.js` faz `prisma.payable_receivable.findMany(...)`,
mas **não existe modelo `payable_receivable`** no `schema.prisma`. Esse
módulo erra em runtime quando alguma rota é chamada. Como a página
`ContasPagarReceber.jsx` parece funcionar, suspeito que ela use o módulo
`titles/` na verdade (que é o backend de contas a pagar/receber por
títulos). O módulo `payables/` parece ser código morto, candidato a remoção
ou refatoração — fora do escopo desta etapa.

---

## 10. O que NÃO está nesta etapa

| Funcionalidade                            | Etapa |
|-------------------------------------------|-------|
| Tela de conciliação (UI 2 colunas)        | 5B    |
| Acesso pela sidebar e via import          | 5B    |
| Vincular entry a Transaction (manual)     | 5B    |
| Desvincular entry (rollback de match)     | 5B    |
| Marcar entry como ignorada                | 5B    |
| Quick-create de Transaction de uma entry  | 5C    |
| Aplicar categoria sugerida no quick-create| 5C    |
| Casos N-pra-1 e 1-pra-N de matching       | Futuro|
| Importação por integração Open Finance    | Futuro|

---

## 11. Resumo dos arquivos do pacote

```
backend/
├── prisma/
│   ├── schema.prisma                                ← schema completo (substitui)
│   └── migrations/
│       └── 20260507_etapa5a_ofx/
│           └── migration.sql                        ← apenas se aplicar SQL direto
└── src/
    └── modules/
        ├── ofx/
        │   ├── ofx-parser.js                        ← NOVO
        │   ├── ofx.service.js                       ← substitui stub
        │   ├── ofx.controller.js                    ← substitui stub
        │   └── ofx.routes.js                        ← substitui stub
        └── transactions/
            ├── transactions.service.js              ← adiciona extrato()
            ├── transactions.controller.js           ← adiciona handler
            └── transactions.routes.js               ← adiciona rota
```
