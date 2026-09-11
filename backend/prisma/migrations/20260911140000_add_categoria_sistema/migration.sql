-- AlterTable
ALTER TABLE "categories" ADD COLUMN     "codigo_sistema" VARCHAR(30);
-- CreateIndex
CREATE UNIQUE INDEX "categories_tenant_id_codigo_sistema_key" ON "categories"("tenant_id", "codigo_sistema");
