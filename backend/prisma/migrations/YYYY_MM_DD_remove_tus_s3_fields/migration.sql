-- Drop the index on tusId
DROP INDEX IF EXISTS "UploadedFile_tusId_idx";

-- Remove the constraints
ALTER TABLE "UploadedFile" DROP CONSTRAINT IF EXISTS "UploadedFile_tusId_key";

-- Drop the columns
ALTER TABLE "UploadedFile" DROP COLUMN IF EXISTS "tusId";
ALTER TABLE "UploadedFile" DROP COLUMN IF EXISTS "s3Bucket";
ALTER TABLE "UploadedFile" DROP COLUMN IF EXISTS "s3Key"; 