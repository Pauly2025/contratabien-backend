const Groq = require('groq-sdk');

const client = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

class ProfileAnalysisService {
  
  async analyzeWithProfile(cvText, profile) {
    try {
      const prompt = this.buildAnalysisPrompt(cvText, profile);
      
      const completion = await client.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [{
          role: 'user',
          content: prompt
        }],
        temperature: 0.7,
        max_tokens: 3000
      });

      const response = completion.choices[0].message.content;
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      
      if (!jsonMatch) {
        throw new Error('No se pudo extraer JSON de la respuesta');
      }
      
      const analysis = JSON.parse(jsonMatch[0]);
      
      // Calcular score final ponderado
      const finalScore = this.calculateWeightedScore(analysis, profile);
      analysis.score_final = finalScore;
      
      return analysis;
      
    } catch (error) {
      console.error('Error en análisis con perfil:', error);
      throw error;
    }
  }

  buildAnalysisPrompt(cvText, profile) {
    return `Eres un experto en reclutamiento técnico. Analiza este CV contra el perfil de cargo específico.

PERFIL DEL CARGO:
Título: ${profile.title}
Descripción: ${profile.description}

SKILLS OBLIGATORIOS (Must-Have):
${profile.must_have_skills.map(s => `- ${s}`).join('\n')}

SKILLS DESEABLES (Nice-to-Have):
${profile.nice_to_have_skills.map(s => `- ${s}`).join('\n')}

DEAL-BREAKERS (Rechazo automático si cumple):
${profile.deal_breakers.map(s => `- ${s}`).join('\n')}

VALORES CULTURALES:
${profile.cultural_values.map(s => `- ${s}`).join('\n')}

EXPERIENCIA REQUERIDA: ${profile.years_experience_min}+ años

CANDIDATO IDEAL:
${profile.ideal_candidate_example}

ANTI-PATRONES (lo que NO queremos):
${profile.anti_patterns}

---

CV DEL CANDIDATO:
${cvText}

---

INSTRUCCIONES:
Analiza el CV en 6 dimensiones. Para cada dimensión, da un score de 0-100 y justificación detallada.

Responde SOLO en este formato JSON exacto:

{
  "competencias_tecnicas": {
    "score": 85,
    "tiene": ["skill1", "skill2"],
    "falta": ["skill3"],
    "justificacion": "El candidato domina X, Y, Z..."
  },
  "experiencia": {
    "score": 90,
    "años_totales": 5,
    "años_relevantes": 4,
    "proyectos_similares": ["proyecto1", "proyecto2"],
    "justificacion": "Tiene 5 años trabajando en..."
  },
  "ajuste_cultural": {
    "score": 75,
    "valores_compartidos": ["autonomía", "aprendizaje"],
    "potenciales_conflictos": ["trabajo remoto vs presencial"],
    "justificacion": "Muestra autonomía en..."
  },
  "potencial": {
    "score": 80,
    "señales_positivas": ["aprendizaje continuo", "proyectos personales"],
    "trayectoria": "Progresión clara de junior a senior",
    "justificacion": "Demuestra capacidad de..."
  },
  "educacion": {
    "score": 70,
    "titulos": ["Ingeniería en Informática"],
    "certificaciones": ["AWS Certified"],
    "justificacion": "Formación académica sólida..."
  },
  "red_flags": {
    "score": 90,
    "señales_preocupantes": ["job hopping: 3 trabajos en 1 año"],
    "explicaciones": ["Buscaba mejor fit cultural"],
    "severidad": "media",
    "justificacion": "Algunos cambios frecuentes pero..."
  },
  "cumple_deal_breakers": false,
  "deal_breaker_detectado": null,
  "fortalezas_unicas": [
    "Experiencia liderando equipos distribuidos",
    "Contribuciones a proyectos open source",
    "Mentoreo de developers juniors"
  ],
  "areas_desarrollo": [
    "Poca experiencia con microservicios",
    "No menciona testing automatizado"
  ],
  "recomendacion": "AVANZAR - Candidato sólido con gran potencial",
  "feedback_candidato": "Tu experiencia en X es excelente. Para destacar aún más, podrías profundizar en Y y Z..."
}`;
  }

  calculateWeightedScore(analysis, profile) {
    const weights = {
      competencias_tecnicas: profile.weight_technical || 30,
      experiencia: profile.weight_experience || 25,
      ajuste_cultural: profile.weight_cultural || 20,
      potencial: profile.weight_potential || 15,
      educacion: profile.weight_education || 10
    };

    let weightedSum = 0;
    let totalWeight = 0;

    for (const [dimension, weight] of Object.entries(weights)) {
      if (analysis[dimension] && analysis[dimension].score !== undefined) {
        weightedSum += analysis[dimension].score * weight;
        totalWeight += weight;
      }
    }

    // Penalizar si cumple deal breakers
    let finalScore = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;
    
    if (analysis.cumple_deal_breakers) {
      finalScore = Math.min(finalScore, 40); // Máximo 40 si tiene deal breakers
    }

    // Bonus por red flags limpios
    if (analysis.red_flags && analysis.red_flags.score >= 90) {
      finalScore = Math.min(100, finalScore + 5);
    }

    return finalScore;
  }

  generateDecision(score, analysis) {
    if (score >= 85) return 'CONTRATAR - Candidato excepcional';
    if (score >= 75) return 'AVANZAR - Candidato muy prometedor';
    if (score >= 60) return 'CONSIDERAR - Revisar en detalle';
    if (score >= 40) return 'DUDOSO - Requiere entrevista adicional';
    return 'RECHAZAR - No cumple requisitos mínimos';
  }
}

module.exports = new ProfileAnalysisService();