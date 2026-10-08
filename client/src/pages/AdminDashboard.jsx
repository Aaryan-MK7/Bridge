import { API_URL } from "../config/api";
import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import PDFViewer from "../components/PDFViewer";
import DocuSignIntegration from "../components/DocuSignIntegration";
import EmailNotification from "../components/EmailNotification";

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [templateMenuOpen, setTemplateMenuOpen] = useState(false);
  const templateMenuRef = useRef();
  const navigate = useNavigate();
  const [employeeData, setEmployeeData] = useState([]);
  const [apiError, setApiError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [letterRequests, setLetterRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState(null);
  const [previewModal, setPreviewModal] = useState({ show: false, content: null, filename: null });
  const [activeEmployeeMenu, setActiveEmployeeMenu] = useState(null); // New state to track the active employee menu
  const [templates, setTemplates] = useState([]);
  const [newTemplate, setNewTemplate] = useState({ label: "", value: "", url: "", fields: [{ name: "", label: "", type: "text" }] });
  const [newEmployee, setNewEmployee] = useState({ employeeId: "", name: "", startDate: "", title: "", address: "" });
  const [smtpConfig, setSmtpConfig] = useState({ host: "", port: 587, user: "", pass: "", from: "", adminEmail: "" });

  const filteredEmployees = employeeData.filter(
    (row) =>
      (row.name && row.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (row.employeeId && row.employeeId.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Dropdown template options
  const templateOptions = [
    {
      label: "Certification Reimbursement",
      value: "certification",
      url: "https://docs.google.com/document/d/193TkX-J6HHpoWx8Ahdhof3EukhGkk6VV/edit",
    },
    {
      label: "HR Letter",
      value: "hr_letter",
      url: "https://docs.google.com/document/d/1SgBMZYqTtQlbvUbk38S3YXk-b0xokwl4/edit",
    },
    {
      label: "Internship Letter Completion",
      value: "internship_completion",
      url: "https://docs.google.com/document/d/1YuRniRa8TlCRB9-x0oWFPMMkxmUCJfOR/edit",
    },
    {
      label: "Travel NOC Letter",
      value: "travel_noc",
      url: "https://docs.google.com/document/d/1wc6birpYSbuxyQhDgHLD-2yaapLJEawl/edit",
    },
    {
      label: "Visa Letter",
      value: "visa",
      url: "https://docs.google.com/document/d/1KGIPp31eyIGixIfBqk3O20nrHY47oq_N/edit",
    },
  ];

  // For tracking previous pending request count for notifications
  const prevPendingCountRef = useRef(0);

  // Close template dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (templateMenuRef.current && !templateMenuRef.current.contains(event.target)) {
        setTemplateMenuOpen(false);
      }
    };
    if (templateMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [templateMenuOpen]);

  // Fetch employees and letter requests on mount
  useEffect(() => {
    fetchEmployees();
    fetchLetterRequests();
    fetchTemplates();
    // Load SMTP settings
    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/settings/smtp`);
        if (res.ok) {
          const data = await res.json();
          setSmtpConfig({
            host: data.host || '',
            port: data.port || 587,
            user: data.user || '',
            pass: data.pass ? '********' : '', // masked
            from: data.from || '',
            adminEmail: data.adminEmail || ''
          });
        }
      } catch {}
    })();
  }, []);

  // Fetch employee data with detailed error logging
  const fetchEmployees = () => {
    fetch(`${API_URL}/api/employees`)
      .then((response) => {
        if (!response.ok) throw new Error(`Failed to load employee data, status: ${response.status}`);
        return response.json();
      })
      .then((data) => {
        setEmployeeData(data);
        setApiError("");
      })
      .catch((err) => {
        console.error("Fetch employee error:", err);
        setApiError(err.message);
      });
  };

  // Fetch letter requests and notify if new pending requests arrive
  const fetchLetterRequests = async () => {
    try {
      const response = await fetch(`${API_URL}/api/letter-requests`);
      if (response.ok) {
        const data = await response.json();
        setLetterRequests(data);

        const pendingCount = data.filter((req) => req.status === "pending").length;

        if (pendingCount > prevPendingCountRef.current) {
          showNotification("New letter request received.", "info");
        }

        prevPendingCountRef.current = pendingCount;
        // setPendingRequests(pendingCount); // This state is no longer needed
      } else {
        console.error("Failed to fetch letter requests, status:", response.status);
      }
    } catch (error) {
      console.error("Error fetching letter requests:", error);
    }
  };

  // Show notification message
  const showNotification = (message, type = "info") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  };

  const fetchTemplates = async () => {
    try {
      const res = await fetch(`${API_URL}/api/templates`);
      if (res.ok) {
        const data = await res.json();
        setTemplates(data);
      }
    } catch (e) {
      console.error("Failed to load templates", e);
    }
  };

  const addFieldRow = () => {
    setNewTemplate((prev) => ({ ...prev, fields: [...prev.fields, { name: "", label: "", type: "text" }] }));
  };

  const updateFieldRow = (index, key, value) => {
    setNewTemplate((prev) => {
      const updated = [...prev.fields];
      updated[index] = { ...updated[index], [key]: value };
      return { ...prev, fields: updated };
    });
  };

  const removeFieldRow = (index) => {
    setNewTemplate((prev) => ({ ...prev, fields: prev.fields.filter((_, i) => i !== index) }));
  };

  const handleCreateTemplate = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_URL}/api/templates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newTemplate),
      });
      if (res.ok || res.status === 201) {
        showNotification("Template created", "success");
        setNewTemplate({ label: "", value: "", url: "", fields: [{ name: "", label: "", type: "text" }] });
        fetchTemplates();
      } else {
        const err = await res.json().catch(() => ({}));
        showNotification(err.error || "Failed to create template", "error");
      }
    } catch (e) {
      showNotification("Network error", "error");
    }
  };

  // Logout handler
  const handleLogout = () => {
    navigate("/");
  };

  // Open selected template URL in new tab
  const handleNewTemplateSelect = (option) => {
    setTemplateMenuOpen(false);
    if (option.url) {
      window.open(option.url, "_blank", "noopener");
    } else {
      alert(`Selected: ${option.label}`);
    }
  };

  // Download generated letter
  const handleDownloadLetter = async (requestId) => {
    try {
      const response = await fetch(`API_URL/api/letter-requests/${requestId}/download-letter`);

      if (response.ok) {
        // Create blob and download
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `letter_${requestId}.docx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        showNotification("Letter downloaded successfully!", "success");
      } else {
        const error = await response.json();
        showNotification(error.error || "Failed to download letter", "error");
      }
    } catch (error) {
      console.error("Error downloading letter:", error);
      showNotification("Error downloading letter", "error");
    }
  };

  // Get DocuSign status for a letter request
  const handleGetDocuSignStatus = async (requestId) => {
    try {
      const response = await fetch(`API_URL/api/letter-requests/${requestId}/docusign-status`);
      if (response.ok) {
        const result = await response.json();
        showNotification(`DocuSign Status: ${result.status}`, "success");
        fetchLetterRequests();
      } else {
        showNotification("Failed to get DocuSign status", "error");
      }
    } catch (error) {
      console.error("Error getting DocuSign status:", error);
      showNotification("Error getting DocuSign status", "error");
    }
  };

  // Get signing URL for a letter request
  const handleGetSigningUrl = async (requestId) => {
    try {
      const response = await fetch(`API_URL/api/letter-requests/${requestId}/signing-url`);
      if (response.ok) {
        const result = await response.json();
        window.open(result.signingUrl, '_blank', 'width=800,height=600');
        showNotification("Signing URL opened in new window", "success");
      } else {
        showNotification("Failed to get signing URL", "error");
      }
    } catch (error) {
      console.error("Error getting signing URL:", error);
      showNotification("Error getting signing URL", "error");
    }
  };

  // Handle making an employee an admin
  const handleMakeAdmin = async (employeeId) => {
    try {
      const current = JSON.parse(localStorage.getItem('employee') || '{}');
      const response = await axios.patch(
        `API_URL/api/employees/${employeeId}/make-admin`,
        { requesterId: current.employeeId }
      );
      if (response.status === 200) {
        showNotification("Employee successfully made an admin!", "success");
        fetchEmployees();
      }
    } catch (error) {
      const msg = error?.response?.data?.error || "Failed to make employee an admin. Please try again.";
      console.error("Error making employee an admin:", error);
      showNotification(msg, "error");
    }
    setActiveEmployeeMenu(null); // Close the menu
  };

  const handleRemoveAdmin = async (employeeId) => {
    try {
      const current = JSON.parse(localStorage.getItem('employee') || '{}');
      const response = await axios.patch(
        `API_URL/api/employees/${employeeId}/remove-admin`,
        { requesterId: current.employeeId }
      );
      if (response.status === 200) {
        showNotification("Admin removed successfully!", "success");
        fetchEmployees();
      }
    } catch (error) {
      const msg = error?.response?.data?.error || "Failed to remove admin. Please try again.";
      console.error("Error removing admin:", error);
      showNotification(msg, "error");
    }
    setActiveEmployeeMenu(null);
  };

  const handleAddEmployee = async (e) => {
    e.preventDefault();
    try {
      if (!newEmployee.employeeId || !newEmployee.name) {
        showNotification("Employee ID and Name are required", "error");
        return;
      }
      const payload = {
        employeeId: newEmployee.employeeId.trim(),
        name: newEmployee.name.trim(),
        startDate: newEmployee.startDate || undefined,
        title: newEmployee.title || "",
        address: newEmployee.address || "",
      };
      const res = await axios.post(`${API_URL}/api/employees`, payload);
      if (res.status === 201 || res.status === 200) {
        showNotification("Employee added successfully", "success");
        setNewEmployee({ employeeId: "", name: "", startDate: "", title: "", address: "" });
        fetchEmployees();
      }
    } catch (err) {
      const msg = err?.response?.data?.error || "Failed to add employee";
      showNotification(msg, "error");
    }
  };

  // Preview generated letter content in a modal
  const handlePreviewLetterContent = async (requestId) => {
    try {
      const response = await fetch(`API_URL/api/letter-requests/${requestId}/preview-letter`);

      if (response.ok) {
        const result = await response.json();

        if (result.success && result.content) {
          // Show preview modal with letter information
          setPreviewModal({
            show: true,
            content: {
              filename: result.filename,
              generatedDate: result.generatedDate,
              size: result.content ? Math.round(result.content.length * 0.75) : 0 // Approximate file size
            },
            filename: result.filename
          });

        } else {
          showNotification("No letter content found to preview", "error");
        }
      } else {
        const error = await response.json();
        showNotification(error.error || "Failed to preview letter", "error");
      }
    } catch (error) {
      console.error("Error previewing letter content:", error);
      showNotification("Error previewing letter content", "error");
    }
  };

  // Approve letter request and send to DocuSign
  const handleApproveAndSendToDocuSign = async (requestId, adminEmail) => {
    try {
      const response = await fetch(`API_URL/api/letter-requests/${requestId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: "approved",
          adminEmail: adminEmail,
        }),
      });

      if (response.ok) {
        const result = await response.json();

        if (result.success && result.redirectUrl) {
          // Redirect to DocuSign for signing
          window.open(result.redirectUrl, '_blank');
          showNotification(`Request approved and sent to DocuSign! Envelope ID: ${result.envelopeId}`, "success");
        } else if (result.success) {
          showNotification("Request approved successfully!", "success");
        } else {
          showNotification(result.error || "Failed to approve request", "error");
        }

        fetchLetterRequests();
      } else {
        const error = await response.json();
        if (error.requiresDocuSignAuth) {
          showNotification("Please connect to DocuSign first before approving requests", "error");
        } else {
          showNotification(error.error || "Failed to approve request", "error");
        }
      }
    } catch (error) {
      console.error("Error approving request:", error);
      showNotification("Error approving request. Please try again.", "error");
    }
  };

  // Reject letter request
  const handleRejectRequest = async (requestId) => {
    try {
      const response = await fetch(`API_URL/api/letter-requests/${requestId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: "rejected",
        }),
      });

      if (response.ok) {
        showNotification("Request rejected successfully!", "success");
        fetchLetterRequests();
      } else {
        const error = await response.json();
        showNotification(error.error || "Failed to reject request", "error");
      }
    } catch (error) {
      console.error("Error rejecting request:", error);
      showNotification("Error rejecting request. Please try again.", "error");
    }
  };

  // Navigation items
  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: "📊" },
    { id: "templates", label: "Manage Templates", icon: "📝" },
    { id: "docusign", label: "DocuSign Integration", icon: "📋" },
    { id: "requests", label: "Letter Requests", icon: "📨" },
    { id: "email", label: "HR Communications", icon: "📧" },
    { id: "employeeData", label: "Employee Data", icon: "🗂️" },
    { id: "settings", label: "Settings", icon: "⚙️" },
  ];

  const stats = [
    {
      title: "Total Users",
      value: employeeData.length.toString(),
      color: "bg-gradient-to-r from-blue-600 to-blue-400",
      iconBg: "bg-blue-100 text-blue-600",
      icon: "👥",
    },
    {
      title: "Pending Requests",
      value: letterRequests.filter(req => req.status === "pending").length.toString(),
      color: "bg-gradient-to-r from-amber-500 to-amber-400",
      iconBg: "bg-amber-100 text-amber-600",
      icon: "⏳",
    },
    {
      title: "Active Templates",
      value: templates.length.toString(),
      color: "bg-gradient-to-r from-emerald-500 to-emerald-400",
      iconBg: "bg-emerald-100 text-emerald-600",
      icon: "📄",
    },
  ];

  // Status badge color helper
  const getStatusColor = (status) => {
    switch (status) {
      case "approved":
        return "text-green-600 bg-green-100";
      case "rejected":
        return "text-red-600 bg-red-100";
      case "letter_generated":
        return "text-indigo-600 bg-indigo-100";
      case "sent_for_signing":
        return "text-purple-600 bg-purple-100";
      case "signed":
        return "text-blue-600 bg-blue-100";
      case "completed":
        return "text-green-700 bg-green-200";
      case "withdrawn":
        return "text-gray-600 bg-gray-100";
      default:
        return "text-amber-600 bg-amber-100";
    }
  };

  return (
    <div className="flex h-screen w-screen bg-gray-50 text-gray-800 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col p-6 shadow-sm">
        <div className="flex-1">
          <div className="flex items-center space-x-3 mb-8">
            <div className="w-10 h-10 bg-blue-600 text-white rounded-xl flex items-center justify-center font-bold">
              HR
            </div>
            <h2 className="text-xl font-bold text-gray-800">Admin Portal</h2>
          </div>
          <nav className="space-y-2">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === item.id
                    ? "bg-blue-50 text-blue-700 border-l-4 border-blue-600"
                    : "bg-white text-gray-600 hover:bg-gray-100"
                }`}
              >
                <span className="text-lg">{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
        </div>

        <div className="mt-8">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gray-200 text-gray-600 rounded-xl flex items-center justify-center font-bold">
              A
            </div>
            <div>
              <div className="font-semibold">Admin</div>
              <div className="text-xs text-gray-500">Administrator</div>
            </div>
          </div>
          <button
            className="mt-6 w-full bg-red-50 text-red-600 py-2 rounded-lg font-semibold hover:bg-red-100 transition"
            onClick={handleLogout}
          >
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-auto">
        <div className="p-8 space-y-6">
          <div className="flex justify-between items-center flex-col sm:flex-row">
            <h1 className="text-2xl font-bold text-gray-800 capitalize">
              {activeTab === 'dashboard' && 'Admin Dashboard'}
              {activeTab === 'templates' && 'Manage Templates'}
              {activeTab === 'docusign' && 'DocuSign Integration'}
              {activeTab === 'requests' && 'Letter Requests'}
              {activeTab === 'email' && 'HR Communications'}
              {activeTab === 'employeeData' && 'Employee Data'}
              {activeTab === 'settings' && 'Settings'}
            </h1>
            <div className="flex items-center gap-3 mt-2 sm:mt-0">
              <span className="text-gray-600">Welcome, Admin 👋</span>
              <button
                onClick={() => navigate('/dashboard')}
                className="px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Switch to Employee
              </button>
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {stats.map((stat, index) => (
                <div
                  key={index}
                  className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition duration-300 border border-gray-100"
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
          )}

          {/* Manage Templates Tab */}
          {activeTab === "templates" && (
            <div className="mt-10">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="card">
                  <h3 className="text-lg font-semibold mb-3">Existing Templates</h3>
                  {templates.length === 0 ? (
                    <div className="text-sm text-gray-500">No templates yet.</div>
                  ) : (
                    <ul className="divide-y border rounded">
                      {templates.map((t) => (
                        <li key={t._id} className="p-3 flex items-center justify-between">
                          <div>
                            <div className="font-medium">{t.label}</div>
                            <div className="text-xs text-gray-500">value: {t.value}</div>
                          </div>
                          <a href={t.url} target="_blank" rel="noreferrer" className="text-blue-600 text-sm">Template</a>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="card">
                  <h3 className="text-lg font-semibold mb-3">Add New Letter Type</h3>
                  <form onSubmit={handleCreateTemplate} className="space-y-3">
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">Label</label>
                      <input value={newTemplate.label} onChange={(e) => setNewTemplate({ ...newTemplate, label: e.target.value })} className="w-full border px-3 py-2 rounded" required />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">Value (unique key)</label>
                      <input value={newTemplate.value} onChange={(e) => setNewTemplate({ ...newTemplate, value: e.target.value })} className="w-full border px-3 py-2 rounded" required />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">Template URL (optional)</label>
                      <input value={newTemplate.url} onChange={(e) => setNewTemplate({ ...newTemplate, url: e.target.value })} className="w-full border px-3 py-2 rounded" />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-sm text-gray-700">Fields</label>
                        <button type="button" onClick={addFieldRow} className="text-blue-600 text-sm">+ Add Field</button>
                      </div>
                      <div className="space-y-2">
                        {newTemplate.fields.map((f, idx) => (
                          <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                            <input placeholder="name" value={f.name} onChange={(e) => updateFieldRow(idx, 'name', e.target.value)} className="col-span-4 border px-2 py-1 rounded" required />
                            <input placeholder="label" value={f.label} onChange={(e) => updateFieldRow(idx, 'label', e.target.value)} className="col-span-5 border px-2 py-1 rounded" required />
                            <select value={f.type} onChange={(e) => updateFieldRow(idx, 'type', e.target.value)} className="col-span-2 border px-2 py-1 rounded">
                              <option value="text">text</option>
                              <option value="number">number</option>
                              <option value="date">date</option>
                            </select>
                            <button type="button" onClick={() => removeFieldRow(idx)} className="col-span-1 text-red-600">✕</button>
                          </div>
                        ))}
                      </div>
                    </div>
                    <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">Create</button>
                  </form>
                </div>
              </div>
            </div>
          )}

          {/* DocuSign Integration Tab */}
          {activeTab === "docusign" && (
            <div className="mt-10">
              <DocuSignIntegration />
            </div>
          )}

          {/* Email Communications Tab */}
          {activeTab === "email" && (
            <div className="mt-10">
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold text-gray-800 mb-6">HR Communications</h2>
                <p className="text-gray-600 mb-6">
                  Use this form to send direct communications to employees or other departments.
                  All emails are sent through EmailJS for reliable delivery.
                </p>
                <EmailNotification />
              </div>
            </div>
          )}

          {/* Letter Requests Tab */}
          {activeTab === "requests" && (
            <div className="mt-10">
              {/* Letter Requests Section */}
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-semibold text-gray-800">Letter Requests</h2>
                  <div className="text-sm text-gray-600">
                    <p>📝 <strong>New Workflow:</strong> Letters are automatically generated with employee details when submitted.</p>
                    <p>👀 <strong>Preview:</strong> Click "Preview Letter" to see the filled letter before approval.</p>
                    <p>✅ <strong>Approve:</strong> Click "Approve & Send to DocuSign" to approve and sign in DocuSign.</p>
                    <p>📥 <strong>Download:</strong> Download the filled letter anytime after generation.</p>
                  </div>
                </div>

                {letterRequests.length === 0 ? (
                  <div className="text-gray-600">No letter requests found.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Employee</th>
                          <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Letter Type</th>
                          <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Request Date</th>
                          <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Status</th>
                          <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Generated Letter</th>
                          <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">DocuSign</th>
                          <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {letterRequests.map((request) => (
                          <tr key={request._id} className="hover:bg-gray-50">
                            <td className="px-4 py-2">
                              <div>
                                <div className="font-medium">{request.employeeName}</div>
                                <div className="text-sm text-gray-500">ID: {request.employeeId}</div>
                              </div>
                            </td>
                            <td className="px-4 py-2">{request.letterType}</td>
                            <td className="px-4 py-2">
                              {new Date(request.requestDate).toLocaleDateString()}
                            </td>
                            <td className="px-4 py-2">
                              <span
                                className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                                  request.status
                                )}`}
                              >
                                {request.status}
                              </span>
                            </td>
                            <td className="px-4 py-2">
                              {request.generatedLetterFilename ? (
                                <div className="text-sm">
                                  <div className="font-medium">{request.generatedLetterFilename}</div>
                                  {request.letterGeneratedDate && (
                                    <div className="text-xs text-gray-500">
                                      Generated: {new Date(request.letterGeneratedDate).toLocaleDateString()}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="text-sm text-gray-400">Not generated</div>
                              )}
                            </td>
                            <td className="px-4 py-2">
                              {request.docusignEnvelopeId ? (
                                <div className="text-sm">
                                  <div className="font-medium">Envelope: {request.docusignEnvelopeId}</div>
                                  <div className="text-xs text-gray-500">
                                    Status: {request.docusignEnvelopeStatus}
                                  </div>
                                  {request.docusignSentDate && (
                                    <div className="text-xs text-gray-500">
                                      Sent: {new Date(request.docusignSentDate).toLocaleDateString()}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="text-sm text-gray-400">Not sent</div>
                              )}
                            </td>
                            <td className="px-4 py-2">
                              <div className="flex space-x-2">
                                {request.status === "pending" && (
                                  <>
                                    <button
                                      onClick={() => handlePreviewLetterContent(request._id)}
                                      className="text-blue-600 hover:text-blue-900 text-sm font-medium"
                                    >
                                      Preview Letter
                                    </button>
                                    <button
                                      onClick={() => {
                                        const adminEmail = prompt("Enter your admin email for DocuSign signing:");
                                        if (adminEmail) {
                                          handleApproveAndSendToDocuSign(request._id, adminEmail);
                                        }
                                      }}
                                      className="text-green-600 hover:text-green-900 text-sm font-medium"
                                    >
                                      Approve & Send to DocuSign
                                    </button>
                                    <button
                                      onClick={() => handleRejectRequest(request._id)}
                                      className="text-red-600 hover:text-red-900 text-sm font-medium"
                                    >
                                      Reject
                                    </button>
                                  </>
                                )}
                                {request.status === "approved" && (
                                  <button
                                    onClick={() => handleDownloadLetter(request._id)}
                                    className="text-indigo-600 hover:text-indigo-900 text-sm font-medium"
                                  >
                                    Download Filled Letter
                                  </button>
                                )}
                                {request.status === "letter_generated" && (
                                  <>
                                    <button
                                      onClick={() => handlePreviewLetterContent(request._id)}
                                      className="text-blue-600 hover:text-blue-900 text-sm font-medium"
                                    >
                                      Preview Letter
                                    </button>
                                    <button
                                      onClick={() => handleDownloadLetter(request._id)}
                                      className="text-green-600 hover:text-green-900 text-sm font-medium"
                                    >
                                      Download Letter
                                    </button>
                                    <button
                                      onClick={() => {
                                        const adminEmail = prompt("Enter your admin email for signing:");
                                        if (adminEmail) {
                                          // Use the existing send to DocuSign functionality
                                          fetch(`API_URL/api/letter-requests/${request._id}/send-to-docusign`, {
                                            method: "POST",
                                            headers: {
                                              "Content-Type": "application/json",
                                            },
                                            body: JSON.stringify({
                                              adminEmail: adminEmail,
                                            }),
                                          })
                                          .then(response => response.json())
                                          .then(result => {
                                            if (result.success) {
                                              showNotification(`Letter sent to DocuSign! Envelope ID: ${result.envelopeId}`, "success");
                                              fetchLetterRequests();
                                            } else {
                                              showNotification(result.error || "Failed to send to DocuSign", "error");
                                            }
                                          })
                                          .catch(error => {
                                            console.error("Error sending to DocuSign:", error);
                                            showNotification("Error sending to DocuSign", "error");
                                          });
                                        }
                                      }}
                                      className="text-purple-600 hover:text-purple-900 text-sm font-medium"
                                    >
                                      Send to DocuSign
                                    </button>
                                  </>
                                )}
                                {request.docusignEnvelopeId && (
                                  <button
                                    onClick={() => handleGetDocuSignStatus(request._id)}
                                    className="text-orange-600 hover:text-orange-900 text-sm font-medium"
                                  >
                                    Check Status
                                  </button>
                                )}
                                {request.docusignEnvelopeStatus === 'sent' && (
                                  <button
                                    onClick={() => handleGetSigningUrl(request._id)}
                                    className="text-blue-600 hover:text-blue-900 text-sm font-medium"
                                  >
                                    Sign Letter
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}


          {/* Employee Data Tab */}
          {/* Settings Tab */}
          {activeTab === 'settings' && (
            <div className="mt-10 grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="card">
                <h3 className="text-lg font-semibold mb-3">SMTP Settings</h3>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    try {
                      const payload = {
                        host: smtpConfig.host,
                        port: Number(smtpConfig.port) || 587,
                        user: smtpConfig.user,
                        pass: smtpConfig.pass === '********' ? undefined : smtpConfig.pass,
                        from: smtpConfig.from,
                        adminEmail: smtpConfig.adminEmail,
                      };
                      const res = await fetch(`${API_URL}/api/settings/smtp`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                      });
                      if (res.ok) {
                        showNotification('SMTP settings saved', 'success');
                      } else {
                        const err = await res.json().catch(()=>({}));
                        showNotification(err.error || 'Failed to save settings', 'error');
                      }
                    } catch {
                      showNotification('Network error', 'error');
                    }
                  }}
                  className="space-y-3"
                >
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">Host</label>
                    <input value={smtpConfig.host} onChange={(e)=>setSmtpConfig({...smtpConfig, host: e.target.value})} className="w-full border px-3 py-2 rounded" required />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">Port</label>
                      <input type="number" value={smtpConfig.port} onChange={(e)=>setSmtpConfig({...smtpConfig, port: e.target.value})} className="w-full border px-3 py-2 rounded" required />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">From</label>
                      <input value={smtpConfig.from} onChange={(e)=>setSmtpConfig({...smtpConfig, from: e.target.value})} className="w-full border px-3 py-2 rounded" placeholder='HR Letters <no-reply@company.com>' />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">User</label>
                      <input value={smtpConfig.user} onChange={(e)=>setSmtpConfig({...smtpConfig, user: e.target.value})} className="w-full border px-3 py-2 rounded" />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">Password</label>
                      <input type="password" value={smtpConfig.pass} onChange={(e)=>setSmtpConfig({...smtpConfig, pass: e.target.value})} className="w-full border px-3 py-2 rounded" placeholder="********" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">Fallback Admin Email</label>
                    <input value={smtpConfig.adminEmail} onChange={(e)=>setSmtpConfig({...smtpConfig, adminEmail: e.target.value})} className="w-full border px-3 py-2 rounded" />
                  </div>
                  <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">Save</button>
                </form>
              </div>
              <div className="card">
                <h3 className="text-lg font-semibold mb-3">Test Email</h3>
                <p className="text-sm text-gray-600 mb-3">Sends a test email to the fallback admin address or the current admin's email if set.</p>
                <button
                  onClick={async ()=>{
                    try {
                      await fetch(`${API_URL}/api/settings/smtp`);
                      showNotification('Save settings, then trigger a real notification by submitting/approving a request', 'info');
                    } catch {
                      showNotification('Backend offline', 'error');
                    }
                  }}
                  className="px-4 py-2 bg-gray-600 text-white rounded"
                >
                  Send Test (instruction)
                </button>
              </div>
            </div>
          )}
          {activeTab === "employeeData" && (
            <div className="mt-10">
              <div className="mb-6 p-4 border rounded bg-white">
                <h3 className="text-lg font-semibold mb-3">Add Employee</h3>
                <form onSubmit={handleAddEmployee} className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">Employee ID *</label>
                    <input
                      value={newEmployee.employeeId}
                      onChange={(e) => setNewEmployee({ ...newEmployee, employeeId: e.target.value })}
                      className="w-full border px-3 py-2 rounded"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">Employee Name *</label>
                    <input
                      value={newEmployee.name}
                      onChange={(e) => setNewEmployee({ ...newEmployee, name: e.target.value })}
                      className="w-full border px-3 py-2 rounded"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">Start Date</label>
                    <input
                      type="date"
                      value={newEmployee.startDate}
                      onChange={(e) => setNewEmployee({ ...newEmployee, startDate: e.target.value })}
                      className="w-full border px-3 py-2 rounded"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">Title</label>
                    <input
                      value={newEmployee.title}
                      onChange={(e) => setNewEmployee({ ...newEmployee, title: e.target.value })}
                      className="w-full border px-3 py-2 rounded"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">Home Address</label>
                    <input
                      value={newEmployee.address}
                      onChange={(e) => setNewEmployee({ ...newEmployee, address: e.target.value })}
                      className="w-full border px-3 py-2 rounded"
                    />
                  </div>
                  <div className="md:col-span-5 flex justify-end">
                    <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">Add</button>
                  </div>
                </form>
              </div>
              <div className="mb-6 p-4 border rounded bg-white">
                <h3 className="text-lg font-semibold mb-3">Import Employees (CSV)</h3>
                <form onSubmit={async (e)=>{
                  e.preventDefault();
                  const fileInput = e.currentTarget.querySelector('input[type="file"]');
                  if (!fileInput.files[0]) return;
                  const formData = new FormData();
                  formData.append('file', fileInput.files[0]);
                  try {
                    const res = await fetch(`${API_URL}/api/employees/import`, {
                      method: 'POST',
                      body: formData
                    });
                    if (res.ok) {
                      showNotification('Import completed', 'success');
                      fetchEmployees();
                    } else {
                      const err = await res.json().catch(()=>({}));
                      showNotification(err.error || 'Import failed', 'error');
                    }
                  } catch {
                    showNotification('Network error', 'error');
                  } finally {
                    fileInput.value = '';
                  }
                }} className="flex items-center gap-3">
                  <input type="file" accept=".csv" className="border px-3 py-2 rounded" />
                  <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">Upload</button>
                </form>
                <p className="text-xs text-gray-500 mt-2">Supported headers: Employee ID, Employee, Start date, Title, Home address - Full address, Email</p>
              </div>
              <input
                type="text"
                placeholder="Search by name or employee ID..."
                className="mb-4 px-4 py-2 border rounded w-full max-w-md"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              {apiError ? (
                <div className="text-red-600">Error loading employees: {apiError}</div>
              ) : (
                <div className="card overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Employee ID</th>
                        <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Employee</th>
                        <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Start date</th>
                        <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Title</th>
                        <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Home address</th>
                        <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Actions</th> {/* New column for actions */}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredEmployees.map((row, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="px-4 py-2">{row.employeeId}</td>
                          <td className="px-4 py-2">
                            <div className="relative">
                              <button
                                onClick={() => setActiveEmployeeMenu(row.employeeId === activeEmployeeMenu ? null : row.employeeId)}
                                className="text-blue-600 hover:underline font-medium text-left"
                              >
                                {row.name}
                              </button>
                              {activeEmployeeMenu === row.employeeId && (
                                <div className="absolute z-10 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5">
                                  <div className="py-1">
                                    {(() => {
                                      const current = JSON.parse(localStorage.getItem('employee') || '{}');
                                      const isCurrentSuperAdmin = (current?.name || '').toLowerCase() === 'aarav mehta';
                                      return (
                                        <>
                                          {isCurrentSuperAdmin && row.role !== 'admin' && (
                                            <button
                                              onClick={() => handleMakeAdmin(row.employeeId)}
                                              className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left"
                                            >
                                              Make Admin
                                            </button>
                                          )}
                                          {isCurrentSuperAdmin && row.role === 'admin' && (row.name || '').toLowerCase() !== 'aarav mehta' && (
                                            <button
                                              onClick={() => handleRemoveAdmin(row.employeeId)}
                                              className="block px-4 py-2 text-sm text-red-600 hover:bg-gray-100 w-full text-left"
                                            >
                                              Remove Admin
                                            </button>
                                          )}
                                        </>
                                      );
                                    })()}
                                  </div>
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-2">{row.startDate}</td>
                          <td className="px-4 py-2">{row.title}</td>
                          <td className="px-4 py-2">{row.address}</td>
                          <td className="px-4 py-2">
                            {(() => {
                              const current = JSON.parse(localStorage.getItem('employee') || '{}');
                              const isCurrentSuperAdmin = (current?.name || '').toLowerCase() === 'aarav mehta';
                              if (!isCurrentSuperAdmin) return null;
                              return (
                                <div className="flex items-center gap-2">
                                  {row.role !== 'admin' ? (
                                    <button
                                      onClick={() => handleMakeAdmin(row.employeeId)}
                                      className="text-blue-600 hover:text-blue-900 text-sm font-medium"
                                    >
                                      Make Admin
                                    </button>
                                  ) : ((row.name || '').toLowerCase() !== 'aarav mehta' ? (
                                    <button
                                      onClick={() => handleRemoveAdmin(row.employeeId)}
                                      className="text-red-600 hover:text-red-900 text-sm font-medium"
                                    >
                                      Remove Admin
                                    </button>
                                  ) : null)}
                                </div>
                              );
                            })()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </main>


      {/* Preview Modal */}
      {previewModal.show && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-4xl w-full max-h-full overflow-auto">
            <h3 className="text-xl font-bold mb-4">Preview: {previewModal.filename}</h3>
            <p className="text-sm text-gray-600 mb-4">Generated on: {previewModal.content?.generatedDate ? new Date(previewModal.content.generatedDate).toLocaleDateString() : 'Unknown'}</p>
            <p className="text-sm text-gray-600 mb-4">Size: {previewModal.content?.size ? `${previewModal.content.size} KB` : 'N/A'}</p>
            <div className="mt-4 flex space-x-3">
              <button
                onClick={() => setPreviewModal({ ...previewModal, show: false })}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition"
              >
                Close Preview
              </button>
              <button
                onClick={() => {
                  // Find the request ID from the filename and download
                  const request = letterRequests.find(req => req.generatedLetterFilename === previewModal.filename);
                  if (request) {
                    handleDownloadLetter(request._id);
                    setPreviewModal({ ...previewModal, show: false });
                  }
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                Download Letter
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
