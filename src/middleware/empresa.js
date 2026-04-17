/**
 * Middleware que inyecta empresaId en req desde el token JWT.
 * SuperAdmin puede pasar ?empresaId=xxx para operar en cualquier empresa.
 */
module.exports = function (req, res, next) {
  if (req.usuario.esSuperAdmin) {
    req.empresaId = req.query.empresaId || req.body.empresaId || null;
  } else {
    req.empresaId = req.usuario.empresaId;
  }

  if (!req.empresaId) {
    return res.status(403).json({ error: 'Sin empresa asignada' });
  }
  next();
};
