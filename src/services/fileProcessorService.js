const pdf = require('pdf-parse');
const mammoth = require('mammoth');
const fs = require('fs').promises;
const Tesseract = require('tesseract.js');

class FileProcessorService {
  
  async processFile(filePath, mimeType) {
    console.log('📄 Procesando archivo:', filePath, 'tipo:', mimeType);
    
    try {
      switch(mimeType) {
        case 'application/pdf':
          return await this.processPDF(filePath);
        
        case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        case 'application/msword':
          return await this.processDOCX(filePath);
        
        case 'text/plain':
          return await this.processTXT(filePath);
        
        case 'image/jpeg':
        case 'image/png':
          return await this.processImage(filePath);
        
        default:
          return await this.processTXT(filePath);
      }
    } catch (error) {
      console.error('Error procesando archivo:', error);
      throw new Error(`No se pudo procesar el archivo: ${error.message}`);
    }
  }

  async processPDF(filePath) {
    try {
      const dataBuffer = await fs.readFile(filePath);
      
      let data;
      try {
        data = await pdf(dataBuffer);
      } catch (pdfError) {
        console.warn('⚠️ Error parseando PDF:', pdfError.message);
        return {
          text: '',
          pages: 1,
          method: 'pdf-parse-fallback',
          error: 'No se pudo extraer texto del PDF'
        };
      }
      
      let text = data.text || '';
      text = text.replace(/\s+/g, ' ').trim();
      
      if (text.length < 50) {
        console.log('📸 PDF tiene poco texto');
        return {
          text: text || 'PDF vacío',
          pages: data.numpages || 1,
          method: 'pdf-parse-minimal'
        };
      }
      
      return {
        text: text,
        pages: data.numpages || 1,
        method: 'pdf-parse'
      };
    } catch (error) {
      console.error('❌ Error procesando PDF:', error);
      throw new Error(`Error leyendo PDF: ${error.message}`);
    }
  }

  async processDOCX(filePath) {
    const dataBuffer = await fs.readFile(filePath);
    const result = await mammoth.extractRawText({ buffer: dataBuffer });
    
    return {
      text: result.value.trim(),
      pages: 1,
      method: 'mammoth',
      warnings: result.messages
    };
  }

  async processTXT(filePath) {
    const text = await fs.readFile(filePath, 'utf-8');
    
    return {
      text: text.trim(),
      pages: 1,
      method: 'plain-text'
    };
  }

  async processImage(filePath) {
    console.log('🔍 Procesando imagen con OCR...');
    
    const { data: { text } } = await Tesseract.recognize(
      filePath,
      'spa+eng',
      {
        logger: m => console.log('OCR:', m.status)
      }
    );
    
    return {
      text: text.trim(),
      pages: 1,
      method: 'tesseract-ocr'
    };
  }

  extractContactInfo(text) {
    const emailRegex = /[\w.-]+@[\w.-]+\.\w+/g;
    const phoneRegex = /(\+?56\s?)?(\d[\s.-]?){8,}/g;
    const rutRegex = /\d{1,2}\.?\d{3}\.?\d{3}-?[\dkK]/g;
    
    const emails = text.match(emailRegex) || [];
    const phones = text.match(phoneRegex) || [];
    const ruts = text.match(rutRegex) || [];
    
    return {
      email: emails[0] || null,
      emails: emails,
      phone: phones[0]?.replace(/\s/g, '') || null,
      phones: phones.map(p => p.replace(/\s/g, '')),
      rut: ruts[0] || null,
      ruts: ruts
    };
  }

  extractName(text) {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l);
    
    for (let i = 0; i < Math.min(5, lines.length); i++) {
      const line = lines[i];
      const words = line.split(' ').filter(w => w);
      
      if (words.length >= 2 && words.length <= 4 && /^[A-ZÁÉÍÓÚÑ]/.test(line)) {
        if (!/@/.test(line) && !/\d{3,}/.test(line)) {
          return line;
        }
      }
    }
    
    return null;
  }

  async extractMetadata(filePath, mimeType) {
    const stats = await fs.stat(filePath);
    
    return {
      size: stats.size,
      sizeKB: Math.round(stats.size / 1024),
      mimeType: mimeType,
      uploadedAt: new Date()
    };
  }
}

module.exports = new FileProcessorService();