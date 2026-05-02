import { useState, useEffect } from 'react';
import api from '../services/api';
import useAuthStore from '../store/authStore';

/**
 * Carrega contas bancárias do tenant ativo
 */
export function useBankAccounts() {
  const { tenant } = useAuthStore();
  const [contas, setContas] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenant?.id) return;
    api.get('/bank-accounts')
      .then(r => setContas(r.data.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [tenant?.id]);

  return { contas, loading };
}

/**
 * Carrega categorias do tenant ativo, opcionalmente filtra por tipo
 */
export function useCategories(tipo = null) {
  const { tenant } = useAuthStore();
  const [categorias, setCategorias] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenant?.id) return;
    const params = tipo ? `?tipo=${tipo}&ativo=true` : '?ativo=true';
    api.get(`/categories${params}`)
      .then(r => setCategorias(r.data.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [tenant?.id, tipo]);

  return { categorias, loading };
}

/**
 * Carrega categorias agrupadas por tipo
 */
export function useCategoriesGrouped() {
  const { tenant } = useAuthStore();
  const [grupos, setGrupos] = useState({ receita: [], despesa: [], transferencia: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenant?.id) return;
    api.get('/categories?agrupadas=true')
      .then(r => setGrupos(r.data.data || { receita: [], despesa: [], transferencia: [] }))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [tenant?.id]);

  return { grupos, loading };
}
