import { Issuer, generators } from 'openid-client';
import { createServer } from 'http';

// Create a simple wrapper for the generators
const generatorsWrapper = {
  nonce: () => {
    try {
      return generators.nonce();
    } catch (error) {
      console.error('Error generating nonce:', error);
      return Math.random().toString(36).substring(2, 15);
    }
  },
  state: () => {
    try {
      return generators.state();
    } catch (error) {
      console.error('Error generating state:', error);
      return Math.random().toString(36).substring(2, 15);
    }
  },
  codeVerifier: () => {
    try {
      return generators.codeVerifier();
    } catch (error) {
      console.error('Error generating code verifier:', error);
      // Generate a random string of 43-128 characters
      return Math.random().toString(36).substring(2, 15) + 
             Math.random().toString(36).substring(2, 15) +
             Math.random().toString(36).substring(2, 15);
    }
  },
  codeChallenge: (verifier) => {
    try {
      return generators.codeChallenge(verifier);
    } catch (error) {
      console.error('Error generating code challenge:', error);
      // This is not a proper code challenge, but it's a fallback
      return verifier;
    }
  }
};

// Store clients for reuse
const clients = new Map();

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const action = url.searchParams.get('action');
  
  res.setHeader('Content-Type', 'application/json');
  
  try {
    if (action === 'discover') {
      const discoveryUrl = url.searchParams.get('discoveryUrl');
      if (!discoveryUrl) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: 'Missing discoveryUrl parameter' }));
        return;
      }
      
      try {
        console.log(`Attempting to discover OIDC provider at: ${discoveryUrl}`);
        
        // Use the Issuer.discover method
        const issuer = await Issuer.discover(discoveryUrl);
        
        console.log('Discovery successful, issuer metadata:', issuer.metadata);
        
        // Create a response with the endpoints from the issuer metadata
        const response = {
          authorizationUrl: issuer.metadata.authorization_endpoint || null,
          tokenUrl: issuer.metadata.token_endpoint || null,
          userInfoUrl: issuer.metadata.userinfo_endpoint || null,
          jwksUrl: issuer.metadata.jwks_uri || null,
          issuer: issuer.metadata.issuer || null
        };
        
        console.log('Discovery response:', response);
        
        res.end(JSON.stringify(response));
      } catch (error) {
        console.error('Discovery error:', error);
        res.statusCode = 500;
        res.end(JSON.stringify({ 
          error: 'Failed to discover OIDC provider', 
          message: error.message,
          stack: error.stack
        }));
      }
    } else if (action === 'generate') {
      try {
        // Use our wrapper for generators
        const nonce = generatorsWrapper.nonce();
        const state = generatorsWrapper.state();
        const codeVerifier = generatorsWrapper.codeVerifier();
        const codeChallenge = generatorsWrapper.codeChallenge(codeVerifier);
        
        console.log('Generated PKCE values:', {
          nonce,
          state,
          codeVerifier,
          codeChallenge
        });
        
        res.end(JSON.stringify({
          nonce,
          state,
          codeVerifier,
          codeChallenge
        }));
      } catch (error) {
        console.error('Error generating PKCE values:', error);
        res.statusCode = 500;
        res.end(JSON.stringify({ error: 'Failed to generate PKCE values', message: error.message }));
      }
    } else if (action === 'validateToken') {
      try {
        const clientId = url.searchParams.get('clientId');
        const clientSecret = url.searchParams.get('clientSecret');
        const discoveryUrl = url.searchParams.get('discoveryUrl');
        const tokenSet = JSON.parse(url.searchParams.get('tokenSet') || '{}');
        
        if (!clientId || !clientSecret || !discoveryUrl) {
          res.statusCode = 400;
          res.end(JSON.stringify({ 
            error: 'Missing required parameters', 
            message: 'clientId, clientSecret, and discoveryUrl are required' 
          }));
          return;
        }
        
        // Get or create client
        let client = clients.get(clientId);
        if (!client) {
          console.log(`Creating new client for ${clientId} with discovery URL ${discoveryUrl}`);
          const issuer = await Issuer.discover(discoveryUrl);
          client = new issuer.Client({
            client_id: clientId,
            client_secret: clientSecret,
            token_endpoint_auth_method: 'client_secret_basic'
          });
          clients.set(clientId, client);
        }
        
        // Validate the token
        const validationResult = await client.userinfo(tokenSet);
        
        res.end(JSON.stringify({
          valid: true,
          userInfo: validationResult
        }));
      } catch (error) {
        console.error('Token validation error:', error);
        res.statusCode = 401;
        res.end(JSON.stringify({ 
          valid: false,
          error: 'Token validation failed', 
          message: error.message 
        }));
      }
    } else if (action === 'exchangeToken') {
      try {
        const clientId = url.searchParams.get('clientId');
        const clientSecret = url.searchParams.get('clientSecret');
        const discoveryUrl = url.searchParams.get('discoveryUrl');
        const code = url.searchParams.get('code');
        const redirectUri = url.searchParams.get('redirectUri');
        const codeVerifier = url.searchParams.get('codeVerifier');
        
        if (!clientId || !clientSecret || !discoveryUrl || !code || !redirectUri || !codeVerifier) {
          res.statusCode = 400;
          res.end(JSON.stringify({ 
            error: 'Missing required parameters', 
            message: 'clientId, clientSecret, discoveryUrl, code, redirectUri, and codeVerifier are required' 
          }));
          return;
        }
        
        // Get or create client
        let client = clients.get(clientId);
        if (!client) {
          console.log(`Creating new client for ${clientId} with discovery URL ${discoveryUrl}`);
          const issuer = await Issuer.discover(discoveryUrl);
          client = new issuer.Client({
            client_id: clientId,
            client_secret: clientSecret,
            token_endpoint_auth_method: 'client_secret_basic'
          });
          clients.set(clientId, client);
        }
        
        // Exchange code for tokens
        const tokenSet = await client.callback(
          redirectUri,
          { code },
          { code_verifier: codeVerifier }
        );
        
        // Get user info
        const userInfo = await client.userinfo(tokenSet);
        
        res.end(JSON.stringify({
          tokenSet,
          userInfo
        }));
      } catch (error) {
        console.error('Token exchange error:', error);
        res.statusCode = 500;
        res.end(JSON.stringify({ 
          error: 'Token exchange failed', 
          message: error.message 
        }));
      }
    } else {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: 'Invalid action' }));
    }
  } catch (error) {
    console.error('Server error:', error);
    res.statusCode = 500;
    res.end(JSON.stringify({ error: 'Internal server error', message: error.message }));
  }
});

server.listen(0, () => {
  const port = server.address().port;
  console.log(JSON.stringify({ port }));
}); 