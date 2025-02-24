import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Papa from 'papaparse';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import './App.css';
import Logo from './cogs.png';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

function App() {
  const [trades, setTrades] = useState([]);
  const [form, setForm] = useState({
    date: '', time: '', ticker: '', gainsLosses: '', riskAmount: '', comments: '',
  });
  const [sortBy, setSortBy] = useState('date');
  const [sortOrder, setSortOrder] = useState('desc');
  const [editingTrade, setEditingTrade] = useState(null);
  const [tickers, setTickers] = useState({
    'EUR/USD': 'N/A', 'GBP/USD': 'N/A', 'GBP/JPY': 'N/A', 'XAU/USD': 'N/A'
  });
  const [period, setPeriod] = useState('YTD');
  const [error, setError] = useState(null); // Added for error feedback
  const BACKEND_URL = 'https://trading-journal-server.onrender.com';
  const tickerOptions = ['EUR/USD', 'GBP/USD', 'GBP/JPY', 'XAU/USD'];

  useEffect(() => {
    fetchTrades();
  
    const eventSource = new EventSource(`${BACKEND_URL}/api/tickers`);
    let buffer = ''; // Buffer to accumulate chunks
  
    eventSource.onmessage = (event) => {
      buffer += event.data; // Append incoming data
      const messages = buffer.split('\n\n'); // Split by SSE delimiter
      buffer = messages.pop(); // Keep incomplete last part in buffer
  
      messages.forEach(message => {
        if (message.startsWith('data: ')) {
          const jsonData = message.replace('data: ', '');
          try {
            const data = JSON.parse(jsonData);
            if (data.type === 'PRICE' && data.bids && data.bids.length > 0) {
              const ticker = data.instrument.replace('_', '/');
              const price = parseFloat(data.bids[0].price).toFixed(4);
              setTickers(prev => ({ ...prev, [ticker]: price }));
            }
          } catch (err) {
            console.error('SSE parse error:', err, 'Raw data:', jsonData);
          }
        }
      });
    };
  
    eventSource.onerror = (err) => {
      console.error('SSE error:', err);
      setError('Failed to fetch real-time prices');
    };
  
    return () => eventSource.close();
  }, [sortBy, sortOrder]);



  
  const fetchTrades = async () => {
    try {
      const res = await axios.get(`${BACKEND_URL}/api/trades?sortBy=${sortBy}&order=${sortOrder}`);
      setTrades(res.data || []);
      setError(null);
    } catch (err) {
      console.error('Fetch trades error:', err.response ? err.response.data : err.message);
      setTrades([]);
      setError('Failed to load trades');
    }
  };

  const calculateProfitLoss = () => {
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    let filteredTrades;
    switch (period) {
      case 'YTD':
        filteredTrades = trades.filter(trade => new Date(trade.date) >= startOfYear);
        break;
      case 'Monthly':
        filteredTrades = trades.filter(trade => new Date(trade.date) >= startOfMonth);
        break;
      case 'Weekly':
        filteredTrades = trades.filter(trade => new Date(trade.date) >= startOfWeek);
        break;
      case 'Daily':
        filteredTrades = trades.filter(trade => new Date(trade.date) >= startOfDay);
        break;
      default:
        filteredTrades = trades;
    }

    const total = filteredTrades.reduce((sum, trade) => sum + (trade.gainsLosses || 0), 0);
    return total.toFixed(2);
  };

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      ...form,
      date: new Date(form.date),
      gainsLosses: parseFloat(form.gainsLosses) || 0,
      riskAmount: parseFloat(form.riskAmount) || 0,
    };
    try {
      if (editingTrade) {
        await axios.put(`${BACKEND_URL}/api/trades/${editingTrade._id}`, payload);
        setEditingTrade(null);
      } else {
        await axios.post(`${BACKEND_URL}/api/trades`, payload);
      }
      setForm({ date: '', time: '', ticker: '', gainsLosses: '', riskAmount: '', comments: '' });
      fetchTrades();
      setError(null);
    } catch (err) {
      console.error('Submit error:', err);
      setError('Failed to save trade');
    }
  };

  const handleEdit = (trade) => {
    setEditingTrade(trade);
    setForm({
      date: trade.date ? trade.date.split('T')[0] : '',
      time: trade.time || '',
      ticker: trade.ticker || '',
      gainsLosses: trade.gainsLosses != null ? trade.gainsLosses.toString() : '0',
      riskAmount: trade.riskAmount != null ? trade.riskAmount.toString() : '0',
      comments: trade.comments || '',
    });
  };

  const handleDelete = async (id) => {
    try {
      await axios.delete(`${BACKEND_URL}/api/trades/${id}`);
      fetchTrades();
      setError(null);
    } catch (err) {
      console.error('Delete error:', err);
      setError('Failed to delete trade');
    }
  };

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const calculateRiskReturnRatio = (gainsLosses, riskAmount) => {
    return riskAmount !== 0 && gainsLosses != null && riskAmount != null
      ? (gainsLosses / riskAmount).toFixed(2)
      : 'N/A';
  };

  const handleImport = (e) => {
    const file = e.target.files[0];
    Papa.parse(file, {
      header: true,
      complete: async (result) => {
        try {
          const importedTrades = result.data;
          for (const trade of importedTrades) {
            await axios.post(`${BACKEND_URL}/api/trades`, {
              date: new Date(trade.date),
              time: trade.time || '',
              ticker: trade.ticker || '',
              gainsLosses: parseFloat(trade.gainsLosses) || 0,
              riskAmount: parseFloat(trade.riskAmount) || 0,
              comments: trade.comments || '',
            });
          }
          fetchTrades();
          setError(null);
        } catch (err) {
          console.error('Import error:', err);
          setError('Failed to import trades');
        }
      },
    });
  };

  const handleExport = () => {
    const csv = Papa.unparse(trades.map(trade => ({
      date: trade.date ? new Date(trade.date).toISOString().split('T')[0] : '',
      time: trade.time || '',
      ticker: trade.ticker || '',
      gainsLosses: trade.gainsLosses != null ? trade.gainsLosses : 0,
      riskAmount: trade.riskAmount != null ? trade.riskAmount : 0,
      comments: trade.comments || '',
    })));
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'trades_export.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const chartData = {
    labels: trades.map(trade => trade.ticker + ' ' + (trade.date ? new Date(trade.date).toLocaleDateString() : '')),
    datasets: [{
      label: 'Gains/Losses',
      data: trades.map(trade => trade.gainsLosses || 0),
      backgroundColor: trades.map(trade => {
        switch (trade.ticker) {
          case 'EUR/USD': return '#4CAF50';
          case 'GBP/USD': return '#2196F3';
          case 'GBP/JPY': return '#FF9800';
          case 'XAU/USD': return '#FFD700';
          default: return '#FFFFFF';
        }
      }),
      borderColor: '#d9d9e6',
      borderWidth: 1,
    }],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      title: { display: true, text: 'Gains/Losses by Trade', color: '#d9d9e6' },
      tooltip: {
        backgroundColor: '#2a2a45',
        titleColor: '#d9d9e6',
        bodyColor: '#d9d9e6',
      },
    },
    scales: {
      x: {
        ticks: { color: '#d9d9e6' },
        grid: { color: '#3a3a5c' },
      },
      y: {
        ticks: { color: '#d9d9e6' },
        grid: { color: '#3a3a5c' },
        title: { display: true, text: 'Amount ($)', color: '#d9d9e6' },
      },
    },
  };

  return (
    <div className="App">
      <div className="header">
        <img src={Logo} alt="Logo" className="app-logo" />
        <h1>Daily Trading Journal</h1>
      </div>
      <div className="ticker-feed">
        <span>EUR/USD: {tickers['EUR/USD']} | </span>
        <span>GBP/USD: {tickers['GBP/USD']} | </span>
        <span>GBP/JPY: {tickers['GBP/JPY']} | </span>
        <span>XAU/USD: {tickers['XAU/USD']}</span>
      </div>
      {error && <div className="error">{error}</div>}
      <form onSubmit={handleSubmit}>
        <input type="date" name="date" value={form.date} onChange={handleChange} required />
        <input type="time" name="time" value={form.time} onChange={handleChange} required />
        <select name="ticker" value={form.ticker} onChange={handleChange} required>
          <option value="" disabled>Select Ticker</option>
          {tickerOptions.map(option => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
        <input type="number" name="gainsLosses" placeholder="Gains/Losses" value={form.gainsLosses} onChange={handleChange} required step="0.01" />
        <input type="number" name="riskAmount" placeholder="Risk Amount" value={form.riskAmount} onChange={handleChange} required step="0.01" />
        <textarea name="comments" placeholder="Comments" value={form.comments} onChange={handleChange}></textarea>
        <button type="submit">{editingTrade ? 'Update Trade' : 'Add Trade'}</button>
        {editingTrade && <button type="button" onClick={() => setEditingTrade(null)}>Cancel</button>}
      </form>
      <div className="import-export">
        <div className="import-export-buttons">
          <input type="file" accept=".csv" onChange={handleImport} />
          <button onClick={handleExport}>Export Trades</button>
        </div>
        <div className="profit-loss">
          <span>Profit/Loss ({period}): ${calculateProfitLoss()}</span>
          <div className="period-toggle">
            <button onClick={() => setPeriod('YTD')} className={period === 'YTD' ? 'active' : ''}>YTD</button>
            <button onClick={() => setPeriod('Monthly')} className={period === 'Monthly' ? 'active' : ''}>Monthly</button>
            <button onClick={() => setPeriod('Weekly')} className={period === 'Weekly' ? 'active' : ''}>Weekly</button>
            <button onClick={() => setPeriod('Daily')} className={period === 'Daily' ? 'active' : ''}>Daily</button>
          </div>
        </div>
      </div>
      <div className="trade-table">
        <table>
          <thead>
            <tr>
              <th onClick={() => handleSort('date')}>Date {sortBy === 'date' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}</th>
              <th onClick={() => handleSort('time')}>Time {sortBy === 'time' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}</th>
              <th onClick={() => handleSort('ticker')}>Ticker {sortBy === 'ticker' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}</th>
              <th onClick={() => handleSort('gainsLosses')}>Gains/Losses {sortBy === 'gainsLosses' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}</th>
              <th onClick={() => handleSort('riskAmount')}>Risk Amount {sortBy === 'riskAmount' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}</th>
              <th>Risk:Return Ratio</th>
              <th>Comments</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {trades.map(trade => (
              <tr key={trade._id}>
                <td>{trade.date ? new Date(trade.date).toLocaleDateString() : 'N/A'}</td>
                <td>{trade.time ? new Date(`1970-01-01T${trade.time}`).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true }) : 'N/A'}</td>
                <td>{trade.ticker || 'N/A'}</td>
                <td>{trade.gainsLosses != null ? trade.gainsLosses.toFixed(2) : '0.00'}</td>
                <td>{trade.riskAmount != null ? trade.riskAmount.toFixed(2) : '0.00'}</td>
                <td>{calculateRiskReturnRatio(trade.gainsLosses, trade.riskAmount)}</td>
                <td>{trade.comments || 'N/A'}</td>
                <td>
                  <button onClick={() => handleEdit(trade)}>Edit</button>
                  <button onClick={() => handleDelete(trade._id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="chart-container">
        <Bar data={chartData} options={chartOptions} height={300} />
      </div>
    </div>
  );
}

export default App;