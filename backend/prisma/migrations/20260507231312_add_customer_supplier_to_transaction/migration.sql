-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "customer_id" TEXT,
ADD COLUMN     "supplier_id" TEXT;

-- CreateIndex
CREATE INDEX "transactions_tenant_id_customer_id_idx" ON "transactions"("tenant_id", "customer_id");

-- CreateIndex
CREATE INDEX "transactions_tenant_id_supplier_id_idx" ON "transactions"("tenant_id", "supplier_id");

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
