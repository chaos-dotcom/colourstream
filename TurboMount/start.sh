#!/bin/bash
set -e

echo "Starting TurboMount S3 mounting service with s3fs-fuse..."

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

# Create cache directory for s3fs
CACHE_DIR="/tmp/s3fs-cache"
mkdir -p $CACHE_DIR

# Debug: Print environment variables for troubleshooting
echo "Environment variables:"
echo "S3_BUCKET: $S3_BUCKET"
echo "S3_REGION: $S3_REGION"
echo "S3_PUBLIC_ENDPOINT: $S3_PUBLIC_ENDPOINT"
echo "S3_MOUNT_POINT: $S3_MOUNT_POINT"
echo "AWS_ACCESS_KEY_ID: ${AWS_ACCESS_KEY_ID:0:5}... (masked)"
echo "AWS_SECRET_ACCESS_KEY: ${AWS_SECRET_ACCESS_KEY:0:5}... (masked)"

# Create mount directories if they don't exist
mkdir -p "$S3_MOUNT_POINT"

# Test AWS/S3 credentials with aws CLI before mounting
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
if eval $AWS_CMD; then
  echo "Successfully connected to S3 bucket: $S3_BUCKET using AWS CLI"
  
  # Create password file for s3fs (more secure than passing credentials on command line)
  echo "${AWS_ACCESS_KEY_ID}:${AWS_SECRET_ACCESS_KEY}" > /tmp/.s3fs-credentials
  chmod 600 /tmp/.s3fs-credentials
  
  # Set up s3fs mount options
  S3FS_OPTS="use_cache=${CACHE_DIR},allow_other,use_path_request_style,umask=0022"
  
  # Add endpoint option if specified
  if [ -n "$S3_PUBLIC_ENDPOINT" ]; then
    # Remove http:// or https:// if present
    S3_ENDPOINT=$(echo $S3_PUBLIC_ENDPOINT | sed 's#^https\?://##')
    S3FS_OPTS="${S3FS_OPTS},url=https://${S3_ENDPOINT},endpoint=${S3_REGION}"
  fi
  
  # Add performance options
  S3FS_OPTS="${S3FS_OPTS},parallel_count=20,multipart_size=52,list_object_max_keys=1000,max_stat_cache_size=100000"
  
  # Mount the S3 bucket
  echo "Mounting S3 bucket with s3fs-fuse..."
  echo "Mount options: ${S3FS_OPTS}"
  
  # Unmount first if already mounted (in case of container restart)
  if mountpoint -q "$S3_MOUNT_POINT"; then
    echo "Unmounting existing mount point..."
    umount -f "$S3_MOUNT_POINT" || true
  fi
  
  # Mount the bucket
  s3fs "$S3_BUCKET" "$S3_MOUNT_POINT" -o passwd_file=/tmp/.s3fs-credentials -o "$S3FS_OPTS"
  
  # Verify mount was successful
  if mountpoint -q "$S3_MOUNT_POINT"; then
    echo "S3 bucket successfully mounted at $S3_MOUNT_POINT"
    echo "List top-level directories:"
    ls -la "$S3_MOUNT_POINT"
    
    # Show CLIENT/PROJECT structure
    echo "CLIENT/PROJECT Directory Structure:"
    find "$S3_MOUNT_POINT" -type d -maxdepth 2 2>/dev/null | sort
    
    # Keep container running and detect if mount fails
    echo "Mount is active. Container will continue running. Use docker logs to monitor activity."
    
    # Monitor the mount point and exit if it becomes unavailable
    while true; do
      if ! mountpoint -q "$S3_MOUNT_POINT"; then
        echo "ERROR: Mount point is no longer available. Attempting to remount..."
        s3fs "$S3_BUCKET" "$S3_MOUNT_POINT" -o passwd_file=/tmp/.s3fs-credentials -o "$S3FS_OPTS"
        
        if ! mountpoint -q "$S3_MOUNT_POINT"; then
          echo "ERROR: Failed to remount. Exiting."
          exit 1
        fi
        
        echo "Successfully remounted."
      fi
      
      # Output a status message every 5 minutes to show the service is still running
      date
      echo "S3 mount is active at $S3_MOUNT_POINT"
      
      # Sleep for 5 minutes
      sleep 300
    done
  else
    echo "ERROR: Failed to mount S3 bucket at $S3_MOUNT_POINT"
    exit 1
  fi
else
  echo "Failed to connect to S3 bucket: $S3_BUCKET using AWS CLI"
  echo "This could be due to credentials or network issues"
  exit 1
fi 