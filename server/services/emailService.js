const axios = require('axios');

class EmailService {
  constructor() {
    // EmailJS configuration
    this.serviceId = process.env.EMAILJS_SERVICE_ID;
    this.templateId = process.env.EMAILJS_TEMPLATE_ID;
    this.publicKey = process.env.EMAILJS_PUBLIC_KEY;
    this.userId = process.env.EMAILJS_USER_ID || this.publicKey; // User ID is often the same as public key
  }

  // Send email using EmailJS REST API
  async sendEmail(templateParams) {
    try {
      if (!this.isConfigured()) {
        throw new Error('EmailJS not configured. Please check environment variables.');
      }

      const response = await axios.post('https://api.emailjs.com/api/v1.0/email/send', {
        service_id: this.serviceId,
        template_id: this.templateId,
        user_id: this.userId,
        template_params: templateParams
      });

      if (response.status === 200) {
        console.log('Email sent successfully via EmailJS API');
        return { success: true, message: 'Email sent successfully' };
      } else {
        throw new Error(`EmailJS API returned status: ${response.status}`);
      }
    } catch (error) {
      console.error('Failed to send email via EmailJS API:', error.message);
      return { success: false, error: error.message };
    }
  }

  // Send email notification for letter request
  async sendLetterRequestNotification(employeeData, adminEmail) {
    try {
      const templateParams = {
        to_email: adminEmail,
        to_name: 'HR Administrator',
        from_name: 'HR Letter Generator System',
        subject: 'New Letter Request Submitted',
        employee_name: employeeData.employeeName,
        employee_id: employeeData.employeeId,
        letter_type: employeeData.letterType,
        request_date: new Date(employeeData.requestDate).toLocaleDateString(),
        message: `A new letter request has been submitted by ${employeeData.employeeName} (ID: ${employeeData.employeeId}) for ${employeeData.letterType}. Please review and process this request.`
      };

      return await this.sendEmail(templateParams);
    } catch (error) {
      console.error('Failed to send letter request notification:', error);
      return { success: false, error: error.message };
    }
  }

  // Send email notification for letter approval
  async sendLetterApprovalNotification(employeeData, adminEmail) {
    try {
      const templateParams = {
        to_email: employeeData.employeeEmail || 'employee@company.com',
        to_name: employeeData.employeeName,
        from_name: 'HR Department',
        subject: 'Letter Request Approved',
        employee_name: employeeData.employeeName,
        employee_id: employeeData.employeeId,
        letter_type: employeeData.letterType,
        approval_date: new Date().toLocaleDateString(),
        message: `Your letter request for ${employeeData.letterType} has been approved. The letter has been generated and is ready for processing.`
      };

      return await this.sendEmail(templateParams);
    } catch (error) {
      console.error('Failed to send approval email:', error);
      return { success: false, error: error.message };
    }
  }

  // Send email notification for letter rejection
  async sendLetterRejectionNotification(employeeData, adminEmail, rejectionReason) {
    try {
      const templateParams = {
        to_email: employeeData.employeeEmail || 'employee@company.com',
        to_name: employeeData.employeeName,
        from_name: 'HR Department',
        subject: 'Letter Request Update',
        employee_name: employeeData.employeeName,
        employee_id: employeeData.employeeId,
        letter_type: employeeData.letterType,
        rejection_date: new Date().toLocaleDateString(),
        rejection_reason: rejectionReason || 'No specific reason provided',
        message: `Your letter request for ${employeeData.letterType} could not be processed at this time. Reason: ${rejectionReason || 'No specific reason provided'}. Please contact HR for more information.`
      };

      return await this.sendEmail(templateParams);
    } catch (error) {
      console.error('Failed to send rejection email:', error);
      return { success: false, error: error.message };
    }
  }

  // Send email notification for letter completion
  async sendLetterCompletionNotification(employeeData, adminEmail) {
    try {
      const templateParams = {
        to_email: employeeData.employeeEmail || 'employee@company.com',
        to_name: employeeData.employeeName,
        from_name: 'HR Department',
        subject: 'Letter Request Completed',
        employee_name: employeeData.employeeName,
        employee_id: employeeData.employeeId,
        letter_type: employeeData.letterType,
        completion_date: new Date().toLocaleDateString(),
        message: `Your letter request for ${employeeData.letterType} has been completed and signed. The letter is now ready for use. Please contact HR to collect your letter.`
      };

      return await this.sendEmail(templateParams);
    } catch (error) {
      console.error('Failed to send completion email:', error);
      return { success: false, error: error.message };
    }
  }

  // Send DocuSign signing notification
  async sendDocuSignNotification(employeeData, adminEmail, signingUrl) {
    try {
      const templateParams = {
        to_email: adminEmail,
        to_name: 'HR Administrator',
        from_name: 'HR Letter Generator System',
        subject: 'Letter Ready for DocuSign Signing',
        employee_name: employeeData.employeeName,
        employee_id: employeeData.employeeId,
        letter_type: employeeData.letterType,
        signing_url: signingUrl,
        message: `The letter for ${employeeData.employeeName} (${employeeData.letterType}) is ready for signing in DocuSign. Please click the signing link to complete the process.`
      };

      return await this.sendEmail(templateParams);
    } catch (error) {
      console.error('Failed to send DocuSign notification email:', error);
      return { success: false, error: error.message };
    }
  }

  // Check if EmailJS is properly configured
  isConfigured() {
    return !!(this.serviceId && this.templateId && this.publicKey);
  }

  // Get configuration status
  getConfigurationStatus() {
    return {
      serviceId: !!this.serviceId,
      templateId: !!this.templateId,
      publicKey: !!this.publicKey,
      fullyConfigured: this.isConfigured()
    };
  }
}

module.exports = EmailService;
