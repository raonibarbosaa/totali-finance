# MERGE GUIDE — Etapa 5B (UI de Conciliação Bancária)

Branch sugerida: `etapa-5b-conciliacao` (a partir de `etapa-5a-ofx`).

Esta etapa entrega a **interface de conciliação bancária** + as ações no backend
que faltavam (link, unlink, ignore, unignore, quick-create, match-candidates).
Também unifica o que estava planejado pra Etapa 5C (quick-create) dentro da 5B.

**Pré-requisito:** Etapa 5A integrada (schema com `OfxEntry`, migration aplicada,
backend rodando com módulo OFX). Esta etapa **não muda schema** nem cria migrations.

---

## 1. O que muda

### Backend

3 arquivos substituídos (a estrutura e nomes não mudam):

```
backend/src/modules/ofx/ofx.service.js     ← novos métodos: linkEntry, unlinkEntry,
                                              ignoreEntry, unignoreEntry,
                                              matchCandidates, quickCreateFromEntry.
                                              + removeImport ajustado para apagar
                                                Transactions criadas via quick-create.

backend/src/modules/ofx/ofx.controller.js  ← handlers reais para os endpoints
                                              que antes eram stubs 501.

backend/src/modules/ofx/ofx.routes.js      ← +2 rotas:
                                              GET  /entries/:id/match-candidates
                                              POST /entries/:id/unignore
```

Endpoints disponíveis depois desta etapa:

| Método | Path                                         | Acesso       |
|--------|----------------------------------------------|--------------|
| GET    | `/api/ofx/entries/:id/match-candidates`      | nível 1 e 2  |
| POST   | `/api/ofx/entries/:id/link`                  | nível 1 e 2  |
| POST   | `/api/ofx/entries/:id/unlink`                | nível 1 e 2  |
| POST   | `/api/ofx/entries/:id/ignore`                | nível 1 e 2  |
| POST   | `/api/ofx/entries/:id/unignore`              | nível 1 e 2  |
| POST   | `/api/ofx/entries/:id/quick-create`          | nível 1 e 2  |

### Frontend

4 arquivos:

```
frontend/src/components/layout/Sidebar.jsx    ← MODIFICADO: +1 SidebarLink "Conciliação"
                                                + import de ListChecks.
frontend/src/App.jsx                          ← MODIFICADO: +1 import + 1 rota
                                                /app/conciliacao
frontend/src/pages/ImportacaoOFX.jsx          ← REESCRITO: form de upload + lista
                                                de imports anteriores + link pra
                                                conciliar. Substitui o placeholder.
frontend/src/pages/Conciliacao.jsx            ← NOVO: página de conciliação completa
                                                (lista de imports + tela de entries
                                                + modais de Vincular e Quick-create).
```

---

## 2. Como aplicar

### 2.1 Trocar de branch

A partir de `etapa-5a-ofx` (já integrada e mergeada na sua main, ou ainda como branch):

```
git checkout -b etapa-5b-conciliacao
```

### 2.2 Copiar os arquivos

Estando na **raiz do projeto** (`totali-finance/`):

```
cp ~/Downloads/ofx.service.js              backend/src/modules/ofx/ofx.service.js
cp ~/Downloads/ofx.controller.js           backend/src/modules/ofx/ofx.controller.js
cp ~/Downloads/ofx.routes.js               backend/src/modules/ofx/ofx.routes.js
cp ~/Downloads/Sidebar.jsx                 frontend/src/components/layout/Sidebar.jsx
cp ~/Downloads/App.jsx                     frontend/src/App.jsx
cp ~/Downloads/ImportacaoOFX.jsx           frontend/src/pages/ImportacaoOFX.jsx
cp ~/Downloads/Conciliacao.jsx             frontend/src/pages/Conciliacao.jsx
cp ~/Downloads/MERGE_GUIDE_ETAPA_5B.md     ./MERGE_GUIDE_ETAPA_5B.md
```

### 2.3 Reiniciar o backend (pra carregar os métodos novos)

Como o backend roda em Docker com bind-mount do código (mesma situação da 5A):

