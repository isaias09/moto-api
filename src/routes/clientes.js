const router = require('express').Router();
const auth = require('../middleware/auth');
const empresa = require('../middleware/empresa');
const Cliente = require('../models/Cliente');

router.use(auth, empresa);

router.get('/', async (req, res) => {
  try {
    const { q } = req.query;
    const filter = { empresaId: req.empresaId, activo: true };
    if (q) {
      filter.$or = [
        { nombre: new RegExp(q, 'i') },
        { apellido: new RegExp(q, 'i') },
        { cedula: new RegExp(q, 'i') },
        { telefono: new RegExp(q, 'i') },
      ];
    }
    const clientes = await Cliente.find(filter).sort({ nombre: 1 });
    res.json(clientes);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const cliente = await Cliente.findOne({ _id: req.params.id, empresaId: req.empresaId });
    if (!cliente) return res.status(404).json({ error: 'No encontrado' });
    res.json(cliente);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', async (req, res) => {
  try {
    const cliente = new Cliente({ ...req.body, empresaId: req.empresaId });
    await cliente.save();
    res.status(201).json(cliente);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.put('/:id', async (req, res) => {
  try {
    const cliente = await Cliente.findOneAndUpdate(
      { _id: req.params.id, empresaId: req.empresaId },
      req.body, { new: true },
    );
    res.json(cliente);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    await Cliente.findOneAndUpdate(
      { _id: req.params.id, empresaId: req.empresaId },
      { activo: false },
    );
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
