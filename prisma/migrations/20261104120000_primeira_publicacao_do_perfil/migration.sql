-- Quando a empresa publicou o perfil no Elo Profissionais pela primeira vez. O responsável é obrigado a publicar uma
-- vez depois do cadastro; depois disso pode despublicar sem ficar preso de novo.
-- Só adiciona uma coluna opcional. Empresas que já têm perfil publicado ficam marcadas como já publicadas.

-- AlterTable
ALTER TABLE "Empresa" ADD COLUMN "primeiraPublicacaoEm" TEXT;

-- Quem já está publicado não é obrigado a nada.
UPDATE "Empresa" SET "primeiraPublicacaoEm" = p."atualizadoEm"
FROM "PerfilPublico" p
WHERE p."empresaId" = "Empresa"."id" AND p."status" = 'publicado';
