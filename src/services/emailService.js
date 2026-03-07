// Servicio de email deshabilitado temporalmente
class EmailService {
  async enviarEmailConfirmacion(candidato, jobTitle) {
    console.log(`📧 [SIMULADO] Email a ${candidato.email} para ${jobTitle}`);
  }

  async enviarFeedbackRechazo(candidato, feedbackText) {
    console.log(`📧 [SIMULADO] Feedback a ${candidato.email}`);
  }

  async enviarNotificacionCliente(clienteEmail, jobTitle, update) {
    console.log(`📧 [SIMULADO] Notificación a ${clienteEmail}`);
  }
}

module.exports = new EmailService();