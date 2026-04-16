const router = require('express').Router();
const auth   = require('../middleware/auth');
const empresaMw = require('../middleware/empresa');
const Pago   = require('../models/Pago');
const Prestamo = require('../models/Prestamo');

router.use(auth, empresaMw);

// GET /api/pagos
router.get('/', async (req, res) => {
  try {
    const { fecha, prestamoId } = req.query;
    const filter = { empresaId: req.empresaId };
    if (prestamoId) filter.prestamoId = prestamoId;
    if (fecha) {
      const inicio = new Date(fecha);
      const fin    = new Date(fecha);
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
    const { prestamoId, montoPagado, metodoPago, referencia, observaciones } = req.body;

    if (!prestamoId || !montoPagado || montoPagado <= 0)
      return res.status(400).json({ error: 'prestamoId y montoPagado son requeridos' });

    const prestamo = await Prestamo.findById(prestamoId);
    if (!prestamo)
      return res.status(404).json({ error: 'Préstamo no encontrado' });
    if (['pagado', 'cancelado'].includes(prestamo.estado))
      return res.status(400).json({ error: 'El préstamo ya está pagado' });

    const esBullet = prestamo.tipoCalculo === 'bullet';

    // ── Ordenar cuotas pendientes por número (cronológico) ──────────────────
    const cuotasOrdenadas = [...prestamo.cuotas].sort(
      (a, b) => a.numeroCuota - b.numeroCuota,
    );

    let montoRestante  = Number(montoPagado);
    let totalCapital   = 0;
    let totalInteres   = 0;
    let totalMora      = 0;
    const cuotasAplicadas = [];

    const cuotasActualizadas = cuotasOrdenadas.map((cuota) => {
      if (montoRestante <= 0 || cuota.estado === 'pagada') return cuota;

      const esPendiente = cuota.estado !== 'pagada';
      if (!esPendiente) return cuota;

      // Para Bullet: las cuotas intermedias son solo interés
      // La última cuota es capital + interés
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
        // Pago parcial — para Bullet solo aplica en la última cuota
        // Las cuotas de solo interés deben pagarse completas
        if (esBullet && cuota.montoCapital === 0) {
          // Cuota de solo interés: no aceptar pago parcial
          // (el cliente debe pagar el interés completo)
          return cuota;
        }

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

    // ── Recalcular métricas ──────────────────────────────────────────────────
    const hoy = new Date();
    const cuotasFinales = cuotasActualizadas.map((c) => {
      if (c.estado !== 'pagada') {
        const vencida = new Date(c.fechaVencimiento) < hoy;
        if (vencida && c.estado !== 'parcial') {
          return { ...c, estado: 'vencida' };
        }
      }
      return c;
    });

    const cuotasPagadas  = cuotasFinales.filter(c => c.estado === 'pagada').length;
    const cuotasVencidas = cuotasFinales.filter(c => c.estado === 'vencida' || c.estado === 'parcial').length;
    const saldoPendiente = cuotasFinales
      .filter(c => c.estado !== 'pagada')
      .reduce((s, c) => s + (c.montoCuota - c.montoPagado), 0);

    let diasMora = 0;
    cuotasFinales.forEach(c => {
      if (c.estado === 'vencida' || c.estado === 'parcial') {
        const dias = Math.floor((hoy - new Date(c.fechaVencimiento)) / 86400000);
        if (dias > diasMora) diasMora = dias;
      }
    });

    const estadoPrestamo = cuotasPagadas === prestamo.totalCuotas
      ? 'pagado'
      : cuotasVencidas > 0 ? 'vencido' : 'activo';

    // Acumular capital e intereses pagados
    const capitalPagadoTotal   = (prestamo.capitalPagado   || 0) + Math.round(totalCapital   * 100) / 100;
    const interesesPagadosTotal= (prestamo.interesesPagados|| 0) + Math.round(totalInteres   * 100) / 100;

    prestamo.cuotas              = cuotasFinales;
    prestamo.cuotasPagadas       = cuotasPagadas;
    prestamo.cuotasVencidas      = cuotasVencidas;
    prestamo.saldoPendiente      = Math.max(0, Math.round(saldoPendiente * 100) / 100);
    prestamo.diasMora            = diasMora;
    prestamo.estado              = estadoPrestamo;
    prestamo.capitalPagado       = capitalPagadoTotal;
    prestamo.interesesPagados    = interesesPagadosTotal;
    await prestamo.save();

    // ── Crear registro de pago ───────────────────────────────────────────────
    const count      = await Pago.countDocuments();
    const year       = new Date().getFullYear();
    const numeroPago = `PAG-${year}-${String(count + 1).padStart(5, '0')}`;

    const pago = await Pago.create({
      empresaId:      req.empresaId,
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
