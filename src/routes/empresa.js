const router  = require('express').Router();
const auth    = require('../middleware/auth');
const Empresa = require('../models/Empresa');

// GET /api/empresa — config de la empresa del usuario autenticado
router.get('/', auth, async (req, res) => {
  try {
    if (!req.usuario.empresaId)
      return res.status(404).json({ error: 'Usuario sin empresa asignada' });

    const empresa = await Empresa.findById(req.usuario.empresaId)
      .select('nombre rnc telefono direccion email config activa');
    if (!empresa)
      return res.status(404).json({ error: 'Empresa no encontrada' });

    res.json(empresa);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/empresa/config — actualizar config financiera
router.put('/config', auth, async (req, res) => {
  try {
    if (!req.usuario.empresaId)
      return res.status(403).json({ error: 'Usuario sin empresa asignada' });

    if (req.usuario.rol !== 'admin')
      return res.status(403).json({ error: 'Solo administradores pueden cambiar la configuración' });

    const { moneda, tasaInteresMensual, tasaMora, diasGraciaMora, frecuenciaPagoDefault,
            nombre, rnc, telefono, direccion, email } = req.body;

    const update = {};
    if (nombre    !== undefined) update.nombre    = nombre;
    if (rnc       !== undefined) update.rnc       = rnc;
    if (telefono  !== undefined) update.telefono  = telefono;
    if (direccion !== undefined) update.direccion = direccion;
    if (email     !== undefined) update.email     = email;
    if (moneda               !== undefined) update['config.moneda']               = moneda;
    if (tasaInteresMensual   !== undefined) update['config.tasaInteresMensual']   = tasaInteresMensual;
    if (tasaMora             !== undefined) update['config.tasaMora']             = tasaMora;
    if (diasGraciaMora       !== undefined) update['config.diasGraciaMora']       = diasGraciaMora;
    if (frecuenciaPagoDefault !== undefined) update['config.frecuenciaPagoDefault'] = frecuenciaPagoDefault;

    const empresa = await Empresa.findByIdAndUpdate(
      req.usuario.empresaId,
      { $set: update },
      { new: true, select: 'nombre rnc telefono direccion email config' },
    );

    res.json(empresa);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
