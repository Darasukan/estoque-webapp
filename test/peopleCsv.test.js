import assert from 'node:assert/strict'
import test from 'node:test'
import { parsePeopleCsv } from '../src/utils/peopleCsv.js'

test('parseia funcionarios de CSV com nome e cargo', () => {
  assert.deepEqual(parsePeopleCsv('nome;cargo\nAna;Mecanica\n"Joao, Silva";Operador').rows, [
    { name: 'Ana', role: 'Mecanica' },
    { name: 'Joao, Silva', role: 'Operador' },
  ])
})

test('aceita CSV sem cabecalho e ignora nome vazio', () => {
  assert.deepEqual(parsePeopleCsv('Maria,Almoxarife\n,Sem nome'), {
    rows: [{ name: 'Maria', role: 'Almoxarife' }],
    skipped: 1,
  })
})

test('usa primeira coluna como nome quando o cabecalho nao informa nome', () => {
  assert.deepEqual(parsePeopleCsv('funcionario;cargo\nCarlos;Soldador').rows, [
    { name: 'Carlos', role: 'Soldador' },
  ])
})
