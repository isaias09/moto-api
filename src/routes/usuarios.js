const router = require('express').Router();
const auth = require('../middleware/auth');
const empresa = require('../middleware/empresa');
const verificarLimite = require('../middleware/plan');
const Usuario = require('../models/Usuario');

router.use(auth, empresa);

// Solo admin puede gestionar usuarios
const soloAdmin = (req, res, next) => {
  if (req.usuario.rol !== 'admin' && !req.usuario.esSuperAdmin)
    return res.status(403).json({ error: 'Solo administradores' });
  next();
};

// GET — solo usuarios de la empresa actual
router.get('/', soloAdmin, async (req, res) => {
  try {
    const usuarios = await Usuario.find({ empresaId: req.empresaId }).select('-password');
    res.json(usuarios);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST — verificar límite del plan antes de crear
router.post('/', soloAdmin, verificarLimite('usuarios'), async (req, res) => {
  try {
    // Verificar email único dentro de la empresa
    const existe = await Usuario.findOne({ email: req.body.email?.toLowerCase(), empresaId: req.empresaId });
    if (existe) return res.status(400).json({ error: 'Ya existe un usuario con ese email en esta empresa' });

    const usuario = new Usuario({ ...req.body, empresaId: req.empresaId });
    await usuario.save();
    const { password, ...data } = usuario.toObject();
    res.status(201).json(data);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// PUT — actualizar usuario (con hash de contraseña si viene nueva)
router.put('/:id', soloAdmin, async (req, res) => {
  try {
    const { password, ...rest } = req.body;

    const usuario = await Usuario.findOne({ _id: req.params.id, empresaId: req.empresaId });
    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });

    Object.assign(usuario, rest);

    if (password && password.trim().length >= 6) {
      usuario.password = password.trim();
    }

    await usuario.save();
    const data = usuario.toObject();
    delete data.password;
    res.json(data);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

module.exports = router;
