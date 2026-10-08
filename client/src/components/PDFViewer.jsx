import { API_URL } from "../config/api";
import React, { useEffect, useState } from 'react';

const PDFViewer = ({ templateName, employeeData }) => {
  const [filledPDFUrl, setFilledPDFUrl] = useState(null);

  const [isLoading, setIsLoading] = useState(false);
  const getTemplatePath = (templateName) => {
    const templates = {
      // Backend values (from database)
      visa: "/templates/visa_letter.pdf",
      certification: "/templates/certification_reimbursement.pdf",
      internship_completion: "/templates/internship_completion.pdf",
      hr_letter: "/templates/hr_letter.pdf",
      travel_noc: "/templates/travel_noc.pdf",
      // Legacy values (for backward compatibility)
      visa_letter: "/templates/visa_letter.pdf",
      certification_reimbursement: "/templates/certification_reimbursement.pdf",
      travel_noc_letter: "/templates/travel_noc.pdf"
    };
    return templates[templateName] || '';
  };



  const templatePath = getTemplatePath(templateName);

  // Function to get filled PDF from backend
  const getFilledPDF = async () => {
    if (!employeeData || !templateName) return;

    setIsLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/pdf-filler/fill-template`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          letterType: templateName,
          employeeData: employeeData
        }),
      });

      if (response.ok) {
        const pdfBlob = await response.blob();
        const url = URL.createObjectURL(pdfBlob);
        setFilledPDFUrl(url);

      } else {
        console.error('Failed to get filled PDF');
      }
    } catch (error) {
      console.error('Error getting filled PDF:', error);
    } finally {
      setIsLoading(false);
    }
  };



  if (!templatePath) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-500">Template not found for: {templateName}</p>
      </div>
    );
  }

  // Auto-fetch filled PDF when component mounts or data changes
  useEffect(() => {
    // Only try to fetch if we have the basics
    if (employeeData && templateName) {
      getFilledPDF();
    }
  }, [templateName, JSON.stringify(employeeData)]);

  return (
    <div className="pdf-viewer">
      <div className="pdf-header mb-4">
        <h4 className="text-lg font-semibold mb-2">Letter Template Preview with Employee Details</h4>
        <p className="text-sm text-gray-600">
          This shows the actual PDF template with employee details filled in.
        </p>
        <div className="mt-2 space-x-2">
          <button
            onClick={getFilledPDF}
            disabled={isLoading}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm disabled:opacity-50"
          >
            {isLoading ? 'Loading...' : 'View Filled PDF'}
          </button>
          {filledPDFUrl && (
            <button
              onClick={() => {
                const link = document.createElement('a');
                link.href = filledPDFUrl;
                link.download = `${employeeData?.employeeName || 'employee'}_${templateName}_filled.pdf`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
              }}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
            >
              Download Filled PDF
            </button>
          )}
        </div>
      </div>

      <div className="pdf-container border border-gray-300 rounded-lg overflow-hidden">
        {/* Show filled PDF when available, otherwise show original template */}
        {filledPDFUrl ? (
          <iframe
            src={filledPDFUrl}
            width="100%"
            height="600"
            title={`${templateName} Filled Template`}
            className="w-full"
          />
        ) : (
          <iframe
            src={`${templatePath}#toolbar=0&navpanes=0&scrollbar=0`}
            width="100%"
            height="600"
            title={`${templateName} Template`}
            className="w-full"
            onError={(e) => {
              console.error('PDF loading error:', e);
            }}
          />
        )}
      </div>

      {/* Employee Details Summary */}
      <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
        <h5 className="font-semibold text-gray-800 mb-2">Quick Reference - Employee Details:</h5>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
          <div><strong>Name:</strong> {employeeData?.employeeName || 'N/A'}</div>
          <div><strong>Employee ID:</strong> {employeeData?.employeeId || 'N/A'}</div>
          <div><strong>Address:</strong> {employeeData?.employeeAddress || employeeData?.address || 'N/A'}</div>
          <div><strong>Letter Type:</strong> {employeeData?.letterType?.replace(/_/g, ' ').toUpperCase() || 'N/A'}</div>
          <div><strong>Status:</strong> <span className={`px-2 py-1 rounded text-xs ${employeeData?.status === 'approved' ? 'bg-green-100 text-green-800' : employeeData?.status === 'rejected' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>{employeeData?.status?.toUpperCase() || 'N/A'}</span></div>
        </div>
      </div>


    </div>
  );
};

export default PDFViewer;
