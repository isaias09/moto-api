const mongoose = require('mongoose');
const Usuario = require('./models/Usuario');
require('dotenv').config();

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Conectado a MongoDB');

  const existe = await Usuario.findOne({ email: 'admin@financerd.com' });
  if (!existe) {
    await Usuario.create({
      nombre: 'Administrador',
      email: 'admin@financerd.com',
      password: 'admin123',
      rol: 'admin',
      activo: true,
    });
    console.log('✅ Admin creado: admin@financerd.com / admin123');
  } else {
    console.log('ℹ️  Admin ya existe');
  }

  await mongoose.disconnect();
}

seed().catch(console.error);
