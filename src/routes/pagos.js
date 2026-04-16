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
      const fin   = new Date(fecha);
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

// POST /api/pagos  — el backend aplica el pago por monto
router.post('/', async (req, res) => {
  try {
    const { prestamoId, montoPagado, metodoPago, referencia, observaciones } = req.body;

    if (!prestamoId || !montoPagado || montoPagado <= 0)
      return res.status(400).json({ error: 'prestamoId y montoPagado son requeridos' });

    const prestamo = await Prestamo.findById(prestamoId);
    if (!prestamo) return res.status(404).json({ error: 'Préstamo no encontrado' });
    if (prestamo.estado === 'pagado' || prestamo.estado === 'cancelado')
      return res.status(400).json({ error: 'El préstamo ya está pagado' });

    // ── Aplicar pago a cuotas en orden cronológico ──────────────────────────
    let montoRestante  = Number(montoPagado);
    let totalCapital   = 0;
    let totalInteres   = 0;
    let totalMora      = 0;
    const cuotasAplicadas = [];

    // Ordenar cuotas pendientes por fecha de vencimiento (más antigua primero)
    const cuotasOrdenadas = [...prestamo.cuotas].sort(
      (a, b) => new Date(a.fechaVencimiento) - new Date(b.fechaVencimiento),
    );

    const cuotasActualizadas = cuotasOrdenadas.map((cuota) => {
      if (montoRestante <= 0 || cuota.estado === 'pagada') return cuota;

      const pendiente = cuota.montoCuota - cuota.montoPagado + (cuota.montoMora || 0);
      if (pendiente <= 0) return cuota;

      if (montoRestante >= pendiente) {
        // Pago completo de esta cuota
        montoRestante -= pendiente;
        cuotasAplicadas.push(cuota._id);
        totalCapital += cuota.montoCapital;
        totalInteres += cuota.montoInteres;
        totalMora    += cuota.montoMora || 0;

        return {
          ...cuota.toObject(),
          montoPagado: cuota.montoCuota,
          montoMora:   0,
          estado:      'pagada',
          fechaPago:   new Date(),
        };
      } else {
        // Pago parcial
        cuotasAplicadas.push(cuota._id);
        const aplicado = montoRestante;
        montoRestante  = 0;
        totalCapital  += aplicado * (cuota.montoCapital / cuota.montoCuota);
        totalInteres  += aplicado * (cuota.montoInteres / cuota.montoCuota);

        return {
          ...cuota.toObject(),
          montoPagado: cuota.montoPagado + aplicado,
          estado:      'parcial',
        };
      }
    });

    // ── Recalcular métricas del préstamo ────────────────────────────────────
    const hoy = new Date();
    const cuotasFinales = cuotasActualizadas.map((c) => {
      // Actualizar estado de vencimiento para cuotas no pagadas
      if (c.estado !== 'pagada') {
        const vencida = new Date(c.fechaVencimiento) < hoy;
        if (vencida && c.estado !== 'parcial') {
          return { ...c, estado: 'vencida' };
        }
      }
      return c;
    });

    const cuotasPagadas   = cuotasFinales.filter((c) => c.estado === 'pagada').length;
    const cuotasVencidas  = cuotasFinales.filter((c) => c.estado === 'vencida' || c.estado === 'parcial').length;
    const saldoPendiente  = cuotasFinales
      .filter((c) => c.estado !== 'pagada')
      .reduce((s, c) => s + (c.montoCuota - c.montoPagado), 0);

    // Calcular días de mora
    let diasMora = 0;
    cuotasFinales.forEach((c) => {
      if (c.estado === 'vencida' || c.estado === 'parcial') {
        const dias = Math.floor((hoy - new Date(c.fechaVencimiento)) / (1000 * 60 * 60 * 24));
        if (dias > diasMora) diasMora = dias;
      }
    });

    const estadoPrestamo = cuotasPagadas === prestamo.totalCuotas
      ? 'pagado'
      : cuotasVencidas > 0
      ? 'vencido'
      : 'activo';

    // ── Guardar cambios en el préstamo ──────────────────────────────────────
    prestamo.cuotas             = cuotasFinales;
    prestamo.cuotasPagadas      = cuotasPagadas;
    prestamo.cuotasVencidas     = cuotasVencidas;
    prestamo.saldoPendiente     = Math.max(0, Math.round(saldoPendiente * 100) / 100);
    prestamo.diasMora           = diasMora;
    prestamo.estado             = estadoPrestamo;
    await prestamo.save();

    // ── Crear registro de pago ──────────────────────────────────────────────
    const count = await Pago.countDocuments();
    const year  = new Date().getFullYear();
    const numeroPago = `PAG-${year}-${String(count + 1).padStart(5, '0')}`;

    const pago = await Pago.create({
      prestamoId,
      clienteId:      prestamo.clienteId,
      usuarioId:      req.usuario.id,
      numeroPago,
      montoPagado:    Number(montoPagado),
      montoCapital:   Math.round(totalCapital   * 100) / 100,
      montoInteres:   Math.round(totalInteres   * 100) / 100,
      montoMora:      Math.round(totalMora      * 100) / 100,
      metodoPago:     metodoPago || 'efectivo',
      referencia,
      observaciones,
      cuotasAplicadas,
      fechaPago:      new Date(),
    });

    res.status(201).json({ pago, prestamo });
  } catch (err) {
    console.error('Error registrando pago:', err);
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
