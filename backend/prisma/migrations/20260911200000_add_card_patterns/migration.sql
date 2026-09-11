-- AlterTable
ALTER TABLE "credit_cards" ADD COLUMN     "category_id_fatura" TEXT,
ADD COLUMN     "conta_cartao" VARCHAR(20);
-- AlterTable
ALTER TABLE "card_statement_entries" ADD COLUMN     "complemento_auto" VARCHAR(255);
-- CreateTable
CREATE TABLE "card_patterns" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "texto" VARCHAR(255) NOT NULL,
    "category_id" TEXT,
    "supplier_id" TEXT,
    "complemento_auto" VARCHAR(255),
    "prioridade" INTEGER NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "card_patterns_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE INDEX "card_patterns_tenant_id_ativo_idx" ON "card_patterns"("tenant_id", "ativo");
-- AddForeignKey
ALTER TABLE "credit_cards" ADD CONSTRAINT "credit_cards_category_id_fatura_fkey" FOREIGN KEY ("category_id_fatura") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "card_patterns" ADD CONSTRAINT "card_patterns_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "card_patterns" ADD CONSTRAINT "card_patterns_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "card_patterns" ADD CONSTRAINT "card_patterns_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
