const { AppError } = require('../middleware/errors');

const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

class DocuSignRegistry {
  constructor({ serviceFactory, now = () => Date.now() }) {
    this.serviceFactory = serviceFactory;
    this.now = now;
    this.services = new Map();
    this.pendingOAuth = new Map();
  }

  getForEmployee(employeeId) {
    const key = String(employeeId);
    if (!this.services.has(key)) {
      this.services.set(key, this.serviceFactory());
    }
    return this.services.get(key);
  }

  beginOAuth(employeeId) {
    this.removeExpiredStates();
    const service = this.getForEmployee(employeeId);
    const { authUrl, state } = service.getAuthUrl();
    this.pendingOAuth.set(state, {
      employeeId: String(employeeId),
      expiresAt: this.now() + OAUTH_STATE_TTL_MS,
    });
    return { authUrl };
  }

  async completeOAuth({ code, state }) {
    this.removeExpiredStates();
    const pending = this.pendingOAuth.get(state);
    if (!pending) {
      throw new AppError(400, 'INVALID_OAUTH_STATE', 'The DocuSign authorization state is invalid or expired');
    }
    this.pendingOAuth.delete(state);
    const service = this.getForEmployee(pending.employeeId);
    await service.getAccessToken(code);
    return {
      employeeId: pending.employeeId,
      accountId: service.getCurrentAccountId(),
    };
  }

  clear(employeeId) {
    const key = String(employeeId);
    this.services.get(key)?.clearToken();
    this.services.delete(key);
  }

  removeExpiredStates() {
    const now = this.now();
    for (const [state, pending] of this.pendingOAuth) {
      if (pending.expiresAt <= now) this.pendingOAuth.delete(state);
    }
  }
}

module.exports = { DocuSignRegistry, OAUTH_STATE_TTL_MS };
