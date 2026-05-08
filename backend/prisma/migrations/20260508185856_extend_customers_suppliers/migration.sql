-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "bairro" VARCHAR(100),
ADD COLUMN     "cep" VARCHAR(8),
ADD COLUMN     "cidade" VARCHAR(100),
ADD COLUMN     "complemento" VARCHAR(150),
ADD COLUMN     "emails_adicionais" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "inscricao_estadual" VARCHAR(30),
ADD COLUMN     "inscricao_municipal" VARCHAR(30),
ADD COLUMN     "logradouro" VARCHAR(255),
ADD COLUMN     "numero" VARCHAR(20),
ADD COLUMN     "pessoa_contato" VARCHAR(150),
ADD COLUMN     "uf" VARCHAR(2);

-- AlterTable
ALTER TABLE "suppliers" ADD COLUMN     "bairro" VARCHAR(100),
ADD COLUMN     "cep" VARCHAR(8),
ADD COLUMN     "cidade" VARCHAR(100),
ADD COLUMN     "complemento" VARCHAR(150),
ADD COLUMN     "emails_adicionais" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "inscricao_estadual" VARCHAR(30),
ADD COLUMN     "inscricao_municipal" VARCHAR(30),
ADD COLUMN     "logradouro" VARCHAR(255),
ADD COLUMN     "numero" VARCHAR(20),
ADD COLUMN     "pessoa_contato" VARCHAR(150),
ADD COLUMN     "uf" VARCHAR(2);
