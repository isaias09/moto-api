const mongoose = require('mongoose');

const EmpresaSchema = new mongoose.Schema({
  nombre:              { type: String, required: true },
  rnc:                 { type: String },
  telefono:            { type: String },
  direccion:           { type: String },
  email:               { type: String },
  logo:                { type: String },
  activa:              { type: Boolean, default: true },
  plan:                { type: String, enum: ['basico', 'profesional', 'enterprise'], default: 'basico' },
  // Configuración financiera propia
  config: {
    moneda:                { type: String, default: 'RD$' },
    tasaInteresMensual:    { type: Number, default: 5 },
    tasaMora:              { type: Number, default: 0.5 },
    diasGraciaMora:        { type: Number, default: 3 },
    frecuenciaPagoDefault: { type: String, default: 'mensual' },
  },
  // Límites según plan
  limites: {
    maxUsuarios:   { type: Number, default: 3 },
    maxClientes:   { type: Number, default: 100 },
    maxPrestamos:  { type: Number, default: 50 },
  },
  creadoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario' },
}, { timestamps: true });

module.exports = mongoose.model('Empresa', EmpresaSchema);
