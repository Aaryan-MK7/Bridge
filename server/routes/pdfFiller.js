const express = require('express');
const router = express.Router();
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const fs = require('fs').promises;
const path = require('path');

// Route to get filled PDF template
router.post('/fill-template', async (req, res) => {
  try {
    const { letterType, employeeData } = req.body;

    if (!letterType || !employeeData) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Map incoming letterType to actual filename basenames in public/templates
    const typeToFilename = {
      // Backend values
      visa: 'visa_letter',
      certification: 'certification_reimbursement',
      internship_completion: 'internship_completion',
      hr_letter: 'hr_letter',
      travel_noc: 'travel_noc',
      // Legacy values (fallbacks)
      visa_letter: 'visa_letter',
      certification_reimbursement: 'certification_reimbursement',
      travel_noc_letter: 'travel_noc',
    };

    const baseName = typeToFilename[letterType] || letterType;
    // Get the template path
    const templatePath = path.join(__dirname, '../..', 'public', 'templates', `${baseName}.pdf`);

    // Check if template exists
    try {
      await fs.access(templatePath);
    } catch (error) {
      return res.status(404).json({ error: "Template not found" });
    }

    // Read the PDF template
    const templateBytes = await fs.readFile(templatePath);
    const pdfDoc = await PDFDocument.load(templateBytes);

    // Get the first page
    const pages = pdfDoc.getPages();
    if (pages.length === 0) {
      return res.status(400).json({ error: "PDF template has no pages" });
    }

    const page = pages[0];
    const { width, height } = page.getSize();

    // Add text overlay with employee details
    await addTextOverlay(pdfDoc, page, letterType, employeeData, width, height);

    // Save the filled PDF
    const filledPdfBytes = await pdfDoc.save();

    // Set response headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${employeeData.employeeName}_${letterType}_filled.pdf"`);

    res.send(Buffer.from(filledPdfBytes));

  } catch (error) {
    console.error('Error filling PDF template:', error);
    res.status(500).json({ error: "Failed to fill PDF template" });
  }
});

