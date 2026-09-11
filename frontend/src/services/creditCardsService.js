import api from './api';

// Controle de cartão de crédito.
//
// Etapa 1: cadastro de cartões e leitura da fatura em PDF, para conferência.
// Nada é classificado e nada vira lançamento ainda — isso vem na Etapa 2,
// junto com o de-para de estabelecimento para categoria e fornecedor.
const creditCardsService = {
  // ── Cartões ───────────────────────────────────────────────────────
  listCards:  ()            => api.get('/credit-cards'),
  findCard:   (id)          => api.get(`/credit-cards/${id}`),
  createCard: (dados)       => api.post('/credit-cards', dados),
  updateCard: (id, dados)   => api.put(`/credit-cards/${id}`, dados),
  removeCard: (id)          => api.delete(`/credit-cards/${id}`),

  // Emissores com leitor de PDF disponível.
  emissores:  ()            => api.get('/credit-cards/emissores'),

  // ── Faturas ───────────────────────────────────────────────────────
  listStatements: (creditCardId) =>
    api.get('/credit-cards/statements', { params: { creditCardId } }),

  findStatement:   (id) => api.get(`/credit-cards/statements/${id}`),
  removeStatement: (id) => api.delete(`/credit-cards/statements/${id}`),

  // ── Classificação e lançamentos (Etapa 2) ─────────────────────────
  // Reaplica o de-para na fatura, depois de você criar regras novas.
  reclassificar: (statementId) =>
    api.post(`/credit-cards/statements/${statementId}/reclassificar`),

  // Aplica a mesma categoria a todas as linhas com a mesma descrição.
  classificarEmLote: (statementId, dados) =>
    api.post(`/credit-cards/statements/${statementId}/classificar`, dados),

  classificarLinha: (entryId, dados) =>
    api.put(`/credit-cards/entries/${entryId}`, dados),

  gerar:    (statementId) => api.post(`/credit-cards/statements/${statementId}/gerar`),
  desfazer: (statementId) => api.post(`/credit-cards/statements/${statementId}/desfazer`),

  importStatement: (creditCardId, file) => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('creditCardId', creditCardId);
    return api.post('/credit-cards/statements/import', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
      // Ler PDF grande demora mais que o padrão de 15s do cliente.
      timeout: 60000,
    });
  },
};

export default creditCardsService;
