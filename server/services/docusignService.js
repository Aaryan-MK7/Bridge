const { ApiClient, TemplatesApi, EnvelopesApi, AccountsApi } = require('docusign-esign');
const axios = require('axios');
const qs = require('qs');
const docusign = require('docusign-esign');

// JWT Configuration with RSA private key
const dsConfig = {
  dsClientId: process.env.DOCUSIGN_CLIENT_ID,
  impersonatedUserGuid: process.env.DOCUSIGN_USER_ID,
  privateKey: (process.env.DOCUSIGN_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
  jwtLifeSec: 600,
  dsOauthServer: process.env.DOCUSIGN_OAUTH_BASE || 'https://account-d.docusign.com',
};

class DocuSignService {
  constructor() {
    this.apiClient = new ApiClient();
    this.apiClient.setBasePath(process.env.DOCUSIGN_OAUTH_BASE || 'https://account-d.docusign.com');
    this.accessToken = null;
    this.accountId = null;
    this.accountName = null;
    this.basePath = null;
    this._tokenExpiration = null;

    // Initialize DocuSign API client with proper configuration
    this.dsApiClient = new ApiClient();
    this.dsApiClient.setBasePath(process.env.DOCUSIGN_OAUTH_BASE || 'https://account-d.docusign.com');

    // JWT configuration with signature scope for eSignature REST API
    this.scopes = 'signature'; // Required for eSignature REST API endpoints
    this.jwtLifeSec = dsConfig.jwtLifeSec;

    // Debug mode
    this._debug = true;
    this._debug_prefix = 'DocuSignService';
  }

  // Debug logging method
  _debug_log(message) {
    if (!this._debug) return;
    console.log(`${this._debug_prefix}: ${message}`);
  }

  // Check if current token is still valid
  checkToken(bufferMin = 10) {
    const noToken = !this.accessToken || !this._tokenExpiration;
    const now = new Date();
    const needToken = noToken || new Date(this._tokenExpiration.getTime() - bufferMin * 60 * 1000) < now;

    if (this._debug) {
      if (noToken) { this._debug_log('checkToken: Starting up--need a token'); }
      if (needToken && !noToken) { this._debug_log('checkToken: Replacing old token'); }
      if (!needToken) { this._debug_log('checkToken: Using current token'); }
    }

    return !needToken;
  }

  // Get OAuth authorization URL (fallback method)
  getAuthUrl() {
    const state = require('crypto').randomBytes(32).toString('hex');
    const authUrl = `${dsConfig.dsOauthServer}/oauth/auth?response_type=code&scope=${this.scopes}&client_id=${dsConfig.dsClientId}&redirect_uri=${process.env.DOCUSIGN_REDIRECT_URI}&state=${state}`;
    return { authUrl, state };
  }

  // Exchange authorization code for access token (OAuth fallback)
  async getAccessToken(authCode) {
    try {
      this._debug_log('Getting access token for code: ' + authCode);

      const tokenResponse = await axios.post(`${dsConfig.dsOauthServer}/oauth/token`, qs.stringify({
        grant_type: 'authorization_code',
        code: authCode,
        redirect_uri: process.env.DOCUSIGN_REDIRECT_URI
      }), {
        auth: {
          username: dsConfig.dsClientId,
          password: process.env.DOCUSIGN_CLIENT_SECRET
        },
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      if (tokenResponse.data && tokenResponse.data.access_token) {
        this.accessToken = tokenResponse.data.access_token;
        this._tokenExpiration = new Date(Date.now() + (tokenResponse.data.expires_in * 1000));

        // Configure API clients
        this.apiClient.setAccessToken(this.accessToken);
        this.dsApiClient.setAccessToken(this.accessToken);
        this.dsApiClient.addDefaultHeader('Authorization', 'Bearer ' + this.accessToken);

        this._debug_log('Access token set successfully');

        // Get account info
        await this.getUserInfo();

        return tokenResponse.data;
      } else {
        throw new Error('No access token received from DocuSign');
      }
    } catch (error) {
      this._debug_log('Error getting access token: ' + error.message);
      throw error;
    }
  }

  // Get JWT token using official DocuSign SDK method
  async getToken() {
    try {
      this._debug_log('Getting JWT token...');

      const dsApi = new ApiClient();
      dsApi.setOAuthBasePath(dsConfig.dsOauthServer.replace('https://', ''));

      const results = await dsApi.requestJWTUserToken(
        dsConfig.dsClientId,
        dsConfig.impersonatedUserGuid,
        this.scopes,
        dsConfig.privateKey,
        this.jwtLifeSec
      );

      // Set expiration with buffer
      const expiresAt = new Date(Date.now() + (results.body.expires_in * 1000) - (10 * 60 * 1000));
      this.accessToken = results.body.access_token;
      this._tokenExpiration = expiresAt;

      this._debug_log('JWT token obtained successfully');

      return {
        accessToken: results.body.access_token,
        tokenExpirationTimestamp: expiresAt
      };
    } catch (error) {
      this._debug_log('Error getting JWT token: ' + error.message);

      // Check if consent is required
      if (this.isConsentRequired(error)) {
        const consentDetails = this.getConsentErrorDetails(error);
        this._debug_log('Consent required: ' + consentDetails.message);
        throw new Error(`CONSENT_REQUIRED: ${consentDetails.message}`);
      }

      throw error;
    }
  }

  // Get user info and account details
  async getUserInfo() {
    try {
      this._debug_log('Getting user info...');

      if (!this.accessToken) {
        throw new Error('No access token available');
      }

      const dsApi = new ApiClient();
      dsApi.setOAuthBasePath(dsConfig.dsOauthServer.replace('https://', ''));

      const results = await dsApi.getUserInfo(this.accessToken);

      // Find the default account or use the one from environment
      let accountInfo;
      if (!process.env.DOCUSIGN_ACCOUNT_ID) {
        // Find default account
        accountInfo = results.accounts.find(account => account.isDefault === 'true');
      } else {
        // Find matching account
        accountInfo = results.accounts.find(account => account.accountId === process.env.DOCUSIGN_ACCOUNT_ID);
      }

      if (!accountInfo) {
        throw new Error(`Target account ${process.env.DOCUSIGN_ACCOUNT_ID || 'default'} not found!`);
      }

      this.accountId = accountInfo.accountId;
      this.accountName = accountInfo.accountName;
      this.basePath = accountInfo.baseUri + '/restapi';

      this._debug_log(`Account info: ${this.accountId} - ${this.accountName}`);

      return {
        accountId: this.accountId,
        basePath: this.basePath,
        accountName: this.accountName
      };
    } catch (error) {
      this._debug_log('Error getting user info: ' + error.message);
      throw error;
    }
  }

  // Main authentication method - tries JWT first, falls back to OAuth
  async authenticateWithJWT() {
    try {
      this._debug_log('Authenticating with JWT...');

      // Check if we need a new token
      if (!this.checkToken()) {
        await this.getToken();
        await this.getUserInfo();
      }

      // Configure API clients
      this.apiClient.setAccessToken(this.accessToken);
      this.dsApiClient.setAccessToken(this.accessToken);
      this.dsApiClient.setBasePath(this.basePath);
      this.dsApiClient.addDefaultHeader('Authorization', 'Bearer ' + this.accessToken);

      this._debug_log('JWT authentication successful');
      return true;
    } catch (error) {
      this._debug_log('JWT authentication failed: ' + error.message);

      // Check if consent is required
      if (error.message && error.message.includes('CONSENT_REQUIRED')) {
        const consentError = {
          type: 'consent_required',
          message: error.message.replace('CONSENT_REQUIRED: ', ''),
          consentUrl: this.getConsentUrl(),
          scopes: this.scopes + ' impersonation'
        };
        throw consentError;
      }

      throw error;
    }
  }

  // Check authentication status
  isAuthenticated() {
    return this.checkToken() && this.accessToken && this.accountId;
  }

  // Get current account ID
  getCurrentAccountId() {
    return this.accountId;
  }

  // Get current access token
  getAccessToken() {
    return this.accessToken;
  }

  // Get configured DocuSign API client
  getDsApiClient() {
    if (!this.accessToken) {
      throw new Error('No access token available. Please authenticate first.');
    }

    // Ensure the API client is properly configured
    this.dsApiClient.setAccessToken(this.accessToken);
    this.dsApiClient.setBasePath(this.basePath || process.env.DOCUSIGN_OAUTH_BASE);
    this.dsApiClient.addDefaultHeader('Authorization', 'Bearer ' + this.accessToken);

    return this.dsApiClient;
  }

  // Get configured Envelopes API
  getEnvelopesApi() {
    const dsApiClient = this.getDsApiClient();
    return new EnvelopesApi(dsApiClient);
  }

  // Get configured Templates API
  getTemplatesApi() {
    const dsApiClient = this.getDsApiClient();
    return new TemplatesApi(dsApiClient);
  }

  // Get configured Accounts API
  getAccountsApi() {
    const dsApiClient = this.getDsApiClient();
    return new AccountsApi(dsApiClient);
  }

  // Clear authentication (logout)
  clearToken() {
    this._debug_log('Clearing authentication tokens');
    this._tokenExpiration = null;
    this.accessToken = null;
    this.accountId = null;
    this.accountName = null;
    this.basePath = null;
  }

  // Get JWT configuration
  getJWTConfig() {
    return {
      dsClientId: dsConfig.dsClientId,
      impersonatedUserGuid: dsConfig.impersonatedUserGuid,
      scopes: this.scopes,
      jwtLifeSec: this.jwtLifeSec
    };
  }

  // Generate consent URL for JWT authentication
  getConsentUrl() {
    const consentScopes = this.scopes + ' impersonation';
    const consentUrl = `${dsConfig.dsOauthServer}/oauth/auth?response_type=code&` +
      `scope=${encodeURIComponent(consentScopes)}&client_id=${dsConfig.dsClientId}&` +
      `redirect_uri=${encodeURIComponent(process.env.DOCUSIGN_REDIRECT_URI)}`;

    this._debug_log('Generated consent URL: ' + consentUrl);
    return consentUrl;
  }

  // Check if consent is required from error response
  isConsentRequired(error) {
    try {
      const body = error?.response?.body || error?.response?.data;
      return body?.error === 'consent_required';
    } catch (e) {
      return false;
    }
  }

  // Get consent error details
  getConsentErrorDetails(error) {
    try {
      const body = error?.response?.body || error?.response?.data;
      return {
        error: body?.error,
        message: body?.message || 'Consent required for JWT authentication',
        consentUrl: this.getConsentUrl()
      };
    } catch (e) {
      return {
        error: 'consent_required',
        message: 'Consent required for JWT authentication',
        consentUrl: this.getConsentUrl()
      };
    }
  }

  // Get all templates
  async getTemplates() {
    try {
      if (!this.accountId) {
        await this.getUserInfo();
      }

      const templatesApi = this.getTemplatesApi();
      const templates = await templatesApi.listTemplates(this.accountId);

      return templates.envelopeTemplates || [];
    } catch (error) {
      this._debug_log('Error getting templates: ' + error.message);
      throw error;
    }
  }

  // Get template by ID
  async getTemplate(templateId) {
    try {
      if (!this.accountId) {
        await this.getUserInfo();
      }

      const templatesApi = this.getTemplatesApi();
      const template = await templatesApi.get(this.accountId, templateId);

      return template;
    } catch (error) {
      this._debug_log('Error getting template: ' + error.message);
      throw error;
    }
  }

  // Create new template
  async createTemplate(templateData) {
    try {
      if (!this.accountId) {
        await this.getUserInfo();
      }

      const templatesApi = this.getTemplatesApi();
      const template = await templatesApi.createTemplate(this.accountId, {
        envelopeTemplateDefinition: {
          name: templateData.name,
          description: templateData.description,
          shared: templateData.shared || false
        },
        documents: templateData.documents || [],
        recipients: templateData.recipients || {},
        emailSettings: templateData.emailSettings || {},
        notification: templateData.notification || {}
      });

      return template;
    } catch (error) {
      this._debug_log('Error creating template: ' + error.message);
      throw error;
    }
  }

  // Update template
  async updateTemplate(templateId, templateData) {
    try {
      if (!this.accountId) {
        await this.getUserInfo();
      }

      const templatesApi = this.getTemplatesApi();
      const template = await templatesApi.update(this.accountId, templateId, {
        envelopeTemplateDefinition: {
          name: templateData.name,
          description: templateData.description,
          shared: templateData.shared || false
        },
        documents: templateData.documents || [],
        recipients: templateData.recipients || {},
        emailSettings: templateData.emailSettings || {},
        notification: templateData.notification || {}
      });

      return template;
    } catch (error) {
      this._debug_log('Error updating template: ' + error.message);
      throw error;
    }
  }

  // Delete template
  async deleteTemplate(templateId) {
    try {
      if (!this.accountId) {
        await this.getUserInfo();
      }

      const templatesApi = this.getTemplatesApi();
      await templatesApi.delete(this.accountId, templateId);

      return { success: true, message: 'Template deleted successfully' };
    } catch (error) {
      this._debug_log('Error deleting template: ' + error.message);
      throw error;
    }
  }

  // Create envelope from template
  async createEnvelopeFromTemplate(templateId, envelopeData) {
    try {
      if (!this.accountId) {
        await this.getUserInfo();
      }

      const templatesApi = this.getTemplatesApi();
      const template = await templatesApi.get(this.accountId, templateId);

      return template;
    } catch (error) {
      this._debug_log('Error getting template: ' + error.message);
      throw error;
    }
  }

  // Create envelope from template with employee data populated
  async createEnvelopeFromTemplateWithData(templateId, envelopeData) {
    try {
      if (!this.accountId) {
        await this.getUserInfo();
      }

      this._debug_log('Creating envelope from template with employee data...');

      let dsApiClient = this.getDsApiClient();
      let envelopesApi = new EnvelopesApi(dsApiClient);
      let results = null;

      // Step 1. Create envelope definition from template
      let envelope = {
        emailSubject: envelopeData.emailSubject || 'Letter for signing',
        emailBlurb: envelopeData.emailBlurb || 'Please review and sign this letter.',
        templateId: templateId,
        templateRoles: envelopeData.recipients || [],
        status: envelopeData.status || 'sent',
        // Add custom fields to populate template
        customFields: envelopeData.customFields || {}
      };

      // Step 2. Call Envelopes::create API method
      results = await envelopesApi.createEnvelope(this.accountId, {
        envelopeDefinition: envelope,
      });

      let envelopeId = results.envelopeId;
      this._debug_log(`Envelope created from template. EnvelopeId ${envelopeId}`);

      // Step 3. Create the recipient view for admin signing
      let viewRequest = this.makeRecipientViewRequest({
        dsReturnUrl: envelopeData.dsReturnUrl || `${process.env.FRONTEND_ORIGIN?.split(',')[0] || 'http://localhost:5173'}/docusign/callback`,
        signerEmail: envelopeData.recipients[0]?.email,
        signerName: envelopeData.recipients[0]?.name,
        signerClientId: envelopeData.recipients[0]?.clientUserId || '1000',
        dsPingUrl: envelopeData.dsPingUrl
      });

      // Call the CreateRecipientView API
      results = await envelopesApi.createRecipientView(this.accountId, envelopeId, {
        recipientViewRequest: viewRequest,
      });

      this._debug_log('Recipient view created successfully');

      return {
        envelopeId: envelopeId,
        redirectUrl: results.url,
        envelope: envelope
      };

    } catch (error) {
      this._debug_log('Error creating envelope from template with data: ' + error.message);
      throw error;
    }
  }

  // Create envelope from template with custom fields
  async createEnvelopeFromTemplateWithCustomFields(templateId, customFields, envelopeData) {
    try {
      if (!this.accountId) {
        await this.getUserInfo();
      }

      this._debug_log('Creating envelope from template with custom fields...');

      let dsApiClient = this.getDsApiClient();
      let envelopesApi = new EnvelopesApi(dsApiClient);
      let results = null;

      // Step 1. Create envelope definition from template
      let envelope = {
        emailSubject: envelopeData.emailSubject || 'Letter for signing',
        emailBlurb: envelopeData.emailBlurb || 'Please review and sign this letter.',
        templateId: templateId,
        templateRoles: envelopeData.recipients || [],
        status: envelopeData.status || 'sent'
      };

      // Step 2. Call Envelopes::create API method
      results = await envelopesApi.createEnvelope(this.accountId, {
        envelopeDefinition: envelope,
      });

      let envelopeId = results.envelopeId;
      this._debug_log(`Envelope created from template. EnvelopeId ${envelopeId}`);

      // Step 3. Update envelope with custom field values
      if (customFields && Object.keys(customFields).length > 0) {
        try {
          // Get the envelope to see current custom fields
          const currentEnvelope = await envelopesApi.getEnvelope(this.accountId, envelopeId);

          // Update custom fields with employee data
          const updatedCustomFields = {
            ...currentEnvelope.customFields,
            ...customFields
          };

          // Update the envelope with custom field values
          await envelopesApi.update(this.accountId, envelopeId, {
            envelope: {
              customFields: updatedCustomFields
            }
          });

          this._debug_log('Custom fields updated with employee data');
        } catch (updateError) {
          this._debug_log('Warning: Could not update custom fields: ' + updateError.message);
          // Continue with envelope creation even if custom field update fails
        }
      }

      // Step 4. Create the recipient view for admin signing
      let viewRequest = this.makeRecipientViewRequest({
        dsReturnUrl: envelopeData.dsReturnUrl || `${process.env.FRONTEND_ORIGIN?.split(',')[0] || 'http://localhost:5173'}/docusign/callback`,
        signerEmail: envelopeData.recipients[0]?.email,
        signerName: envelopeData.recipients[0]?.name,
        signerClientId: envelopeData.recipients[0]?.clientUserId || '1000',
        dsPingUrl: envelopeData.dsPingUrl
      });

      // Call the CreateRecipientView API
      results = await envelopesApi.createRecipientView(this.accountId, envelopeId, {
        recipientViewRequest: viewRequest,
      });

      this._debug_log('Recipient view created successfully');

      return {
        envelopeId: envelopeId,
        redirectUrl: results.url,
        envelope: envelope
      };

    } catch (error) {
      this._debug_log('Error creating envelope from template with custom fields: ' + error.message);
      throw error;
    }
  }

  // Get envelope status
  async getEnvelopeStatus(envelopeId) {
    try {
      if (!this.accountId) {
        await this.getUserInfo();
      }

      const envelopesApi = this.getEnvelopesApi();
      const envelope = await envelopesApi.getEnvelope(this.accountId, envelopeId);

      return envelope;
    } catch (error) {
      this._debug_log('Error getting envelope status: ' + error.message);
      throw error;
    }
  }

  // Get envelope documents
  async getEnvelopeDocuments(envelopeId) {
    try {
      if (!this.accountId) {
        await this.getUserInfo();
      }

      const envelopesApi = this.getEnvelopesApi();
      const documents = await envelopesApi.getDocument(this.accountId, envelopeId, '1');

      return documents;
    } catch (error) {
      this._debug_log('Error getting envelope documents: ' + error.message);
      throw error;
    }
  }

  // Create embedded signing URL
  async createEmbeddedSigningUrl(envelopeId, recipientEmail, recipientName, returnUrl) {
    try {
      if (!this.accountId) {
        await this.getUserInfo();
      }

      const envelopesApi = this.getEnvelopesApi();
      const recipientViewRequest = {
        returnUrl: returnUrl,
        authenticationMethod: 'none',
        email: recipientEmail,
        userName: recipientName,
        clientUserId: '1000', // Required for embedded signing
        pingFrequency: '600',
        pingUrl: returnUrl
      };

      const viewUrl = await envelopesApi.createRecipientView(this.accountId, envelopeId, {
        recipientViewRequest: recipientViewRequest
      });

      return viewUrl.url;
    } catch (error) {
      this._debug_log('Error creating embedded signing URL: ' + error.message);
      throw error;
    }
  }

  // Create envelope for embedded signing
  async createEnvelopeForEmbeddedSigning(envelopeArgs) {
    try {
      if (!this.accountId) {
        await this.getUserInfo();
      }

      this._debug_log('Creating envelope for embedded signing...');

      // Data for this method
      // envelopeArgs.basePath
      // envelopeArgs.accessToken
      // envelopeArgs.accountId

      let dsApiClient = new docusign.ApiClient();
      dsApiClient.setBasePath(this.basePath);
      dsApiClient.addDefaultHeader('Authorization', 'Bearer ' + this.accessToken);
      let envelopesApi = new docusign.EnvelopesApi(dsApiClient);
      let results = null;

      // Step 1. Make the envelope request body
      let envelope = this.makeEnvelope(envelopeArgs);

      // Step 2. call Envelopes::create API method
      // Exceptions will be caught by the calling function
      results = await envelopesApi.createEnvelope(this.accountId, {
        envelopeDefinition: envelope,
      });

      let envelopeId = results.envelopeId;
      this._debug_log(`Envelope was created. EnvelopeId ${envelopeId}`);

      // Step 3. create the recipient view, the embedded signing
      let viewRequest = this.makeRecipientViewRequest(envelopeArgs);
      // Call the CreateRecipientView API
      // Exceptions will be caught by the calling function
      results = await envelopesApi.createRecipientView(this.accountId, envelopeId, {
        recipientViewRequest: viewRequest,
      });

      return { envelopeId: envelopeId, redirectUrl: results.url };
    } catch (error) {
      this._debug_log('Error creating envelope for embedded signing: ' + error.message);
      throw error;
    }
  }

  // Create envelope definition
  makeEnvelope(args) {
    // Data for this method
    // args.signerEmail
    // args.signerName
    // args.signerClientId
    // args.docFile (base64 encoded document)
    // args.documentName
    // args.anchorString (default: '/sn1/')

    this._debug_log('Creating envelope definition...');

    // create the envelope definition
    let env = new docusign.EnvelopeDefinition();
    env.emailSubject = args.emailSubject || 'Please sign this document';

    // add the documents
    if (args.docFile) {
      let doc1 = new docusign.Document();
      // Convert base64 to buffer if needed
      let docPdfBytes;
      if (typeof args.docFile === 'string') {
        // If it's already base64, decode it to buffer first
        docPdfBytes = Buffer.from(args.docFile, 'base64');
      } else {
        docPdfBytes = args.docFile;
      }

      let doc1b64 = Buffer.from(docPdfBytes).toString('base64');
      doc1.documentBase64 = doc1b64;
      doc1.name = args.documentName || 'Document'; // can be different from actual file name
      doc1.fileExtension = 'pdf';
      doc1.documentId = '1';

      // The order in the docs array determines the order in the envelope
      env.documents = [doc1];
    }

    // Create a signer recipient to sign the document, identified by name and email
    // We set the clientUserId to enable embedded signing for the recipient
    // We're setting the parameters via the object creation
    let signer1 = docusign.Signer.constructFromObject({
      email: args.signerEmail,
      name: args.signerName,
      clientUserId: args.signerClientId || '1000',
      recipientId: 1,
    });

    // Create signHere fields (also known as tabs) on the documents,
    // We're using anchor (autoPlace) positioning
    //
    // The DocuSign platform searches throughout your envelope's
    // documents for matching anchor strings.
    let signHere1 = docusign.SignHere.constructFromObject({
      anchorString: args.anchorString || '/sn1/',
      anchorYOffset: '10',
      anchorUnits: 'pixels',
      anchorXOffset: '20',
    });

    // Tabs are set per recipient / signer
    let signer1Tabs = docusign.Tabs.constructFromObject({
      signHereTabs: [signHere1],
    });
    signer1.tabs = signer1Tabs;

    // Add the recipient to the envelope object
    let recipients = docusign.Recipients.constructFromObject({
      signers: [signer1],
    });
    env.recipients = recipients;

    // Request that the envelope be sent by setting |status| to "sent".
    // To request that the envelope be created as a draft, set to "created"
    env.status = 'sent';

    this._debug_log('Envelope definition created successfully');
    return env;
  }

  // Create recipient view request for embedded signing
  makeRecipientViewRequest(args) {
    // Data for this method
    // args.dsReturnUrl
    // args.signerEmail
    // args.signerName
    // args.signerClientId
    // args.dsPingUrl

    this._debug_log('Creating recipient view request...');

    let viewRequest = new docusign.RecipientViewRequest();

    // Set the url where you want the recipient to go once they are done signing
    // should typically be a callback route somewhere in your app.
    // The query parameter is included as an example of how
    // to save/recover state information during the redirect to
    // the DocuSign signing. It's usually better to use
    // the session mechanism of your web framework. Query parameters
    // can be changed/spoofed very easily.
    viewRequest.returnUrl = args.dsReturnUrl + '?state=123';

    // How has your app authenticated the user? In addition to your app's
    // authentication, you can include authenticate steps from DocuSign.
    // Eg, SMS authentication
    viewRequest.authenticationMethod = 'none';

    // Recipient information must match embedded recipient info
    // we used to create the envelope.
    viewRequest.email = args.signerEmail;
    viewRequest.userName = args.signerName;
    viewRequest.clientUserId = args.signerClientId || '1000';

    // DocuSign recommends that you redirect to DocuSign for the
    // embedded signing. There are multiple ways to save state.
    // To maintain your application's session, use the pingUrl
    // parameter. It causes the DocuSign signing web page
    // (not the DocuSign server) to send pings via AJAX to your
    // app,
    viewRequest.pingFrequency = 600; // seconds
    // NOTE: The pings will only be sent if the pingUrl is an https address
    viewRequest.pingUrl = args.dsPingUrl; // optional setting

    this._debug_log('Recipient view request created successfully');
    return viewRequest;
  }

  // Send envelope for embedded signing (complete method)
  async sendEnvelopeForEmbeddedSigning(envelopeArgs) {
    try {
      this._debug_log('Sending envelope for embedded signing...');

      // Validate required arguments
      if (!envelopeArgs.signerEmail || !envelopeArgs.signerName || !envelopeArgs.docFile) {
        throw new Error('Missing required arguments: signerEmail, signerName, docFile');
      }

      // Create envelope and get signing URL
      const result = await this.createEnvelopeForEmbeddedSigning(envelopeArgs);

      this._debug_log(`Envelope sent successfully. ID: ${result.envelopeId}`);

      return result;
    } catch (error) {
      this._debug_log('Error sending envelope for embedded signing: ' + error.message);
      throw error;
    }
  }

  // Complete sendEnvelopeForEmbeddedSigning function following the exact pattern
  async sendEnvelopeForEmbeddedSigningComplete(args) {
    // Data for this method
    // args.basePath
    // args.accessToken
    // args.accountId
    // args.envelopeArgs

    try {
      this._debug_log('Sending envelope for embedded signing (complete method)...');

      let dsApiClient = new docusign.ApiClient();
      dsApiClient.setBasePath(args.basePath || this.basePath);
      dsApiClient.addDefaultHeader('Authorization', 'Bearer ' + (args.accessToken || this.accessToken));
      let envelopesApi = new docusign.EnvelopesApi(dsApiClient);
      let results = null;

      // Step 1. Make the envelope request body
      let envelope = this.makeEnvelope(args.envelopeArgs);

      // Step 2. call Envelopes::create API method
      // Exceptions will be caught by the calling function
      results = await envelopesApi.createEnvelope(args.accountId || this.accountId, {
        envelopeDefinition: envelope,
      });

      let envelopeId = results.envelopeId;
      this._debug_log(`Envelope was created. EnvelopeId ${envelopeId}`);

      // Step 3. create the recipient view, the embedded signing
      let viewRequest = this.makeRecipientViewRequest(args.envelopeArgs);
      // Call the CreateRecipientView API
      // Exceptions will be caught by the calling function
      results = await envelopesApi.createRecipientView(args.accountId || this.accountId, envelopeId, {
        recipientViewRequest: viewRequest,
      });

      return { envelopeId: envelopeId, redirectUrl: results.url };
    } catch (error) {
      this._debug_log('Error in sendEnvelopeForEmbeddedSigningComplete: ' + error.message);
      throw error;
    }
  }

  // Get envelope status and details
  async getEnvelopeDetails(envelopeId) {
    try {
      if (!this.accountId) {
        await this.getUserInfo();
      }

      const envelopesApi = this.getEnvelopesApi();
      const envelope = await envelopesApi.getEnvelope(this.accountId, envelopeId);

      return envelope;
    } catch (error) {
      this._debug_log('Error getting envelope details: ' + error.message);
      throw error;
    }
  }

  // List all envelopes with status
  async listEnvelopes(status = 'any', fromDate = null) {
    try {
      if (!this.accountId) {
        await this.getUserInfo();
      }

      const envelopesApi = this.getEnvelopesApi();

      let options = {};
      if (status !== 'any') {
        options.status = status;
      }
      if (fromDate) {
        options.fromDate = fromDate;
      }

      const envelopes = await envelopesApi.listStatusChanges(this.accountId, options);

      return envelopes.envelopes || [];
    } catch (error) {
      this._debug_log('Error listing envelopes: ' + error.message);
      throw error;
    }
  }

  // Update envelope status
  async updateEnvelopeStatus(envelopeId, status) {
    try {
      if (!this.accountId) {
        await this.getUserInfo();
      }

      const envelopesApi = this.getEnvelopesApi();

      const envelopeUpdate = {
        status: status
      };

      await envelopesApi.update(this.accountId, envelopeId, {
        envelope: envelopeUpdate
      });

      this._debug_log(`Envelope ${envelopeId} status updated to ${status}`);
      return { success: true, envelopeId, status };
    } catch (error) {
      this._debug_log('Error updating envelope status: ' + error.message);
      throw error;
    }
  }
}

module.exports = DocuSignService;
