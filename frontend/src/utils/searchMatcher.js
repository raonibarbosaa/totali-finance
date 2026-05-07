/**
 * Verifica se um item bate com a query de busca.
 *
 * Lógica:
 *  - Query vazia -> sempre verdadeiro (mostra tudo)
 *  - Tokens da query separados por espaço
 *  - Tokens numéricos (ex: "150"): comparação EXATA com campos numéricos (tolerância de centavo)
 *  - Tokens textuais: substring case-insensitive em campos textuais
 *  - OR: basta UM token bater (em qualquer campo) para o item ser incluído
 *
 * @param {Object} item - objeto a testar
 * @param {string} query - termo de busca (ex: "luz energia 150")
 * @param {Array<string>} textFields   - caminhos textuais (ex: ['descricao', 'fornecedor.nome'])
 * @param {Array<string>} numberFields - caminhos numéricos (ex: ['valor'])
 * @returns {boolean}
 */
export function matchSearch(item, query, textFields = [], numberFields = []) {
  if (!query || !query.trim()) return true;
  if (!item) return false;

  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;

  // Separa tokens numéricos (aceita "150", "150.50", "150,50") vs textuais
  const numericTokens = [];
  const textTokens = [];
  for (const t of tokens) {
    const normalized = t.replace(',', '.');
    if (/^\d+(\.\d+)?$/.test(normalized)) {
      numericTokens.push(parseFloat(normalized));
    } else {
      textTokens.push(t);
    }
  }

  // Match numérico (EXATO, tolerância de centavo)
  for (const field of numberFields) {
    const val = getValue(item, field);
    if (val == null) continue;
    const numVal = parseFloat(val);
    if (Number.isFinite(numVal) && numericTokens.some(t => Math.abs(numVal - t) < 0.01)) {
      return true;
    }
  }

  // Match textual (substring, OR)
  for (const field of textFields) {
    const val = getValue(item, field);
    if (val == null) continue;
    const strVal = String(val).toLowerCase();
    if (textTokens.some(t => strVal.includes(t))) {
      return true;
    }
  }

  return false;
}

// Acessa campos aninhados: getValue(obj, 'a.b.c') === obj?.a?.b?.c
function getValue(obj, path) {
  if (!obj || !path) return undefined;
  return path.split('.').reduce((acc, k) => (acc == null ? acc : acc[k]), obj);
}

export default matchSearch;
