const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const claudeService = require('../services/claudeService');

router.post('/analyze', express.json(), async (req, res) => {
  try {
    console.log('📥 Request recibido:', req.body);
    
    const { jobPostingId, candidateName, candidateEmail, cvText } = req.body;

    if (!jobPostingId || !candidateName || !candidateEmail || !cvText) {
      return res.status(400).json({ 
        error: 'Faltan campos requeridos',
        required: ['jobPostingId', 'candidateName', 'candidateEmail', 'cvText']
      });
    }

    console.log('✅ Buscando job posting...');

    const jobResult = await pool.query(
      'SELECT title, description, requirements FROM job_postings WHERE id = $1',
      [parseInt(jobPostingId, 10)]
    );

    if (jobResult.rows.length === 0) {
      return res.status(404).json({ error: 'Job posting no encontrado' });
    }

    const job = jobResult.rows[0];
    const jobDescription = `${job.title}\n\n${job.description || ''}`;

    console.log('🤖 Analizando con Groq...');
    const aiAnalysis = await claudeService.analyzarCV(cvText, jobDescription);
    console.log('✅ Análisis completado');

    let candidateId;
    const candidateCheck = await pool.query(
      'SELECT id FROM candidates WHERE email = $1',
      [candidateEmail]
    );

    if (candidateCheck.rows.length > 0) {
      candidateId = candidateCheck.rows[0].id;
    } else {
      const insertResult = await pool.query(
        `INSERT INTO candidates (full_name, email, cv_parsed_text)
         VALUES ($1, $2, $3) RETURNING id`,
        [candidateName, candidateEmail, cvText]
      );
      candidateId = insertResult.rows[0].id;
    }

    const applicationResult = await pool.query(
      `INSERT INTO applications (job_posting_id, candidate_id, status, ai_score, ai_analysis)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (job_posting_id, candidate_id) 
       DO UPDATE SET ai_score = $4, ai_analysis = $5
       RETURNING id`,
      [parseInt(jobPostingId, 10), candidateId, 'analyzed', aiAnalysis.score, aiAnalysis]
    );

    console.log('🎉 Proceso completado');

    res.json({
      success: true,
      applicationId: applicationResult.rows[0].id,
      candidateId,
      analysis: aiAnalysis
    });

  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({ 
      error: 'Error procesando CV', 
      details: error.message 
    });
  }
});

router.get('/applications', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT a.id, a.status, a.ai_score, a.created_at,
             c.full_name, c.email,
             j.title as job_title
      FROM applications a
      JOIN candidates c ON a.candidate_id = c.id
      JOIN job_postings j ON a.job_posting_id = j.id
      ORDER BY a.created_at DESC
      LIMIT 50
    `);

    res.json({ applications: result.rows });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Error obteniendo aplicaciones' });
  }
});

router.get('/application/:id', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT a.*, c.full_name, c.email, j.title as job_title
       FROM applications a
       JOIN candidates c ON a.candidate_id = c.id
       JOIN job_postings j ON a.job_posting_id = j.id
       WHERE a.id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Aplicación no encontrada' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Error obteniendo datos' });
  }
});
router.get('/stats', async (req, res) => {
  try {
    const stats = await pool.query(`
      SELECT 
        COUNT(*) as total_candidatos,
        COUNT(*) FILTER (WHERE ai_score >= 80) as alta_calidad,
        COUNT(*) FILTER (WHERE ai_score >= 60 AND ai_score < 80) as media_calidad,
        COUNT(*) FILTER (WHERE ai_score < 60) as baja_calidad,
        ROUND(AVG(ai_score), 2) as promedio_score
      FROM applications
      WHERE ai_score IS NOT NULL
    `);

    const recentActivity = await pool.query(`
      SELECT 
        DATE(created_at) as fecha,
        COUNT(*) as cantidad
      FROM applications
      WHERE created_at >= NOW() - INTERVAL '30 days'
      GROUP BY DATE(created_at)
      ORDER BY fecha DESC
      LIMIT 30
    `);

    res.json({
      stats: stats.rows[0],
      activity: recentActivity.rows
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Error obteniendo estadísticas' });
  }
});
module.exports = router;