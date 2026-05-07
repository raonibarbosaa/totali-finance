/*
  Warnings:

  - A unique constraint covering the columns `[recurring_title_id,data_vencimento]` on the table `titles` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "titles" ADD COLUMN     "recurring_title_id" TEXT;

-- CreateTable
CREATE TABLE "recurring_titles" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "category_id" TEXT,
    "tipo" VARCHAR(10) NOT NULL,
    "descricao" VARCHAR(255) NOT NULL,
    "valor" DECIMAL(15,2) NOT NULL,
    "numero_documento" VARCHAR(100),
    "nome_contato" VARCHAR(200),
    "observacao" TEXT,
    "frequencia" VARCHAR(15) NOT NULL,
    "dia_vencimento" INTEGER NOT NULL,
    "data_inicio" DATE NOT NULL,
    "data_fim_geracao" DATE,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_por" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recurring_titles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "recurring_titles_tenant_id_ativo_idx" ON "recurring_titles"("tenant_id", "ativo");

-- CreateIndex
CREATE UNIQUE INDEX "titles_recurring_title_id_data_vencimento_key" ON "titles"("recurring_title_id", "data_vencimento");

-- AddForeignKey
ALTER TABLE "titles" ADD CONSTRAINT "titles_recurring_title_id_fkey" FOREIGN KEY ("recurring_title_id") REFERENCES "recurring_titles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_titles" ADD CONSTRAINT "recurring_titles_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_titles" ADD CONSTRAINT "recurring_titles_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_titles" ADD CONSTRAINT "recurring_titles_criado_por_fkey" FOREIGN KEY ("criado_por") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
