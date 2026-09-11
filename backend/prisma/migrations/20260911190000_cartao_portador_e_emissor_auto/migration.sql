-- AlterTable
ALTER TABLE "credit_cards" ALTER COLUMN "emissor" SET DEFAULT 'auto';
-- AlterTable
ALTER TABLE "card_statement_entries" ADD COLUMN     "portador" VARCHAR(120);
