// frontend/src/components/ui/ConfirmDialog.jsx
//
// Substituto do confirm() nativo do navegador.
//
// O ganho não é estético: o confirm() do navegador mostra só "OK / Cancelar"
// e um bloco de texto. Aqui dá pra listar o impacto item a item e nomear o
// botão com o que realmente vai acontecer ("Excluir 12 títulos"), que é o que
// impede o clique automático em ação destrutiva.

import Modal from './Modal';

const TONES = {
  perigo: {
    btn:    { background: '#dc2626', color: '#fff' },
    btnHover: '#b91c1c',
    caixa:  { background: '#fef2f2', borderColor: '#fecaca', color: '#991b1b' },
  },
  aviso: {
    btn:    { background: '#d97706', color: '#fff' },
    btnHover: '#b45309',
    caixa:  { background: '#fffbeb', borderColor: '#fde68a', color: '#92400e' },
  },
  neutro: {
    btn:    { background: '#152740', color: '#fff' },
    btnHover: '#1e3a5f',
    caixa:  { background: '#f8fafc', borderColor: '#e2e8f0', color: '#334155' },
  },
};

/**
 * @param {boolean}  open
 * @param {Function} onClose
 * @param {Function} onConfirm     pode ser async; o dialog não fecha sozinho
 * @param {string}   title
 * @param {string}   mensagem      frase principal
 * @param {Array}    detalhes      linhas de impacto: string ou { texto, tone }
 * @param {string}   confirmLabel  texto do botão — inclua o número aqui
 * @param {string}   tone          'perigo' | 'aviso' | 'neutro'
 * @param {boolean}  loading       desabilita os botões durante a chamada
 * @param {boolean}  confirmDisabled
 * @param {Node}     children      conteúdo extra (ex: opções de rádio)
 */
export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  mensagem,
  detalhes = [],
  confirmLabel = 'Confirmar',
  cancelLabel = 'Voltar',
  tone = 'perigo',
  loading = false,
  confirmDisabled = false,
  children,
}) {
  const t = TONES[tone] || TONES.perigo;

  return (
    <Modal open={open} onClose={loading ? () => {} : onClose} title={title} size="md">
      {mensagem && (
        <p style={{ margin: '0 0 14px', color: '#334155', fontSize: 14, lineHeight: 1.55 }}>
          {mensagem}
        </p>
      )}

      {detalhes.length > 0 && (
        <ul
          style={{
            listStyle: 'none', margin: '0 0 14px', padding: '12px 14px',
            border: '1px solid', borderRadius: 10, fontSize: 13, lineHeight: 1.6,
            ...t.caixa,
          }}
        >
          {detalhes.map((d, i) => {
            const texto = typeof d === 'string' ? d : d.texto;
            return (
              <li key={i} style={{ display: 'flex', gap: 8 }}>
                <span aria-hidden="true">•</span>
                <span>{texto}</span>
              </li>
            );
          })}
        </ul>
      )}

      {children}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
        <button
          type="button"
          onClick={onClose}
          disabled={loading}
          style={{
            padding: '8px 16px', fontSize: 14, borderRadius: 8, cursor: loading ? 'default' : 'pointer',
            border: '1px solid #cbd5e1', background: '#fff', color: '#475569',
            opacity: loading ? 0.5 : 1,
          }}
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={loading || confirmDisabled}
          style={{
            padding: '8px 16px', fontSize: 14, fontWeight: 600, borderRadius: 8,
            border: 'none', cursor: (loading || confirmDisabled) ? 'default' : 'pointer',
            opacity: (loading || confirmDisabled) ? 0.55 : 1,
            ...t.btn,
          }}
        >
          {loading ? 'Processando...' : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
