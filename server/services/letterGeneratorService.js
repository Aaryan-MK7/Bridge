const { Document, Packer, Paragraph, TextRun, AlignmentType, HeadingLevel, Table, TableRow, TableCell, WidthType } = require('docx');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');
const fs = require('fs');
const path = require('path');

class LetterGeneratorService {
  constructor() {
    // Prefer root-level public/templates; fallback to backend/public/templates
    const rootTemplates = path.join(__dirname, '../../../public/templates');
    const backendTemplates = path.join(__dirname, '../../public/templates');
    this.templatesPath = fs.existsSync(rootTemplates) ? rootTemplates : backendTemplates;
  }

  // Get the template file path for a letter type
  getTemplatePath(letterType) {
    const templateMap = {

      // Map letter types to the updated DOCX template filenames
      'visa_letter': 'visa_letter.docx',
      'visa': 'visa_letter.docx',
      'visaletter': 'visa_letter.docx',
      'certification_reimbursement': 'certification_reimbursement.docx',
      'certification': 'certification_reimbursement.docx',
      'certificationreimbursement': 'certification_reimbursement.docx',
      'internship_completion': 'internship_completion.docx',
      'internship': 'internship_completion.docx',
      'internshipcompletion': 'internship_completion.docx',
      'hr_letter': 'hrletter.docx',
      'hrletter': 'hrletter.docx',
      'travel_noc': 'travelnoc.docx',
      'travel_noc_letter': 'travelnoc.docx',
      'travelnoc': 'travelnoc.docx',

      // Generic letter types (fallback)
      'experience': 'experience_certificate.docx',
      'salary': 'salary_certificate.docx',
      'no objection': 'no_objection_certificate.docx',
      'relieving': 'relieving_letter.docx',
      'appointment': 'appointment_letter.docx',
      'promotion': 'promotion_letter.docx',
      'transfer': 'transfer_letter.docx',
      'termination': 'termination_letter.docx',

      // Additional mappings for common variations
      'experience certificate': 'experience_certificate.docx',
      'salary certificate': 'salary_certificate.docx',
      'no objection certificate': 'no_objection_certificate.docx',
      'relieving letter': 'relieving_letter.docx',
      'appointment letter': 'appointment_letter.docx',
      'promotion letter': 'promotion_letter.docx',
      'transfer letter': 'transfer_letter.docx',
      'termination letter': 'termination_letter.docx'
    };

    const normalizedType = letterType.toLowerCase().trim();
    let templateFile = templateMap[normalizedType];

    // If not in map, try direct filename match `${type}.docx`
    if (!templateFile) {
      const direct = path.join(this.templatesPath, `${normalizedType}.docx`);
      if (fs.existsSync(direct)) return direct;
    }

    if (!templateFile) {
      throw new Error(`No template found for letter type: ${letterType}`);
    }

    const templatePath = path.join(this.templatesPath, templateFile);
    if (!fs.existsSync(templatePath)) {
      throw new Error(`Template file not found: ${templatePath}`);
    }
    return templatePath;
  }

