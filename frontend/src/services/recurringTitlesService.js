import api from './api';

const recurringTitlesService = {
  list:     (params = {})    => api.get('/recurring-titles', { params }),
  findOne:  (id)             => api.get(`/recurring-titles/${id}`),
  create:   (data)           => api.post('/recurring-titles', data),
  update:   (id, data)       => api.put(`/recurring-titles/${id}`, data),
  cancelar: (id)             => api.post(`/recurring-titles/${id}/cancelar`),
  remove:   (id)             => api.delete(`/recurring-titles/${id}`),
  // Disparo manual (admin) — útil pra forçar geração sem listar títulos
  gerar:    ()               => api.post('/recurring-titles/gerar'),
};

export default recurringTitlesService;
