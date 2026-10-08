import { API_URL } from "../config/api";
import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

const letterTemplates = {
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

export default function EmployeeDashboard() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [requestHistory, setRequestHistory] = useState([]);
  const [currentEmployee, setCurrentEmployee] = useState(null);
  const [notification, setNotification] = useState(null);
  const [formData, setFormData] = useState({
    address: "",
    comments: "",
    letterType: "",
    details: {}
  });
  const [templates, setTemplates] = useState([]);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [initialProfile, setInitialProfile] = useState(null);
  const [showPreview, setShowPreview] = useState(false);

  const [stats, setStats] = useState([
    {
      title: "Letters Requested",
      value: "0",
      color: "bg-gradient-to-r from-blue-600 to-blue-400",
      iconBg: "bg-blue-100 text-blue-600",
      icon: "📨",
    },
    {
      title: "Approved Letters",
      value: "0",
      color: "bg-gradient-to-r from-green-500 to-green-400",
      iconBg: "bg-green-100 text-green-600",
      icon: "✅",
    },
    {
      title: "Pending Approvals",
      value: "0",
      color: "bg-gradient-to-r from-amber-500 to-amber-400",
      iconBg: "bg-amber-100 text-amber-600",
      icon: "⏳",
    },
  ]);

  const navigate = useNavigate();
  const prevRequestHistoryRef = useRef([]);

  useEffect(() => {
    const storedValue = localStorage.getItem("employee");
    if (!storedValue) {
      navigate("/");
      return;
    }
    try {
      const employee = JSON.parse(storedValue);
      setCurrentEmployee(employee);
      setFormData(prev => ({
        ...prev,
        address: employee.address || ""
      }));
    } catch (err) {
      navigate("/");
    }
  }, [navigate]);

  useEffect(() => {
    if (!currentEmployee?.employeeId) return;
    // Avoid overwriting user input while editing
    if (isEditingProfile) return;
    fetchRequestHistory();
    // Load profile from CSV-backed endpoint
    (async () => {
      try {
        const res = await fetch(`API_URL/api/employees/${currentEmployee.employeeId}/profile`);
        if (res.ok) {
          const data = await res.json();
          // Merge server-sourced profile without clobbering current in-flight edits
          const merged = { ...currentEmployee, ...data };
          setCurrentEmployee(merged);
          setInitialProfile((prev) => prev || merged);
          localStorage.setItem('employee', JSON.stringify(merged));
        }
      } catch {}
    })();
  }, [currentEmployee?.employeeId, isEditingProfile]);

  // Load templates from backend
  useEffect(() => {
    const loadTemplates = async () => {
      try {
        const res = await fetch(`${API_URL}/api/templates`);
        if (res.ok) {
          const data = await res.json();
          setTemplates(data.filter(t => t.isActive !== false));
        }
      } catch (e) {
        // Ignore
      }
    };
    loadTemplates();
  }, []);

  const fetchRequestHistory = async () => {
    try {
      const response = await fetch(
        `API_URL/api/letter-requests/employee/${currentEmployee.employeeId}`
      );
      if (response.ok) {
        const data = await response.json();

        const prev = prevRequestHistoryRef.current;
        data.forEach((req) => {
          const prevReq = prev.find((r) => r._id === req._id);
          if (prevReq && prevReq.status !== req.status) {
            if (req.status === "approved") showNotification("Your letter request has been approved.", "success");
            else if (req.status === "rejected") showNotification("Your letter request has been rejected.", "error");
          }
        });
        prevRequestHistoryRef.current = data;

        setRequestHistory(data);
        setStats([
          { ...stats[0], value: data.length + "" },
          { ...stats[1], value: data.filter((req) => req.status === "approved").length + "" },
          { ...stats[2], value: data.filter((req) => req.status === "pending").length + "" }
        ]);
      }
    } catch (error) {
      console.error("Error fetching request history:", error);
    }
  };

  const showNotification = (message, type = "info") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  };

  const handleLogout = () => {
    localStorage.removeItem("employee");
    navigate("/");
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleDetailChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, details: { ...prev.details, [name]: value } }));
  };

  const submitLetterRequest = async () => {
    if (!formData.letterType) {
      showNotification("Please select a letter type", "error");
      return;
    }

    const requiredFields = getFieldsForType(formData.letterType) || [];
    const missing = requiredFields.filter(f => !formData.details?.[f.name]);
    if (missing.length) {
      showNotification("Please fill all required fields for this letter", "error");
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/letter-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: currentEmployee.employeeId,
          employeeName: currentEmployee.name,
          letterType: formData.letterType,
          details: formData.details,
          address: formData.address,
          employeeComments: formData.comments,
          status: "pending"
        }),
      });

      if (response.ok) {
        showNotification("Your letter request has been sent.", "success");
        setFormData({
          address: currentEmployee.address || "",
          comments: "",
          letterType: "",
          details: {}
        });
        await fetchRequestHistory();
      } else {
        showNotification("Failed to submit request.", "error");
      }
    } catch (err) {
      showNotification("Submit error.", "error");
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "approved": return "text-green-600 bg-green-100";
      case "rejected": return "text-red-600 bg-red-100";
      case "withdrawn": return "text-gray-600 bg-gray-100";
      default: return "text-amber-600 bg-amber-100";
    }
  };

  const withdrawRequest = async (requestId) => {
    try {
      // Try dedicated withdraw endpoint first
      const response = await fetch(`API_URL/api/letter-requests/${requestId}/withdraw`, {
        method: 'POST'
      });
      if (response.ok) {
        showNotification('Request withdrawn.', 'success');
        await fetchRequestHistory();
        return;
      }

      // Fallback: use generic status update endpoint
      const fallback = await fetch(`API_URL/api/letter-requests/${requestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'withdrawn' })
      });
      if (fallback.ok) {
        showNotification('Request withdrawn.', 'success');
        await fetchRequestHistory();
        return;
      }

      const errText = await fallback.text();
      showNotification(errText || 'Unable to withdraw request.', 'error');
    } catch (e) {
      showNotification('Network error.', 'error');
    }
  };

  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: "📊" },
    { id: "request", label: "Request Letter", icon: "📝" },
    { id: "history", label: "Letter History", icon: "📜" },
    { id: "profile", label: "Profile", icon: "👤" },
  ];

  const baseLetterOptions = [
    { label: "Certification Reimbursement", value: "certification_reimbursement" },
    { label: "HR Letter", value: "hr_letter" },
    { label: "Internship Letter Completion", value: "internship_completion" },
    { label: "Travel NOC Letter", value: "travel_noc" },
    { label: "Visa Letter", value: "visa_letter" },
  ];
  const apiLetterOptions = templates.map(t => ({ label: t.label, value: t.value }));
  const letterOptions = Array.from(new Map([...baseLetterOptions, ...apiLetterOptions].map(o => [o.value, o])).values());

  const letterFieldConfig = {
    certification_reimbursement: [
      { name: "courseName", label: "Course Name", type: "text" },
      { name: "amount", label: "Reimbursement Amount", type: "number" },
      { name: "institute", label: "Institute Name", type: "text" }
    ],
    hr_letter: [
      { name: "recipientName", label: "Recipient Name", type: "text" },
      { name: "recipientAddress", label: "Recipient Address", type: "text" },
      { name: "purpose", label: "Purpose of Letter", type: "text" }
    ],
    internship_completion: [
      { name: "internshipRole", label: "Internship Role", type: "text" },
      { name: "startDate", label: "Start Date", type: "date" },
      { name: "endDate", label: "End Date", type: "date" }
    ],
    travel_noc: [
      { name: "purpose", label: "Purpose of Travel", type: "text" },
      { name: "destination", label: "Destination", type: "text" },
      { name: "travelStart", label: "Travel Start Date", type: "date" },
      { name: "travelEnd", label: "Travel End Date", type: "date" }
    ],
    visa_letter: [
      { name: "country", label: "Country", type: "text" },
      { name: "duration", label: "Stay Duration", type: "text" },
      { name: "purpose", label: "Purpose of Visit", type: "text" }
    ]
  };

  // Prefer fields from template; fallback to static config
  const getFieldsForType = (type) => {
    const t = templates.find(t => t.value === type);
    if (t && Array.isArray(t.fields) && t.fields.length > 0) return t.fields;
    return letterFieldConfig[type] || [];
  };

  const getTemplateUrl = (type) => {
    const t = templates.find(t => t.value === type);
    return (t && t.url) ? t.url : letterTemplates[type];
  };

  // Function to download filled letter template for approved requests
  const downloadFilledTemplate = async (request) => {
    if (request.status !== 'approved') {
      showNotification('Only approved requests can be downloaded', 'error');
      return;
    }

    try {
      // Get filled PDF from backend
      const response = await fetch(`${API_URL}/api/pdf-filler/fill-template`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          letterType: request.letterType,
          employeeData: request
        }),
      });

      if (response.ok) {
        const pdfBlob = await response.blob();
        const url = window.URL.createObjectURL(pdfBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${request.employeeName}_${request.letterType}_filled_letter.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Clean up
        window.URL.revokeObjectURL(url);

        showNotification('Filled PDF letter downloaded successfully!', 'success');
      } else {
        throw new Error('Failed to get filled PDF');
      }
    } catch (error) {
      console.error('Download error:', error);
      showNotification('Failed to download template. Please try again.', 'error');
    }
  };

  // Function to generate filled letter template with employee details
  const generateFilledLetterTemplate = (request) => {
    const today = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // Get employee details
    const employeeName = request.employeeName || currentEmployee?.name || 'N/A';
    const employeeId = request.employeeId || currentEmployee?.employeeId || 'N/A';
    const employeeAddress = request.employeeAddress || currentEmployee?.address || 'N/A';
    const letterType = request.letterType || 'N/A';
    const details = request.details || {};
    const comments = request.employeeComments || request.comments || '';

    // Generate letter content based on type
    let letterContent = '';
    switch (letterType) {
      case 'visa':
        letterContent = generateVisaLetter(employeeName, employeeId, employeeAddress, details);
        break;
      case 'certification':
        letterContent = generateCertificationLetter(employeeName, employeeId, employeeAddress, details);
        break;
      case 'hr_letter':
        letterContent = generateHRLetter(employeeName, employeeId, employeeAddress, details);
        break;
      case 'internship_completion':
        letterContent = generateInternshipLetter(employeeName, employeeId, employeeAddress, details);
        break;
      case 'travel_noc':
        letterContent = generateTravelNOCLetter(employeeName, employeeId, employeeAddress, details);
        break;
      default:
        letterContent = generateGenericLetter(employeeName, employeeId, employeeAddress, details);
    }

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>${employeeName} - ${letterType.replace(/_/g, ' ').toUpperCase()} Letter</title>
    <style>
        body {
            font-family: 'Times New Roman', serif;
            margin: 0;
            padding: 40px;
            line-height: 1.6;
            color: #333;
            background: white;
        }
        .letter-container {
            max-width: 800px;
            margin: 0 auto;
            background: white;
        }
        .letterhead {
            text-align: center;
            margin-bottom: 40px;
            border-bottom: 2px solid #333;
            padding-bottom: 20px;
        }
        .company-name {
            font-size: 24px;
            font-weight: bold;
            margin-bottom: 10px;
            color: #1a365d;
        }
        .company-address {
            font-size: 14px;
            margin-bottom: 5px;
        }
        .date-section {
            margin-bottom: 30px;
        }
        .recipient-section {
            margin-bottom: 30px;
        }
        .salutation {
            margin-bottom: 20px;
        }
        .content {
            text-align: justify;
            margin-bottom: 30px;
        }
        .content p {
            margin-bottom: 15px;
        }
        .employee-details {
            margin: 20px 0;
            padding: 15px;
            background: #f8f9fa;
            border-left: 4px solid #007bff;
        }
        .employee-details h4 {
            margin: 0 0 10px 0;
            color: #007bff;
        }
        .employee-details ul {
            margin: 0;
            padding-left: 20px;
        }
        .employee-details li {
            margin: 5px 0;
        }
        .closing {
            margin-top: 40px;
        }
        .signature {
            margin-top: 30px;
        }
        .signature-line {
            border-top: 1px solid #333;
            width: 200px;
            margin-top: 40px;
        }
        .comments {
            margin: 20px 0;
            padding: 15px;
            background: #fff3cd;
            border-left: 4px solid #ffc107;
            border-radius: 4px;
        }
        .approval-info {
            margin: 20px 0;
            padding: 15px;
            background: #d4edda;
            border-left: 4px solid #28a745;
            border-radius: 4px;
        }
    </style>
</head>
<body>
    <div class="letter-container">
        ${letterContent}

        ${comments ? `
        <div class="comments">
            <h4>Additional Comments:</h4>
            <p>${comments}</p>
        </div>
        ` : ''}

        <div class="approval-info">
            <h4>Approval Information:</h4>
            <p><strong>Status:</strong> APPROVED</p>
            <p><strong>Approval Date:</strong> ${today}</p>
            ${request.adminNotes ? `<p><strong>Admin Notes:</strong> ${request.adminNotes}</p>` : ''}
        </div>

        <div class="closing">
            <p>Thank you for your cooperation.</p>

            <div class="signature">
                <p>Sincerely,</p>
                <div class="signature-line"></div>
                <p><strong>HR Department</strong><br>
                ST. HR Solutions</p>
            </div>
        </div>
    </div>
</body>
</html>`;
  };



  // Letter generation functions for each type
  const generateVisaLetter = (name, id, address, details) => `
        <div class="letterhead">
            <div class="company-name">ST. HR Solutions</div>
            <div class="company-address">123 Business Park, Tech Hub</div>
            <div class="company-address">Bengaluru, Karnataka 560001</div>
            <div class="company-address">Phone: +91-80-1234-5678 | Email: hr@sthrsolutions.com</div>
        </div>

        <div class="date-section">
            <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
        </div>

        <div class="recipient-section">
            <p><strong>To:</strong><br>
            The Visa Officer<br>
            ${details.embassy || '[Embassy/Consulate Name]'}<br>
            ${details.embassyAddress || '[Embassy/Consulate Address]'}</p>
        </div>

        <div class="salutation">
            <p>Dear Sir/Madam,</p>
        </div>

        <div class="content">
            <p>Subject: <strong>Visa Application Support Letter</strong></p>

            <p>This is to certify that <strong>${name}</strong> (Employee ID: <strong>${id}</strong>) is a full-time employee of ST. HR Solutions.</p>

            <div class="employee-details">
                <h4>Employee Details:</h4>
                <ul>
                    <li><strong>Employee Name:</strong> ${name}</li>
                    <li><strong>Employee ID:</strong> ${id}</li>
                    <li><strong>Employee Address:</strong> ${address}</li>
                    <li><strong>Country of Visit:</strong> ${details.country || 'N/A'}</li>
                    <li><strong>Duration of Stay:</strong> ${details.duration || 'N/A'}</li>
                    <li><strong>Purpose of Visit:</strong> ${details.purpose || 'N/A'}</li>
                </ul>
            </div>

            <p>We confirm that the above-mentioned employee is currently employed with our organization and is in good standing. This letter is issued for visa application purposes.</p>

            <p>The employee has been granted leave for the duration of their travel and will return to work upon completion of their visit.</p>
        </div>`;

  const generateCertificationLetter = (name, id, address, details) => `
        <div class="letterhead">
            <div class="company-name">ST. HR Solutions</div>
            <div class="company-address">123 Business Park, Tech Hub</div>
            <div class="company-address">Bengaluru, Karnataka 560001</div>
            <div class="company-address">Phone: +91-80-1234-5678 | Email: hr@sthrsolutions.com</div>
        </div>

        <div class="date-section">
            <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
        </div>

        <div class="recipient-section">
            <p><strong>To:</strong><br>
            ${details.recipient || '[Recipient Name]'}<br>
            ${details.recipientAddress || '[Recipient Address]'}</p>
        </div>

        <div class="salutation">
            <p>Dear Sir/Madam,</p>
        </div>

        <div class="content">
            <p>Subject: <strong>Certification Reimbursement Request</strong></p>

            <p>This letter is to confirm the certification reimbursement request for our employee.</p>

            <div class="employee-details">
                <h4>Employee Details:</h4>
                <ul>
                    <li><strong>Employee Name:</strong> ${name}</li>
                    <li><strong>Employee ID:</strong> ${id}</li>
                    <li><strong>Employee Address:</strong> ${address}</li>
                    <li><strong>Course Name:</strong> ${details.courseName || 'N/A'}</li>
                    <li><strong>Institute:</strong> ${details.institute || 'N/A'}</li>
                    <li><strong>Reimbursement Amount:</strong> $${details.amount || 'N/A'}</li>
                </ul>
            </div>

            <p>We confirm that the above-mentioned employee is currently employed with ST. HR Solutions and is requesting reimbursement for the certification course mentioned above.</p>

            <p>This certification is relevant to the employee's role and will contribute to their professional development and our organization's growth.</p>
        </div>`;

  const generateHRLetter = (name, id, address, details) => `
        <div class="letterhead">
            <div class="company-name">ST. HR Solutions</div>
            <div class="company-address">123 Business Park, Tech Hub</div>
            <div class="company-address">Bengaluru, Karnataka 560001</div>
            <div class="company-address">Phone: +91-80-1234-5678 | Email: hr@sthrsolutions.com</div>
        </div>

        <div class="date-section">
            <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
        </div>

        <div class="recipient-section">
            <p><strong>To:</strong><br>
            ${details.recipient || '[Recipient Name]'}<br>
            ${details.recipientAddress || '[Recipient Address]'}</p>
        </div>

        <div class="salutation">
            <p>Dear ${details.recipient || '[Recipient Name]'},</p>
        </div>

        <div class="content">
            <p>Subject: <strong>Employee Verification Letter</strong></p>

            <p>This letter is being issued on behalf of <strong>${name}</strong> (Employee ID: <strong>${id}</strong>), a valued employee of ST. HR Solutions.</p>

            <div class="employee-details">
                <h4>Employee Details:</h4>
                <ul>
                    <li><strong>Employee Name:</strong> ${name}</li>
                    <li><strong>Employee ID:</strong> ${id}</li>
                    <li><strong>Employee Address:</strong> ${address}</li>
                    <li><strong>Purpose:</strong> ${details.purpose || 'N/A'}</li>
                </ul>
            </div>

            <p>We confirm that the above-mentioned employee is currently employed with our organization and is in good standing.</p>

            <p>This letter is issued for the purpose mentioned above and confirms the employee's association with our organization.</p>
        </div>`;

  const generateInternshipLetter = (name, id, address, details) => `
        <div class="letterhead">
            <div class="company-name">ST. HR Solutions</div>
            <div class="company-address">123 Business Park, Tech Hub</div>
            <div class="company-address">Bengaluru, Karnataka 560001</div>
            <div class="company-address">Phone: +91-80-1234-5678 | Email: hr@sthrsolutions.com</div>
        </div>

        <div class="date-section">
            <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
        </div>

        <div class="recipient-section">
            <p><strong>To:</strong><br>
            ${details.recipient || '[Recipient Name]'}<br>
            ${details.recipientAddress || '[Recipient Address]'}</p>
        </div>

        <div class="salutation">
            <p>Dear Sir/Madam,</p>
        </div>

        <div class="content">
            <p>Subject: <strong>Internship Completion Certificate</strong></p>

            <p>This letter certifies the completion of internship for <strong>${name}</strong> (Employee ID: <strong>${id}</strong>).</p>

            <div class="employee-details">
                <h4>Internship Details:</h4>
                <ul>
                    <li><strong>Intern Name:</strong> ${name}</li>
                    <li><strong>Employee ID:</strong> ${id}</li>
                    <li><strong>Intern Address:</strong> ${address}</li>
                    <li><strong>Internship Role:</strong> ${details.internshipRole || 'N/A'}</li>
                    <li><strong>Start Date:</strong> ${details.startDate || 'N/A'}</li>
                    <li><strong>End Date:</strong> ${details.endDate || 'N/A'}</li>
                </ul>
            </div>

            <p>We confirm that the above-mentioned intern has successfully completed their internship period with ST. HR Solutions and has demonstrated excellent performance during their tenure.</p>

            <p>The intern has gained valuable experience and skills during their internship period and has contributed positively to our organization.</p>

            <p>This certificate is issued to acknowledge the successful completion of the internship program.</p>
        </div>`;

  const generateTravelNOCLetter = (name, id, address, details) => `
        <div class="letterhead">
            <div class="company-name">ST. HR Solutions</div>
            <div class="company-address">123 Business Park, Tech Hub</div>
            <div class="company-address">Bengaluru, Karnataka 560001</div>
            <div class="company-address">Phone: +91-80-1234-5678 | Email: hr@sthrsolutions.com</div>
        </div>

        <div class="date-section">
            <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
        </div>

        <div class="recipient-section">
            <p><strong>To:</strong><br>
            ${details.recipient || '[Recipient Name]'}<br>
            ${details.recipientAddress || '[Recipient Address]'}</p>
        </div>

        <div class="salutation">
            <p>Dear Sir/Madam,</p>
        </div>

        <div class="content">
            <p>Subject: <strong>No Objection Certificate (NOC) for Travel</strong></p>

            <p>This letter serves as a No Objection Certificate (NOC) for travel for <strong>${name}</strong> (Employee ID: <strong>${id}</strong>).</p>

            <div class="employee-details">
                <h4>Travel Details:</h4>
                <ul>
                    <li><strong>Employee Name:</strong> ${name}</li>
                    <li><strong>Employee ID:</strong> ${id}</li>
                    <li><strong>Employee Address:</strong> ${address}</li>
                    <li><strong>Purpose of Travel:</strong> ${details.purpose || 'N/A'}</li>
                    <li><strong>Destination:</strong> ${details.destination || 'N/A'}</li>
                    <li><strong>Travel Start Date:</strong> ${details.travelStart || 'N/A'}</li>
                    <li><strong>Travel End Date:</strong> ${details.travelEnd || 'N/A'}</li>
                </ul>
            </div>

            <p>We have no objection to the employee's travel plans and confirm that this travel is approved by the organization.</p>

            <p>The employee has been granted leave for the duration of their travel and will return to work upon completion of their visit.</p>

            <p>This NOC is issued for the purpose mentioned above and confirms our approval for the employee's travel.</p>
        </div>`;

  const generateGenericLetter = (name, id, address, details) => `
        <div class="letterhead">
            <div class="company-name">ST. HR Solutions</div>
            <div class="company-address">123 Business Park, Tech Hub</div>
            <div class="company-address">Bengaluru, Karnataka 560001</div>
            <div class="company-address">Phone: +91-80-1234-5678 | Email: hr@sthrsolutions.com</div>
        </div>

        <div class="date-section">
            <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
        </div>

        <div class="recipient-section">
            <p><strong>To:</strong><br>
            ${details.recipient || '[Recipient Name]'}<br>
            ${details.recipientAddress || '[Recipient Address]'}</p>
        </div>

        <div class="salutation">
            <p>Dear Sir/Madam,</p>
        </div>

        <div class="content">
            <p>Subject: <strong>Letter of Support</strong></p>

            <p>This letter is being issued on behalf of <strong>${name}</strong> (Employee ID: <strong>${id}</strong>), a valued employee of ST. HR Solutions.</p>

            <div class="employee-details">
                <h4>Employee Details:</h4>
                <ul>
                    <li><strong>Employee Name:</strong> ${name}</li>
                    <li><strong>Employee ID:</strong> ${id}</li>
                    <li><strong>Employee Address:</strong> ${address}</li>
                    ${Object.entries(details).map(([key, value]) =>
                      `<li><strong>${key.replace(/([A-Z])/g, ' $1').trim()}:</strong> ${value || 'N/A'}</li>`
                    ).join('')}
                </ul>
            </div>

            <p>We confirm that the above-mentioned employee is currently employed with our organization and is in good standing.</p>

            <p>This letter is issued for the purpose mentioned above and confirms the employee's association with our organization.</p>
        </div>`;

  if (!currentEmployee) return <div className="p-10 text-lg">Loading...</div>;

  return (
    <div className="flex h-screen w-screen overflow-hidden text-gray-800">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col p-6 shadow-sm">
        <div className="flex items-center space-x-3 mb-8">
          <div className="w-10 h-10 bg-blue-600 text-white rounded-xl flex items-center justify-center font-bold">HR</div>
          <h2 className="text-xl font-bold text-gray-800">Employee Portal</h2>
        </div>
        <nav className="space-y-2 flex-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                activeTab === item.id
                  ? "bg-blue-50 text-blue-700 border-l-4 border-blue-600"
                  : "hover:bg-gray-100"
              }`}
            >
              <span className="text-lg">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="mt-4 space-y-4">
          <div className="flex items-center space-x-3 p-3 bg-gray-50 border border-gray-200 rounded-xl">
            <div className="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">
              {currentEmployee.name.charAt(0)}
            </div>
            <div>
              <p className="text-sm font-medium text-gray-800">{currentEmployee.name}</p>
              <p className="text-xs text-gray-500">Employee</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full bg-red-50 text-red-600 hover:bg-red-100 py-2 px-4 rounded-xl border border-red-100 font-medium"
          >
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto p-8 space-y-6 bg-gray-50">
        <div className="flex justify-between items-center flex-col sm:flex-row">
          <h1 className="text-2xl font-bold capitalize">{activeTab}</h1>
          <div className="flex items-center gap-3 mt-2 sm:mt-0">
            <span className="text-gray-500">Welcome, {currentEmployee.name}</span>
            {currentEmployee?.role?.toLowerCase() === "admin" && (
              <button
                onClick={() => navigate('/admin-dashboard')}
                className="px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Switch to Admin
              </button>
            )}
          </div>
        </div>

        {/* Notification Bar */}
        {notification && (
          <div
            className={`p-3 rounded text-white font-medium mb-4 ${
              notification.type === "success"
                ? "bg-green-600"
                : notification.type === "error"
                ? "bg-red-600"
                : "bg-blue-600"
            }`}
          >
            {notification.message}
          </div>
        )}

        {/* Dashboard Tab */}
        {activeTab === "dashboard" && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {stats.map((stat, index) => (
                <div
                  key={index}
                  className="bg-white p-6 rounded-xl shadow-sm border border-gray-100"
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-gray-600 font-medium">{stat.title}</h3>
                    <div
                      className={`w-10 h-10 ${stat.iconBg} rounded-lg flex items-center justify-center text-lg`}
                    >
                      {stat.icon}
                    </div>
                  </div>
                  <p className="text-3xl font-bold text-gray-800">{stat.value}</p>
                  <div className="w-full mt-3 h-2 bg-gray-100 rounded-full">
                    <div
                      className={`${stat.color} h-2 rounded-full`}
                      style={{ width: `${Math.min(100, Math.max(0, (Number(stat.value) / 50) * 100))}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h2 className="text-xl font-semibold mb-2 text-gray-800">Employee Overview</h2>
              <p className="text-gray-600">
                Request letters, check history, and manage your settings from here.
              </p>
            </div>
          </>
        )}

        {/* Request Tab - Now shows form directly */}
        {activeTab === "request" && (
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 max-w-2xl">
            <h2 className="text-xl font-semibold mb-6 text-gray-800">Letter Request Form</h2>

            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Employee Name</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
                    value={currentEmployee.name}
                    readOnly
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Employee ID</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
                    value={currentEmployee.employeeId}
                    readOnly
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Letter Type *</label>
                <select
                  name="letterType"
                  value={formData.letterType}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  required
                >
                  <option value="">Select Letter Type</option>
                  {letterOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              {(getFieldsForType(formData.letterType) || []).map((field) => (
                <div key={field.name}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{field.label}</label>
                  <input
                    type={field.type}
                    name={field.name}
                    value={formData.details[field.name] || ""}
                    onChange={handleDetailChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    required
                  />
                </div>
              ))}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                <input
                  type="text"
                  name="address"
                  value={formData.address}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="Enter your current address"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Additional Comments</label>
                <textarea
                  name="comments"
                  value={formData.comments}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  rows="4"
                  placeholder="Please provide any additional information that might help process your request..."
                ></textarea>
              </div>
            </div>

            <div className="flex justify-end space-x-4 pt-6">
              <button
                onClick={() => {
                  setFormData({
                    address: currentEmployee.address || "",
                    comments: "",
                    letterType: "",
                    details: {}
                  });
                }}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                Clear Form
              </button>
              <button
                onClick={() => setShowPreview(true)}
                disabled={!formData.letterType}
                className={`px-6 py-2 rounded-md ${
                  formData.letterType
                    ? "bg-gray-600 text-white hover:bg-gray-700"
                    : "bg-gray-300 text-gray-500 cursor-not-allowed"
                }`}
              >
                Preview
              </button>
              <button
                onClick={submitLetterRequest}
                disabled={!formData.letterType}
                className={`px-6 py-2 rounded-md ${
                  formData.letterType
                    ? "bg-blue-600 text-white hover:bg-blue-700"
                    : "bg-gray-300 text-gray-500 cursor-not-allowed"
                }`}
              >
                Submit Request
              </button>
            </div>
          </div>
        )}

        {/* History Tab */}
        {activeTab === "history" && (
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
            <h2 className="text-xl font-semibold mb-4 text-gray-800">Letter History</h2>
            {requestHistory.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500">No letter requests found.</p>
                <button
                  onClick={() => setActiveTab("request")}
                  className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Request a Letter
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Letter Type</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Request Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Admin Notes</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {requestHistory.map((request) => (
                      <tr key={request._id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 capitalize">
                          {request.letterType.replace(/_/g, ' ')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(request.requestDate).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          })}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(
                              request.status
                            )}`}
                          >
                            {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {request.adminNotes || "-"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 space-x-3">
                          {request.status === "approved" && (
                            <button
                              onClick={() => downloadFilledTemplate(request)}
                              className="text-blue-600 hover:text-blue-900 cursor-pointer"
                            >
                              Download
                            </button>
                          )}
                          {request.status === "pending" && (
                            <button
                              onClick={() => withdrawRequest(request._id)}
                              className="text-red-600 hover:text-red-800"
                            >
                              Withdraw
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Profile Tab */}
        {activeTab === "profile" && (
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 max-w-xl">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="text-xl font-semibold text-gray-800">My Profile</h2>
                <p className="text-xs text-gray-500 mt-1">Data synced from CSV where available</p>
              </div>
              {!isEditingProfile ? (
                <button
                  type="button"
                  onClick={() => setIsEditingProfile(true)}
                  className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Edit Details
                </button>
              ) : (
                <div className="space-x-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (initialProfile) setCurrentEmployee(initialProfile);
                      setIsEditingProfile(false);
                    }}
                    className="px-3 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    form="profile-form"
                    className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Save Changes
                  </button>
                </div>
              )}
            </div>
            <form
              id="profile-form"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!isEditingProfile) return;
                try {
                  const res = await fetch(`API_URL/api/employees/${currentEmployee.employeeId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      name: currentEmployee.name,
                      // employeeId and title are intentionally omitted (non-editable)
                      address: currentEmployee.address || '',
                      startDate: currentEmployee.startDate || '',
                      email: currentEmployee.email || ''
                    })
                  });
                  if (res.ok) {
                    const updated = await res.json();
                    localStorage.setItem('employee', JSON.stringify(updated));
                    showNotification('Profile updated', 'success');
                    setCurrentEmployee(updated);
                    setInitialProfile(updated);
                    setIsEditingProfile(false);
                  } else {
                    const err = await res.json().catch(() => ({}));
                    showNotification(err.error || 'Failed to update profile', 'error');
                  }
                } catch {
                  showNotification('Network error', 'error');
                }
              }}
              className="space-y-5"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Full Name</label>
                  <input className="w-full border rounded px-3 py-2 bg-gray-100" value={currentEmployee.name || ''} readOnly />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Employee ID</label>
                  <input className="w-full border rounded px-3 py-2 bg-gray-100" value={currentEmployee.employeeId} readOnly />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Email</label>
                  <input
                    type="email"
                    className={`w-full border rounded px-3 py-2 ${!isEditingProfile ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                    value={currentEmployee.email || ''}
                    onChange={(e) => setCurrentEmployee({ ...currentEmployee, email: e.target.value })}
                    disabled={!isEditingProfile}
                    placeholder="name@example.com"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Title</label>
                  <input className="w-full border rounded px-3 py-2 bg-gray-100" value={currentEmployee.title || ''} readOnly />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Start Date</label>
                  <input
                    type="date"
                    className={`w-full border rounded px-3 py-2 ${!isEditingProfile ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                    value={currentEmployee.startDate ? new Date(currentEmployee.startDate).toISOString().slice(0,10) : ''}
                    onChange={(e) => setCurrentEmployee({ ...currentEmployee, startDate: e.target.value })}
                    disabled={!isEditingProfile}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm text-gray-600 mb-1">Home Address</label>
                  <input
                    className={`w-full border rounded px-3 py-2 ${!isEditingProfile ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                    value={currentEmployee.address || ''}
                    onChange={(e) => setCurrentEmployee({ ...currentEmployee, address: e.target.value })}
                    disabled={!isEditingProfile}
                  />
                </div>
              </div>
            </form>
            {/* Change Password */}
            <div className="mt-8 pt-6 border-t">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Change Password</h3>
              <ChangePassword employeeId={currentEmployee.employeeId} onDone={(msg)=>showNotification(msg,'success')} />
            </div>
          </div>
        )}

        {/* Preview Modal */}
        {showPreview && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold text-gray-800">Preview Letter Request</h2>
                <button
                  onClick={() => setShowPreview(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

            <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">Employee Name</label>
                    <p className="text-gray-800 font-medium">{currentEmployee.name}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">Employee ID</label>
                    <p className="text-gray-800 font-medium">{currentEmployee.employeeId}</p>
                  </div>
                </div>

                    <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Letter Type</label>
                  <p className="text-gray-800 font-medium capitalize">
                    {letterOptions.find(opt => opt.value === formData.letterType)?.label || formData.letterType.replace(/_/g, ' ')}
                  </p>
                </div>

                {getFieldsForType(formData.letterType).map((field) => (
                  <div key={field.name}>
                    <label className="block text-sm font-medium text-gray-600 mb-1">{field.label}</label>
                    <p className="text-gray-800">
                      {formData.details[field.name] || <span className="text-gray-400 italic">Not provided</span>}
                    </p>
                    </div>
                ))}

                    <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Address</label>
                  <p className="text-gray-800">
                    {formData.address || <span className="text-gray-400 italic">Not provided</span>}
                  </p>
                    </div>

                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Additional Comments</label>
                  <p className="text-gray-800">
                    {formData.comments || <span className="text-gray-400 italic">No additional comments</span>}
                  </p>
                </div>
              </div>

              <div className="flex justify-end space-x-4 mt-6 pt-4 border-t">
                <button
                  onClick={() => setShowPreview(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Back to Form
                </button>
                <button
                  onClick={() => {
                    setShowPreview(false);
                    submitLetterRequest();
                  }}
                  className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Submit Request
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function ChangePassword({ employeeId, onDone }) {
  const [oldPassword, setOldPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!oldPassword || !newPassword || !confirmPassword) {
      setError("All fields are required");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New password and confirm password do not match");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`API_URL/api/employees/${employeeId}/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldPassword, newPassword })
      });
      const data = await res.json().catch(()=>({}));
      if (res.ok && data.success) {
        setOldPassword("");
        setNewPassword("");
        setConfirmPassword("");
        onDone && onDone('Password updated successfully');
      } else {
        setError(data.message || 'Failed to update password');
      }
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
      {error && <div className="px-3 py-2 rounded bg-red-50 text-red-700 border border-red-200 text-sm">{error}</div>}
      <div>
        <label className="block text-sm text-gray-600 mb-1">Current Password</label>
        <input type="password" value={oldPassword} onChange={(e)=>setOldPassword(e.target.value)} className="w-full border rounded px-3 py-2" required />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-gray-600 mb-1">New Password</label>
          <input type="password" value={newPassword} onChange={(e)=>setNewPassword(e.target.value)} className="w-full border rounded px-3 py-2" required />
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">Confirm New Password</label>
          <input type="password" value={confirmPassword} onChange={(e)=>setConfirmPassword(e.target.value)} className="w-full border rounded px-3 py-2" required />
        </div>
      </div>
      <button type="submit" disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
        {loading ? 'Updating...' : 'Update Password'}
      </button>
    </form>
  );
}

