export default {
  issuer: 'https://{yourOktaDomain}/oauth2/default',
  clientId: '{yourClientId}',
  redirectUri: window.location.origin + '/login/callback',
  scopes: ['openid', 'profile', 'email'],
};
