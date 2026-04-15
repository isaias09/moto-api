const router = require('express').Router();
const auth = require('../middleware/auth');
const Usuario = require('../models/Usuario');

router.use(auth);

// Solo admin puede gestionar usuarios
const soloAdmin = (req, res, next) => {
  if (req.usuario.rol !== 'admin')
    return res.status(403).json({ error: 'Solo administradores' });
  next();
};

router.get('/', soloAdmin, async (req, res) => {
  try {
    const usuarios = await Usuario.find().select('-password');
    res.json(usuarios);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', soloAdmin, async (req, res) => {
  try {
    const usuario = new Usuario(req.body);
    await usuario.save();
    const { password, ...data } = usuario.toObject();
    res.status(201).json(data);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.put('/:id', soloAdmin, async (req, res) => {
  try {
    const { password, ...rest } = req.body;
    const usuario = await Usuario.findByIdAndUpdate(req.params.id, rest, { new: true }).select('-password');
    res.json(usuario);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

module.exports = router;
