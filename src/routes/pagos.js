const router    = require('express').Router();
const auth      = require('../middleware/auth');
const empresaMw = require('../middleware/empresa');
const Pago      = require('../models/Pago');
const Prestamo  = require('../models/Prestamo');

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
    const { prestamoId, montoPagado, metodoPago, referencia, observaciones, abonoCapital } = req.body;

    if (!prestamoId || !montoPagado || montoPagado <= 0)
      return res.status(400).json({ error: 'prestamoId y montoPagado son requeridos' });

    const prestamo = await Prestamo.findById(prestamoId);
    if (!prestamo)
      return res.status(404).json({ error: 'Préstamo no encontrado' });
    if (['pagado', 'cancelado'].includes(prestamo.estado))
      return res.status(400).json({ error: 'El préstamo ya está pagado' });

    const hoy = new Date();
    let totalCapital    = 0;
    let totalInteres    = 0;
    let totalMora       = 0;
    let cuotasAplicadas = [];
    let cuotasFinales;
    let nuevoSaldo;
    let estadoPrestamo;

    // ── SOLO INTERÉS ──────────────────────────────────────────────────────────
    if (prestamo.tipoCalculo === 'solo_interes') {
      const capitalActual = prestamo.saldoPendiente;
      const abono         = Number(abonoCapital || 0);
      const tp            = prestamo.tasaInteres / 100 / (
        prestamo.frecuenciaPago === 'diario'    ? 30 :
        prestamo.frecuenciaPago === 'semanal'   ? 4  :
        prestamo.frecuenciaPago === 'quincenal' ? 2  : 1
      );

      totalInteres = Math.round(capitalActual * tp * 100) / 100;
      totalCapital = abono;
      nuevoSaldo   = Math.max(0, Math.round((capitalActual - abono) * 100) / 100);

      // Nuevo interés basado en capital reducido
      const nuevoInteres = Math.round(nuevoSaldo * tp * 100) / 100;
      let marcada = false;

      cuotasFinales = prestamo.cuotas.map(c => {
        if (c.estado === 'pagada') return c;
        if (!marcada) {
          // Marcar la próxima cuota de interés como pagada
          marcada = true;
          cuotasAplicadas.push(c._id);
          return { ...c.toObject(), montoPagado: c.montoCuota, estado: 'pagada', fechaPago: hoy };
        }
        // Recalcular interés futuro con el nuevo capital
        return { ...c.toObject(), montoInteres: nuevoInteres, montoCuota: nuevoInteres };
      });

      estadoPrestamo = nuevoSaldo <= 0 ? 'pagado' : prestamo.estado;

    // ── NORMAL (frances, simple, aleman, bullet) ──────────────────────────────
    } else {
      const cuotasOrdenadas = [...prestamo.cuotas].sort((a, b) => a.numeroCuota - b.numeroCuota);
      let montoRestante = Number(montoPagado);

      cuotasFinales = cuotasOrdenadas.map(cuota => {
        if (montoRestante <= 0 || cuota.estado === 'pagada') return cuota;
        const pendiente = cuota.montoCuota - cuota.montoPagado + (cuota.montoMora || 0);
        if (pendiente <= 0) return cuota;

        if (montoRestante >= pendiente) {
          montoRestante -= pendiente;
          cuotasAplicadas.push(cuota._id);
          totalCapital += cuota.montoCapital;
          totalInteres += cuota.montoInteres;
          totalMora    += cuota.montoMora || 0;
          return { ...cuota.toObject(), montoPagado: cuota.montoCuota, montoMora: 0, estado: 'pagada', fechaPago: hoy };
        } else {
          // Bullet: cuotas de solo interés no aceptan pago parcial
          if (prestamo.tipoCalculo === 'bullet' && cuota.montoCapital === 0) return cuota;
          cuotasAplicadas.push(cuota._id);
          const aplicado = montoRestante;
          montoRestante  = 0;
          totalCapital  += aplicado * (cuota.montoCapital / cuota.montoCuota);
          totalInteres  += aplicado * (cuota.montoInteres / cuota.montoCuota);
          return { ...cuota.toObject(), montoPagado: cuota.montoPagado + aplicado, estado: 'parcial' };
        }
      });

      // Marcar vencidas
      cuotasFinales = cuotasFinales.map(c => {
        if (c.estado !== 'pagada' && c.estado !== 'parcial' && new Date(c.fechaVencimiento) < hoy)
          return { ...c, estado: 'vencida' };
        return c;
      });

      const pagadas = cuotasFinales.filter(c => c.estado === 'pagada').length;
      nuevoSaldo = cuotasFinales
        .filter(c => c.estado !== 'pagada')
        .reduce((s, c) => s + (c.montoCuota - c.montoPagado), 0);
      estadoPrestamo = pagadas === prestamo.totalCuotas ? 'pagado'
        : cuotasFinales.some(c => c.estado === 'vencida' || c.estado === 'parcial') ? 'vencido' : 'activo';
    }

    // ── Métricas finales ──────────────────────────────────────────────────────
    const cuotasPagadasCount  = cuotasFinales.filter(c => c.estado === 'pagada').length;
    const cuotasVencidasCount = cuotasFinales.filter(c => c.estado === 'vencida' || c.estado === 'parcial').length;
    let diasMora = 0;
    cuotasFinales.forEach(c => {
      if (c.estado === 'vencida' || c.estado === 'parcial') {
        const dias = Math.floor((hoy - new Date(c.fechaVencimiento)) / 86400000);
        if (dias > diasMora) diasMora = dias;
      }
    });

    prestamo.cuotas           = cuotasFinales;
    prestamo.cuotasPagadas    = cuotasPagadasCount;
    prestamo.cuotasVencidas   = cuotasVencidasCount;
    prestamo.saldoPendiente   = Math.max(0, Math.round(nuevoSaldo * 100) / 100);
    prestamo.diasMora         = diasMora;
    prestamo.estado           = estadoPrestamo;
    prestamo.capitalPagado    = Math.round(((prestamo.capitalPagado    || 0) + totalCapital) * 100) / 100;
    prestamo.interesesPagados = Math.round(((prestamo.interesesPagados || 0) + totalInteres) * 100) / 100;
    await prestamo.save();

    // ── Registro de pago ──────────────────────────────────────────────────────
    const count      = await Pago.countDocuments({ empresaId: req.empresaId });
    const year       = new Date().getFullYear();
    const numeroPago = `PAG-${year}-${String(count + 1).padStart(5, '0')}`;

    const pago = await Pago.create({
      empresaId:    req.empresaId,
      prestamoId,
      clienteId:    prestamo.clienteId,
      usuarioId:    req.usuario.id,
      numeroPago,
      montoPagado:  Number(montoPagado),
      montoCapital: Math.round(totalCapital * 100) / 100,
      montoInteres: Math.round(totalInteres * 100) / 100,
      montoMora:    Math.round(totalMora    * 100) / 100,
      metodoPago:   metodoPago || 'efectivo',
      referencia,
      observaciones,
      cuotasAplicadas,
      fechaPago: hoy,
    });

    res.status(201).json({ pago, prestamo });
  } catch (err) {
    console.error('Error registrando pago:', err);
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
