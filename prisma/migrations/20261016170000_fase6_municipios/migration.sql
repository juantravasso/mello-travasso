-- CreateTable
CREATE TABLE "Municipio" (
    "ibgeId" INTEGER NOT NULL,
    "nome" TEXT NOT NULL,
    "nomeBusca" TEXT NOT NULL,
    "uf" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "Municipio_pkey" PRIMARY KEY ("ibgeId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Municipio_uf_nomeBusca_key" ON "Municipio"("uf", "nomeBusca");


-- Coordenadas dentro do Brasil e UF de duas letras maiúsculas (defesa em profundidade: a busca por
-- raio confia nesses números).
ALTER TABLE "Municipio" ADD CONSTRAINT "Municipio_coordenadas_check" CHECK (
  "latitude" BETWEEN -34 AND 6 AND "longitude" BETWEEN -75 AND -28
);
ALTER TABLE "Municipio" ADD CONSTRAINT "Municipio_uf_check" CHECK ("uf" ~ '^[A-Z]{2}$');
