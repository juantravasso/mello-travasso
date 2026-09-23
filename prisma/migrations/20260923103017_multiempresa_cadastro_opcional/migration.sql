-- CreateEnum
CREATE TYPE "TipoPessoaDb" AS ENUM ('pj', 'pf');

-- CreateEnum
CREATE TYPE "PlanoDb" AS ENUM ('teste', 'cortesia', 'ativo', 'suspenso');

-- AlterTable
ALTER TABLE "Empresa" ADD COLUMN     "aceiteTermosEm" TEXT,
ADD COLUMN     "aceiteTermosVersao" TEXT,
ADD COLUMN     "bairro" TEXT,
ADD COLUMN     "cep" TEXT,
ADD COLUMN     "cidade" TEXT,
ADD COLUMN     "complemento" TEXT,
ADD COLUMN     "emailContato" TEXT,
ADD COLUMN     "estado" TEXT,
ADD COLUMN     "logradouro" TEXT,
ADD COLUMN     "nomeFantasia" TEXT,
ADD COLUMN     "numero" TEXT,
ADD COLUMN     "plano" "PlanoDb",
ADD COLUMN     "situacaoCadastral" TEXT,
ADD COLUMN     "telefone" TEXT,
ADD COLUMN     "testeTerminaEm" TEXT,
ADD COLUMN     "tipoPessoa" "TipoPessoaDb";
