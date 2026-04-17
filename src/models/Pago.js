const mongoose = require('mongoose');

const PagoSchema = new mongoose.Schema({
  empresaId: { type: mongoose.Schema.Types.ObjectId, ref: 'Empresa', required: true },
  prestamoId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Prestamo', required: true },
  clienteId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Cliente', required: true },
  usuarioId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
  numeroPago:     { type: String, required: true },
  cuotasAplicadas:[{ type: mongoose.Schema.Types.ObjectId }],
  montoPagado:    { type: Number, required: true },
  montoCapital:   { type: Number, default: 0 },
  montoInteres:   { type: Number, default: 0 },
  montoMora:      { type: Number, default: 0 },
  metodoPago:     { type: String, enum: ['efectivo','transferencia','cheque','tarjeta'], default: 'efectivo' },
  referencia:     String,
  observaciones:  String,
  fechaPago:      { type: Date, default: Date.now },
}, { timestamps: true });

PagoSchema.index({ empresaId: 1, numeroPago: 1 }, { unique: true });

module.exports = mongoose.model('Pago', PagoSchema);
