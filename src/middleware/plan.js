/**
 * Middleware que verifica los límites del plan de suscripción antes de crear recursos.
 */
const Empresa  = require('../models/Empresa');
const Usuario  = require('../models/Usuario');
const Cliente  = require('../models/Cliente');
const Prestamo = require('../models/Prestamo');

const LIMITES_POR_PLAN = {
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

      // Sin empresa asignada (no debería llegar aquí, pero por seguridad)
      if (!empresaId) {
        console.warn('[plan] Sin empresaId — bloqueando creación');
        return res.status(403).json({ error: 'Sin empresa asignada' });
      }

      const empresa = await Empresa.findById(empresaId).select('plan limites nombre');
      if (!empresa) return res.status(404).json({ error: 'Empresa no encontrada' });

      const plan     = empresa.plan ?? 'basico';
      const defaults = LIMITES_POR_PLAN[plan] ?? LIMITES_POR_PLAN.basico;

      // Usar límites de BD solo si son números válidos > 0
      const maxUsuarios  = (empresa.limites?.maxUsuarios  > 0) ? empresa.limites.maxUsuarios  : defaults.maxUsuarios;
      const maxClientes  = (empresa.limites?.maxClientes  > 0) ? empresa.limites.maxClientes  : defaults.maxClientes;
      const maxPrestamos = (empresa.limites?.maxPrestamos > 0) ? empresa.limites.maxPrestamos : defaults.maxPrestamos;

      let actual = 0;
      let maximo = 0;
      let nombreRecurso = '';

      if (recurso === 'usuarios') {
        actual        = await Usuario.countDocuments({ empresaId, activo: true });
        maximo        = maxUsuarios;
        nombreRecurso = 'usuarios';
      } else if (recurso === 'clientes') {
        actual        = await Cliente.countDocuments({ empresaId, activo: true });
        maximo        = maxClientes;
        nombreRecurso = 'clientes';
      } else if (recurso === 'prestamos') {
        actual        = await Prestamo.countDocuments({ empresaId, estado: { $in: ['activo', 'vencido'] } });
        maximo        = maxPrestamos;
        nombreRecurso = 'préstamos activos';
      }

      console.log(`[plan] empresa="${empresa.nombre}" plan=${plan} recurso=${recurso} actual=${actual} maximo=${maximo}`);

      if (actual >= maximo) {
        return res.status(403).json({
          error: `Límite del plan alcanzado: máximo ${maximo} ${nombreRecurso} (plan ${plan}). Actualiza tu plan para continuar.`,
          codigo: 'LIMITE_PLAN',
          recurso,
          actual,
          maximo,
          plan,
        });
      }

      next();
    } catch (err) {
      console.error('[plan] Error en verificarLimite:', err.message);
      next(err);
    }
  };
};
