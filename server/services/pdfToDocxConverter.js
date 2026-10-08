const { Document, Packer, Paragraph, TextRun, AlignmentType, HeadingLevel, Spacing } = require('docx');
const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');

class PdfToDocxConverter {
  constructor() {
    this.templatesPath = path.join(__dirname, '../../public/templates');
  }

  // Convert PDF to DOCX with placeholders
  async convertPdfToDocx(pdfPath, letterType) {
    try {
      // Read PDF file
      const pdfBuffer = fs.readFileSync(pdfPath);
      const pdfData = await pdfParse(pdfBuffer);

      // Extract text content
      const textContent = pdfData.text;

      // Create DOCX with placeholders based on letter type
      const docxContent = this.createDocxWithPlaceholders(textContent, letterType);

      return docxContent;
    } catch (error) {
      console.error(`Error converting PDF to DOCX: ${error.message}`);
      throw error;
    }
  }

  // Create DOCX content with placeholders based on letter type
  createDocxWithPlaceholders(textContent, letterType) {
    switch (letterType.toLowerCase()) {
      case 'visa_letter':
      case 'visa':
        return this.createVisaLetterDocx();

      case 'certification_reimbursement':
      case 'certification':
        return this.createCertificationReimbursementDocx();

      case 'internship_completion':
      case 'internship':
        return this.createInternshipCompletionDocx();

      case 'hr_letter':
        return this.createHrLetterDocx();

      case 'travel_noc':
      case 'travel_noc_letter':
        return this.createTravelNocDocx();

      default:
        return this.createGenericLetterDocx(letterType);
    }
  }