// Letter generation functions for each type
const generateVisaLetter = (name, id, address, details) => `
  <div class="letterhead">
      <div class="company-name">ST. HR Solutions</div>
      <div class="company-address">123 Business Park, Tech Hub</div>
      <div class="company-address">Bengaluru, Karnataka 560001</div>
      <div class="company-address">Phone: +91-80-1234-5678 | Email: hr@sthrsolutions.com</div>
  </div>

  <div class="date-section">
      <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
  </div>

  <div class="recipient-section">
      <p><strong>To:</strong><br>
      The Visa Officer<br>
      ${details.embassy || '[Embassy/Consulate Name]'}<br>
      ${details.embassyAddress || '[Embassy/Consulate Address]'}</p>
  </div>

  <div class="salutation">
      <p>Dear Sir/Madam,</p>
  </div>

  <div class="content">
      <p>Subject: <strong>Visa Application Support Letter</strong></p>

      <p>This is to certify that <strong>${name}</strong> (Employee ID: <strong>${id}</strong>) is a full-time employee of ST. HR Solutions.</p>

      <div class="employee-details">
          <h4>Employee Details:</h4>
          <ul>
              <li><strong>Employee Name:</strong> ${name}</li>
              <li><strong>Employee ID:</strong> ${id}</li>
              <li><strong>Employee Address:</strong> ${address}</li>
              <li><strong>Country of Visit:</strong> ${details.country || 'N/A'}</li>
              <li><strong>Duration of Stay:</strong> ${details.duration || 'N/A'}</li>
              <li><strong>Purpose of Visit:</strong> ${details.purpose || 'N/A'}</li>
          </ul>
      </div>

      <p>We confirm that the above-mentioned employee is currently employed with our organization and is in good standing. This letter is issued for visa application purposes.</p>

      <p>The employee has been granted leave for the duration of their travel and will return to work upon completion of their visit.</p>
  </div>`;

