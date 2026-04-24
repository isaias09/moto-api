/**
 * Script de migración: corrige los límites de plan en todas las empresas.
 * Ejecutar una sola vez: node src/scripts/fix-limites.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Empresa  = require('../models/Empresa');

const LIMITES_POR_PLAN = {
  basico:      { maxUsuarios: 3,   maxClientes: 100,    maxPrestamos: 50     },
  profesional: { maxUsuarios: 10,  maxClientes: 500,    maxPrestamos: 250    },
  enterprise:  { maxUsuarios: 999, maxClientes: 999999, maxPrestamos: 999999 },
};

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ MongoDB conectado');

  const empresas = await Empresa.find({});
  console.log(`📋 ${empresas.length} empresas encontradas`);

  let actualizadas = 0;
  for (const e of empresas) {
    const plan     = e.plan ?? 'basico';
    const defaults = LIMITES_POR_PLAN[plan] ?? LIMITES_POR_PLAN.basico;
    const necesitaFix =
      !e.limites ||
      !(e.limites.maxUsuarios  > 0) ||
      !(e.limites.maxClientes  > 0) ||
      !(e.limites.maxPrestamos > 0);

    if (necesitaFix) {
      await Empresa.findByIdAndUpdate(e._id, {
        $set: {
          'limites.maxUsuarios':  defaults.maxUsuarios,
          'limites.maxClientes':  defaults.maxClientes,
          'limites.maxPrestamos': defaults.maxPrestamos,
        },
      });
      console.log(`  ✔ "${e.nombre}" (${plan}) → max ${defaults.maxUsuarios} usuarios, ${defaults.maxClientes} clientes, ${defaults.maxPrestamos} préstamos`);
      actualizadas++;
    } else {
      console.log(`  ✓ "${e.nombre}" (${plan}) — límites OK`);
    }
  }

  console.log(`\n✅ ${actualizadas} empresas actualizadas`);
  await mongoose.disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });
