import { useState, useRef } from 'react';

/**
 * Lê o XML da NF-e e extrai os campos relevantes para
 * pré-preencher um título de Conta a Pagar.
 */
function parseNFe(xmlText) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, 'text/xml');

  const get = (tag) => {
    const el = doc.getElementsByTagName(tag)[0];
    return el ? el.textContent.trim() : '';
  };

  // Emitente (fornecedor)
  const emitente = {
    cnpj:  get('emit > CNPJ') || get('CNPJ'),
    nome:  get('emit > xNome') || get('xNome'),
    ie:    get('emit > IE'),
  };

  // Dados da nota
  const chaveAcesso = get('chNFe') || get('Id')?.replace('NFe', '');
  const numero      = get('nNF');
  const serie       = get('serie');
  const dataEmissao = get('dhEmi') || get('dEmi');
  const valorTotal  = get('vNF') || get('vProd');

  // Duplicatas (vencimentos)
  const dups = doc.getElementsByTagName('dup');
  const duplicatas = Array.from(dups).map(dup => ({
    numero: dup.getElementsByTagName('nDup')[0]?.textContent.trim() || '',
    vencimento: dup.getElementsByTagName('dVenc')[0]?.textContent.trim() || '',
    valor: dup.getElementsByTagName('vDup')[0]?.textContent.trim() || '0',
  }));

  // Se não tiver duplicatas, usa o total como uma única parcela
  if (duplicatas.length === 0 && valorTotal) {
    duplicatas.push({
      numero: numero || '001',
      vencimento: dataEmissao ? dataEmissao.slice(0, 10) : '',
      valor: valorTotal,
    });
  }

  return {
    emitente,
    chaveAcesso,
    numero,
    serie,
    dataEmissao: dataEmissao ? dataEmissao.slice(0, 10) : '',
    valorTotal,
    duplicatas,
  };
}

function formatCNPJ(cnpj) {
  if (!cnpj) return '';
  return cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}