const generateCertificationLetter = (name, id, address, details) => `
  <div class="letterhead">
      <div class="company-name">ST. HR Solutions</div>
      <div class="company-address">123 Business Park, Tech Hub</div>
      <div class="company-address">Bengaluru, Karnataka 560001</div>
      <div class="company-address">Phone: +91-80-1234-5678 | Email: hr@sthrsolutions.com</div>
  </div>

  <div class="date-section">
      <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
  </div>

  <div class="recipient-section">
      <p><strong>To:</strong><br>
      ${details.recipient || '[Recipient Name]'}<br>
      ${details.recipientAddress || '[Recipient Address]'}</p>
  </div>

  <div class="salutation">
      <p>Dear Sir/Madam,</p>
  </div>

  <div class="content">
      <p>Subject: <strong>Certification Reimbursement Request</strong></p>

      <p>This letter is to confirm the certification reimbursement request for our employee.</p>

      <div class="employee-details">
          <h4>Employee Details:</h4>
          <ul>
              <li><strong>Employee Name:</strong> ${name}</li>
              <li><strong>Employee ID:</strong> ${id}</li>
              <li><strong>Employee Address:</strong> ${address}</li>
              <li><strong>Course Name:</strong> ${details.courseName || 'N/A'}</li>
              <li><strong>Institute:</strong> ${details.institute || 'N/A'}</li>
              <li><strong>Reimbursement Amount:</strong> $${details.amount || 'N/A'}</li>
          </ul>
      </div>

      <p>We confirm that the above-mentioned employee is currently employed with ST. HR Solutions and is requesting reimbursement for the certification course mentioned above.</p>

      <p>This certification is relevant to the employee's role and will contribute to their professional development and our organization's growth.</p>
  </div>`;

