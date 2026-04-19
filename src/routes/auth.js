const router  = require('express').Router();
const jwt     = require('jsonwebtoken');
const Usuario = require('../models/Usuario');
const Empresa = require('../models/Empresa');

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: 'Email y contraseña requeridos' });

    const usuario = await Usuario.findOne({ email: email.toLowerCase(), activo: true });
    if (!usuario)
      return res.status(401).json({ error: 'Credenciales incorrectas' });

    const ok = await usuario.compararPassword(password);
    if (!ok)
      return res.status(401).json({ error: 'Credenciales incorrectas' });

    await Usuario.findByIdAndUpdate(usuario._id, { lastLogin: new Date() });

    // Cargar config de la empresa si el usuario pertenece a una
    let empresa = null;
    if (usuario.empresaId) {
      empresa = await Empresa.findById(usuario.empresaId).select('nombre rnc telefono direccion email config activa');
      if (!empresa || !empresa.activa) {
        return res.status(403).json({ error: 'Empresa inactiva. Contacte al administrador del sistema.' });
      }
    }

    const token = jwt.sign(
      {
        id:           usuario._id,
        email:        usuario.email,
        rol:          usuario.rol,
        nombre:       usuario.nombre,
        empresaId:    usuario.empresaId ?? null,
        esSuperAdmin: usuario.esSuperAdmin ?? false,
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' },
    );

    res.json({
      token,
      usuario: {
        id:           usuario._id,
        nombre:       usuario.nombre,
        email:        usuario.email,
        rol:          usuario.rol,
        empresaId:    usuario.empresaId ?? null,
        esSuperAdmin: usuario.esSuperAdmin ?? false,
      },
      empresa: empresa ? {
        id:        empresa._id,
        nombre:    empresa.nombre,
        rnc:       empresa.rnc,
        telefono:  empresa.telefono,
        direccion: empresa.direccion,
        email:     empresa.email,
        config:    empresa.config,
      } : null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/auth/me
router.get('/me', require('../middleware/auth'), async (req, res) => {
  try {
    const usuario = await Usuario.findById(req.usuario.id).select('-password');
    res.json(usuario);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
