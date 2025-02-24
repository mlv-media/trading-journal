const mongoose = require('mongoose');

const tradeSchema = new mongoose.Schema({
  date: { type: Date, required: true },
  time: { type: String, required: true },
  ticker: { type: String, required: true },
  gainsLosses: { type: Number, required: true },
  riskAmount: { type: Number, required: true },
  comments: { type: String },
}, { timestamps: true });

module.exports = mongoose.model('Trade', tradeSchema);