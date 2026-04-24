const router = require('express').Router();
const auth    = require('../middleware/auth');
const empresa = require('../middleware/empresa');
const verificarLimite = require('../middleware/plan');
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

router.post('/', verificarLimite('prestamos'), async (req, res) => {
  try {
    const empresaId = req.empresaId || req.body.empresaId;
    if (!empresaId) return res.status(403).json({ error: 'Sin empresa asignada' });
    const count = await Prestamo.countDocuments({ empresaId });
    const year  = new Date().getFullYear();
    const numeroPrestamo = `PRE-${year}-${String(count + 1).padStart(4, '0')}`;

    // Sanitizar campos numéricos — evitar NaN
    const body = { ...req.body };
    console.log('[POST /prestamos] saldoPendiente recibido:', body.saldoPendiente, typeof body.saldoPendiente);
    const numFields = ['montoSolicitado','inicial','montoFinanciado','tasaInteres',
      'tasaMoraDiaria','plazoMeses','totalCuotas','montoCuota','totalIntereses',
      'totalPagar','saldoPendiente','capitalPagado','interesesPagados',
      'cuotasPagadas','cuotasVencidas','diasMora','montoMoraAcumulada'];
    for (const f of numFields) {
      const v = Number(body[f]);
      body[f] = isNaN(v) ? 0 : v;
    }
    console.log('[POST /prestamos] saldoPendiente sanitizado:', body.saldoPendiente);

    const prestamo = new Prestamo({ ...body, empresaId, numeroPrestamo, usuarioId: req.usuario.id });
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
