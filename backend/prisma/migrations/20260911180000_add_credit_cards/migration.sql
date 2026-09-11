-- CreateTable
CREATE TABLE "credit_cards" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "nome" VARCHAR(100) NOT NULL,
    "emissor" VARCHAR(30) NOT NULL DEFAULT 'generico',
    "bandeira" VARCHAR(20),
    "ultimos_4" VARCHAR(4),
    "limite" DECIMAL(15,2),
    "dia_fechamento" INTEGER,
    "dia_vencimento" INTEGER,
    "bank_account_id" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "credit_cards_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "card_statements" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "credit_card_id" TEXT NOT NULL,
    "nome_arquivo" VARCHAR(255),
    "hash_arquivo" VARCHAR(64) NOT NULL,
    "emissor_detectado" VARCHAR(30),
    "competencia" DATE,
    "data_vencimento" DATE,
    "valor_total_informado" DECIMAL(15,2),
    "total_linhas" INTEGER NOT NULL DEFAULT 0,
    "importado_por" TEXT,
    "importado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "card_statements_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "card_statement_entries" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "card_statement_id" TEXT NOT NULL,
    "credit_card_id" TEXT NOT NULL,
    "data_compra" DATE NOT NULL,
    "descricao" VARCHAR(500) NOT NULL,
    "valor" DECIMAL(15,2) NOT NULL,
    "tipo" VARCHAR(20) NOT NULL,
    "parcela_numero" INTEGER,
    "parcela_total" INTEGER,
    "category_id" TEXT,
    "supplier_id" TEXT,
    "transaction_id" TEXT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pendente',
    "hash_linha" VARCHAR(64) NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "card_statement_entries_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE INDEX "credit_cards_tenant_id_ativo_idx" ON "credit_cards"("tenant_id", "ativo");
-- CreateIndex
CREATE INDEX "card_statements_tenant_id_credit_card_id_idx" ON "card_statements"("tenant_id", "credit_card_id");
-- CreateIndex
CREATE UNIQUE INDEX "card_statements_tenant_id_hash_arquivo_key" ON "card_statements"("tenant_id", "hash_arquivo");
-- CreateIndex
CREATE INDEX "card_statement_entries_tenant_id_card_statement_id_idx" ON "card_statement_entries"("tenant_id", "card_statement_id");
-- CreateIndex
CREATE UNIQUE INDEX "card_statement_entries_credit_card_id_hash_linha_key" ON "card_statement_entries"("credit_card_id", "hash_linha");
-- AddForeignKey
ALTER TABLE "credit_cards" ADD CONSTRAINT "credit_cards_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "credit_cards" ADD CONSTRAINT "credit_cards_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "bank_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "card_statements" ADD CONSTRAINT "card_statements_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "card_statements" ADD CONSTRAINT "card_statements_credit_card_id_fkey" FOREIGN KEY ("credit_card_id") REFERENCES "credit_cards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "card_statements" ADD CONSTRAINT "card_statements_importado_por_fkey" FOREIGN KEY ("importado_por") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "card_statement_entries" ADD CONSTRAINT "card_statement_entries_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "card_statement_entries" ADD CONSTRAINT "card_statement_entries_card_statement_id_fkey" FOREIGN KEY ("card_statement_id") REFERENCES "card_statements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "card_statement_entries" ADD CONSTRAINT "card_statement_entries_credit_card_id_fkey" FOREIGN KEY ("credit_card_id") REFERENCES "credit_cards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "card_statement_entries" ADD CONSTRAINT "card_statement_entries_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "card_statement_entries" ADD CONSTRAINT "card_statement_entries_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
