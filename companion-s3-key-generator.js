// companion-s3-key-generator.js
// This function will be used by Companion to generate clean keys for S3 uploads
// It strips out UUIDs and organizes files by client and project folders
// Reference: https://uppy.io/docs/companion/#s3-storage
// Updated function signature based on potential Uppy documentation format
function stripUuid({ filename, metadata, req }) {
  // Log everything received to understand the structure
  console.log('[KeyGen V3] Received args:', {
    filename,
    metadata: JSON.stringify(metadata),
    reqAvailable: !!req,
    reqBodyKeys: req ? Object.keys(req.body || {}) : 'N/A',
    // Also try logging req.companion.options.metadata if available
    reqCompanionOptionsMetadata: req && req.companion && req.companion.options ? JSON.stringify(req.companion.options.metadata) : 'N/A'
  });

  // Determine the source of metadata, trying multiple potential locations
  let meta = null;
  if (metadata && (metadata.client || metadata.project)) {
    console.log('[KeyGen V3] Using direct metadata argument');
    meta = metadata;
  } else if (req && req.body && req.body.metadata && (req.body.metadata.client || req.body.metadata.project)) {
    console.log('[KeyGen V3] Using req.body.metadata');
    meta = req.body.metadata;
  } else if (req && req.companion && req.companion.options && req.companion.options.metadata && (req.companion.options.metadata.client || req.companion.options.metadata.project)) {
    // Check req.companion.options.metadata as a less common possibility
    console.log('[KeyGen V3] Using req.companion.options.metadata');
    meta = req.companion.options.metadata;
  } else {
     console.log('[KeyGen V3] Metadata (client/project) not found in expected locations.');
  }

  console.log('[KeyGen V3] Final metadata used:', JSON.stringify(meta));

  const clientName = meta ? meta.client : 'default_client'; // Use clearer defaults
  const projectName = meta ? meta.project : 'default_project';
  console.log('[KeyGen V3] Extracted client/project:', clientName, '/', projectName);

  // Normalize the client code and project name (replace spaces with underscores)
  const normalizedClientCode = clientName ? String(clientName).replace(/\s+/g, '_') : 'default_client';
  const normalizedProjectName = projectName ? String(projectName).replace(/\s+/g, '_') : 'default_project';
  console.log('[KeyGen V3] Normalized client/project:', normalizedClientCode, '/', normalizedProjectName);

  // Strip out the UUID pattern from the filename
  const filenameWithoutUuid = filename.replace(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-)/gi, '');

  // Ensure the filename is valid for S3 but preserve the original name as much as possible
  const safeName = filenameWithoutUuid.replace(/[\/\\:*?"<>|]/g, '_');

  // Log the transformation for debugging
  console.log(`[KeyGen V3] Original filename: ${filename}`);
  console.log(`[KeyGen V3] Clean filename without UUID: ${safeName}`);

  // Create the key using the /CLIENT/PROJECT/filename structure
  const key = `${normalizedClientCode}/${normalizedProjectName}/${safeName}`;
  console.log(`[KeyGen V3] Generated S3 key: ${key}`);

  return key;
}

module.exports = { stripUuid }; 