/**
 * Formata valor monetário em BRL
 */
export function formatCurrency(value) {
  if (value === null || value === undefined) return '—';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(value));
}

/**
 * Formata data para DD/MM/AAAA
 */
export function formatDate(date) {
  if (!date) return '—';
  const d = new Date(date);
  // Ajuste de fuso (datas sem hora vêm como UTC)
  const adjusted = new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return adjusted.toLocaleDateString('pt-BR');
}

/**
 * Formata data e hora para DD/MM/AAAA HH:mm
 */
export function formatDateTime(date) {
  if (!date) return '—';
  return new Date(date).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

/**
 * Formata CNPJ: 00.000.000/0000-00
 */
export function formatCNPJ(cnpj) {
  if (!cnpj) return '—';
  const digits = cnpj.replace(/\D/g, '');
  return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}

/**
 * Formata competência (primeiro dia do mês) para "Abril 2026"
 */
export function formatCompetencia(date) {
  if (!date) return '—';
  const d = new Date(date);
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), 1)
    .toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}

/**
 * Nome do nível de acesso
 */
export function nomeRole(role) {
  const nomes = { 1: 'Gerencial', 2: 'Operacional', 3: 'Básico' };
  return nomes[role] || '—';
}

/**
 * Nome do perfil
 */
export function nomePerfil(perfil) {
  const nomes = {
    admin_total: 'Admin Total',
    admin_funcionario: 'Funcionário Totali',
    cliente: 'Cliente',
  };
  return nomes[perfil] || perfil;
}

/**
 * Aplica máscara de CNPJ ao digitar
 */
export function maskCNPJ(value) {
  return value
    .replace(/\D/g, '')
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2')
    .substring(0, 18);
}