const generateHRLetter = (name, id, address, details) => `
  <div class="letterhead">
      <div class="company-name">ST. HR Solutions</div>
      <div class="company-address">123 Business Park, Tech Hub</div>
      <div class="company-address">Bengaluru, Karnataka 560001</div>
      <div class="company-address">Phone: +91-80-1234-5678 | Email: hr@sthrsolutions.com</div>
  </div>

  <div class="date-section">
      <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
  </div>

  <div class="recipient-section">
      <p><strong>To:</strong><br>
      ${details.recipient || '[Recipient Name]'}<br>
      ${details.recipientAddress || '[Recipient Address]'}</p>
  </div>

  <div class="salutation">
      <p>Dear ${details.recipient || '[Recipient Name]'},</p>
  </div>

  <div class="content">
      <p>Subject: <strong>Employee Verification Letter</strong></p>

      <p>This letter is being issued on behalf of <strong>${name}</strong> (Employee ID: <strong>${id}</strong>), a valued employee of ST. HR Solutions.</p>

      <div class="employee-details">
          <h4>Employee Details:</h4>
          <ul>
              <li><strong>Employee Name:</strong> ${name}</li>
              <li><strong>Employee ID:</strong> ${id}</li>
              <li><strong>Employee Address:</strong> ${address}</li>
              <li><strong>Purpose:</strong> ${details.purpose || 'N/A'}</li>
          </ul>
      </div>

      <p>We confirm that the above-mentioned employee is currently employed with our organization and is in good standing.</p>

      <p>This letter is issued for the purpose mentioned above and confirms the employee's association with our organization.</p>
  </div>`;

const generateInternshipLetter = (name, id, address, details) => `
  <div class="letterhead">
      <div class="company-name">ST. HR Solutions</div>
      <div class="company-address">123 Business Park, Tech Hub</div>
      <div class="company-address">Bengaluru, Karnataka 560001</div>
      <div class="company-address">Phone: +91-80-1234-5678 | Email: hr@sthrsolutions.com</div>
  </div>

  <div class="date-section">
      <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
  </div>

  <div class="recipient-section">
      <p><strong>To:</strong><br>
      ${details.recipient || '[Recipient Name]'}<br>
      ${details.recipientAddress || '[Recipient Address]'}</p>
  </div>

  <div class="salutation">
      <p>Dear Sir/Madam,</p>
  </div>

  <div class="content">
      <p>Subject: <strong>Internship Completion Certificate</strong></p>

      <p>This letter certifies the completion of internship for <strong>${name}</strong> (Employee ID: <strong>${id}</strong>).</p>

      <div class="employee-details">
          <h4>Internship Details:</h4>
          <ul>
              <li><strong>Intern Name:</strong> ${name}</li>
              <li><strong>Employee ID:</strong> ${id}</li>
              <li><strong>Intern Address:</strong> ${address}</li>
              <li><strong>Internship Role:</strong> ${details.internshipRole || 'N/A'}</li>
              <li><strong>Start Date:</strong> ${details.startDate || 'N/A'}</li>
              <li><strong>End Date:</strong> ${details.endDate || 'N/A'}</li>
          </ul>
      </div>

      <p>We confirm that the above-mentioned intern has successfully completed their internship period with ST. HR Solutions and has demonstrated excellent performance during their tenure.</p>

      <p>The intern has gained valuable experience and skills during their internship period and has contributed positively to our organization.</p>

      <p>This certificate is issued to acknowledge the successful completion of the internship program.</p>
  </div>`;

