'use strict';

// ─────────────────────────────────────────────────────────────────────────
// Registro de leitores de fatura.
//
// Cada emissor tem layout proprio, entao tem leitor proprio. Nao existe leitor
// unico que acerte Nubank, Itau e Bradesco ao mesmo tempo — e o mesmo motivo
// de existirem rotinas separadas para Caixa e Santander na conversao de
// extratos bancarios.
//
// Todo leitor exporta a MESMA interface:
//   { nome, rotulo, detectar(texto) -> bool, extrair(texto, opcoes) -> {...} }
//
// Para adicionar um emissor: crie o arquivo, implemente as duas funcoes e
// acrescente no array LEITORES. Nada mais no sistema muda.
// ─────────────────────────────────────────────────────────────────────────

const generico = require('./generico');
const cora     = require('./cora');

// Ordem importa: o primeiro cujo detectar() responder true e o escolhido.
// O generico fica fora da deteccao — ele e o fallback, nunca o detectado.
const LEITORES = [
  cora,
  // require('./nubank'),
  // require('./itau'),
];

const TODOS = [...LEITORES, generico];

// 'auto' nao e um leitor: e a ausencia de escolha. Existe para distinguir
// "deixei no padrao" de "escolhi o generico de proposito", que e o que o
// usuario faz quando o leitor do emissor esta errando naquele arquivo.
const AUTO = 'auto';

/** Lista para a tela de cadastro do cartao. */
function listarEmissores() {
  return [
    { value: AUTO, label: 'Detectar automaticamente' },
    ...TODOS.map((l) => ({ value: l.nome, label: l.rotulo })),
  ];
}

/**
 * Escolhe o leitor de uma fatura.
 *
 * 1. Emissor escolhido no cadastro manda, inclusive quando e o generico.
 * 2. No automatico, tenta detectar pelo conteudo do arquivo.
 * 3. Sem deteccao, cai no generico.
 */
function escolherLeitor(texto, emissorCadastrado) {
  if (emissorCadastrado && emissorCadastrado !== AUTO) {
    const escolhido = TODOS.find((l) => l.nome === emissorCadastrado);
    if (escolhido) return escolhido;
  }
  return LEITORES.find((l) => l.detectar(texto)) || generico;
}

module.exports = { escolherLeitor, listarEmissores, LEITORES: TODOS, AUTO };
