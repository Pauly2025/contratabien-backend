const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const claudeService = require('../services/claudeService');

router.post('/message', async (req, res) => {
  try {
    const { applicationId, message, historial } = req.body;

    const appResult = await pool.query(
      `SELECT j.title, j.requirements
       FROM applications a
       JOIN job_postings j ON a.job_posting_id = j.id
       WHERE a.id = $1`,
      [applicationId]
    );

    if (appResult.rows.length === 0) {
      return res.status(404).json({ error: 'Aplicación no encontrada' });
    }

    const job = appResult.rows[0];
    const mensajes = historial.map(msg => ({ role: msg.role, content: msg.content }));
    mensajes.push({ role: 'user', content: message });

    const respuesta = await claudeService.entrevistaConversacional(mensajes, {
      jobTitle: job.title,
      competencias: job.requirements?.competencias_clave || []
    });

    const nuevoHistorial = [...historial, 
      { role: 'user', content: message },
      { role: 'assistant', content: respuesta }
    ];

    await pool.query(
      `UPDATE applications SET interview_transcript = $1 WHERE id = $2`,
      [JSON.stringify(nuevoHistorial), applicationId]
    );

    res.json({ success: true, respuesta, historial: nuevoHistorial });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Error en entrevista' });
  }
});

module.exports = router;