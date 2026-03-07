const fs = require('fs').promises;

class PDFService {
  
  async extraerTextoPDF(filePath) {
    try {
      console.log('📄 Procesando archivo:', filePath);
      
      // Por ahora, usamos texto simulado
      // TODO: Implementar lectura real de PDF cuando pdf-parse funcione
      const text = `
        Juan Pérez
        juan@test.com
        +56912345678
        
        Desarrollador Full Stack con 5 años de experiencia.
        
        Experiencia:
        - JavaScript: 5 años
        - React: 3 años  
        - Node.js: 4 años
        - PostgreSQL: 3 años
        
        He trabajado en proyectos de e-commerce y aplicaciones web.
        Experiencia liderando equipos pequeños.
      `;
      
      return {
        text: text,
        pages: 1
      };
    } catch (error) {
      console.error('Error extrayendo PDF:', error);
      throw new Error('No se pudo procesar el PDF');
    }
  }

  async extraerDatosContacto(text) {
    const emailRegex = /[\w.-]+@[\w.-]+\.\w+/;
    const phoneRegex = /(\+?56\s?)?(\d\s?){8,}/;
    const rutRegex = /\d{1,2}\.\d{3}\.\d{3}-[\dkK]/;
    
    return {
      email: text.match(emailRegex)?.[0] || null,
      phone: text.match(phoneRegex)?.[0]?.replace(/\s/g, '') || null,
      rut: text.match(rutRegex)?.[0] || null
    };
  }
}

module.exports = new PDFService();