const generateTravelNOCLetter = (name, id, address, details) => `
  <div class="letterhead">
      <div class="company-name">ST. HR Solutions</div>
      <div class="company-address">123 Business Park, Tech Hub</div>
      <div class="company-address">Bengaluru, Karnataka 560001</div>
      <div class="company-address">Phone: +91-80-1234-5678 | Email: hr@sthrsolutions.com</div>
  </div>

  <div class="date-section">
      <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
  </div>

  <div class="recipient-section">
      <p><strong>To:</strong><br>
      ${details.recipient || '[Recipient Name]'}<br>
      ${details.recipientAddress || '[Recipient Address]'}</p>
  </div>

  <div class="salutation">
      <p>Dear Sir/Madam,</p>
  </div>

  <div class="content">
      <p>Subject: <strong>No Objection Certificate (NOC) for Travel</strong></p>

      <p>This letter serves as a No Objection Certificate (NOC) for travel for <strong>${name}</strong> (Employee ID: <strong>${id}</strong>).</p>

      <div class="employee-details">
          <h4>Travel Details:</h4>
          <ul>
              <li><strong>Employee Name:</strong> ${name}</li>
              <li><strong>Employee ID:</strong> ${id}</li>
              <li><strong>Employee Address:</strong> ${address}</li>
              <li><strong>Purpose of Travel:</strong> ${details.purpose || 'N/A'}</li>
              <li><strong>Destination:</strong> ${details.destination || 'N/A'}</li>
              <li><strong>Travel Start Date:</strong> ${details.travelStart || 'N/A'}</li>
              <li><strong>Travel End Date:</strong> ${details.travelEnd || 'N/A'}</li>
          </ul>
      </div>

      <p>We have no objection to the employee's travel plans and confirm that this travel is approved by the organization.</p>

      <p>The employee has been granted leave for the duration of their travel and will return to work upon completion of their visit.</p>

      <p>This NOC is issued for the purpose mentioned above and confirms our approval for the employee's travel.</p>
  </div>`;

