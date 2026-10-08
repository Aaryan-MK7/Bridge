import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../config/api';

const DocuSignIntegration = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [accountId, setAccountId] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [templateForm, setTemplateForm] = useState({
    name: '',
    description: '',
    shared: false
  });
  const [authMethod, setAuthMethod] = useState(null);
  const [consentInfo, setConsentInfo] = useState(null);
  const [envelopes, setEnvelopes] = useState([]);
  const [showEnvelopeForm, setShowEnvelopeForm] = useState(false);
  const [envelopeForm, setEnvelopeForm] = useState({
    signerEmail: '',
    signerName: '',
    documentName: '',
    emailSubject: 'Please sign this document',
    anchorString: '/sn1/'
  });
  const [selectedFile, setSelectedFile] = useState(null);

  const API_BASE = `${API_URL}/api/docusign`;

  // Check authentication status on component mount
  useEffect(() => {
    checkAuthStatus();
  }, []);

  // Check DocuSign authentication status
  const checkAuthStatus = async () => {
    try {
      const response = await axios.get(`${API_BASE}/status`, {
        withCredentials: true
      });
      setIsAuthenticated(response.data.authenticated);
      setAccountId(response.data.accountId);

      if (response.data.authenticated) {
        fetchTemplates();
      }
    } catch (error) {
      console.error('Error checking auth status:', error);
    }
  };

  // Connect to DocuSign using JWT authentication
  const connectDocuSign = async () => {
    try {
      setLoading(true);
      setError(null);
      setConsentInfo(null);

      console.log('🔐 Connecting to DocuSign with JWT authentication...');

      // Try JWT authentication first
      try {
        const response = await axios.post(`${API_BASE}/auth/jwt`, {}, {
          withCredentials: true
        });

        if (response.data.success) {
          console.log('🔐 JWT authentication successful:', response.data);
          setIsAuthenticated(true);
          setAccountId(response.data.accountId);
          setAuthMethod('JWT');
          fetchTemplates();
          setLoading(false);
          return;
        }
      } catch (jwtError) {
        console.log('🔐 JWT authentication failed:', jwtError.message);

        // Check if consent is required
        if (jwtError.response?.data?.error === 'consent_required') {
          setConsentInfo({
            message: jwtError.response.data.message,
            consentUrl: jwtError.response.data.consentUrl,
            scopes: jwtError.response.data.scopes,
            instructions: jwtError.response.data.instructions
          });
          setError('Consent required for JWT authentication');
          setLoading(false);
          return;
        }

        setError(`JWT authentication failed: ${jwtError.response?.data?.error || jwtError.message}`);
      }

      // Fallback to OAuth if JWT fails (and not due to consent)
      console.log('🔐 Falling back to OAuth authentication...');
      const response = await axios.get(`${API_BASE}/auth`, {
        withCredentials: true
      });

      if (response.data.method === 'OAuth' && response.data.authUrl) {
        setAuthMethod('OAuth');
        // Open DocuSign OAuth in new window
        const authWindow = window.open(
          response.data.authUrl,
          'DocuSign OAuth',
          'width=600,height=700'
        );

        // Poll for authentication completion
        const pollAuth = setInterval(async () => {
          try {
            const authResponse = await axios.get(`${API_BASE}/status`, {
              withCredentials: true
            });
            if (authResponse.data.authenticated) {
              clearInterval(pollAuth);
              authWindow.close();
              setIsAuthenticated(true);
              setAccountId(authResponse.data.accountId);
              setAuthMethod(authResponse.data.sessionData?.docusignMethod || 'OAuth');
              fetchTemplates();
              setLoading(false);
              setError(null);
            }
          } catch (error) {
            // Continue polling
          }
        }, 2000);

        // Timeout after 5 minutes
        setTimeout(() => {
          clearInterval(pollAuth);
          authWindow.close();
          setLoading(false);
          setError('Authentication timeout. Please try again.');
        }, 300000);
      } else {
        setLoading(false);
        setError('Failed to get authentication URL');
      }

    } catch (error) {
      setLoading(false);
      setError('Failed to connect to DocuSign');
      console.error('Error connecting to DocuSign:', error);
    }
  };

  // Handle consent grant
  const handleConsentGrant = () => {
    if (consentInfo?.consentUrl) {
      window.open(consentInfo.consentUrl, '_blank');
      setError('Please complete the consent process in the new window, then try connecting again.');
    }
  };

  // Fetch templates from DocuSign
  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE}/templates`, {
        withCredentials: true
      });
      setTemplates(response.data);
    } catch (error) {
      setError('Failed to fetch templates');
      console.error('Error fetching templates:', error);
    } finally {
      setLoading(false);
    }
  };

  // Create new template
  const createTemplate = async () => {
    try {
      setLoading(true);
      await axios.post(`${API_BASE}/templates`, templateForm, {
        withCredentials: true
      });

      // Reset form and refresh templates
      setTemplateForm({ name: '', description: '', shared: false });
      setShowTemplateForm(false);
      fetchTemplates();

      setError(null);
    } catch (error) {
      setError('Failed to create template');
      console.error('Error creating template:', error);
    } finally {
      setLoading(false);
    }
  };

  // Delete template
  const deleteTemplate = async (templateId) => {
    if (!window.confirm('Are you sure you want to delete this template?')) {
      return;
    }

    try {
      setLoading(true);
      await axios.delete(`${API_BASE}/templates/${templateId}`, {
        withCredentials: true
      });
      fetchTemplates();
      setError(null);
    } catch (error) {
      setError('Failed to delete template');
      console.error('Error deleting template:', error);
    } finally {
      setLoading(false);
    }
  };

  // Logout from DocuSign
  const logoutDocuSign = async () => {
    try {
      await axios.post(`${API_BASE}/logout`, {}, {
        withCredentials: true
      });
      setIsAuthenticated(false);
      setAccountId(null);
      setTemplates([]);
      setSelectedTemplate(null);
      setError(null);
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  // Handle template form changes
  const handleTemplateFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setTemplateForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  // Fetch envelopes from DocuSign
  const fetchEnvelopes = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE}/envelopes`, {
        withCredentials: true
      });
      setEnvelopes(response.data);
    } catch (error) {
      setError('Failed to fetch envelopes');
      console.error('Error fetching envelopes:', error);
    } finally {
      setLoading(false);
    }
  };

  // Send document for embedded signing
  const sendForSigning = async () => {
    try {
      if (!selectedFile) {
        setError('Please select a document to sign');
        return;
      }

      setLoading(true);

      // Convert file to base64
      const reader = new FileReader();
      reader.onload = async () => {
        const base64Data = reader.result.split(',')[1]; // Remove data:application/pdf;base64, prefix

        const envelopeData = {
          ...envelopeForm,
          docFile: base64Data,
          signerClientId: '1000'
        };

        const response = await axios.post(`${API_BASE}/envelopes/embedded-signing`, envelopeData, {
          withCredentials: true
        });

        if (response.data.envelopeId) {
          setError(null);
          setShowEnvelopeForm(false);
          setEnvelopeForm({
            signerEmail: '',
            signerName: '',
            documentName: '',
            emailSubject: 'Please sign this document',
            anchorString: '/sn1/'
          });
          setSelectedFile(null);
          fetchEnvelopes();

          // Show success message
          alert(`Envelope sent successfully! Envelope ID: ${response.data.envelopeId}`);
        }
      };

      reader.readAsDataURL(selectedFile);
    } catch (error) {
      setError('Failed to send document for signing');
      console.error('Error sending document:', error);
    } finally {
      setLoading(false);
    }
  };

  // Handle file selection
  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file && file.type === 'application/pdf') {
      setSelectedFile(file);
      setEnvelopeForm(prev => ({ ...prev, documentName: file.name }));
    } else {
      setError('Please select a valid PDF file');
    }
  };

  // Fetch envelope details
  const fetchEnvelopeDetails = async (envelopeId) => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE}/envelopes/${envelopeId}`, {
        withCredentials: true
      });
      alert(`Envelope Details:\n${JSON.stringify(response.data, null, 2)}`);
    } catch (error) {
      setError('Failed to fetch envelope details');
      console.error('Error fetching envelope details:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2">Loading...</span>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-800 mb-4">DocuSign Integration</h2>
        <p className="text-gray-600 mb-6">
          Connect to DocuSign to manage templates and envelopes directly from your HR Letter Generator.
        </p>

        {/* Connection Status */}
        <div className="mb-6 p-4 rounded-lg border">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-800">Connection Status</h3>
              <p className="text-sm text-gray-600">
                {isAuthenticated
                  ? `Connected to DocuSign (${authMethod})`
                  : 'Not connected to DocuSign'
                }
              </p>
              {accountId && (
                <p className="text-xs text-gray-500 mt-1">Account ID: {accountId}</p>
              )}
            </div>
            <div className="flex items-center space-x-3">
              {isAuthenticated ? (
                <button
                  onClick={logoutDocuSign}
                  disabled={loading}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                >
                  {loading ? 'Disconnecting...' : 'Disconnect'}
                </button>
              ) : (
                <button
                  onClick={connectDocuSign}
                  disabled={loading}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? 'Connecting...' : 'Connect to DocuSign'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Consent Required Display */}
        {consentInfo && (
          <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3 flex-1">
                <h3 className="text-sm font-medium text-yellow-800">Consent Required</h3>
                <div className="mt-2 text-sm text-yellow-700">
                  <p className="mb-2">{consentInfo.message}</p>
                  <p className="mb-2"><strong>Required Scopes:</strong> {consentInfo.scopes}</p>
                  <p className="mb-3">{consentInfo.instructions}</p>
                  <button
                    onClick={handleConsentGrant}
                    className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 text-sm"
                  >
                    Grant Consent
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Authentication Method Info */}
        {authMethod && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-blue-800">
                  <strong>Authentication Method:</strong> {authMethod}
                  {authMethod === 'JWT' && ' (Recommended - More secure and efficient)'}
                  {authMethod === 'OAuth' && ' (Fallback method)'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Templates Section */}
        {isAuthenticated && (
          <div className="space-y-6">
            {/* Template Management Section */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-gray-800">Template Management</h3>
                <button
                  onClick={() => setShowTemplateForm(!showTemplateForm)}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  {showTemplateForm ? 'Cancel' : 'Create Template'}
                </button>
              </div>

              {/* Template Creation Form */}
              {showTemplateForm && (
                <div className="mb-6 p-4 border border-gray-200 rounded-lg">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input
                      type="text"
                      placeholder="Template Name"
                      value={templateForm.name}
                      onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      type="text"
                      placeholder="Description"
                      value={templateForm.description}
                      onChange={(e) => setTemplateForm({ ...templateForm, description: e.target.value })}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="mt-4 flex items-center">
                    <input
                      type="checkbox"
                      id="shared"
                      checked={templateForm.shared}
                      onChange={(e) => setTemplateForm({ ...templateForm, shared: e.target.checked })}
                      className="mr-2"
                    />
                    <label htmlFor="shared" className="text-sm text-gray-600">Shared Template</label>
                  </div>
                  <button
                    onClick={createTemplate}
                    disabled={loading}
                    className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {loading ? 'Creating...' : 'Create Template'}
                  </button>
                </div>
              )}

              {/* Templates List */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {templates.map((template) => (
                  <div key={template.templateId} className="p-4 border border-gray-200 rounded-lg">
                    <h4 className="font-semibold text-gray-800">{template.name}</h4>
                    <p className="text-sm text-gray-600 mt-1">{template.description}</p>
                    <div className="mt-3 flex space-x-2">
                      <button
                        onClick={() => setSelectedTemplate(template)}
                        className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                      >
                        View
                      </button>
                      <button
                        onClick={() => deleteTemplate(template.templateId)}
                        className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Embedded Signing Section */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-gray-800">Embedded Signing</h3>
                <button
                  onClick={() => setShowEnvelopeForm(!showEnvelopeForm)}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                >
                  {showEnvelopeForm ? 'Cancel' : 'Send Document for Signing'}
                </button>
              </div>

              {/* Envelope Creation Form */}
              {showEnvelopeForm && (
                <div className="mb-6 p-4 border border-gray-200 rounded-lg">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input
                      type="email"
                      placeholder="Signer Email"
                      value={envelopeForm.signerEmail}
                      onChange={(e) => setEnvelopeForm({ ...envelopeForm, signerEmail: e.target.value })}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      type="text"
                      placeholder="Signer Name"
                      value={envelopeForm.signerName}
                      onChange={(e) => setEnvelopeForm({ ...envelopeForm, signerName: e.target.value })}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      type="text"
                      placeholder="Email Subject"
                      value={envelopeForm.emailSubject}
                      onChange={(e) => setEnvelopeForm({ ...envelopeForm, emailSubject: e.target.value })}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      type="text"
                      placeholder="Anchor String (default: /sn1/)"
                      value={envelopeForm.anchorString}
                      onChange={(e) => setEnvelopeForm({ ...envelopeForm, anchorString: e.target.value })}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="mt-4">
                    <input
                      type="file"
                      accept=".pdf"
                      onChange={handleFileSelect}
                      className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                    />
                    <p className="text-xs text-gray-500 mt-1">Only PDF files are supported</p>
                  </div>
                  <button
                    onClick={sendForSigning}
                    disabled={loading || !selectedFile}
                    className="mt-4 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                  >
                    {loading ? 'Sending...' : 'Send for Signing'}
                  </button>
                </div>
              )}

              {/* Envelopes List */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {envelopes.map((envelope) => (
                  <div key={envelope.envelopeId} className="p-4 border border-gray-200 rounded-lg">
                    <h4 className="font-semibold text-gray-800">Envelope {envelope.envelopeId}</h4>
                    <p className="text-sm text-gray-600 mt-1">Status: {envelope.status}</p>
                    <p className="text-sm text-gray-600">Created: {new Date(envelope.created).toLocaleDateString()}</p>
                    <div className="mt-3 flex space-x-2">
                      <button
                        onClick={() => fetchEnvelopeDetails(envelope.envelopeId)}
                        className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                      >
                        View Details
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DocuSignIntegration;
