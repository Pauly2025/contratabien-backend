const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const claudeService = require('../services/claudeService');

router.post('/generate', async (req, res) => {
  try {
    const { jobPostingId } = req.body;

    const jobResult = await pool.query(
      'SELECT title, requirements FROM job_postings WHERE id = $1',
      [jobPostingId]
    );

    if (jobResult.rows.length === 0) {
      return res.status(404).json({ error: 'Job posting no encontrado' });
    }

    const job = jobResult.rows[0];
    const competencias = job.requirements?.competencias_clave || [];

    const prueba = await claudeService.generarPruebaCompetencias(job.title, competencias);

    res.json({ success: true, prueba });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Error generando prueba' });
  }
});

router.post('/evaluate', async (req, res) => {
  try {
    const { applicationId, preguntas, respuestas } = req.body;

    const evaluacion = await claudeService.evaluarRespuestasPrueba(preguntas, respuestas);

    await pool.query(
      `UPDATE applications 
       SET competency_test_score = $1, competency_test_results = $2
       WHERE id = $3`,
      [evaluacion.score_total, evaluacion, applicationId]
    );

    res.json({ success: true, evaluacion });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Error evaluando' });
  }
});

module.exports = router;