const Groq = require('groq-sdk');

const client = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

class AIService {
  
  async analyzarCV(cvText, jobDescription) {
    try {
      const completion = await client.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [{
          role: 'user',
          content: `Eres un experto en reclutamiento. Analiza este CV y evalúa qué tan bien calza con el cargo.

CARGO:
${jobDescription}

CV DEL CANDIDATO:
${cvText}

Responde SOLO en formato JSON:
{
  "score": 85,
  "fortalezas": ["fortaleza1", "fortaleza2"],
  "debilidades": ["debilidad1"],
  "competencias_clave": {
    "tecnicas": ["tech1", "tech2"],
    "blandas": ["soft1"]
  },
  "experiencia_relevante": "resumen breve",
  "recomendacion": "avanza"
}`
        }],
        temperature: 0.7,
        max_tokens: 2000
      });

      const response = completion.choices[0].message.content;
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No se pudo extraer JSON');
      
      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      console.error('Error en análisis CV:', error);
      throw error;
    }
  }

  async generarPruebaCompetencias(jobTitle, competencias) {
    try {
      const completion = await client.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [{
          role: 'user',
          content: `Genera una prueba práctica para: ${jobTitle}
Competencias: ${competencias.join(', ')}

Responde SOLO en JSON:
{
  "titulo": "Prueba de...",
  "duracion_minutos": 45,
  "instrucciones": "...",
  "preguntas": [
    {
      "numero": 1,
      "tipo": "caso_practico",
      "enunciado": "...",
      "criterios_evaluacion": ["criterio1", "criterio2"]
    }
  ]
}`
        }],
        temperature: 0.8,
        max_tokens: 3000
      });

      const response = completion.choices[0].message.content;
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      console.error('Error generando prueba:', error);
      throw error;
    }
  }

  async evaluarRespuestasPrueba(preguntas, respuestas) {
    try {
      const completion = await client.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [{
          role: 'user',
          content: `Evalúa estas respuestas.

PREGUNTAS: ${JSON.stringify(preguntas)}
RESPUESTAS: ${JSON.stringify(respuestas)}

Responde SOLO en JSON con score_total, evaluacion_por_pregunta, resumen, recomendacion.`
        }],
        temperature: 0.5,
        max_tokens: 2000
      });

      const response = completion.choices[0].message.content;
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      console.error('Error evaluando:', error);
      throw error;
    }
  }

  async entrevistaConversacional(historialMensajes, jobContext) {
    try {
      const messages = [
        { 
          role: 'system', 
          content: `Eres reclutador para: ${jobContext.jobTitle}. Haz preguntas sobre experiencia, motivación, competencias: ${jobContext.competencias.join(', ')}` 
        },
        ...historialMensajes
      ];

      const completion = await client.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: messages,
        temperature: 0.8,
        max_tokens: 1000
      });

      return completion.choices[0].message.content;
    } catch (error) {
      console.error('Error en entrevista:', error);
      throw error;
    }
  }

  async generarFeedback(candidatoData, motivo) {
    try {
      const completion = await client.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [{
          role: 'user',
          content: `Genera email de feedback para ${candidatoData.nombre} que no avanzó en ${candidatoData.cargo}. 
Fortalezas: ${candidatoData.fortalezas.join(', ')}
Razón: ${motivo}

Email empático, constructivo, profesional.`
        }],
        temperature: 0.7,
        max_tokens: 800
      });

      return completion.choices[0].message.content;
    } catch (error) {
      console.error('Error generando feedback:', error);
      throw error;
    }
  }
}

module.exports = new AIService();