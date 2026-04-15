const router = require('express').Router();
const auth = require('../middleware/auth');
const Pago = require('../models/Pago');
const Prestamo = require('../models/Prestamo');

router.use(auth);

// GET /api/pagos
router.get('/', async (req, res) => {
  try {
    const { fecha, prestamoId } = req.query;
    const filter = {};
    if (prestamoId) filter.prestamoId = prestamoId;
    if (fecha) {
      const inicio = new Date(fecha);
      const fin = new Date(fecha);
      fin.setDate(fin.getDate() + 1);
      filter.fechaPago = { $gte: inicio, $lt: fin };
    }
    const pagos = await Pago.find(filter)
      .populate('clienteId', 'nombre apellido')
      .populate('prestamoId', 'numeroPrestamo')
      .sort({ fechaPago: -1 });
    res.json(pagos);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/pagos
router.post('/', async (req, res) => {
  try {
    const { prestamoId, montoPagado, metodoPago, referencia, observaciones, cuotasAplicadas,
            montoCapital, montoInteres, montoMora } = req.body;

    const prestamo = await Prestamo.findById(prestamoId);
    if (!prestamo) return res.status(404).json({ error: 'Préstamo no encontrado' });

    // Generar número de pago
    const count = await Pago.countDocuments();
    const year = new Date().getFullYear();
    const numeroPago = `PAG-${year}-${String(count + 1).padStart(5, '0')}`;

    const pago = new Pago({
      prestamoId,
      clienteId: prestamo.clienteId,
      usuarioId: req.usuario.id,
      numeroPago,
      montoPagado,
      montoCapital: montoCapital || 0,
      montoInteres: montoInteres || 0,
      montoMora: montoMora || 0,
      metodoPago,
      referencia,
      observaciones,
      cuotasAplicadas: cuotasAplicadas || [],
      fechaPago: new Date(),
    });

    await pago.save();

    // Actualizar cuotas del préstamo
    if (cuotasAplicadas && cuotasAplicadas.length > 0) {
      let montoRestante = montoPagado;
      prestamo.cuotas = prestamo.cuotas.map((c) => {
        if (!cuotasAplicadas.includes(c._id.toString())) return c;
        if (montoRestante <= 0) return c;
        const pendiente = c.montoCuota - c.montoPagado + c.montoMora;
        if (montoRestante >= pendiente) {
          montoRestante -= pendiente;
          return { ...c.toObject(), montoPagado: c.montoCuota, montoMora: 0, estado: 'pagada', fechaPago: new Date() };
        } else {
          const aplicado = montoRestante;
          montoRestante = 0;
          return { ...c.toObject(), montoPagado: c.montoPagado + aplicado, estado: 'parcial' };
        }
      });
    }

    // Recalcular saldo y estado
    const cuotasPagadas = prestamo.cuotas.filter((c) => c.estado === 'pagada').length;
    const saldoPendiente = prestamo.cuotas
      .filter((c) => c.estado !== 'pagada')
      .reduce((s, c) => s + (c.montoCuota - c.montoPagado), 0);

    prestamo.cuotasPagadas = cuotasPagadas;
    prestamo.saldoPendiente = Math.max(0, saldoPendiente);
    if (cuotasPagadas === prestamo.totalCuotas) prestamo.estado = 'pagado';

    await prestamo.save();

    res.status(201).json({ pago, prestamo });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

module.exports = router;
