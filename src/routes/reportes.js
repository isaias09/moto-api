const router = require('express').Router();
const auth = require('../middleware/auth');
const Prestamo = require('../models/Prestamo');
const Pago = require('../models/Pago');
const Cliente = require('../models/Cliente');

router.use(auth);

// GET /api/reportes/dashboard
router.get('/dashboard', async (req, res) => {
  try {
    const hoy = new Date();
    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    const inicioDia = new Date(hoy.toDateString());
    const finDia = new Date(inicioDia); finDia.setDate(finDia.getDate() + 1);

    const [prestamos, pagosHoy, pagosMes, totalClientes] = await Promise.all([
      Prestamo.find(),
      Pago.find({ fechaPago: { $gte: inicioDia, $lt: finDia } }),
      Pago.find({ fechaPago: { $gte: inicioMes } }),
      Cliente.countDocuments({ activo: true }),
    ]);

    const activos = prestamos.filter((p) => ['activo', 'vencido'].includes(p.estado));
    const enMora = prestamos.filter((p) => p.cuotasVencidas > 0);

    const tipos = ['personal','hipotecario','vehicular','comercial','empresarial','educativo','con_garantia','sin_garantia'];
    const prestamosPorTipo = {};
    tipos.forEach((t) => {
      prestamosPorTipo[t] = prestamos.filter((p) => p.tipoPrestamo === t && p.estado !== 'pagado').length;
    });

    res.json({
      totalPrestamosActivos: activos.length,
      totalCartera: activos.reduce((s, p) => s + p.saldoPendiente, 0),
      cobradoHoy: pagosHoy.reduce((s, p) => s + p.montoPagado, 0),
      cobradoMes: pagosMes.reduce((s, p) => s + p.montoPagado, 0),
      ingresosMes: pagosMes.reduce((s, p) => s + p.montoInteres + p.montoMora, 0),
      clientesEnMora: enMora.length,
      montoMoraTotal: enMora.reduce((s, p) => s + p.montoMoraAcumulada, 0),
      prestamosVencidos: prestamos.filter((p) => p.estado === 'vencido').length,
      totalClientes,
      prestamosPorTipo,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/reportes/cuadre?fecha=2024-01-15
router.get('/cuadre', async (req, res) => {
  try {
    const fecha = req.query.fecha ? new Date(req.query.fecha) : new Date();
    const inicio = new Date(fecha.toDateString());
    const fin = new Date(inicio); fin.setDate(fin.getDate() + 1);

    const pagos = await Pago.find({ fechaPago: { $gte: inicio, $lt: fin } })
      .populate('clienteId', 'nombre apellido')
      .populate('prestamoId', 'numeroPrestamo');

    res.json({
      fecha: inicio,
      totalCobrado: pagos.reduce((s, p) => s + p.montoPagado, 0),
      totalCapital: pagos.reduce((s, p) => s + p.montoCapital, 0),
      totalIntereses: pagos.reduce((s, p) => s + p.montoInteres, 0),
      totalMora: pagos.reduce((s, p) => s + p.montoMora, 0),
      cantidadPagos: pagos.length,
      pagos,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
