const service = require('./tenants.service');

async function listar(req, res) {
  try {
    const { page, limit, search } = req.query;
    const result = await service.listar({
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 50,
      search: search || '',
    });
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
}

async function buscar(req, res) {
  try {
    const tenant = await service.buscarPorId(req.params.id);
    res.json({ success: true, data: tenant });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
}

async function criar(req, res) {
  try {
    const { razaoSocial, nomeFantasia, cnpj, codigoFilial, regime } = req.body;
    if (!razaoSocial || !cnpj) {
      return res.status(400).json({ success: false, error: 'Razão social e CNPJ são obrigatórios.' });
    }
    const tenant = await service.criar({ razaoSocial, nomeFantasia, cnpj, codigoFilial, regime });
    res.status(201).json({ success: true, data: tenant });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
}

async function atualizar(req, res) {
  try {
    const tenant = await service.atualizar(req.params.id, req.body);
    res.json({ success: true, data: tenant });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
}

async function alterarStatus(req, res) {
  try {
    const { ativo } = req.body;
    const tenant = await service.alterarStatus(req.params.id, ativo);
    res.json({ success: true, data: tenant });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
}

module.exports = { listar, buscar, criar, atualizar, alterarStatus };