  // Build data object for DOCX template placeholders
  buildTemplateData(employeeDetails) {
    const currentDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // Format additional details
    let additionalDetails = 'No additional details provided';
    if (employeeDetails.details && Object.keys(employeeDetails.details).length > 0) {
      additionalDetails = Object.entries(employeeDetails.details)
        .map(([key, value]) => `• ${key}: ${value}`)
        .join('\n');
    }

    // Format employee comments
    let employeeComments = 'No comments provided';
    if (employeeDetails.employeeComments && employeeDetails.employeeComments.trim()) {
      employeeComments = employeeDetails.employeeComments;
    }

    // Extract specific fields from details for common placeholders
    const department = employeeDetails.details?.Department || employeeDetails.details?.department || 'N/A';
    const position = employeeDetails.details?.Position || employeeDetails.details?.position || 'N/A';
    const startDate = employeeDetails.details?.['Start Date'] || employeeDetails.details?.['start_date'] || 'N/A';
    const salary = employeeDetails.details?.Salary || employeeDetails.details?.salary || 'N/A';
    const endDate = employeeDetails.details?.['End Date'] || employeeDetails.details?.['end_date'] || 'N/A';
    const projectName = employeeDetails.details?.['Project Name'] || employeeDetails.details?.['project_name'] || 'N/A';
    const destination = employeeDetails.details?.Destination || employeeDetails.details?.destination || 'N/A';
    const travelDates = employeeDetails.details?.['Travel Dates'] || employeeDetails.details?.['travel_dates'] || 'N/A';
    const travelPurpose = employeeDetails.details?.['Travel Purpose'] || employeeDetails.details?.['travel_purpose'] || 'N/A';
    const certificationName = employeeDetails.details?.['Certification Name'] || employeeDetails.details?.['certification_name'] || 'N/A';
    const certificationCost = employeeDetails.details?.['Certification Cost'] || employeeDetails.details?.['certification_cost'] || 'N/A';

    // Base data map for docxtemplater placeholders
    const base = {
      CURRENT_DATE: currentDate,
      EMPLOYEE_NAME: employeeDetails.employeeName || 'N/A',
      EMPLOYEE_ID: employeeDetails.employeeId || 'N/A',
      REQUEST_DATE: new Date(employeeDetails.requestDate).toLocaleDateString(),
      LETTER_TYPE: employeeDetails.letterType || 'N/A',
      ADDITIONAL_DETAILS: additionalDetails,
      EMPLOYEE_COMMENTS: employeeComments,
      DEPARTMENT: department,
      POSITION: position,
      START_DATE: startDate,
      SALARY: salary,
      END_DATE: endDate,
      PROJECT_NAME: projectName,
      DESTINATION: destination,
      TRAVEL_DATES: travelDates,
      TRAVEL_PURPOSE: travelPurpose,
      CERTIFICATION_NAME: certificationName,
      CERTIFICATION_COST: certificationCost
    };

    // Provide common alias keys so templates can use different naming styles
    const withAliases = (data) => {
      const out = { ...data };
      const add = (k, v) => { out[k] = v; };
      add('current_date', base.CURRENT_DATE); add('CurrentDate', base.CURRENT_DATE); add('Date', base.CURRENT_DATE);
      add('employee_name', base.EMPLOYEE_NAME); add('EmployeeName', base.EMPLOYEE_NAME); add('Name', base.EMPLOYEE_NAME);
      add('employee_id', base.EMPLOYEE_ID); add('EmployeeID', base.EMPLOYEE_ID); add('EmployeeId', base.EMPLOYEE_ID);
      add('request_date', base.REQUEST_DATE); add('RequestDate', base.REQUEST_DATE);
      add('letter_type', base.LETTER_TYPE); add('LetterType', base.LETTER_TYPE);
      add('additional_details', base.ADDITIONAL_DETAILS); add('AdditionalDetails', base.ADDITIONAL_DETAILS);
      add('employee_comments', base.EMPLOYEE_COMMENTS); add('EmployeeComments', base.EMPLOYEE_COMMENTS);
      add('department', base.DEPARTMENT); add('Department', base.DEPARTMENT);
      add('position', base.POSITION); add('Position', base.POSITION);
      add('start_date', base.START_DATE); add('StartDate', base.START_DATE);
      add('salary', base.SALARY); add('Salary', base.SALARY);
      add('end_date', base.END_DATE); add('EndDate', base.END_DATE);
      add('project_name', base.PROJECT_NAME); add('ProjectName', base.PROJECT_NAME);
      add('destination', base.DESTINATION); add('Destination', base.DESTINATION);
      add('travel_dates', base.TRAVEL_DATES); add('TravelDates', base.TRAVEL_DATES);
      add('travel_purpose', base.TRAVEL_PURPOSE); add('TravelPurpose', base.TRAVEL_PURPOSE);
      add('certification_name', base.CERTIFICATION_NAME); add('CertificationName', base.CERTIFICATION_NAME); add('CourseName', base.CERTIFICATION_NAME);
      add('certification_cost', base.CERTIFICATION_COST); add('CertificationCost', base.CERTIFICATION_COST); add('Amount', base.CERTIFICATION_COST);
      return out;
    };

    return withAliases(base);
  }

  // Generate letter by filling the DOCX template placeholders
  async generateLetterFromTemplate(letterType, employeeDetails) {
    try {
      // Get the template file path
      const templatePath = this.getTemplatePath(letterType);

      // Load DOCX from Buffer (more robust for zipped binaries)
      const templateBuffer = fs.readFileSync(templatePath);
      const zip = new PizZip(templateBuffer);

      // If the template contains {{...}} placeholders, use docxtemplater
      const documentXml = zip.file('word/document.xml')?.asText() || '';
      const hasCurlyTags = documentXml.includes('{{');

      if (hasCurlyTags) {
        const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });
        const data = this.buildTemplateData(employeeDetails);
        doc.setData(data);
        try {
          doc.render();
        } catch (renderError) {
          console.error('Docxtemplater render error:', renderError);
          throw renderError;
        }
        return doc.getZip().generate({ type: 'nodebuffer' });
      }

      // Otherwise, perform token replacement for plain yellow tokens (e.g., DD-MM-YY, XYZ, STI0XYZ)
      const tokenMap = this.buildTokenMap(letterType, employeeDetails);

      // Replace tokens inside all xml files within word/ to preserve formatting
      Object.keys(zip.files)
        .filter((name) => name.startsWith('word/') && name.endsWith('.xml'))
        .forEach((name) => {
          let content = zip.file(name).asText();
          for (const [token, value] of Object.entries(tokenMap)) {
            // Replace whole-word tokens; keep simple to avoid corrupting XML
            const safeValue = this.escapeXml(String(value));
            const regex = new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
            content = content.replace(regex, safeValue);
          }
          zip.file(name, content);
        });

