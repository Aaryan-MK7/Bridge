import { apiRequest } from './client.js';

const encode = (value) => encodeURIComponent(String(value));

export const authApi = {
  login: (credentials) => apiRequest('/api/employees/login', {
    method: 'POST',
    body: credentials,
  }),
  forgotPassword: (payload) => apiRequest('/api/employees/forgot-password', {
    method: 'POST',
    body: payload,
  }),
  resetPassword: (payload) => apiRequest('/api/employees/reset-password', {
    method: 'POST',
    body: payload,
  }),
};

export const employeeApi = {
  list: () => apiRequest('/api/employees'),
  getProfile: (employeeId) => apiRequest(`/api/employees/${encode(employeeId)}/profile`),
  create: (employee) => apiRequest('/api/employees', { method: 'POST', body: employee }),
  updateProfile: (employeeId, profile) => apiRequest(`/api/employees/${encode(employeeId)}`, {
    method: 'PATCH',
    body: profile,
  }),
  remove: (employeeId) => apiRequest(`/api/employees/${encode(employeeId)}`, {
    method: 'DELETE',
  }),
  changeRole: (employeeId, role) => apiRequest(
    `/api/employees/${encode(employeeId)}/${role === 'admin' ? 'make-admin' : 'remove-admin'}`,
    { method: 'PATCH', body: {} },
  ),
  changePassword: (employeeId, passwords) => apiRequest(
    `/api/employees/${encode(employeeId)}/change-password`,
    { method: 'POST', body: passwords },
  ),
  importCsv: (file) => {
    const body = new FormData();
    body.append('file', file);
    return apiRequest('/api/employees/import', { method: 'POST', body });
  },
};

export const letterRequestApi = {
  listAll: () => apiRequest('/api/letter-requests'),
  listForEmployee: (employeeId) => apiRequest(
    `/api/letter-requests/employee/${encode(employeeId)}`,
  ),
  create: (request) => apiRequest('/api/letter-requests', {
    method: 'POST',
    body: request,
  }),
  updateStatus: (requestId, update) => apiRequest(
    `/api/letter-requests/${encode(requestId)}`,
    { method: 'PATCH', body: update },
  ),
  withdraw: (requestId) => apiRequest(
    `/api/letter-requests/${encode(requestId)}/withdraw`,
    { method: 'POST' },
  ),
  retake: (requestId, request) => apiRequest(
    `/api/letter-requests/${encode(requestId)}/retake`,
    { method: 'PUT', body: request },
  ),
  download: (requestId) => apiRequest(
    `/api/letter-requests/${encode(requestId)}/download-letter`,
    { responseType: 'blob' },
  ),
  sendToDocuSign: (requestId, adminEmail) => apiRequest(
    `/api/letter-requests/${encode(requestId)}/send-to-docusign`,
    { method: 'POST', body: { adminEmail } },
  ),
  getDocuSignStatus: (requestId) => apiRequest(
    `/api/letter-requests/${encode(requestId)}/docusign-status`,
  ),
  getSigningUrl: (requestId) => apiRequest(
    `/api/letter-requests/${encode(requestId)}/signing-url`,
  ),
};

export const templateApi = {
  list: () => apiRequest('/api/templates'),
  create: (template) => apiRequest('/api/templates', { method: 'POST', body: template }),
  update: (templateId, template) => apiRequest(`/api/templates/${encode(templateId)}`, {
    method: 'PATCH',
    body: template,
  }),
  remove: (templateId) => apiRequest(`/api/templates/${encode(templateId)}`, {
    method: 'DELETE',
  }),
};

export const settingsApi = {
  getNotifications: () => apiRequest('/api/settings/notifications'),
  updateNotifications: (settings) => apiRequest('/api/settings/notifications', {
    method: 'PUT',
    body: settings,
  }),
};

export const docusignApi = {
  status: () => apiRequest('/api/docusign/status'),
  connectJwt: () => apiRequest('/api/docusign/auth/jwt', { method: 'POST', body: {} }),
  getOAuthUrl: () => apiRequest('/api/docusign/auth'),
  disconnect: () => apiRequest('/api/docusign/logout', { method: 'POST', body: {} }),
  listTemplates: () => apiRequest('/api/docusign/templates'),
  listEnvelopes: () => apiRequest('/api/docusign/envelopes'),
};
