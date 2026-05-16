-- CreateTable
CREATE TABLE "drive_configs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "folder_id" VARCHAR(255) NOT NULL,
    "folder_url" TEXT,
    "source" VARCHAR(20) NOT NULL DEFAULT 'totali',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "last_checked_at" TIMESTAMP(3),
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "drive_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ofx_import_logs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "drive_file_id" VARCHAR(255),
    "file_name" VARCHAR(255) NOT NULL,
    "status" VARCHAR(20) NOT NULL,
    "transaction_count" INTEGER NOT NULL DEFAULT 0,
    "error_msg" TEXT,
    "imported_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ofx_import_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "drive_configs_tenant_id_key" ON "drive_configs"("tenant_id");

-- CreateIndex
CREATE INDEX "ofx_import_logs_tenant_id_imported_at_idx" ON "ofx_import_logs"("tenant_id", "imported_at");

-- AddForeignKey
ALTER TABLE "drive_configs" ADD CONSTRAINT "drive_configs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ofx_import_logs" ADD CONSTRAINT "ofx_import_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
