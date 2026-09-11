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

// Ordem importa: o primeiro cujo detectar() responder true e o escolhido.
// O generico fica fora da deteccao — ele e o fallback, nunca o detectado.
const LEITORES = [
  // require('./nubank'),
  // require('./itau'),
];

const TODOS = [...LEITORES, generico];

/** Lista para a tela de cadastro do cartao. */
function listarEmissores() {
  return TODOS.map((l) => ({ value: l.nome, label: l.rotulo }));
}

/**
 * Escolhe o leitor de uma fatura.
 *
 * 1. Se o cartao tem emissor cadastrado e existe leitor com esse nome, usa ele.
 *    A escolha do usuario manda mais que a deteccao automatica.
 * 2. Senao, tenta detectar pelo conteudo do texto.
 * 3. Senao, cai no generico.
 */
function escolherLeitor(texto, emissorCadastrado) {
  if (emissorCadastrado && emissorCadastrado !== 'generico') {
    const escolhido = TODOS.find((l) => l.nome === emissorCadastrado);
    if (escolhido) return escolhido;
  }
  return LEITORES.find((l) => l.detectar(texto)) || generico;
}

module.exports = { escolherLeitor, listarEmissores, LEITORES: TODOS };