```
docker restart totali_backend && sleep 3 && docker logs totali_backend --tail 10
```

Espera ver `✅ TotaliFinance API rodando na porta 3000`.

**Não precisa rodar `prisma generate` nem `prisma migrate`** — esta etapa não toca
no schema.

### 2.4 Rebuild do frontend (pra carregar os JSX novos)

Se o seu container `totali_frontend` é nginx servindo arquivos buildados estaticamente
(que parece ser o caso, baseado no setup atual), o restart sozinho não basta. Você
precisa **rebuildar** a imagem do frontend.

Primeiro descubra onde está o `docker-compose.yml`:

```
docker inspect totali_frontend --format '{{index .Config.Labels "com.docker.compose.project.working_dir"}}'
```

Aí, do diretório retornado:

```
docker compose up -d --build frontend
```

(Ou, se for compose v1: `docker-compose up -d --build frontend`.)

Se o seu setup já tem hot-reload via Vite (improvável com nginx servindo build, mas possível
em algum modo dev), basta o restart simples.

---

## 3. Comportamento esperado

### Sidebar → Conciliação

Aparece um item novo **"Conciliação"** na seção **Bancário** (logo abaixo de "Importar
OFX"), visível pra níveis 1 e 2. Clique abre `/app/conciliacao` mostrando uma **lista
de imports recentes**, cada um com contadores (conciliados/pendentes) e um botão
chevron pra abrir.

### Tela de conciliação (`?importId=X`)

- **Cabeçalho**: nome do arquivo, conta, período, data/usuário da importação.
- **Tabs por status**: Pendentes (default), Conciliadas, Ignoradas, com contadores.
- **Filtro de busca**: caixa de texto que filtra por descrição/memo localmente (não
  recarrega do backend).
- **Cards de entries** com cor de status:
  - **Pendente** (amarelo): botões `Vincular`, `Criar lançamento`, link `Ignorar`.
  - **Conciliada** (verde): mostra o lançamento vinculado embutido, com `Desvincular`.
    Se a Transaction veio de quick-create, aparece um badge "criado por esta entry".
  - **Ignorada** (cinza, esmaecida): botão `Desfazer`.

### Modal "Vincular"

Mostra a entry no topo, lista candidatos automáticos (mesma conta, valor ±10%, data
±5 dias) ordenados por proximidade. Match exato (data e valor exatos) recebe um badge
"match exato". Se nada for relevante, link "Buscar outro lançamento" expande uma
busca livre por descrição (debounce de 350ms).

A busca livre filtra **apenas Transactions ainda não conciliadas** (`conciliadoEm: null`)
da mesma conta e direção (receita/despesa).

### Modal "Criar lançamento" (quick-create)

Pré-preenche tudo com os dados da entry. Tipo, valor, data e conta são auto e
read-only. Descrição (vinda do memo da entry), complemento e categoria (vinda da
sugestão do OfxPattern, se houver) podem ser editados. Categoria é filtrada pelo
tipo da Transaction (receita/despesa, ignora se não houver natureza definida).

Salvar cria a Transaction com:
- `origem='ofx'`
- `ofxImportId=` o import da entry
- `conciliadoEm=now()`
- categoryId vindo do form (vai trazer também os campos de Domínio Contábil:
  `contaDebito`, `contaCredito`, `codHistorico`, etc.)

E vincula a entry à Transaction recém-criada (`status=conciliado`).

### Excluir importação OFX (atualizado)

Antes da 5B, o `DELETE /api/ofx/imports/:id` só desconciliava as Transactions
manuais. Agora ele também:
- **Apaga** Transactions criadas via quick-create (`origem='ofx'` E
  `ofxImportId === este id`), exceto se já tiverem `exportado=true`. As exportadas
  são mantidas e apenas desconciliadas, pra preservar a trilha pra o Domínio.
- Continua **desconciliando** Transactions manuais que foram batidas pelo auto-match.

---

## 4. Smoke tests sugeridos

Depois de aplicar tudo:

1. **Abre `/app/conciliacao` pela sidebar** → vê lista de imports recentes.
2. **Clica num import** → tela de conciliação abre, tab "Pendentes" ativa.
3. **Em uma entry pendente, clica "Vincular"** → modal abre com candidatos. Se
   houver candidato com data/valor exatos, aparece badge "match exato". Vincula
   um → modal fecha, entry vai pra "Conciliadas".
4. **Em outra entry pendente, clica "Criar lançamento"** → modal abre. Categoria
   pré-selecionada é a sugestão do OfxPattern (se houver). Edita descrição. Salva.
   Entry vira "Conciliada", com badge "criado por esta entry" no card.
5. **Em outra, clica "Ignorar"** → vai pra tab "Ignoradas".
6. **Na tab "Ignoradas", clica "Desfazer"** → volta pra "Pendentes".
7. **Em uma "Conciliada", clica "Desvincular"** → confirmação → entry volta a
   "Pendente", lançamento perde marca de conciliado.
8. **Vai em /app/importacao-ofx, deleta o import** → confirma que as Transactions
   criadas via quick-create foram apagadas (e que as manuais ficaram, só
   desconciliadas).

---

## 5. Decisões de design dessa etapa

### Por que apagar Transactions de quick-create no `removeImport`?

Porque elas só existem por causa do import. Manter elas órfãs (com `ofxImportId`
apontando pra um import deletado) seria pior — confundiria relatórios e a UI.

### Por que preservar as `exportado=true`?

Lançamentos exportados pra Domínio Contábil já fazem parte da contabilidade oficial.
Apagá-los criaria descompasso entre o sistema e o Domínio. Em vez de bloquear o
delete do import inteiro, simplesmente desconciliamos esses casos específicos
(raros mas possíveis).

### Por que filtrar candidatos por `valor ±10%` e `data ±5 dias`?

Tentativa de cobrir casos comuns onde o usuário cadastrou:
- valor ligeiramente diferente (taxas, arredondamento)
- data ligeiramente diferente (dia do faturamento vs dia do pagamento)

A tolerância pode ser ajustada futuramente — está no `matchCandidates` em
`ofx.service.js`. Se quiser tornar configurável por empresa, dá pra mover pra
`ConfiguracaoEmpresa`.

### Por que `transactions/?bankAccountId=X&search=texto&tipo=Y` na busca livre?

Reusa o endpoint existente do módulo `transactions/`. Limitação: ele não filtra por
"sem ofxEntry" no servidor, então o frontend filtra client-side por `conciliadoEm: null`.
Se quiser endpoint dedicado mais eficiente, dá pra adicionar futuramente.

---

## 6. Limitações conhecidas / pendentes

- **Sem N-pra-1 nem 1-pra-N** — uma entry só pode vincular a um Transaction e
  vice-versa. Casos onde uma compra parcelada virou várias linhas no extrato
  ainda precisam de tratamento manual (ignorar ou criar Transactions individuais).
- **Sem ações em lote** — selecionar várias entries e ignorar/conciliar de uma vez.
  Pode ser adicionado em futuras etapas se a operação for cansativa.
- **Sem visualizar quem criou a Transaction via quick-create** — o badge "criado
  por esta entry" aparece, mas não tem link clicável pra abrir o lançamento na
  página `/app/lancamentos`. Pode ser adicionado.
- **Sem rotacionamento da senha do banco de dev** (anotação não-relacionada à 5B,
  só pra lembrar do que ficou pendente da 5A).

---

## 7. Resumo dos arquivos do pacote

```
backend/
└── src/modules/ofx/
    ├── ofx.service.js            ← substitui (5A → 5B)
    ├── ofx.controller.js         ← substitui (5A → 5B)
    └── ofx.routes.js             ← substitui (5A → 5B)

frontend/
└── src/
    ├── App.jsx                   ← MODIFICADO (+rota Conciliação)
    ├── components/layout/
    │   └── Sidebar.jsx           ← MODIFICADO (+item Conciliação)
    └── pages/
        ├── ImportacaoOFX.jsx     ← REESCRITO (era placeholder)
        └── Conciliacao.jsx       ← NOVO

MERGE_GUIDE_ETAPA_5B.md           ← este arquivo
```
