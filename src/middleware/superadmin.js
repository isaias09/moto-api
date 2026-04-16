module.exports = function (req, res, next) {
  if (!req.usuario?.esSuperAdmin) {
    return res.status(403).json({ error: 'Acceso solo para SuperAdmin' });
  }
  next();
};
