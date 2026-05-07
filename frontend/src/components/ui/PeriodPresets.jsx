import React from 'react';

// ─── Helpers de data ────────────────────────────────────────────────
const fmt = d => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const startOfWeek = (d) => {
  const date = new Date(d);
  const day = date.getDay() || 7; // Dom=0 -> 7
  if (day !== 1) date.setDate(date.getDate() - (day - 1));
  date.setHours(0, 0, 0, 0);
  return date;
};

const endOfWeek = (d) => {
  const start = startOfWeek(d);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return end;
};

const startOfMonth = (y, m) => new Date(y, m, 1);
const endOfMonth   = (y, m) => new Date(y, m + 1, 0);

// ─── Definição dos presets ──────────────────────────────────────────
const compute = {
  semana: () => {
    const now = new Date();
    return [fmt(startOfWeek(now)), fmt(endOfWeek(now))];
  },
  mes: () => {
    const now = new Date();
    return [
      fmt(startOfMonth(now.getFullYear(), now.getMonth())),
      fmt(endOfMonth(now.getFullYear(), now.getMonth())),
    ];
  },
  mesPassado: () => {
    const now = new Date();
    const m = now.getMonth() - 1;
    const y = m < 0 ? now.getFullYear() - 1 : now.getFullYear();
    const mes = m < 0 ? 11 : m;
    return [fmt(startOfMonth(y, mes)), fmt(endOfMonth(y, mes))];
  },
  proximoMes: () => {
    const now = new Date();
    const m = now.getMonth() + 1;
    const y = m > 11 ? now.getFullYear() + 1 : now.getFullYear();
    const mes = m > 11 ? 0 : m;
    return [fmt(startOfMonth(y, mes)), fmt(endOfMonth(y, mes))];
  },
};

const PRESETS_PADRAO = [
  { key: 'semana',      label: 'Esta semana' },
  { key: 'mes',         label: 'Este mês' },
  { key: 'mesPassado',  label: 'Mês passado' },
  { key: 'proximoMes',  label: 'Próximo mês' },
];

/**
 * Botões de atalho para setar dataInicio + dataFim em filtros de período.
 *
 * @param {Function} onChange    callback (inicio, fim) => void; recebe strings YYYY-MM-DD
 * @param {Array}    presets     opcional; lista custom de presets (default: todos)
 * @param {boolean}  showLimpar  exibe botão "Limpar" que envia ('','')  (default: true)
 * @param {string}   className   classes extras
 */
export default function PeriodPresets({
  onChange,
  presets = PRESETS_PADRAO,
  showLimpar = true,
  className = '',
}) {
  const handleClick = (key) => {
    if (key === 'limpar') {
      onChange('', '');
    } else if (compute[key]) {
      const [ini, fim] = compute[key]();
      onChange(ini, fim);
    }
  };

  return (
    <div className={`flex flex-wrap gap-1.5 ${className}`}>
      {presets.map(({ key, label }) => (
        <button
          key={key}
          type="button"
          onClick={() => handleClick(key)}
          className="text-xs px-2.5 py-1 rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-colors"
        >
          {label}
        </button>
      ))}
      {showLimpar && (
        <button
          type="button"
          onClick={() => handleClick('limpar')}
          className="text-xs px-2.5 py-1 rounded-md border border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
        >
          Limpar
        </button>
      )}
    </div>
  );
}
