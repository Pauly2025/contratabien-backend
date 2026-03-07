const express = require('express');
const router = express.Router();
const pool = require('../config/database');

router.post('/work-history', async (req, res) => {
  try {
    const { applicationId } = req.body;

    // Simulación (en producción conectar con API real)
    const verificacion = {
      status: 'verified',
      matches: 2,
      discrepancias: []
    };

    await pool.query(
      `UPDATE applications 
       SET verification_status = $1, verification_results = $2
       WHERE id = $3`,
      ['verified', verificacion, applicationId]
    );

    res.json({ success: true, verificacion });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Error verificando' });
  }
});

module.exports = router;