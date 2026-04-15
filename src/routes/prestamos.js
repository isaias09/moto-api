const router = require('express').Router();
const auth = require('../middleware/auth');
const Prestamo = require('../models/Prestamo');

router.use(auth);

// GET /api/prestamos
router.get('/', async (req, res) => {
  try {
    const { estado, tipo, clienteId } = req.query;
    const filter = {};
    if (estado) filter.estado = estado;
    if (tipo) filter.tipoPrestamo = tipo;
    if (clienteId) filter.clienteId = clienteId;
    const prestamos = await Prestamo.find(filter)
      .populate('clienteId', 'nombre apellido cedula telefono')
      .sort({ createdAt: -1 });
    res.json(prestamos);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/prestamos/:id
router.get('/:id', async (req, res) => {
  try {
    const p = await Prestamo.findById(req.params.id)
      .populate('clienteId', 'nombre apellido cedula telefono');
    if (!p) return res.status(404).json({ error: 'No encontrado' });
    res.json(p);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/prestamos
router.post('/', async (req, res) => {
  try {
    // Generar número de préstamo
    const count = await Prestamo.countDocuments();
    const year = new Date().getFullYear();
    const numeroPrestamo = `PRE-${year}-${String(count + 1).padStart(4, '0')}`;
    const prestamo = new Prestamo({ ...req.body, numeroPrestamo, usuarioId: req.usuario.id });
    await prestamo.save();
    res.status(201).json(prestamo);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// PUT /api/prestamos/:id
router.put('/:id', async (req, res) => {
  try {
    const p = await Prestamo.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(p);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// GET /api/prestamos/mora/lista
router.get('/mora/lista', async (req, res) => {
  try {
    const enMora = await Prestamo.find({ cuotasVencidas: { $gt: 0 } })
      .populate('clienteId', 'nombre apellido cedula telefono')
      .sort({ diasMora: -1 });
    res.json(enMora);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
