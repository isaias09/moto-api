const mongoose = require('mongoose');

const ReferenciaSchema = new mongoose.Schema({
  nombre:   String,
  telefono: String,
  relacion: String,
}, { _id: false });

const ClienteSchema = new mongoose.Schema({
  nombre:        { type: String, required: true },
  apellido:      { type: String, required: true },
  cedula:        { type: String, required: true, unique: true },
  telefono:      { type: String, required: true },
  telefonoAlt:   String,
  email:         String,
  direccion:     { type: String, required: true },
  sector:        String,
  ciudad:        String,
  ocupacion:     String,
  ingresoMensual:{ type: Number, default: 0 },
  referencias:   [ReferenciaSchema],
  documentos:    [String],
  activo:        { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('Cliente', ClienteSchema);
