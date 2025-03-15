# TurboMount - S3 Bucket Mounting Container

TurboMount is a Docker-based solution for mounting S3 buckets as filesystems on macOS. It uses AWS Mountpoint for S3 to provide a seamless way to access S3 objects as files.

## Features

- Works on both Intel (x86_64) and Apple Silicon (ARM) Macs
- Supports AWS S3 and S3-compatible storage solutions (like MinIO)
- Configurable through environment variables
- Exposes mounted S3 bucket through a Docker volume
- Integration with existing Docker Compose setups

## Prerequisites

- Docker Desktop for Mac
- Docker Compose
- AWS account with S3 bucket (or S3-compatible storage)
- AWS credentials with appropriate permissions

## Setup Instructions

1. **Create .env file:**
   ```bash
   cp .env.example .env
   ```
   Edit the `.env` file with your actual S3 bucket name and credentials.

2. **Build and start the container:**
   ```bash
   docker-compose up -d
   ```

3. **Verify the mount:**
   ```bash
   docker exec -it turbomount ls -la /mnt/s3
   ```

4. **Access your S3 files:**
   Files mounted in the container are also accessible through the `turbomount_data` volume.

## Integration with Existing Projects

To integrate TurboMount with your existing Docker Compose project:

1. Make sure the network name in `docker-compose.yml` matches your project's network
2. Add the TurboMount service to your main `docker-compose.yml` file or use the `--file` option:
   ```bash
   docker-compose -f docker-compose.yml -f TurboMount/docker-compose.yml up -d
   ```

## Using with MinIO

When using TurboMount with MinIO or other S3-compatible storage:

1. Make sure to use the **public endpoint URL** for your MinIO server in the `S3_ENDPOINT` variable
2. Example: `S3_ENDPOINT=https://s3.yourdomain.com` instead of `http://minio:9000`
3. This is because mount-s3 needs to resolve the domain name from inside the container
4. You might need to ensure your MinIO server has proper TLS certificates installed

## Troubleshooting

If you encounter issues:

1. **Check container logs:**
   ```bash
   docker logs turbomount
   ```

2. **Verify AWS credentials:**
   ```bash
   docker exec -it turbomount aws s3 ls
   ```

3. **Check FUSE permissions:**
   Make sure `/dev/fuse` is accessible and `--cap-add SYS_ADMIN` is properly set.

4. **Architecture issues:**
   Ensure you've set the correct `ARCH` in your .env file (arm64 for Apple Silicon, amd64 for Intel Macs).

5. **DNS resolution errors:**
   If you see "Host name was invalid for dns resolution" errors, try using a public endpoint URL that can be resolved from within the container.

## Known Limitations on macOS

- Performance may vary compared to native S3 access
- File locking operations may not work as expected
- Some macOS-specific file attributes may not be preserved

## Credits

- [AWS Mountpoint for S3](https://github.com/awslabs/mountpoint-s3)
- Ubuntu base image 