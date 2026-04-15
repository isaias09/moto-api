const router = require('express').Router();
const auth = require('../middleware/auth');
const Cliente = require('../models/Cliente');

router.use(auth);

// GET /api/clientes
router.get('/', async (req, res) => {
  try {
    const { q } = req.query;
    const filter = { activo: true };
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

// GET /api/clientes/:id
router.get('/:id', async (req, res) => {
  try {
    const cliente = await Cliente.findById(req.params.id);
    if (!cliente) return res.status(404).json({ error: 'No encontrado' });
    res.json(cliente);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/clientes
router.post('/', async (req, res) => {
  try {
    const cliente = new Cliente(req.body);
    await cliente.save();
    res.status(201).json(cliente);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// PUT /api/clientes/:id
router.put('/:id', async (req, res) => {
  try {
    const cliente = await Cliente.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(cliente);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// DELETE /api/clientes/:id (soft delete)
router.delete('/:id', async (req, res) => {
  try {
    await Cliente.findByIdAndUpdate(req.params.id, { activo: false });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
