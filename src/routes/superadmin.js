const router    = require('express').Router();
const auth      = require('../middleware/auth');
const isSuperAdmin = require('../middleware/superadmin');
const Empresa   = require('../models/Empresa');
const Usuario   = require('../models/Usuario');
const Prestamo  = require('../models/Prestamo');
const Cliente   = require('../models/Cliente');
const Pago      = require('../models/Pago');

router.use(auth, isSuperAdmin);

// ── DASHBOARD SUPERADMIN ──────────────────────────────────────────────────────
router.get('/dashboard', async (req, res) => {
  try {
    const [empresas, usuarios, clientes, prestamos, pagos] = await Promise.all([
      Empresa.countDocuments(),
      Usuario.countDocuments({ esSuperAdmin: false }),
      Cliente.countDocuments(),
      Prestamo.countDocuments(),
      Pago.countDocuments(),
    ]);

    const empresasActivas   = await Empresa.countDocuments({ activa: true });
    const carteraTotal      = await Prestamo.aggregate([
      { $match: { estado: { $in: ['activo', 'vencido'] } } },
      { $group: { _id: null, total: { $sum: '$saldoPendiente' } } },
    ]);
    const cobradoTotal      = await Pago.aggregate([
      { $group: { _id: null, total: { $sum: '$montoPagado' } } },
    ]);

    res.json({
      empresas, empresasActivas,
      usuarios, clientes, prestamos, pagos,
      carteraTotal:  carteraTotal[0]?.total  ?? 0,
      cobradoTotal:  cobradoTotal[0]?.total  ?? 0,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── EMPRESAS ──────────────────────────────────────────────────────────────────
router.get('/empresas', async (req, res) => {
  try {
    const empresas = await Empresa.find().sort({ createdAt: -1 });
    // Agregar conteos por empresa
    const result = await Promise.all(empresas.map(async (e) => {
      const [clientes, prestamos, usuarios] = await Promise.all([
        Cliente.countDocuments({ empresaId: e._id }),
        Prestamo.countDocuments({ empresaId: e._id }),
        Usuario.countDocuments({ empresaId: e._id }),
      ]);
      const cartera = await Prestamo.aggregate([
        { $match: { empresaId: e._id, estado: { $in: ['activo','vencido'] } } },
        { $group: { _id: null, total: { $sum: '$saldoPendiente' } } },
      ]);
      return {
        ...e.toObject(),
        stats: {
          clientes, prestamos, usuarios,
          cartera: cartera[0]?.total ?? 0,
        },
      };
    }));
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/empresas/:id', async (req, res) => {
  try {
    const empresa = await Empresa.findById(req.params.id);
    if (!empresa) return res.status(404).json({ error: 'No encontrada' });
    res.json(empresa);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/empresas', async (req, res) => {
  try {
    const empresa = await Empresa.create({ ...req.body, creadoPor: req.usuario.id });
    res.status(201).json(empresa);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.put('/empresas/:id', async (req, res) => {
  try {
    const empresa = await Empresa.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(empresa);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.delete('/empresas/:id', async (req, res) => {
  try {
    await Empresa.findByIdAndUpdate(req.params.id, { activa: false });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── USUARIOS DE UNA EMPRESA ───────────────────────────────────────────────────
router.get('/empresas/:id/usuarios', async (req, res) => {
  try {
    const usuarios = await Usuario.find({ empresaId: req.params.id }).select('-password');
    res.json(usuarios);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/empresas/:id/usuarios', async (req, res) => {
  try {
    const usuario = new Usuario({ ...req.body, empresaId: req.params.id });
    await usuario.save();
    const { password, ...data } = usuario.toObject();
    res.status(201).json(data);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// ── TODOS LOS USUARIOS ────────────────────────────────────────────────────────
router.get('/usuarios', async (req, res) => {
  try {
    const usuarios = await Usuario.find({ esSuperAdmin: false })
      .select('-password')
      .populate('empresaId', 'nombre');
    res.json(usuarios);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
