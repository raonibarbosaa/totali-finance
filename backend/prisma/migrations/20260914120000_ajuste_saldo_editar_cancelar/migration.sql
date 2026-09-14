-- Edicao e cancelamento do ajuste de saldo bancario.
--
-- revisoes guarda as versoes anteriores do ajuste (data, saldos, diferenca,
-- motivo, quem editou e quando). E JSON porque so e lido inteiro, para mostrar
-- no painel do modal — nada filtra nem agrega por dentro dele.
ALTER TABLE "balance_adjustments" ADD COLUMN "editado_em"  TIMESTAMP(3);
ALTER TABLE "balance_adjustments" ADD COLUMN "editado_por" TEXT;
ALTER TABLE "balance_adjustments" ADD COLUMN "revisoes"    JSONB;

-- Cancelamento e logico: o lancamento some (o saldo volta ao que era) mas a
-- linha continua no historico, riscada.
ALTER TABLE "balance_adjustments" ADD COLUMN "cancelado_em"        TIMESTAMP(3);
ALTER TABLE "balance_adjustments" ADD COLUMN "cancelado_por"       TEXT;
ALTER TABLE "balance_adjustments" ADD COLUMN "motivo_cancelamento" VARCHAR(500);

ALTER TABLE "balance_adjustments" ADD CONSTRAINT "balance_adjustments_editado_por_fkey"
  FOREIGN KEY ("editado_por") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "balance_adjustments" ADD CONSTRAINT "balance_adjustments_cancelado_por_fkey"
  FOREIGN KEY ("cancelado_por") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
