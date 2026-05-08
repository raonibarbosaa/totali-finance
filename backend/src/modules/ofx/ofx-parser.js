'use strict';

/**
 * Parser de arquivos OFX (1.x SGML e 2.x XML).
 *
 * Extrai apenas o que interessa para conciliação bancária:
 *   • account: BANKID, BRANCHID, ACCTID, ACCTTYPE
 *   • period:  DTSTART, DTEND
 *   • currency: CURDEF (default BRL)
 *   • transactions: lista de STMTTRN normalizadas
 *
 * Formato de cada transação retornada:
 *   {
 *     fitid:         string,         // identificador único (chave de dedup)
 *     dataMovimento: Date,
 *     valor:         number,         // sempre positivo
 *     tipo:          'credito'|'debito',
 *     trnType:       string,         // ex: 'DEBIT','CREDIT','PAYMENT','XFER'
 *     descricao:     string|null,    // <NAME>
 *     memo:          string|null,    // <MEMO>
 *     checkNum:      string|null,
 *   }
 *
 * Quirks tratados:
 *   • Cabeçalho OFX 1 SGML é descartado (tudo antes de <OFX>).
 *   • Tags abertas sem fechamento (estilo SGML) são suportadas.
 *   • DTPOSTED no formato YYYYMMDD ou YYYYMMDDHHMMSS, com ou sem [TZ].
 *   • BOM UTF-8 é removido.
 *
 * Limitações conhecidas (aceitáveis para nosso caso de uso):
 *   • Só lê o primeiro <STMTRS> do arquivo. OFX multi-conta cairia em só uma.
 *   • Encoding fixado em latin1 (ISO-8859-1) que cobre os bancos BR.
 */

function parseOfx(content) {
  if (Buffer.isBuffer(content)) content = decodeBuffer(content);
  if (typeof content !== 'string') {
    throw new Error('Conteúdo OFX deve ser string ou Buffer');
  }

  // Remove BOM e normaliza quebras de linha
  let text = content.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Localiza o início do bloco OFX (descarta cabeçalho SGML/XML)
  const ofxStart = text.search(/<OFX[\s>]/i);
  if (ofxStart === -1) {
    throw new Error('Arquivo OFX inválido: tag <OFX> não encontrada.');
  }
  text = text.substring(ofxStart);

  const tag = (haystack, name) => {
    const re = new RegExp(`<${name}>\\s*([^<\\n\\r]+)`, 'i');
    const m = haystack.match(re);
    return m ? m[1].trim() : null;
  };

  // ─── Conta bancária do arquivo ─────────────────────────
  const bankBlock = matchBlock(text, 'BANKACCTFROM') || '';
  const account = {
    bankId:    tag(bankBlock, 'BANKID'),
    branchId:  tag(bankBlock, 'BRANCHID'),
    accountId: tag(bankBlock, 'ACCTID'),
    type:      tag(bankBlock, 'ACCTTYPE'),
  };

  // ─── Lista de transações ───────────────────────────────
  const tranListBlock = matchBlock(text, 'BANKTRANLIST') || '';
  const period = {
    start: parseOfxDate(tag(tranListBlock, 'DTSTART')),
    end:   parseOfxDate(tag(tranListBlock, 'DTEND')),
  };

  const currency = tag(text, 'CURDEF') || 'BRL';

  const transactions = [];
  // Captura tudo entre <STMTTRN> e o próximo <STMTTRN> ou </BANKTRANLIST>
  const tranRegex = /<STMTTRN>([\s\S]*?)(?=<STMTTRN>|<\/STMTTRN>|<\/BANKTRANLIST>|<LEDGERBAL>)/gi;
  let m;
  while ((m = tranRegex.exec(tranListBlock)) !== null) {
    const block = m[1];
    const trnType  = (tag(block, 'TRNTYPE') || '').toUpperCase();
    const dtPosted = parseOfxDate(tag(block, 'DTPOSTED'));
    const trnAmtRaw = tag(block, 'TRNAMT');
    const trnAmt   = trnAmtRaw !== null ? parseFloat(trnAmtRaw.replace(',', '.')) : NaN;
    const fitId    = tag(block, 'FITID');
    const memo     = tag(block, 'MEMO');
    const name     = tag(block, 'NAME');
    const checkNum = tag(block, 'CHECKNUM');

    if (!fitId || !dtPosted || !Number.isFinite(trnAmt)) continue;

    transactions.push({
      fitid:         fitId,
      dataMovimento: dtPosted,
      valor:         Math.abs(trnAmt),
      tipo:          trnAmt >= 0 ? 'credito' : 'debito',
      trnType,
      descricao:     name || null,
      memo:          memo || null,
      checkNum:      checkNum || null,
    });
  }

  return { account, period, currency, transactions };
}

/** Captura o conteúdo entre <TAG> e </TAG> (ou até o próximo bloco-irmão se faltar fechamento). */
function matchBlock(text, name) {
  const closed = new RegExp(`<${name}>([\\s\\S]*?)<\\/${name}>`, 'i').exec(text);
  return closed ? closed[1] : null;
}

/**
 * Parse data OFX para Date.
 * Formatos aceitos:
 *   YYYYMMDD
 *   YYYYMMDDHHMMSS
 *   YYYYMMDDHHMMSS.XXX
 *   YYYYMMDDHHMMSS[TZ:LABEL]
 */
function parseOfxDate(s) {
  if (!s) return null;
  const clean = s.replace(/\[.*?\]/g, '').trim();
  const m = clean.match(/^(\d{4})(\d{2})(\d{2})(?:(\d{2})(\d{2})(\d{2}))?/);
  if (!m) return null;
  const y  = +m[1];
  const mo = +m[2] - 1;
  const d  = +m[3];
  const h  = +(m[4] ?? 0);
  const mi = +(m[5] ?? 0);
  const se = +(m[6] ?? 0);
  // Usa UTC: queremos só o "dia" sem deslocamento de fuso
  const dt = new Date(Date.UTC(y, mo, d, h, mi, se));
  return Number.isFinite(dt.getTime()) ? dt : null;
}

module.exports = { parseOfx, parseOfxDate, decodeBuffer };

/**
 * Decodifica buffer detectando encoding.
 *
 * Estratégia: tenta UTF-8 estrito (TextDecoder com fatal=true). Se passar,
 * o arquivo é UTF-8 (válido tanto pra ASCII puro quanto pra OFX modernos
 * de bancos como Cora, Inter, Nubank). Se falhar (sequência multi-byte
 * inválida), cai pra latin1 (ISO-8859-1 / CP1252) que é o padrão dos
 * bancos tradicionais brasileiros (Bradesco, Itaú, BB).
 *
 * Ignora deliberadamente o header `CHARSET:` do OFX 1 e o `encoding=` do
 * XML — bancos costumam declarar errado. A detecção por conteúdo é mais
 * confiável: latin1 com caracteres acentuados produz bytes que são
 * sequências UTF-8 inválidas; UTF-8 puramente ASCII passa nos dois testes
 * e produz a mesma saída.
 */
function decodeBuffer(buffer) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch (e) {
    return buffer.toString('latin1');
  }
}
