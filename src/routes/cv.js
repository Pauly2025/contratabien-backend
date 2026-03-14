const express = require('express');
const router = express.Router();
const formidableModule = require('formidable');
const formidable = formidableModule.formidable || formidableModule;
const pool = require('../config/database');
const claudeService = require('../services/claudeService');
const fileProcessorService = require('../services/fileProcessorService');
const emailService = require('../services/emailService');
const fs = require('fs').promises;
const profileAnalysisService = require('../services/profileAnalysisService');

router.post('/analyze', async (req, res) => {
  const form = formidable({
    uploadDir: 'uploads',
    keepExtensions: true,
    maxFileSize: 10 * 1024 * 1024, // 10MB
    multiples: false
  });

  form.parse(req, async (err, fields, files) => {
    try {
      if (err) {
        console.error('❌ Error parseando form:', err);
        return res.status(400).json({ error: 'Error procesando formulario' });
      }

      console.log('📥 Datos recibidos');

      const jobPostingId = fields.jobPostingId?.[0] || fields.jobPostingId;
      const candidateName = fields.candidateName?.[0] || fields.candidateName;
      const candidateEmail = fields.candidateEmail?.[0] || fields.candidateEmail;
      const cvText = fields.cvText?.[0] || fields.cvText;
      const cvFile = files.cvFile?.[0] || files.cvFile;

      if (!jobPostingId) {
        return res.status(400).json({ error: 'jobPostingId es requerido' });
      }

      let finalCvText;
      let extractedContact = {};
      let extractedName = null;
      let processingMethod = 'manual-text';

      // Procesar archivo si existe
      if (cvFile) {
        console.log('📄 Procesando archivo:', cvFile.originalFilename);
        
        const processed = await fileProcessorService.processFile(
          cvFile.filepath, 
          cvFile.mimetype || 'application/pdf'
        );

        finalCvText = processed.text;
        extractedContact = fileProcessorService.extractContactInfo(finalCvText);
        extractedName = fileProcessorService.extractName(finalCvText);
        processingMethod = processed.method;

        console.log('✅ Archivo procesado:', {
          method: processingMethod,
          pages: processed.pages,
          textLength: finalCvText.length,
          extractedName: extractedName,
          extractedEmail: extractedContact.email
        });
      } else if (cvText) {
        // Si no hay archivo, usar texto manual
        finalCvText = cvText;
        extractedContact = fileProcessorService.extractContactInfo(cvText);
        extractedName = fileProcessorService.extractName(cvText);
        processingMethod = 'manual-text';
      } else {
        return res.status(400).json({ error: 'Debes subir un archivo CV o proporcionar texto' });
      }

      if (!finalCvText || finalCvText.length < 50) {
        return res.status(400).json({ 
          error: 'El CV está vacío o es muy corto',
          details: 'Verifica que el archivo contenga texto legible'
        });
      }

      // Usar datos extraídos si no vienen del formulario
      const finalCandidateName = candidateName || extractedName || 'Candidato sin nombre';
      const finalCandidateEmail = candidateEmail || extractedContact.email || `temp-${Date.now()}@contratabien.cl`;

      console.log('👤 Candidato:', {
        nombre: finalCandidateName,
        email: finalCandidateEmail,
        metodo: processingMethod
      });

      // Obtener job posting
      const jobResult = await pool.query(
        'SELECT title, description, requirements FROM job_postings WHERE id = $1',
        [parseInt(jobPostingId, 10)]
      );

      if (jobResult.rows.length === 0) {
        return res.status(404).json({ error: 'Job posting no encontrado' });
      }

      const job = jobResult.rows[0];
      const jobDescription = `${job.title}\n\n${job.description || ''}`;

     console.log('🤖 Analizando con IA...');

let aiAnalysis;

// Si el job tiene perfil asociado, usar análisis multidimensional
if (job.profile_id) {
  const profileResult = await pool.query(
    'SELECT * FROM job_profiles WHERE id = $1',
    [job.profile_id]
  );

  if (profileResult.rows.length > 0) {
    const profile = profileResult.rows[0];
    console.log('📊 Usando análisis multidimensional con perfil:', profile.title);
    
    aiAnalysis = await profileAnalysisService.analyzeWithProfile(finalCvText, profile);
    aiAnalysis.profile_used = {
      id: profile.id,
      title: profile.title
    };
  } else {
    // Fallback a análisis simple
    aiAnalysis = await claudeService.analyzarCV(finalCvText, jobDescription);
  }
} else {
  // Análisis simple sin perfil
  aiAnalysis = await claudeService.analyzarCV(finalCvText, jobDescription);
}

console.log('✅ Análisis completado');

      // Verificar o crear candidato
      let candidateId;
      const candidateCheck = await pool.query(
        'SELECT id FROM candidates WHERE email = $1',
        [finalCandidateEmail]
      );

      if (candidateCheck.rows.length > 0) {
        candidateId = candidateCheck.rows[0].id;
        
        // Actualizar datos del candidato
        await pool.query(
          `UPDATE candidates 
           SET full_name = $1, phone = $2, cv_file_path = $3, cv_parsed_text = $4
           WHERE id = $5`,
          [
            finalCandidateName, 
            extractedContact.phone, 
            cvFile?.filepath || null, 
            finalCvText,
            candidateId
          ]
        );
      } else {
        const insertResult = await pool.query(
          `INSERT INTO candidates (full_name, email, phone, rut, cv_file_path, cv_parsed_text)
           VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
          [
            finalCandidateName, 
            finalCandidateEmail, 
            extractedContact.phone, 
            extractedContact.rut,
            cvFile?.filepath || null, 
            finalCvText
          ]
        );
        candidateId = insertResult.rows[0].id;
      }

      // Crear o actualizar aplicación
      const applicationResult = await pool.query(
        `INSERT INTO applications (job_posting_id, candidate_id, status, ai_score, ai_analysis)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (job_posting_id, candidate_id) 
         DO UPDATE SET ai_score = $4, ai_analysis = $5, updated_at = NOW()
         RETURNING id`,
        [parseInt(jobPostingId, 10), candidateId, 'analyzed', aiAnalysis.score, aiAnalysis]
      );

      // Enviar email de confirmación (solo si es email real)
      if (!finalCandidateEmail.includes('@temp.') && !finalCandidateEmail.includes('contratabien.cl')) {
        try {
          await emailService.enviarEmailConfirmacion(
            { nombre: finalCandidateName, email: finalCandidateEmail },
            job.title
          );
        } catch (emailError) {
          console.warn('⚠️ No se pudo enviar email:', emailError.message);
        }
      }

      console.log('🎉 Proceso completado');

      // Limpiar archivo temporal después de un tiempo
      if (cvFile) {
        setTimeout(async () => {
          try {
            await fs.unlink(cvFile.filepath);
            console.log('🗑️ Archivo temporal eliminado');
          } catch (e) {
            // Ignorar error si ya fue eliminado
          }
        }, 60000); // 1 minuto
      }

      res.json({
        success: true,
        applicationId: applicationResult.rows[0].id,
        candidateId,
        analysis: aiAnalysis,
        metadata: {
          processingMethod,
          extractedData: {
            name: extractedName,
            email: extractedContact.email,
            phone: extractedContact.phone
          }
        }
      });

    } catch (error) {
      console.error('❌ Error completo:', error);
      res.status(500).json({ 
        error: 'Error procesando CV', 
        details: error.message 
      });
    }
  });
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
      `SELECT a.*, c.full_name, c.email, c.phone, c.cv_parsed_text, j.title as job_title
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