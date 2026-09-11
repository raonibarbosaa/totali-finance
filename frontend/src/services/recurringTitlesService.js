import api from './api';

// escopoExclusao: o que fazer com os títulos JÁ GERADOS ao cancelar/excluir
// um template. Valores aceitos pelo backend:
//   'nenhum'       — mantém tudo (default, comportamento antigo)
//   'futuros'      — apaga os em aberto com vencimento a partir de hoje
//   'todosAbertos' — apaga todos os em aberto, vencidos inclusive
// Títulos pagos ou parciais nunca são apagados, em nenhum escopo.
const recurringTitlesService = {
  list:     (params = {})    => api.get('/recurring-titles', { params }),
  findOne:  (id)             => api.get(`/recurring-titles/${id}`),
  create:   (data)           => api.post('/recurring-titles', data),
  update:   (id, data)       => api.put(`/recurring-titles/${id}`, data),

  // Contagem das ocorrências geradas, para a janela mostrar o impacto real.
  impacto:  (id)             => api.get(`/recurring-titles/${id}/impacto`),

  cancelar: (id, escopoExclusao = 'nenhum') =>
    api.post(`/recurring-titles/${id}/cancelar`, { escopoExclusao }),

  // DELETE não deve carregar corpo — o escopo vai na query string.
  remove:   (id, escopoExclusao = 'nenhum') =>
    api.delete(`/recurring-titles/${id}`, { params: { escopoExclusao } }),

  // Disparo manual (admin) — útil pra forçar geração sem listar títulos
  gerar:    ()               => api.post('/recurring-titles/gerar'),
};

export default recurringTitlesService;