export default function ImportarXMLModal({ isOpen, onClose, onImported }) {
  const [nfe, setNfe]         = useState(null);
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState([]);
  const fileRef = useRef();

  if (!isOpen) return null;

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setError('');
    setNfe(null);
    setSelected([]);

    try {
      const text = await file.text();
      const parsed = parseNFe(text);

      if (!parsed.emitente.nome && !parsed.valorTotal) {
        throw new Error('Arquivo XML inválido ou não é uma NF-e');
      }

      setNfe(parsed);
      // Seleciona todas as duplicatas por padrão
      setSelected(parsed.duplicatas.map((_, i) => i));
    } catch (e) {
      setError(e.message || 'Erro ao processar XML');
    }
    if (fileRef.current) fileRef.current.value = '';
  };

  const toggleSelect = (i) => {
    setSelected(prev =>
      prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i]
    );
  };

  const handleImport = async () => {
    if (!nfe || selected.length === 0) return;
    setLoading(true);
    setError('');

    try {
      const titulos = selected.map(i => {
        const dup = nfe.duplicatas[i];
        return {
          tipo: 'pagar',
          descricao: `NF ${nfe.numero}/${nfe.serie || '1'} - ${nfe.emitente.nome}`,
          valor: parseFloat(dup.valor),
          dataEmissao: nfe.dataEmissao || new Date().toISOString().slice(0, 10),
          dataVencimento: dup.vencimento || nfe.dataEmissao || new Date().toISOString().slice(0, 10),
          nomeContato: nfe.emitente.nome,
          numeroDocumento: `NF-${nfe.numero}-${dup.numero}`,
          observacao: `Chave NF-e: ${nfe.chaveAcesso || ''}`,
        };
      });

      // Cria os títulos via API
      for (const titulo of titulos) {
        await fetch('/api/titles', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('accessToken') || ''}`,
          },
          body: JSON.stringify(titulo),
          credentials: 'include',
        });
      }

      onImported(titulos.length);
      onClose();
      setNfe(null);
      setSelected([]);
    } catch (e) {
      setError('Erro ao importar títulos. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h2 className="text-lg font-semibold text-[#152740]">📄 Importar XML NF-e</h2>
            <p className="text-sm text-gray-400 mt-0.5">Lança contas a pagar automaticamente pela nota fiscal</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>

        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {error && (
            <div className="bg-red-50 text-red-600 text-sm rounded-xl px-4 py-3">{error}</div>
          )}

          {/* Upload */}
          <div className="border-2 border-dashed border-gray-200 rounded-2xl p-8 text-center hover:border-[#152740]/30 transition-colors">
            <div className="text-4xl mb-3">📂</div>
            <p className="text-sm font-medium text-gray-700 mb-1">Selecione o arquivo XML da NF-e</p>
            <p className="text-xs text-gray-400 mb-4">Formatos aceitos: .xml</p>
            <label className="px-5 py-2 bg-[#152740] text-white text-sm font-medium rounded-xl cursor-pointer hover:bg-[#1e3a5f] transition-colors">
              Escolher arquivo
              <input ref={fileRef} type="file" accept=".xml" onChange={handleFile} className="hidden" />
            </label>
          </div>

          {/* Dados da NF-e */}
          {nfe && (
            <div className="space-y-4">
              {/* Info do emitente */}
              <div className="bg-blue-50 rounded-xl p-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-gray-500">Fornecedor</span>
                  <p className="font-semibold text-[#152740]">{nfe.emitente.nome || '—'}</p>
                </div>
                <div>
                  <span className="text-gray-500">CNPJ</span>
                  <p className="font-medium">{formatCNPJ(nfe.emitente.cnpj) || '—'}</p>
                </div>
                <div>
                  <span className="text-gray-500">NF-e nº / Série</span>
                  <p className="font-medium">{nfe.numero || '—'} / {nfe.serie || '1'}</p>
                </div>
                <div>
                  <span className="text-gray-500">Data Emissão</span>
                  <p className="font-medium">{nfe.dataEmissao ? new Date(nfe.dataEmissao).toLocaleDateString('pt-BR') : '—'}</p>
                </div>
                <div className="col-span-2">
                  <span className="text-gray-500">Valor Total</span>
                  <p className="font-bold text-lg text-[#152740]">
                    {Number(nfe.valorTotal || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </p>
                </div>
              </div>

              {/* Duplicatas */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-[#152740]">
                    Duplicatas / Parcelas ({nfe.duplicatas.length})
                  </h3>
                  <button
                    onClick={() => setSelected(
                      selected.length === nfe.duplicatas.length
                        ? []
                        : nfe.duplicatas.map((_, i) => i)
                    )}
                    className="text-xs text-[#152740] underline"
                  >
                    {selected.length === nfe.duplicatas.length ? 'Desmarcar todas' : 'Selecionar todas'}
                  </button>
                </div>

                <div className="space-y-2">
                  {nfe.duplicatas.map((dup, i) => (
                    <label
                      key={i}
                      className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                        selected.includes(i)
                          ? 'border-[#152740] bg-[#152740]/5'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selected.includes(i)}
                        onChange={() => toggleSelect(i)}
                        className="w-4 h-4 accent-[#152740]"
                      />
                      <div className="flex-1 grid grid-cols-3 gap-2 text-sm">
                        <div>
                          <span className="text-gray-400 text-xs">Duplicata</span>
                          <p className="font-medium text-[#152740]">{dup.numero || `0${i+1}`}</p>
                        </div>
                        <div>
                          <span className="text-gray-400 text-xs">Vencimento</span>
                          <p className="font-medium">
                            {dup.vencimento ? new Date(dup.vencimento).toLocaleDateString('pt-BR') : '—'}
                          </p>
                        </div>
                        <div>
                          <span className="text-gray-400 text-xs">Valor</span>
                          <p className="font-semibold text-red-600">
                            {Number(dup.valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </p>
                        </div>
                      </div>
                    </label>
                  ))}
                </div>

                {selected.length > 0 && (
                  <div className="mt-3 bg-amber-50 rounded-xl px-4 py-2 text-sm text-amber-700">
                    <strong>{selected.length} título(s)</strong> serão criados em Contas a Pagar no total de{' '}
                    <strong>
                      {selected.reduce((s, i) => s + Number(nfe.duplicatas[i].valor || 0), 0)
                        .toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </strong>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-2xl">
          <button onClick={onClose} className="px-5 py-2 text-sm text-gray-600 hover:text-gray-800">
            Cancelar
          </button>
          {nfe && selected.length > 0 && (
            <button
              onClick={handleImport}
              disabled={loading}
              className="px-6 py-2 bg-[#152740] text-white text-sm font-medium rounded-xl hover:bg-[#1e3a5f] disabled:opacity-50 transition-colors"
            >
              {loading ? 'Importando...' : `Criar ${selected.length} título(s)`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
