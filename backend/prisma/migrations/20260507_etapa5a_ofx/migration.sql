-- ─────────────────────────────────────────────────────────────────────────────
-- Etapa 5A — Importação OFX e Conciliação Bancária (parte 1)
--
-- Mudanças:
--   1. transactions  + conciliado_em (DateTime?)        — flag de conciliação
--   2. ofx_imports   + hash_arquivo  (VARCHAR(64))      — dedup de arquivo
--   3. ofx_entries   (NOVA TABELA)                      — linhas do extrato OFX
--
-- Compatível: Etapas 1–4 não são impactadas.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. transactions.conciliado_em ─────────────────────────────────────────
ALTER TABLE "transactions"
  ADD COLUMN "conciliado_em" TIMESTAMP(3);

CREATE INDEX "transactions_tenant_id_conciliado_em_idx"
  ON "transactions"("tenant_id", "conciliado_em");

-- ── 2. ofx_imports.hash_arquivo ───────────────────────────────────────────
ALTER TABLE "ofx_imports"
  ADD COLUMN "hash_arquivo" VARCHAR(64);

CREATE UNIQUE INDEX "ofx_imports_tenant_id_hash_arquivo_key"
  ON "ofx_imports"("tenant_id", "hash_arquivo");

-- ── 3. ofx_entries (nova tabela) ──────────────────────────────────────────
CREATE TABLE "ofx_entries" (
  "id"                    TEXT          NOT NULL,
  "tenant_id"             TEXT          NOT NULL,
  "ofx_import_id"         TEXT          NOT NULL,
  "bank_account_id"       TEXT          NOT NULL,
  "fitid"                 VARCHAR(255)  NOT NULL,
  "data_movimento"        DATE          NOT NULL,
  "valor"                 DECIMAL(15,2) NOT NULL,
  "tipo"                  VARCHAR(20)   NOT NULL,
  "descricao"             VARCHAR(500),
  "memo"                  VARCHAR(500),
  "status"                VARCHAR(20)   NOT NULL DEFAULT 'pendente',
  "transaction_id"        TEXT,
  "suggested_category_id" TEXT,
  "conciliado_em"         TIMESTAMP(3),
  "ignorado_em"           TIMESTAMP(3),
  "criado_em"             TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ofx_entries_pkey" PRIMARY KEY ("id")
);

-- Índices únicos: 1 entry pode estar vinculada a 1 transaction (e vice-versa);
-- FITID é único por conta (mesmo arquivo importado em 2 imports não duplica).
CREATE UNIQUE INDEX "ofx_entries_transaction_id_key"
  ON "ofx_entries"("transaction_id");

CREATE UNIQUE INDEX "ofx_entries_bank_account_id_fitid_key"
  ON "ofx_entries"("bank_account_id", "fitid");

CREATE INDEX "ofx_entries_tenant_id_status_idx"
  ON "ofx_entries"("tenant_id", "status");

CREATE INDEX "ofx_entries_ofx_import_id_idx"
  ON "ofx_entries"("ofx_import_id");

-- Foreign keys
ALTER TABLE "ofx_entries"
  ADD CONSTRAINT "ofx_entries_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ofx_entries"
  ADD CONSTRAINT "ofx_entries_ofx_import_id_fkey"
  FOREIGN KEY ("ofx_import_id") REFERENCES "ofx_imports"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ofx_entries"
  ADD CONSTRAINT "ofx_entries_bank_account_id_fkey"
  FOREIGN KEY ("bank_account_id") REFERENCES "bank_accounts"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ofx_entries"
  ADD CONSTRAINT "ofx_entries_transaction_id_fkey"
  FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ofx_entries"
  ADD CONSTRAINT "ofx_entries_suggested_category_id_fkey"
  FOREIGN KEY ("suggested_category_id") REFERENCES "categories"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