      return zip.generate({ type: 'nodebuffer' });
    } catch (error) {
      console.error('❌ Error generating letter from template:', error);
      throw new Error(`Failed to generate letter from template: ${error.message}`);
    }
  }

  // Build a map of simple tokens used in legacy yellow-highlight templates
  buildTokenMap(letterType, employeeDetails) {
    const twoDigit = (n) => String(n).padStart(2, '0');
    const now = new Date();
    const ddmmyy = `${twoDigit(now.getDate())}-${twoDigit(now.getMonth() + 1)}-${String(now.getFullYear()).slice(-2)}`;
    const requestDate = new Date(employeeDetails.requestDate || now);
    const reqDdmmyy = `${twoDigit(requestDate.getDate())}-${twoDigit(requestDate.getMonth() + 1)}-${String(requestDate.getFullYear()).slice(-2)}`;

    const details = employeeDetails.details || {};
    const certificationCost = details['Certification Cost'] || details['certification_cost'] || details['Amount'] || details['amount'] || '';
    const certificationName = details['Certification Name'] || details['certification_name'] || details['Course name'] || details['course_name'] || '';

    // Base tokens (apply across templates if found)
    const base = {
      'DD-MM-YY': reqDdmmyy,
      'Employee Name': employeeDetails.employeeName || '',
      'Employee name': employeeDetails.employeeName || '',
      'STI0XYZ': employeeDetails.employeeId || '',
      'Course name': certificationName,
      'Employee ID': employeeDetails.employeeId || ''
    };

    // Ambiguous token 'XYZ': in reimbursement template this is amount; otherwise leave as-is
    if (String(certificationCost).length > 0) {
      base['XYZ'] = certificationCost;
    }

    // Allow more per-type overrides if needed
    switch ((letterType || '').toLowerCase()) {
      case 'certification_reimbursement':
      case 'certification':
        base['XYZ'] = certificationCost;
        break;
      default:
        break;
    }

    return base;
  }

  // Minimal XML escaping for token values
  escapeXml(value) {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  // Generate letter content based on letter type and employee details (fallback method)
  generateLetterContent(letterType, employeeDetails) {
    const currentDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    switch (letterType.toLowerCase()) {
      case 'experience':
        return this.generateExperienceLetter(employeeDetails, currentDate);
      case 'salary':
        return this.generateSalaryLetter(employeeDetails, currentDate);
      case 'no objection':
        return this.generateNoObjectionLetter(employeeDetails, currentDate);
      case 'relieving':
        return this.generateRelievingLetter(employeeDetails, currentDate);
      case 'appointment':
        return this.generateAppointmentLetter(employeeDetails, currentDate);
      case 'promotion':
        return this.generatePromotionLetter(employeeDetails, currentDate);
      case 'transfer':
        return this.generateTransferLetter(employeeDetails, currentDate);
      case 'termination':
        return this.generateTerminationLetter(employeeDetails, currentDate);
      default:
        return this.generateGenericLetter(employeeDetails, currentDate);
    }
  }

  // Generate Experience Letter
  generateExperienceLetter(employee, currentDate) {
    const doc = new Document({
      sections: [{
        properties: {},
        children: [
          new Paragraph({
            text: "EXPERIENCE CERTIFICATE",
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 }
          }),
          new Paragraph({
            text: `Date: ${currentDate}`,
            alignment: AlignmentType.RIGHT,
            spacing: { after: 400 }
          }),
          new Paragraph({
            text: `This is to certify that Mr./Ms. ${employee.employeeName} (Employee ID: ${employee.employeeId}) has been working with our organization.`,
            spacing: { after: 200 }
          }),
          new Paragraph({
            text: `Employee Details:`,
            heading: HeadingLevel.HEADING_2,
            spacing: { after: 200 }
          }),
          new Paragraph({
            text: `• Employee Name: ${employee.employeeName}`,
            spacing: { after: 100 }
          }),
          new Paragraph({
            text: `• Employee ID: ${employee.employeeId}`,
            spacing: { after: 100 }
          }),
          new Paragraph({
            text: `• Request Date: ${new Date(employee.requestDate).toLocaleDateString()}`,
            spacing: { after: 200 }
          }),
          ...(employee.details && Object.keys(employee.details).length > 0 ? [
            new Paragraph({
              text: "Additional Details:",
              heading: HeadingLevel.HEADING_2,
              spacing: { after: 200 }
            }),
            ...Object.entries(employee.details).map(([key, value]) =>
              new Paragraph({
                text: `• ${key}: ${value}`,
                spacing: { after: 100 }
              })
            )
          ] : []),
          ...(employee.employeeComments ? [
            new Paragraph({
              text: "Employee Comments:",
              heading: HeadingLevel.HEADING_2,
              spacing: { after: 200 }
            }),
            new Paragraph({
              text: employee.employeeComments,
              spacing: { after: 400 }
            })
          ] : []),
          new Paragraph({
            text: "This certificate is issued upon the request of the employee and is valid for all official purposes.",
            spacing: { after: 400 }
          }),
          new Paragraph({
            text: "For Company Name",
            spacing: { after: 200 }
          }),
          new Paragraph({
            text: "_________________",
            spacing: { after: 100 }
          }),
          new Paragraph({
            text: "Authorized Signature",
            spacing: { after: 100 }
          })
        ]
      }]
    });

    return doc;
  }

  // Generate Salary Letter
  generateSalaryLetter(employee, currentDate) {
    const doc = new Document({
      sections: [{
        properties: {},
        children: [
          new Paragraph({
            text: "SALARY CERTIFICATE",
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 }
          }),
          new Paragraph({
            text: `Date: ${currentDate}`,
            alignment: AlignmentType.RIGHT,
            spacing: { after: 400 }
          }),
          new Paragraph({
            text: `This is to certify that Mr./Ms. ${employee.employeeName} (Employee ID: ${employee.employeeId}) is employed with our organization.`,
            spacing: { after: 200 }
          }),
          new Paragraph({
            text: `Employee Details:`,
            heading: HeadingLevel.HEADING_2,
            spacing: { after: 200 }
          }),
          new Paragraph({
            text: `• Employee Name: ${employee.employeeName}`,
            spacing: { after: 100 }
          }),
          new Paragraph({
            text: `• Employee ID: ${employee.employeeId}`,
            spacing: { after: 100 }
          }),
          new Paragraph({
            text: `• Request Date: ${new Date(employee.requestDate).toLocaleDateString()}`,
            spacing: { after: 200 }
          }),
          ...(employee.details && Object.keys(employee.details).length > 0 ? [
            new Paragraph({
              text: "Additional Details:",
              heading: HeadingLevel.HEADING_2,
              spacing: { after: 200 }
            }),
            ...Object.entries(employee.details).map(([key, value]) =>
              new Paragraph({
                text: `• ${key}: ${value}`,
                spacing: { after: 100 }
              })
            )
          ] : []),
          new Paragraph({
            text: "This certificate is issued for salary verification purposes and is valid for all official requirements.",
            spacing: { after: 400 }
          }),
          new Paragraph({
            text: "For Company Name",
            spacing: { after: 200 }
          }),
          new Paragraph({
            text: "_________________",
            spacing: { after: 100 }
          }),
          new Paragraph({
            text: "Authorized Signature",
            spacing: { after: 100 }
          })
        ]
      }]
    });

    return doc;
  }

  // Generate No Objection Letter
  generateNoObjectionLetter(employee, currentDate) {
    const doc = new Document({
      sections: [{
        properties: {},
        children: [
          new Paragraph({
            text: "NO OBJECTION CERTIFICATE",
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 }
          }),
          new Paragraph({
            text: `Date: ${currentDate}`,
            alignment: AlignmentType.RIGHT,
            spacing: { after: 400 }
          }),
          new Paragraph({
            text: `This is to certify that we have no objection to Mr./Ms. ${employee.employeeName} (Employee ID: ${employee.employeeId}) proceeding with their request.`,
            spacing: { after: 200 }
          }),
          new Paragraph({
            text: `Employee Details:`,
            heading: HeadingLevel.HEADING_2,
            spacing: { after: 200 }
          }),
          new Paragraph({
            text: `• Employee Name: ${employee.employeeName}`,
            spacing: { after: 100 }
          }),
          new Paragraph({
            text: `• Employee ID: ${employee.employeeId}`,
            spacing: { after: 100 }
          }),
          new Paragraph({
            text: `• Request Date: ${new Date(employee.requestDate).toLocaleDateString()}`,
            spacing: { after: 200 }
          }),
          ...(employee.details && Object.keys(employee.details).length > 0 ? [
            new Paragraph({
              text: "Additional Details:",
              heading: HeadingLevel.HEADING_2,
              spacing: { after: 200 }
            }),
            ...Object.entries(employee.details).map(([key, value]) =>
              new Paragraph({
                text: `• ${key}: ${value}`,
                spacing: { after: 100 }
              })
            )
          ] : []),
          new Paragraph({
            text: "This certificate confirms that there are no pending issues or objections from our organization.",
            spacing: { after: 400 }
          }),
          new Paragraph({
            text: "For Company Name",
            spacing: { after: 200 }
          }),
          new Paragraph({
            text: "_________________",
            spacing: { after: 100 }
          }),
          new Paragraph({
            text: "Authorized Signature",
            spacing: { after: 100 }
          })
        ]
      }]
    });

    return doc;
  }

  // Generate Generic Letter
  generateGenericLetter(employee, currentDate) {
    const doc = new Document({
      sections: [{
        properties: {},
        children: [
          new Paragraph({
            text: `${employee.letterType.toUpperCase()} LETTER`,
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 }
          }),
          new Paragraph({
            text: `Date: ${currentDate}`,
            alignment: AlignmentType.RIGHT,
            spacing: { after: 400 }
          }),
          new Paragraph({
            text: `This letter is issued to Mr./Ms. ${employee.employeeName} (Employee ID: ${employee.employeeId}) as requested.`,
            spacing: { after: 200 }
          }),
          new Paragraph({
            text: `Employee Details:`,
            heading: HeadingLevel.HEADING_2,
            spacing: { after: 200 }
          }),
          new Paragraph({
            text: `• Employee Name: ${employee.employeeName}`,
            spacing: { after: 100 }
          }),
          new Paragraph({
            text: `• Employee ID: ${employee.employeeId}`,
            spacing: { after: 100 }
          }),
          new Paragraph({
            text: `• Letter Type: ${employee.letterType}`,
            spacing: { after: 100 }
          }),
          new Paragraph({
            text: `• Request Date: ${new Date(employee.requestDate).toLocaleDateString()}`,
            spacing: { after: 200 }
          }),
          ...(employee.details && Object.keys(employee.details).length > 0 ? [
            new Paragraph({
              text: "Additional Details:",
              heading: HeadingLevel.HEADING_2,
              spacing: { after: 200 }
            }),
            ...Object.entries(employee.details).map(([key, value]) =>
              new Paragraph({
                text: `• ${key}: ${value}`,
                spacing: { after: 100 }
              })
            )
          ] : []),
          ...(employee.employeeComments ? [
            new Paragraph({
              text: "Employee Comments:",
              heading: HeadingLevel.HEADING_2,
              spacing: { after: 200 }
            }),
            new Paragraph({
              text: employee.employeeComments,
              spacing: { after: 400 }
            })
          ] : []),
          new Paragraph({
            text: "This letter is issued for official purposes and is valid as per organizational policies.",
            spacing: { after: 400 }
          }),
          new Paragraph({
            text: "For Company Name",
            spacing: { after: 200 }
          }),
          new Paragraph({
            text: "_________________",
            spacing: { after: 100 }
          }),
          new Paragraph({
            text: "Authorized Signature",
            spacing: { after: 100 }
          })
        ]
      }]
    });

    return doc;
  }

  // Generate other letter types (placeholder implementations)
  generateRelievingLetter(employee, currentDate) {
    return this.generateGenericLetter(employee, currentDate);
  }

  generateAppointmentLetter(employee, currentDate) {
    return this.generateGenericLetter(employee, currentDate);
  }

  generatePromotionLetter(employee, currentDate) {
    return this.generateGenericLetter(employee, currentDate);
  }

  generateTransferLetter(employee, currentDate) {
    return this.generateGenericLetter(employee, currentDate);
  }

  generateTerminationLetter(employee, currentDate) {
    return this.generateGenericLetter(employee, currentDate);
  }

  // Generate DOCX file and return buffer
  async generateDocxLetter(letterType, employeeDetails) {
    try {
      // Always fill the provided template; do not generate a fresh layout
      return await this.generateLetterFromTemplate(letterType, employeeDetails);
    } catch (error) {
      console.error('Error generating DOCX letter:', error);
      throw new Error('Failed to generate DOCX letter');
    }
  }

  // Public helper to fill a template and return Buffer
  async fillTemplate(letterType, data) {
    return this.generateLetterFromTemplate(letterType, data);
  }

  // Generate letter and save to file system
  async generateAndSaveLetter(letterType, employeeDetails, filename) {
    try {
      const buffer = await this.generateDocxLetter(letterType, employeeDetails);
      const filePath = path.join(this.templatesPath, filename);

      // Ensure directory exists
      if (!fs.existsSync(this.templatesPath)) {
        fs.mkdirSync(this.templatesPath, { recursive: true });
      }

      fs.writeFileSync(filePath, buffer);

      return filePath;
    } catch (error) {
      console.error('Error saving DOCX letter:', error);
      throw new Error('Failed to save DOCX letter');
    }
  }
}

module.exports = LetterGeneratorService;
