const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../client/build')));

// Suppress Mongoose strictQuery warning
mongoose.set('strictQuery', true);

// MongoDB connection setup
const mongoURI = process.env.MONGO_URI;
if (!mongoURI) {
  console.error('MONGO_URI is not defined in environment variables');
  process.exit(1);
}
console.log('Attempting to connect with MONGO_URI:', mongoURI.replace(/:([^@]+)@/, ':<hidden>@'));

async function connectToMongoDB() {
  try {
    await mongoose.connect(mongoURI, {
      serverSelectionTimeoutMS: 30000,
      connectTimeoutMS: 30000,
      socketTimeoutMS: 45000,
      useNewUrlParser: true,
      useUnifiedTopology: true,
      retryWrites: true,
      w: 'majority',
    });
    console.log('MongoDB connected successfully');

    await mongoose.connection.db.admin().ping();
    console.log('Pinged MongoDB deployment - connection confirmed');
  } catch (err) {
    console.error('MongoDB connection error:', err.message, err.stack);
    process.exit(1);
  }
}

connectToMongoDB().then(() => {
  const tradeRoutes = require('./routes/trades');
  app.use('/api/trades', tradeRoutes);

  const OANDA_API_TOKEN = process.env.OANDA_API_TOKEN || '83d7f025343f6140a94a94abb4b0198f-363d0912ddc235a9b3450e578076f3ce';
  const OANDA_ACCOUNT_ID = process.env.OANDA_ACCOUNT_ID || '001-001-13416152-002';
  const OANDA_STREAM_URL = `https://stream-fxtrade.oanda.com/v3/accounts/${OANDA_ACCOUNT_ID}/pricing/stream?instruments=EUR_USD,GBP_USD,GBP_JPY,XAU_USD`;

  app.get('/api/tickers', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const source = axios.CancelToken.source();
    axios.get(OANDA_STREAM_URL, {
      headers: { Authorization: `Bearer ${OANDA_API_TOKEN}` },
      responseType: 'stream',
      cancelToken: source.token,
    })
      .then(response => {
        response.data.on('data', (chunk) => {
          const formattedData = `data: ${chunk.toString()}\n\n`;
          res.write(formattedData);
        });
        response.data.on('end', () => res.end());
      })
      .catch(err => {
        console.error('OANDA stream error:', err.response ? err.response.data : err.message);
        res.status(500).send('Stream error');
      });

    req.on('close', () => {
      source.cancel('Client closed connection');
      res.end();
    });
  });

  app.get('/', (req, res) => {
    res.send('Welcome to the Trading Journal Server!');
  });

  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/build/index.html'));
  });

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}).catch(err => {
  console.error('Failed to start server due to MongoDB connection:', err);
});