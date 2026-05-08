// middleware/upload.js
//
// Upload de planilhas via multer com memory storage. Não grava em disco —
// o buffer vai direto pro service de importação. Limites: 10 MB e 1 arquivo.

const multer = require('multer');

const MIMES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
  'application/csv',
  'application/octet-stream',
];
const EXTS = ['.xlsx', '.xls', '.csv'];

const fileFilter = (req, file, cb) => {
  const ext = (file.originalname.match(/\.[^.]+$/) || [''])[0].toLowerCase();
  if (MIMES.includes(file.mimetype) || EXTS.includes(ext)) return cb(null, true);
  return cb(new Error('Formato não suportado. Use .xlsx, .xls ou .csv.'), false);
};

module.exports = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter,
});
