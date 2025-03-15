#!/bin/bash
set -e

echo "Starting TurboMount S3 mounting service..."

# Check for required environment variables
if [ -z "$S3_BUCKET" ]; then
  echo "Error: S3_BUCKET environment variable is required"
  exit 1
fi

# Set AWS credential environment variables from S3_ACCESS_KEY and S3_SECRET_KEY
if [ -n "$S3_ACCESS_KEY" ]; then
  export AWS_ACCESS_KEY_ID="$S3_ACCESS_KEY"
  echo "Using S3_ACCESS_KEY for AWS credentials"
elif [ -z "$AWS_ACCESS_KEY_ID" ]; then
  echo "Error: Neither S3_ACCESS_KEY nor AWS_ACCESS_KEY_ID environment variable is set"
  exit 1
fi

if [ -n "$S3_SECRET_KEY" ]; then
  export AWS_SECRET_ACCESS_KEY="$S3_SECRET_KEY"
  echo "Using S3_SECRET_KEY for AWS credentials"
elif [ -z "$AWS_SECRET_ACCESS_KEY" ]; then
  echo "Error: Neither S3_SECRET_KEY nor AWS_SECRET_ACCESS_KEY environment variable is set"
  exit 1
fi

# Set region if provided, otherwise default to us-east-1
S3_REGION=${S3_REGION:-us-east-1}

# Set mount point with default if not specified
S3_MOUNT_POINT=${S3_MOUNT_POINT:-/mnt/s3fs}

# Debug: Print environment variables for troubleshooting
echo "Environment variables:"
echo "S3_BUCKET: $S3_BUCKET"
echo "S3_REGION: $S3_REGION"
echo "S3_PUBLIC_ENDPOINT: $S3_PUBLIC_ENDPOINT"
echo "MOUNT_OPTIONS: $MOUNT_OPTIONS"
echo "S3_MOUNT_POINT: $S3_MOUNT_POINT"
echo "AWS_ACCESS_KEY_ID: ${AWS_ACCESS_KEY_ID:0:5}... (masked)"
echo "AWS_SECRET_ACCESS_KEY: ${AWS_SECRET_ACCESS_KEY:0:5}... (masked)"

# Create mount directories if they don't exist
mkdir -p "$S3_MOUNT_POINT"
mkdir -p /mnt/shared

# Test AWS/S3 credentials with aws CLI
echo "Testing S3 connection with aws CLI..."
if [ -n "$S3_PUBLIC_ENDPOINT" ]; then
  # Explicitly configure AWS CLI to use path-style URL for MinIO compatibility
  aws configure set default.s3.addressing_style path
  AWS_CMD="aws s3 ls --endpoint-url $S3_PUBLIC_ENDPOINT s3://$S3_BUCKET"
else
  AWS_CMD="aws s3 ls s3://$S3_BUCKET"
fi

echo "Running: $AWS_CMD"
echo "This may take a moment..."
eval $AWS_CMD
if [ $? -eq 0 ]; then
  echo "Successfully connected to S3 bucket: $S3_BUCKET using AWS CLI"
  
  # Now get contents directly and use them to populate the shared directory
  echo "Listing bucket contents and copying to shared directory..."
  rm -rf /mnt/shared/* # Clear any existing files
  
  # Get all files from S3 bucket
  if [ -n "$S3_PUBLIC_ENDPOINT" ]; then
    aws s3 cp --endpoint-url $S3_PUBLIC_ENDPOINT --recursive s3://$S3_BUCKET/ /mnt/shared/
  else
    aws s3 cp --recursive s3://$S3_BUCKET/ /mnt/shared/
  fi
  
  # Set permissions
  chmod -R 755 /mnt/shared
  
  echo "Files successfully copied to /mnt/shared"
  echo "Listing copied files:"
  ls -la /mnt/shared
else
  echo "Failed to connect to S3 bucket: $S3_BUCKET using AWS CLI"
  echo "This could be due to credentials or network issues"
  exit 1
fi

echo "TurboMount service is running successfully!"
echo "Container will continue running. Use docker logs to monitor activity."
echo "S3 files are accessible on the host at /Volumes/Backup3/s3mount"

exec tail -f /dev/null 