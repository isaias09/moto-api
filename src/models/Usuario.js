const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UsuarioSchema = new mongoose.Schema({
  empresaId: { type: mongoose.Schema.Types.ObjectId, ref: 'Empresa', default: null },
  esSuperAdmin: { type: Boolean, default: false },
  nombre:    { type: String, required: true },
  email:     { type: String, required: true, unique: true, lowercase: true },
  password:  { type: String, required: true },
  rol:       { type: String, enum: ['admin', 'cajero', 'cobrador'], default: 'cajero' },
  activo:    { type: Boolean, default: true },
  telefono:  { type: String },
  lastLogin: { type: Date },
}, { timestamps: true });

// Hash password antes de guardar
UsuarioSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

UsuarioSchema.methods.compararPassword = function (plain) {
  return bcrypt.compare(plain, this.password);
};

module.exports = mongoose.model('Usuario', UsuarioSchema);
