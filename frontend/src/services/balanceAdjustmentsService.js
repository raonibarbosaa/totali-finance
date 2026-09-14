import api from './api';

// Ajuste de saldo bancário.
//
// O ajuste não sobrescreve nenhum número: ele cria um lançamento de verdade
// (origem 'ajuste') mais um registro de auditoria com o saldo do sistema, o
// saldo real informado e o motivo.
//
// Enquanto a competência está aberta, o ajuste pode ser corrigido (atualizar)
// ou cancelado. Depois de fechada, o único caminho é o estorno, que lança o
// contrário com a data de hoje sem tocar no mês fechado. Quem decide qual dos
// três a tela pode oferecer é o backend: cada ajuste da lista vem com um campo
// `acoes`.
const balanceAdjustmentsService = {
  // Saldo que o sistema calcula para a conta naquela data, mostrado antes de
  // o usuário digitar o saldo real do extrato.
  // ignorarAjusteId: usado na EDIÇÃO, para o saldo vir como estaria se aquele
  // ajuste não existisse — que é o número contra o qual a diferença é medida.
  previa: (bankAccountId, data, ignorarAjusteId = null) =>
    api.get('/balance-adjustments/previa', {
      params: { bankAccountId, data, ...(ignorarAjusteId && { ignorarAjusteId }) },
    }),

  list: (bankAccountId) =>
    api.get('/balance-adjustments', { params: { bankAccountId } }),

  // { bankAccountId, dataLancamento, saldoReal, motivo }
  //
  // Não recebe categoria: ela é fixa e o backend escolhe pelo sentido da
  // diferença. contaDebito e contaCredito só vão no primeiro ajuste de cada
  // sentido, quando a categoria ainda não tem as contas do plano de contas.
  //
  // O campo de data se chama dataLancamento porque é o nome que o guarda de
  // competência fechada procura no corpo da requisição.
  create: (dados) => api.post('/balance-adjustments', dados),

  estornar: (id, motivo, contas = {}) =>
    api.post(`/balance-adjustments/${id}/estornar`, { motivo, ...contas }),

  // { dataLancamento, saldoReal, motivo } — o que não vier fica como está.
  // O saldo do sistema é recalculado na data nova, ignorando o lançamento do
  // próprio ajuste, então a diferença muda junto.
  atualizar: (id, dados) => api.put(`/balance-adjustments/${id}`, dados),

  // Apaga o lançamento (o saldo volta ao que era) e mantém a linha no
  // histórico como cancelada. O motivo vai no corpo — em DELETE, o axios só
  // manda corpo dentro de `data`.
  cancelar: (id, motivo) =>
    api.delete(`/balance-adjustments/${id}`, { data: { motivo } }),
};

export default balanceAdjustmentsService;
