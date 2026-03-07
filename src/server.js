require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// CORS más permisivo para producción
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const cvRoutes = require('./routes/cv');
const competencyRoutes = require('./routes/competency');
const interviewRoutes = require('./routes/interview');
const verificationRoutes = require('./routes/verification');

app.use('/api/cv', cvRoutes);
app.use('/api/competency-test', competencyRoutes);
app.use('/api/interview', interviewRoutes);
app.use('/api/verification', verificationRoutes);

app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV 
  });
});

app.get('/', (req, res) => {
  res.json({ 
    message: 'Contratabien API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      cv: '/api/cv/*',
      stats: '/api/cv/stats'
    }
  });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Error interno del servidor',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
  console.log(`📊 Ambiente: ${process.env.NODE_ENV}`);
  console.log(`🌍 CORS habilitado para: ${process.env.FRONTEND_URL || '*'}`);
});