// Function to add text overlay to PDF page
async function addTextOverlay(pdfDoc, page, letterType, employeeData, pageWidth, pageHeight) {
  try {
    // Use Helvetica to better match the template's sans-serif look
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const fontSize = 12;
    const smallFontSize = 10;
    const lineHeight = fontSize + 4;

    // Get employee details
    const employeeName = employeeData.employeeName || 'N/A';
    const employeeId = employeeData.employeeId || 'N/A';
    const employeeAddress = employeeData.employeeAddress || employeeData.address || 'N/A';
    const today = new Date().toLocaleDateString();

    // Helpers
    const drawWrapped = (text, x, y, maxWidth, size = fontSize, fnt = font, lineGap = 3) => {
      if (!text) return y;
      const words = String(text).split(' ');
      let line = '';
      let cursorY = y;
      for (const w of words) {
        const test = line ? line + ' ' + w : w;
        const width = fnt.widthOfTextAtSize(test, size);
        if (width > maxWidth && line) {
          page.drawText(line, { x, y: cursorY, size, font: fnt, color: rgb(0,0,0) });
          cursorY -= (size + lineGap);
          line = w;
        } else {
          line = test;
        }
      }
      if (line) {
        page.drawText(line, { x, y: cursorY, size, font: fnt, color: rgb(0,0,0) });
        cursorY -= (size + lineGap);
      }
      return cursorY;
    };

    // If certification letter, use a template-specific layout for better alignment
    if (letterType === 'certification' || letterType === 'certification_reimbursement') {
      // Coordinate system assumptions for US Letter (612x792) and provided template
      // Only place values near existing labels to avoid overlap
      const details = employeeData.details || {};
      const marginLeft = 72; // 1 inch

      // Date (top right, aligned with template date)
      const dateSize = 11;
      page.drawText(today, {
        x: pageWidth - 95,
        y: pageHeight - 60,
        size: dateSize,
        font,
        color: rgb(0,0,0),
      });

      // Top name under header
      if (employeeName && employeeName !== 'N/A') {
        page.drawText(employeeName, {
          x: marginLeft + 48,
          y: pageHeight - 120,
          size: 12,
          font: boldFont,
          color: rgb(0,0,0),
        });
      }

      // Employee ID value next to its label line
      if (employeeId && employeeId !== 'N/A') {
        page.drawText(employeeId, {
          x: marginLeft + 120,
          y: pageHeight - 140,
          size: 11,
          font,
          color: rgb(0,0,0),
        });
      }

      // Amount and Course name inside the paragraph line
      if (details.amount) {
        page.drawText(String(details.amount), {
          x: marginLeft + 28, // after "reimburse you INR"
          y: pageHeight - 270,
          size: 11,
          font: boldFont,
          color: rgb(0,0,0),
        });
      }
      if (details.courseName) {
        page.drawText(String(details.courseName), {
          x: marginLeft + 208, // after "for the"
          y: pageHeight - 270,
          size: 11,
          font: boldFont,
          color: rgb(0,0,0),
        });
      }

      // Optional: institute near top block small line
      if (details.institute) {
        page.drawText(String(details.institute), {
          x: marginLeft + 64,
          y: pageHeight - 158,
          size: 11,
          font,
          color: rgb(0,0,0),
        });
      }

      // Additional comments in the designated section
      if (employeeData.employeeComments || employeeData.comments) {
        const comments = employeeData.employeeComments || employeeData.comments;
        drawWrapped(comments, marginLeft, pageHeight - 390, pageWidth - marginLeft * 2, 11, font, 2);
      }

      // Status badge on the right
      if (employeeData.status) {
        const statusText = `Status: ${employeeData.status.toUpperCase()}`;
        page.drawText(statusText, {
          x: pageWidth - 190,
          y: pageHeight - 100,
          size: 12,
          font: boldFont,
          color: rgb(0.5, 0.5, 0),
        });
      }

      return; // handled template-specific overlay
    }

    // Generic layout fallback
    // Add date at top right
    page.drawText(today, {
      x: pageWidth - 100,
      y: pageHeight - 50,
      size: fontSize,
      font: font,
      color: rgb(0, 0, 0)
    });

    // Add employee name (usually near the top)
    page.drawText(employeeName, {
      x: 100,
      y: pageHeight - 150,
      size: fontSize,
      font: boldFont,
      color: rgb(0, 0, 0)
    });

    // Add employee ID
    page.drawText(`Employee ID: ${employeeId}`, {
      x: 100,
      y: pageHeight - 170,
      size: fontSize,
      font: font,
      color: rgb(0, 0, 0)
    });

    // Add employee address
    page.drawText(`Address: ${employeeAddress}`, {
      x: 100,
      y: pageHeight - 190,
      size: fontSize,
      font: font,
      color: rgb(0, 0, 0)
    });

    // Add form-specific details
    if (employeeData.details) {
      let yOffset = pageHeight - 220;
      for (const [key, value] of Object.entries(employeeData.details)) {
        if (value && value.trim() !== '') {
          const label = key.replace(/([A-Z])/g, ' $1').trim();
          page.drawText(`${label}: ${value}`, {
            x: 100,
            y: yOffset,
            size: fontSize,
            font: font,
            color: rgb(0, 0, 0)
          });
          yOffset -= lineHeight;
        }
      }
    }

    // Add employee comments if available
    if (employeeData.employeeComments || employeeData.comments) {
      const comments = employeeData.employeeComments || employeeData.comments;
      page.drawText('Additional Comments:', {
        x: 100,
        y: pageHeight - 350,
        size: fontSize,
        font: boldFont,
        color: rgb(0, 0, 0)
      });

      // Split long comments into multiple lines
      const maxWidth = pageWidth - 200;
      const words = comments.split(' ');
      let currentLine = '';
      let lineY = pageHeight - 370;

      for (const word of words) {
        const testLine = currentLine + (currentLine ? ' ' : '') + word;
        const testWidth = font.widthOfTextAtSize(testLine, fontSize);

        if (testWidth > maxWidth && currentLine) {
          page.drawText(currentLine, {
            x: 100,
            y: lineY,
            size: fontSize,
            font: font,
            color: rgb(0, 0, 0)
          });
          currentLine = word;
          lineY -= lineHeight;
        } else {
          currentLine = testLine;
        }
      }

      // Draw the last line
      if (currentLine) {
        page.drawText(currentLine, {
          x: 100,
          y: lineY,
          size: fontSize,
          font: font,
          color: rgb(0, 0, 0)
        });
      }
    }

    // Add admin notes if available
    if (employeeData.adminNotes) {
      page.drawText('Admin Notes:', {
        x: 100,
        y: pageHeight - 450,
        size: fontSize,
        font: boldFont,
        color: rgb(0, 0, 0)
      });

      page.drawText(employeeData.adminNotes, {
        x: 100,
        y: pageHeight - 470,
        size: fontSize,
        font: font,
        color: rgb(0, 0, 0)
      });
    }

    // Add approval status if available
    if (employeeData.status) {
      const statusColor = employeeData.status === 'approved' ? rgb(0, 0.5, 0) :
                         employeeData.status === 'rejected' ? rgb(0.5, 0, 0) :
                         rgb(0.5, 0.5, 0);

      page.drawText(`Status: ${employeeData.status.toUpperCase()}`, {
        x: pageWidth - 150,
        y: pageHeight - 100,
        size: fontSize,
        font: boldFont,
        color: statusColor
      });
    }

  } catch (error) {
    console.error('Error adding text overlay:', error);
    throw error;
  }
}

module.exports = router;
