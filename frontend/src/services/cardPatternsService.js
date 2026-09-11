import api from './api';

// De-para do cartão: texto do estabelecimento para categoria e fornecedor.
//
// Separado do de-para de OFX de propósito. Nome de loja não se mistura com
// histórico bancário, então um não atrapalha o outro.
//
// Duas coisas que o de-para de OFX não tem:
//   - prioridade, com desempate pelo texto mais específico
//   - complemento automático aplicado de verdade no lançamento
const cardPatternsService = {
  list:    ()          => api.get('/card-patterns'),
  findOne: (id)        => api.get(`/card-patterns/${id}`),
  create:  (dados)     => api.post('/card-patterns', dados),
  update:  (id, dados) => api.put(`/card-patterns/${id}`, dados),
  remove:  (id)        => api.delete(`/card-patterns/${id}`),
};

export default cardPatternsService;
