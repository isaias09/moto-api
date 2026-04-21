const mongoose = require('mongoose');

const CuotaSchema = new mongoose.Schema({
  numeroCuota:      { type: Number, default: 0 },
  fechaVencimiento: { type: Date, required: true },
  montoCapital:     { type: Number, default: 0 },
  montoInteres:     { type: Number, default: 0 },
  montoCuota:       { type: Number, default: 0 },
  montoPagado:      { type: Number, default: 0 },
  montoMora:        { type: Number, default: 0 },
  estado:           { type: String, enum: ['pendiente', 'pagada', 'vencida', 'parcial'], default: 'pendiente' },
  fechaPago:        Date,
}, { _id: true });

const num = (def = 0) => ({ type: Number, default: def });

const PrestamoSchema = new mongoose.Schema({
  empresaId:           { type: mongoose.Schema.Types.ObjectId, ref: 'Empresa', required: true },
  clienteId:           { type: mongoose.Schema.Types.ObjectId, ref: 'Cliente', required: true },
  usuarioId:           { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
  numeroPrestamo:      { type: String, required: true },
  tipoPrestamo:        { type: String, enum: ['personal','hipotecario','vehicular','comercial','empresarial','educativo','con_garantia','sin_garantia'], required: true },
  tipoCalculo:         { type: String, enum: ['frances','simple','aleman','bullet','solo_interes'], default: 'frances' },
  descripcionDestino:  { type: String, required: true },
  tieneGarantia:       { type: Boolean, default: false },
  tipoGarantia:        { type: String, default: 'ninguna' },
  descripcionGarantia: String,
  valorGarantia:       Number,
  montoSolicitado:     num(),
  inicial:             num(),
  montoFinanciado:     num(),
  tasaInteres:         num(),
  plazoMeses:          num(1),
  frecuenciaPago:      { type: String, enum: ['diario','semanal','quincenal','mensual'], default: 'mensual' },
  totalCuotas:         num(1),
  montoCuota:          num(),
  totalIntereses:      num(),
  totalPagar:          num(),
  fechaInicio:         { type: Date, default: Date.now },
  fechaVencimiento:    { type: Date, required: true },
  estado:              { type: String, enum: ['activo','pagado','vencido','recuperado','cancelado'], default: 'activo' },
  cuotas:              [CuotaSchema],
  saldoPendiente:      num(),
  capitalPagado:       num(),
  interesesPagados:    num(),
  tasaMoraDiaria:      num(0.5),
  cuotasPagadas:       num(),
  cuotasVencidas:      num(),
  diasMora:            num(),
  montoMoraAcumulada:  num(),
  observaciones:       String,
}, { timestamps: true });

// Sanitizar NaN antes de guardar — v2
PrestamoSchema.pre('save', function(next) {
  const fields = Object.keys(this.schema.paths).filter(
    k => this.schema.paths[k].instance === 'Number'
  );
  for (const f of fields) {
    if (this[f] == null || isNaN(this[f])) this[f] = 0;
  }
  next();
});

PrestamoSchema.index({ empresaId: 1, numeroPrestamo: 1 }, { unique: true });

module.exports = mongoose.model('Prestamo', PrestamoSchema);
