import api from './api';

// Ajuste de saldo bancário.
//
// O ajuste não sobrescreve nenhum número: ele cria um lançamento de verdade
// (origem 'ajuste') mais um registro de auditoria com o saldo do sistema, o
// saldo real informado e o motivo. Por isso não existe "editar ajuste" — para
// desfazer, usa-se o estorno, que gera o lançamento contrário.
const balanceAdjustmentsService = {
  // Saldo que o sistema calcula para a conta naquela data, mostrado antes de
  // o usuário digitar o saldo real do extrato.
  previa: (bankAccountId, data) =>
    api.get('/balance-adjustments/previa', { params: { bankAccountId, data } }),

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
};

export default balanceAdjustmentsService;
