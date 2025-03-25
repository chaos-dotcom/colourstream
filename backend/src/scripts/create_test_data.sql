-- Check if client exists, if not create it
DO $$
DECLARE
  client_id UUID;
  project_id UUID;
  token1 TEXT := '0123456789abcdef0123456789abcdef';
  token2 TEXT := 'fedcba9876543210fedcba9876543210';
  token3 TEXT := 'abcdef0123456789abcdef0123456789';
BEGIN
  -- Check if we have any clients
  IF NOT EXISTS (SELECT 1 FROM "Client" LIMIT 1) THEN
    -- Create a test client
    INSERT INTO "Client" (id, name, code, "createdAt", "updatedAt")
    VALUES (
      gen_random_uuid(),
      'Test Client',
      'TEST',
      NOW(),
      NOW()
    )
    RETURNING id INTO client_id;
    
    RAISE NOTICE 'Created client with ID: %', client_id;
  ELSE
    -- Get the first client
    SELECT id INTO client_id FROM "Client" LIMIT 1;
    RAISE NOTICE 'Using existing client with ID: %', client_id;
  END IF;
  
  -- Check if we have any projects for this client
  IF NOT EXISTS (SELECT 1 FROM "Project" WHERE "clientId"::TEXT = client_id::TEXT LIMIT 1) THEN
    -- Create a test project
    INSERT INTO "Project" (id, name, description, "clientId", "createdAt", "updatedAt")
    VALUES (
      gen_random_uuid(),
      'Test Project',
      'A test project for upload links',
      client_id,
      NOW(),
      NOW()
    )
    RETURNING id INTO project_id;
    
    RAISE NOTICE 'Created project with ID: %', project_id;
  ELSE
    -- Get the first project
    SELECT id INTO project_id FROM "Project" WHERE "clientId"::TEXT = client_id::TEXT LIMIT 1;
    RAISE NOTICE 'Using existing project with ID: %', project_id;
  END IF;
  
  -- Delete existing upload links if they exist with these tokens
  DELETE FROM "UploadLink" WHERE token IN (token1, token2, token3);
  
  -- Create test upload links
  INSERT INTO "UploadLink" (id, token, "projectId", "expiresAt", "maxUses", "usedCount", "isActive", "createdAt", "updatedAt")
  VALUES
  (
    gen_random_uuid(),
    token1,
    project_id,
    NOW() + INTERVAL '7 days',
    NULL, -- Unlimited uses
    0,
    TRUE,
    NOW(),
    NOW()
  );
  
  INSERT INTO "UploadLink" (id, token, "projectId", "expiresAt", "maxUses", "usedCount", "isActive", "createdAt", "updatedAt")
  VALUES
  (
    gen_random_uuid(),
    token2,
    project_id,
    NOW() + INTERVAL '7 days',
    10,
    0,
    TRUE,
    NOW(),
    NOW()
  );
  
  INSERT INTO "UploadLink" (id, token, "projectId", "expiresAt", "maxUses", "usedCount", "isActive", "createdAt", "updatedAt")
  VALUES
  (
    gen_random_uuid(),
    token3,
    project_id,
    NOW() + INTERVAL '7 days',
    5,
    2,
    TRUE,
    NOW(),
    NOW()
  );
  
  RAISE NOTICE 'Created 3 test upload links';
END $$; 