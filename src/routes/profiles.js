const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// Listar todos los perfiles
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT p.*, c.name as company_name
      FROM job_profiles p
      LEFT JOIN companies c ON p.company_id = c.id
      WHERE p.status = 'active'
      ORDER BY p.created_at DESC
    `);

    res.json({ profiles: result.rows });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Error obteniendo perfiles' });
  }
});

// Obtener perfil específico
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM job_profiles WHERE id = $1',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Perfil no encontrado' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Error obteniendo perfil' });
  }
});

// Crear nuevo perfil
router.post('/', express.json(), async (req, res) => {
  try {
    const {
      company_id,
      title,
      description,
      must_have_skills,
      nice_to_have_skills,
      deal_breakers,
      cultural_values,
      weight_technical,
      weight_experience,
      weight_cultural,
      weight_potential,
      weight_education,
      years_experience_min,
      years_experience_max,
      education_required,
      certifications,
      ideal_candidate_example,
      anti_patterns
    } = req.body;

    const result = await pool.query(`
      INSERT INTO job_profiles (
        company_id, title, description,
        must_have_skills, nice_to_have_skills, deal_breakers, cultural_values,
        weight_technical, weight_experience, weight_cultural, weight_potential, weight_education,
        years_experience_min, years_experience_max, education_required, certifications,
        ideal_candidate_example, anti_patterns
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      RETURNING *
    `, [
      company_id || 1,
      title,
      description,
      JSON.stringify(must_have_skills || []),
      JSON.stringify(nice_to_have_skills || []),
      JSON.stringify(deal_breakers || []),
      JSON.stringify(cultural_values || []),
      weight_technical || 30,
      weight_experience || 25,
      weight_cultural || 20,
      weight_potential || 15,
      weight_education || 10,
      years_experience_min || 0,
      years_experience_max,
      education_required,
      JSON.stringify(certifications || []),
      ideal_candidate_example,
      anti_patterns
    ]);

    res.json({ success: true, profile: result.rows[0] });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Error creando perfil', details: error.message });
  }
});

// Actualizar perfil
router.put('/:id', express.json(), async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Construir query dinámicamente
    const fields = [];
    const values = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (key !== 'id') {
        fields.push(`${key} = $${paramIndex}`);
        
        // Si es array, convertir a JSON
        if (Array.isArray(value)) {
          values.push(JSON.stringify(value));
        } else {
          values.push(value);
        }
        
        paramIndex++;
      }
    }

    fields.push(`updated_at = NOW()`);
    values.push(id);

    const query = `
      UPDATE job_profiles 
      SET ${fields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Perfil no encontrado' });
    }

    res.json({ success: true, profile: result.rows[0] });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Error actualizando perfil', details: error.message });
  }
});

// Eliminar perfil (soft delete)
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'UPDATE job_profiles SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      ['inactive', req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Perfil no encontrado' });
    }

    res.json({ success: true, message: 'Perfil desactivado' });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Error eliminando perfil' });
  }
});

module.exports = router;