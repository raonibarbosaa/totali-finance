-- CreateEnum
CREATE TYPE "tipo_documento" AS ENUM ('CPF', 'CNPJ');

-- AlterTable
ALTER TABLE "titles" ADD COLUMN     "customer_id" TEXT,
ADD COLUMN     "grupo_parcelamento_id" TEXT,
ADD COLUMN     "parcela_numero" INTEGER,
ADD COLUMN     "parcela_total" INTEGER,
ADD COLUMN     "supplier_id" TEXT,
ADD COLUMN     "valor_total_grupo" DECIMAL(15,2);

-- CreateTable
CREATE TABLE "suppliers" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "nome" VARCHAR(200) NOT NULL,
    "documento" VARCHAR(20),
    "tipo_documento" "tipo_documento",
    "email" VARCHAR(150),
    "telefone" VARCHAR(30),
    "endereco" TEXT,
    "observacao" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "nome" VARCHAR(200) NOT NULL,
    "documento" VARCHAR(20),
    "tipo_documento" "tipo_documento",
    "email" VARCHAR(150),
    "telefone" VARCHAR(30),
    "endereco" TEXT,
    "observacao" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "suppliers_tenant_id_ativo_idx" ON "suppliers"("tenant_id", "ativo");

-- CreateIndex
CREATE INDEX "suppliers_tenant_id_nome_idx" ON "suppliers"("tenant_id", "nome");

-- CreateIndex
CREATE INDEX "customers_tenant_id_ativo_idx" ON "customers"("tenant_id", "ativo");

-- CreateIndex
CREATE INDEX "customers_tenant_id_nome_idx" ON "customers"("tenant_id", "nome");

-- CreateIndex
CREATE INDEX "titles_tenant_id_grupo_parcelamento_id_idx" ON "titles"("tenant_id", "grupo_parcelamento_id");

-- AddForeignKey
ALTER TABLE "titles" ADD CONSTRAINT "titles_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "titles" ADD CONSTRAINT "titles_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