const generateGenericLetter = (name, id, address, details) => `
  <div class="letterhead">
      <div class="company-name">ST. HR Solutions</div>
      <div class="company-address">123 Business Park, Tech Hub</div>
      <div class="company-address">Bengaluru, Karnataka 560001</div>
      <div class="company-address">Phone: +91-80-1234-5678 | Email: hr@sthrsolutions.com</div>
  </div>

  <div class="date-section">
      <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
  </div>

  <div class="recipient-section">
      <p><strong>To:</strong><br>
      ${details.recipient || '[Recipient Name]'}<br>
      ${details.recipientAddress || '[Recipient Address]'}</p>
  </div>

  <div class="salutation">
      <p>Dear Sir/Madam,</p>
  </div>

  <div class="content">
      <p>Subject: <strong>Letter of Support</strong></p>

      <p>This letter is being issued on behalf of <strong>${name}</strong> (Employee ID: <strong>${id}</strong>), a valued employee of ST. HR Solutions.</p>

      <div class="employee-details">
          <h4>Employee Details:</h4>
          <ul>
              <li><strong>Employee Name:</strong> ${name}</li>
              <li><strong>Employee ID:</strong> ${id}</li>
              <li><strong>Employee Address:</strong> ${address}</li>
              ${Object.entries(details).map(([key, value]) =>
                `<li><strong>${key.replace(/([A-Z])/g, ' $1').trim()}:</strong> ${value || 'N/A'}</li>`
              ).join('')}
          </ul>
      </div>

      <p>We confirm that the above-mentioned employee is currently employed with our organization and is in good standing.</p>

      <p>This letter is issued for the purpose mentioned above and confirms the employee's association with our organization.</p>
  </div>`;
