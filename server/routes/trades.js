const express = require('express');
const router = express.Router();
const Trade = require('../models/Trade');

router.get('/', async (req, res) => {
  const { sortBy = 'date', order = 'desc' } = req.query;
  try {
    const trades = await Trade.find().sort({ [sortBy]: order === 'asc' ? 1 : -1 });
    res.json(trades);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', async (req, res) => {
  const { date, time, ticker, gainsLosses, riskAmount, comments } = req.body;
  const trade = new Trade({ date, time, ticker, gainsLosses, riskAmount, comments });
  try {
    const savedTrade = await trade.save();
    res.status(201).json(savedTrade);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.put('/:id', async (req, res) => {
  const { date, time, ticker, gainsLosses, riskAmount, comments } = req.body;
  try {
    const trade = await Trade.findByIdAndUpdate(
      req.params.id,
      { date, time, ticker, gainsLosses, riskAmount, comments },
      { new: true }
    );
    res.json(trade);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await Trade.findByIdAndDelete(req.params.id);
    res.json({ message: 'Trade deleted' });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;