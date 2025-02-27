import * as openidClient from 'openid-client';
import { createServer } from 'http';

const server = createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const action = url.searchParams.get('action');
  
  if (action === 'discover') {
    const discoveryUrl = url.searchParams.get('url');
    if (!discoveryUrl) {
      res.writeHead(400);
      res.end(JSON.stringify({ error: 'Missing discovery URL' }));
      return;
    }
    
    openidClient.discovery(discoveryUrl)
      .then(issuer => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          issuer: issuer.issuer,
          authorization_endpoint: issuer.authorization_endpoint,
          token_endpoint: issuer.token_endpoint,
          userinfo_endpoint: issuer.userinfo_endpoint,
          jwks_uri: issuer.jwks_uri
        }));
      })
      .catch(error => {
        res.writeHead(500);
        res.end(JSON.stringify({ error: error.message }));
      });
  } else if (action === 'generate') {
    const nonce = openidClient.randomNonce();
    const state = openidClient.randomState();
    const codeVerifier = openidClient.randomPKCECodeVerifier();
    const codeChallenge = openidClient.calculatePKCECodeChallenge(codeVerifier);
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ nonce, state, codeVerifier, codeChallenge }));
  } else {
    res.writeHead(400);
    res.end(JSON.stringify({ error: 'Invalid action' }));
  }
});

server.listen(0, () => {
  const port = server.address().port;
  console.log(JSON.stringify({ port }));
}); 