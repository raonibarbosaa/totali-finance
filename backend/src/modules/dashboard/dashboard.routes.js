const express = require('express');
const router = express.Router();
const auth   = require('../../middleware/auth');
const tGuard = require('../../middleware/tenantGuard');
const rGuard = require('../../middleware/roleGuard');
const prisma = require('../../config/database');
router.use(auth, tGuard);
router.get('/stats', rGuard([1,2,3]), async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay  = new Date(now.getFullYear(), now.getMonth()+1, 0, 23,59,59);
    const [receitas, despesas, titulos, contas] = await Promise.all([
      prisma.transaction.aggregate({ where:{ tenantId, tipo:'receita', status:{in:['realizado','conciliado']}, dataLancamento:{gte:firstDay,lte:lastDay} }, _sum:{valor:true} }),
      prisma.transaction.aggregate({ where:{ tenantId, tipo:'despesa', status:{in:['realizado','conciliado']}, dataLancamento:{gte:firstDay,lte:lastDay} }, _sum:{valor:true} }),
      prisma.title.count({ where:{ tenantId, status:{in:['aberto','parcial']}, dataVencimento:{ lte:new Date(Date.now()+7*86400000) } } }),
      prisma.bankAccount.findMany({ where:{ tenantId, ativo:true }, select:{ id:true, nome:true, saldoInicial:true } }),
    ]);
    const saldoTotal = contas.reduce((s,c) => s + Number(c.saldoInicial||0), 0);
    res.json({ success:true, data:{ receitas:Number(receitas._sum.valor||0), despesas:Number(despesas._sum.valor||0), resultado:Number(receitas._sum.valor||0)-Number(despesas._sum.valor||0), titulosVencer:titulos, saldoTotal } });
  } catch(e) { res.status(500).json({ success:false, error:e.message }); }
});
module.exports = router;