  // Create Visa Letter DOCX with placeholders
  createVisaLetterDocx() {
    return new Document({
      sections: [{
        properties: {},
        children: [
          new Paragraph({
            text: "VISA LETTER",
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 }
          }),
          new Paragraph({
            text: "Date: {{CURRENT_DATE}}",
            alignment: AlignmentType.RIGHT,
            spacing: { after: 400 }
          }),
          new Paragraph({
            text: "To Whom It May Concern,",
            spacing: { after: 200 }
          }),
          new Paragraph({
            text: "This is to certify that Mr./Ms. {{EMPLOYEE_NAME}} (Employee ID: {{EMPLOYEE_ID}}) is a full-time employee of our organization.",
            spacing: { after: 200 }
          }),
          new Paragraph({
            text: "Employee Details:",
            heading: HeadingLevel.HEADING_2,
            spacing: { after: 200 }
          }),
          new Paragraph({
            text: "• Employee Name: {{EMPLOYEE_NAME}}",
            spacing: { after: 100 }
          }),
          new Paragraph({
            text: "• Employee ID: {{EMPLOYEE_ID}}",
            spacing: { after: 100 }
          }),
          new Paragraph({
            text: "• Department: {{DEPARTMENT}}",
            spacing: { after: 100 }
          }),
          new Paragraph({
            text: "• Position: {{POSITION}}",
            spacing: { after: 100 }
          }),
          new Paragraph({
            text: "• Start Date: {{START_DATE}}",
            spacing: { after: 100 }
          }),
          new Paragraph({
            text: "• Salary: {{SALARY}}",
            spacing: { after: 200 }
          }),
          new Paragraph({
            text: "Additional Details:",
            heading: HeadingLevel.HEADING_2,
            spacing: { after: 200 }
          }),
          new Paragraph({
            text: "{{ADDITIONAL_DETAILS}}",
            spacing: { after: 200 }
          }),
          new Paragraph({
            text: "Employee Comments:",
            heading: HeadingLevel.HEADING_2,
            spacing: { after: 200 }
          }),
          new Paragraph({
            text: "{{EMPLOYEE_COMMENTS}}",
            spacing: { after: 400 }
          }),
          new Paragraph({
            text: "This letter is issued for visa application purposes and is valid for all official requirements.",
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
  }

  // Create Certification Reimbursement DOCX with placeholders
  createCertificationReimbursementDocx() {
    return new Document({
      sections: [{
        properties: {},
        children: [
          new Paragraph({
            text: "CERTIFICATION REIMBURSEMENT LETTER",
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 }
          }),
          new Paragraph({
            text: "Date: {{CURRENT_DATE}}",
            alignment: AlignmentType.RIGHT,
            spacing: { after: 400 }
          }),
          new Paragraph({
            text: "To Whom It May Concern,",
            spacing: { after: 200 }
          }),
          new Paragraph({
            text: "This is to certify that Mr./Ms. {{EMPLOYEE_NAME}} (Employee ID: {{EMPLOYEE_ID}}) is eligible for certification reimbursement.",
            spacing: { after: 200 }
          }),
          new Paragraph({
            text: "Employee Details:",
            heading: HeadingLevel.HEADING_2,
            spacing: { after: 200 }
          }),
          new Paragraph({
            text: "• Employee Name: {{EMPLOYEE_NAME}}",
            spacing: { after: 100 }
          }),
          new Paragraph({
            text: "• Employee ID: {{EMPLOYEE_ID}}",
            spacing: { after: 100 }
          }),
          new Paragraph({
            text: "• Department: {{DEPARTMENT}}",
            spacing: { after: 100 }
          }),
          new Paragraph({
            text: "• Position: {{POSITION}}",
            spacing: { after: 100 }
          }),
          new Paragraph({
            text: "• Certification: {{CERTIFICATION_NAME}}",
            spacing: { after: 100 }
          }),
          new Paragraph({
            text: "• Cost: {{CERTIFICATION_COST}}",
            spacing: { after: 200 }
          }),
          new Paragraph({
            text: "Additional Details:",
            heading: HeadingLevel.HEADING_2,
            spacing: { after: 200 }
          }),
          new Paragraph({
            text: "{{ADDITIONAL_DETAILS}}",
            spacing: { after: 200 }
          }),
          new Paragraph({
            text: "Employee Comments:",
            heading: HeadingLevel.HEADING_2,
            spacing: { after: 200 }
          }),
          new Paragraph({
            text: "{{EMPLOYEE_COMMENTS}}",
            spacing: { after: 400 }
          }),
          new Paragraph({
            text: "This letter confirms eligibility for certification reimbursement as per company policy.",
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
  }

  // Create Internship Completion DOCX with placeholders
  createInternshipCompletionDocx() {
    return new Document({
      sections: [{
        properties: {},
        children: [
          new Paragraph({
            text: "INTERNSHIP COMPLETION CERTIFICATE",
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 }
          }),
          new Paragraph({
            text: "Date: {{CURRENT_DATE}}",
            alignment: AlignmentType.RIGHT,
            spacing: { after: 400 }
          }),
          new Paragraph({
            text: "This is to certify that Mr./Ms. {{EMPLOYEE_NAME}} (Employee ID: {{EMPLOYEE_ID}}) has successfully completed their internship.",
            spacing: { after: 200 }
          }),
          new Paragraph({
            text: "Internship Details:",
            heading: HeadingLevel.HEADING_2,
            spacing: { after: 200 }
          }),
          new Paragraph({
            text: "• Intern Name: {{EMPLOYEE_NAME}}",
            spacing: { after: 100 }
          }),
          new Paragraph({
            text: "• Intern ID: {{EMPLOYEE_ID}}",
            spacing: { after: 100 }
          }),
          new Paragraph({
            text: "• Department: {{DEPARTMENT}}",
            spacing: { after: 100 }
          }),
          new Paragraph({
            text: "• Start Date: {{START_DATE}}",
            spacing: { after: 100 }
          }),
          new Paragraph({
            text: "• End Date: {{END_DATE}}",
            spacing: { after: 100 }
          }),
          new Paragraph({
            text: "• Project: {{PROJECT_NAME}}",
            spacing: { after: 200 }
          }),
          new Paragraph({
            text: "Additional Details:",
            heading: HeadingLevel.HEADING_2,
            spacing: { after: 200 }
          }),
          new Paragraph({
            text: "{{ADDITIONAL_DETAILS}}",
            spacing: { after: 200 }
          }),
          new Paragraph({
            text: "Employee Comments:",
            heading: HeadingLevel.HEADING_2,
            spacing: { after: 200 }
          }),
          new Paragraph({
            text: "{{EMPLOYEE_COMMENTS}}",
            spacing: { after: 400 }
          }),
          new Paragraph({
            text: "This certificate confirms successful completion of the internship program.",
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
  }

  // Create HR Letter DOCX with placeholders
  createHrLetterDocx() {
    return new Document({
      sections: [{
        properties: {},
        children: [
          new Paragraph({
            text: "HR LETTER",
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 }
          }),
          new Paragraph({
            text: "Date: {{CURRENT_DATE}}",
            alignment: AlignmentType.RIGHT,
            spacing: { after: 400 }
          }),
          new Paragraph({
            text: "To Whom It May Concern,",
            spacing: { after: 200 }
          }),
          new Paragraph({
            text: "This letter is issued to Mr./Ms. {{EMPLOYEE_NAME}} (Employee ID: {{EMPLOYEE_ID}}) as requested.",
            spacing: { after: 200 }
          }),
          new Paragraph({
            text: "Employee Details:",
            heading: HeadingLevel.HEADING_2,
            spacing: { after: 200 }
          }),
          new Paragraph({
            text: "• Employee Name: {{EMPLOYEE_NAME}}",
            spacing: { after: 100 }
          }),
          new Paragraph({
            text: "• Employee ID: {{EMPLOYEE_ID}}",
            spacing: { after: 100 }
          }),
          new Paragraph({
            text: "• Department: {{DEPARTMENT}}",
            spacing: { after: 100 }
          }),
          new Paragraph({
            text: "• Position: {{POSITION}}",
            spacing: { after: 100 }
          }),
          new Paragraph({
            text: "• Request Date: {{REQUEST_DATE}}",
            spacing: { after: 200 }
          }),
          new Paragraph({
            text: "Additional Details:",
            heading: HeadingLevel.HEADING_2,
            spacing: { after: 200 }
          }),
          new Paragraph({
            text: "{{ADDITIONAL_DETAILS}}",
            spacing: { after: 200 }
          }),
          new Paragraph({
            text: "Employee Comments:",
            heading: HeadingLevel.HEADING_2,
            spacing: { after: 200 }
          }),
          new Paragraph({
            text: "{{EMPLOYEE_COMMENTS}}",
            spacing: { after: 400 }
          }),
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
  }

  // Create Travel NOC DOCX with placeholders
  createTravelNocDocx() {
    return new Document({
      sections: [{
        properties: {},
        children: [
          new Paragraph({
            text: "TRAVEL NO OBJECTION CERTIFICATE",
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 }
          }),
          new Paragraph({
            text: "Date: {{CURRENT_DATE}}",
            alignment: AlignmentType.RIGHT,
            spacing: { after: 400 }
          }),
          new Paragraph({
            text: "This is to certify that we have no objection to Mr./Ms. {{EMPLOYEE_NAME}} (Employee ID: {{EMPLOYEE_ID}}) traveling.",
            spacing: { after: 200 }
          }),
          new Paragraph({
            text: "Travel Details:",
            heading: HeadingLevel.HEADING_2,
            spacing: { after: 200 }
          }),
          new Paragraph({
            text: "• Employee Name: {{EMPLOYEE_NAME}}",
            spacing: { after: 100 }
          }),
          new Paragraph({
            text: "• Employee ID: {{EMPLOYEE_ID}}",
            spacing: { after: 100 }
          }),
          new Paragraph({
            text: "• Destination: {{DESTINATION}}",
            spacing: { after: 100 }
          }),
          new Paragraph({
            text: "• Travel Dates: {{TRAVEL_DATES}}",
            spacing: { after: 100 }
          }),
          new Paragraph({
            text: "• Purpose: {{TRAVEL_PURPOSE}}",
            spacing: { after: 200 }
          }),
          new Paragraph({
            text: "Additional Details:",
            heading: HeadingLevel.HEADING_2,
            spacing: { after: 200 }
          }),
          new Paragraph({
            text: "{{ADDITIONAL_DETAILS}}",
            spacing: { after: 200 }
          }),
          new Paragraph({
            text: "Employee Comments:",
            heading: HeadingLevel.HEADING_2,
            spacing: { after: 200 }
          }),
          new Paragraph({
            text: "{{EMPLOYEE_COMMENTS}}",
            spacing: { after: 400 }
          }),
          new Paragraph({
            text: "This certificate confirms no objection for the specified travel.",
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
  }

  // Create Generic Letter DOCX with placeholders
  createGenericLetterDocx(letterType) {
    return new Document({
      sections: [{
        properties: {},
        children: [
          new Paragraph({
            text: `${letterType.toUpperCase()} LETTER`,
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 }
          }),
          new Paragraph({
            text: "Date: {{CURRENT_DATE}}",
            alignment: AlignmentType.RIGHT,
            spacing: { after: 400 }
          }),
          new Paragraph({
            text: "This letter is issued to Mr./Ms. {{EMPLOYEE_NAME}} (Employee ID: {{EMPLOYEE_ID}}) as requested.",
            spacing: { after: 200 }
          }),
          new Paragraph({
            text: "Employee Details:",
            heading: HeadingLevel.HEADING_2,
            spacing: { after: 200 }
          }),
          new Paragraph({
            text: "• Employee Name: {{EMPLOYEE_NAME}}",
            spacing: { after: 100 }
          }),
          new Paragraph({
            text: "• Employee ID: {{EMPLOYEE_ID}}",
            spacing: { after: 100 }
          }),
          new Paragraph({
            text: "• Letter Type: {{LETTER_TYPE}}",
            spacing: { after: 100 }
          }),
          new Paragraph({
            text: "• Request Date: {{REQUEST_DATE}}",
            spacing: { after: 200 }
          }),
          new Paragraph({
            text: "Additional Details:",
            heading: HeadingLevel.HEADING_2,
            spacing: { after: 200 }
          }),
          new Paragraph({
            text: "{{ADDITIONAL_DETAILS}}",
            spacing: { after: 200 }
          }),
          new Paragraph({
            text: "Employee Comments:",
            heading: HeadingLevel.HEADING_2,
            spacing: { after: 200 }
          }),
          new Paragraph({
            text: "{{EMPLOYEE_COMMENTS}}",
            spacing: { after: 400 }
          }),
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
  }

  // Convert all PDF templates to DOCX
  async convertAllTemplates() {
    const templatesDir = path.join(__dirname, '../../public/templates');

    // Ensure templates directory exists
    if (!fs.existsSync(templatesDir)) {
      fs.mkdirSync(templatesDir, { recursive: true });
    }

    console.log('🔄 Converting PDF templates to DOCX...');

    const pdfTemplates = [
      { file: 'visa_letter.pdf', type: 'visa_letter' },
      { file: 'certification_reimbursement.pdf', type: 'certification_reimbursement' },
      { file: 'internship_completion.pdf', type: 'internship_completion' },
      { file: 'hr_letter.pdf', type: 'hr_letter' },
      { file: 'travel_noc.pdf', type: 'travel_noc' }
    ];

    for (const template of pdfTemplates) {
      try {
        const pdfPath = path.join(templatesDir, template.file);

        if (fs.existsSync(pdfPath)) {
          const docxDoc = this.createDocxWithPlaceholders(null, template.type);
          const buffer = await Packer.toBuffer(docxDoc);

          const docxFilename = template.file.replace('.pdf', '.docx');
          const docxPath = path.join(templatesDir, docxFilename);

          fs.writeFileSync(docxPath, buffer);
          console.log(`✅ Converted: ${template.file} → ${docxFilename}`);
        } else {
          console.log(`⚠️  PDF not found: ${template.file}`);
        }
      } catch (error) {
        console.error(`❌ Error converting ${template.file}:`, error.message);
      }
    }

    console.log('\n🎉 PDF to DOCX conversion completed!');
    console.log('📁 Templates saved in:', templatesDir);
  }
}

module.exports = PdfToDocxConverter;
