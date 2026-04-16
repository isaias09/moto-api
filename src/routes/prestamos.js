const router = require('express').Router();
const auth    = require('../middleware/auth');
const empresa = require('../middleware/empresa');
const Prestamo = require('../models/Prestamo');

router.use(auth, empresa);

router.get('/', async (req, res) => {
  try {
    const { estado, tipo, clienteId } = req.query;
    const filter = { empresaId: req.empresaId };
    if (estado)   filter.estado       = estado;
    if (tipo)     filter.tipoPrestamo = tipo;
    if (clienteId)filter.clienteId    = clienteId;
    const prestamos = await Prestamo.find(filter)
      .populate('clienteId', 'nombre apellido cedula telefono')
      .sort({ createdAt: -1 });
    res.json(prestamos);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/mora/lista', async (req, res) => {
  try {
    const enMora = await Prestamo.find({ empresaId: req.empresaId, cuotasVencidas: { $gt: 0 } })
      .populate('clienteId', 'nombre apellido cedula telefono')
      .sort({ diasMora: -1 });
    res.json(enMora);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const p = await Prestamo.findOne({ _id: req.params.id, empresaId: req.empresaId })
      .populate('clienteId', 'nombre apellido cedula telefono');
    if (!p) return res.status(404).json({ error: 'No encontrado' });
    res.json(p);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', async (req, res) => {
  try {
    const count = await Prestamo.countDocuments({ empresaId: req.empresaId });
    const year  = new Date().getFullYear();
    const numeroPrestamo = `PRE-${year}-${String(count + 1).padStart(4, '0')}`;
    const prestamo = new Prestamo({ ...req.body, empresaId: req.empresaId, numeroPrestamo, usuarioId: req.usuario.id });
    await prestamo.save();
    res.status(201).json(prestamo);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.put('/:id', async (req, res) => {
  try {
    const p = await Prestamo.findOneAndUpdate(
      { _id: req.params.id, empresaId: req.empresaId },
      req.body, { new: true },
    );
    res.json(p);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

module.exports = router;
