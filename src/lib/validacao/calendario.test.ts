import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { compromissoSchema, MAX_PARTICIPANTES, periodoSchema } from "./calendario";

const base = { titulo: "Reunião com o cliente", categoria: "reuniao", data: "2026-10-20", diaInteiro: false, horaInicio: "14:00", horaFim: "15:00" } as const;

function mensagens(entrada: unknown): string[] {
  const r = compromissoSchema.safeParse(entrada);
  return r.success ? [] : r.error.issues.map((i) => i.message);
}

describe("validação do compromisso", () => {
  it("aceita um compromisso completo e preenche os padrões", () => {
    const r = compromissoSchema.parse(base);
    assert.equal(r.status, "agendado");
    assert.deepEqual(r.participantesIds, []);
  });
  it("exige título", () => assert.ok(mensagens({ ...base, titulo: "   " }).includes("Informe o título do compromisso")));
  it("recusa data que não existe", () => assert.ok(mensagens({ ...base, data: "2026-02-30" }).includes("Data inválida")));
  it("com horário, o início é obrigatório", () => assert.ok(mensagens({ ...base, horaInicio: undefined }).includes("Informe o horário de início")));
  it("o término precisa ser depois do início", () => {
    assert.ok(mensagens({ ...base, horaInicio: "15:00", horaFim: "14:00" }).includes("O término precisa ser depois do início"));
    assert.ok(mensagens({ ...base, horaInicio: "15:00", horaFim: "15:00" }).includes("O término precisa ser depois do início"));
  });
  it("término é opcional", () => assert.deepEqual(mensagens({ ...base, horaFim: undefined }), []));
  it("dia inteiro não tem horário", () => {
    assert.deepEqual(mensagens({ ...base, diaInteiro: true, horaInicio: undefined, horaFim: undefined }), []);
    assert.ok(mensagens({ ...base, diaInteiro: true }).includes("Compromisso de dia inteiro não tem horário"));
  });
  it("recusa categoria e situação desconhecidas", () => {
    assert.notDeepEqual(mensagens({ ...base, categoria: "inventada" }), []);
    assert.notDeepEqual(mensagens({ ...base, status: "perdido" }), []);
  });
  it("recusa campos a mais (empresaId e criadoPorId forjados no envio)", () => {
    assert.notDeepEqual(mensagens({ ...base, empresaId: "outra" }), []);
    assert.notDeepEqual(mensagens({ ...base, criadoPorId: "outro" }), []);
  });
  it("participantes precisam ser identificadores válidos e no máximo " + MAX_PARTICIPANTES, () => {
    assert.notDeepEqual(mensagens({ ...base, participantesIds: ["nao-e-uuid"] }), []);
    const muitos = Array.from({ length: MAX_PARTICIPANTES + 1 }, () => "3f2504e0-4f89-41d3-9a0c-0305e82c3301");
    assert.notDeepEqual(mensagens({ ...base, participantesIds: muitos }), []);
  });
});

describe("validação do período consultado", () => {
  it("aceita um mês de grade", () => assert.equal(periodoSchema.safeParse({ de: "2026-09-27", ate: "2026-11-07" }).success, true));
  it("recusa fim antes do início", () => assert.equal(periodoSchema.safeParse({ de: "2026-10-20", ate: "2026-10-19" }).success, false));
  it("recusa período grande demais (consulta que varre tudo)", () => assert.equal(periodoSchema.safeParse({ de: "2026-01-01", ate: "2026-12-31" }).success, false));
});
