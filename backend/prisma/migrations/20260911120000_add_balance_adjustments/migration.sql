-- CreateTable
CREATE TABLE "balance_adjustments" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "bank_account_id" TEXT NOT NULL,
    "transaction_id" TEXT,
    "data_ajuste" DATE NOT NULL,
    "saldo_sistema" DECIMAL(15,2) NOT NULL,
    "saldo_real" DECIMAL(15,2) NOT NULL,
    "diferenca" DECIMAL(15,2) NOT NULL,
    "motivo" VARCHAR(500) NOT NULL,
    "estorno_de" TEXT,
    "criado_por" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "balance_adjustments_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE INDEX "balance_adjustments_tenant_id_bank_account_id_idx" ON "balance_adjustments"("tenant_id", "bank_account_id");
-- AddForeignKey
ALTER TABLE "balance_adjustments" ADD CONSTRAINT "balance_adjustments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "balance_adjustments" ADD CONSTRAINT "balance_adjustments_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "bank_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "balance_adjustments" ADD CONSTRAINT "balance_adjustments_criado_por_fkey" FOREIGN KEY ("criado_por") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
