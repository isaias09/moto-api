/**
 * Middleware que verifica los límites del plan de suscripción antes de crear recursos.
 * Uso: router.post('/', auth, empresa, verificarLimite('usuarios'), handler)
 */
const Empresa = require('../models/Empresa');
const Usuario = require('../models/Usuario');
const Cliente = require('../models/Cliente');
const Prestamo = require('../models/Prestamo');

const LIMITES_DEFAULT = {
  basico:      { maxUsuarios: 3,   maxClientes: 100,    maxPrestamos: 50     },
  profesional: { maxUsuarios: 10,  maxClientes: 500,    maxPrestamos: 250    },
  enterprise:  { maxUsuarios: 999, maxClientes: 999999, maxPrestamos: 999999 },
};

/**
 * @param {'usuarios'|'clientes'|'prestamos'} recurso
 */
module.exports = function verificarLimite(recurso) {
  return async (req, res, next) => {
    try {
      const empresaId = req.empresaId;
      if (!empresaId) return next(); // superadmin sin empresa — sin límite

      const empresa = await Empresa.findById(empresaId).select('plan limites');
      if (!empresa) return res.status(404).json({ error: 'Empresa no encontrada' });

      // Usar límites guardados en BD; si no existen, usar los del plan
      const defaults = LIMITES_DEFAULT[empresa.plan] ?? LIMITES_DEFAULT.basico;
      const limites  = {
        maxUsuarios:  empresa.limites?.maxUsuarios  ?? defaults.maxUsuarios,
        maxClientes:  empresa.limites?.maxClientes  ?? defaults.maxClientes,
        maxPrestamos: empresa.limites?.maxPrestamos ?? defaults.maxPrestamos,
      };

      let actual = 0;
      let maximo = 0;
      let nombre = '';

      if (recurso === 'usuarios') {
        actual = await Usuario.countDocuments({ empresaId, activo: true });
        maximo = limites.maxUsuarios;
        nombre = 'usuarios';
      } else if (recurso === 'clientes') {
        actual = await Cliente.countDocuments({ empresaId, activo: true });
        maximo = limites.maxClientes;
        nombre = 'clientes';
      } else if (recurso === 'prestamos') {
        actual = await Prestamo.countDocuments({ empresaId, estado: { $in: ['activo', 'vencido'] } });
        maximo = limites.maxPrestamos;
        nombre = 'préstamos activos';
      }

      if (actual >= maximo) {
        return res.status(403).json({
          error: `Límite del plan alcanzado: máximo ${maximo} ${nombre} (plan ${empresa.plan}). Actualiza tu plan para continuar.`,
          codigo: 'LIMITE_PLAN',
          recurso,
          actual,
          maximo,
          plan: empresa.plan,
        });
      }

      next();
    } catch (err) {
      next(err);
    }
  };
};
