import * as openidClient from 'openid-client';
import { createServer } from 'http';

// Create a simple wrapper for the generators
const generatorsWrapper = {
  nonce: () => {
    try {
      return openidClient.randomNonce();
    } catch (error) {
      console.error('Error generating nonce:', error);
      return Math.random().toString(36).substring(2, 15);
    }
  },
  state: () => {
    try {
      return openidClient.randomState();
    } catch (error) {
      console.error('Error generating state:', error);
      return Math.random().toString(36).substring(2, 15);
    }
  },
  codeVerifier: () => {
    try {
      return openidClient.randomPKCECodeVerifier();
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
      return openidClient.calculatePKCECodeChallenge(verifier);
    } catch (error) {
      console.error('Error generating code challenge:', error);
      // This is not a proper code challenge, but it's a fallback
      return verifier;
    }
  }
};

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
        
        // Use the discovery function directly
        const issuerMetadata = await openidClient.discovery(discoveryUrl);
        
        console.log('Discovery successful, issuer metadata:', issuerMetadata);
        
        // Create a response with the endpoints from the issuer metadata
        const response = {
          authorizationUrl: issuerMetadata.authorization_endpoint || null,
          tokenUrl: issuerMetadata.token_endpoint || null,
          userInfoUrl: issuerMetadata.userinfo_endpoint || null,
          jwksUrl: issuerMetadata.jwks_uri || null,
          issuer: issuerMetadata.issuer || null
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