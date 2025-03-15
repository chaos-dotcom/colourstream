# TurboMount - S3 Bucket Mounting Container with s3fs-fuse

TurboMount is a Docker-based solution for mounting S3 buckets as filesystems on macOS and Linux. It uses s3fs-fuse to provide a seamless way to access S3 objects as files **without downloading the entire bucket content**.

## Features

- True filesystem mounting without downloading all files
- Files are only downloaded when accessed (lazy loading)
- Works on both Intel (x86_64) and Apple Silicon (ARM) Macs
- Supports AWS S3 and S3-compatible storage solutions (like MinIO)
- Maintains CLIENT/PROJECT directory structure
- Automatically recovers from mount failures
- Configurable through environment variables
- Exposes mounted S3 bucket through a Docker volume

## Key Advantages Over Previous Method

- Instant startup (no waiting for downloads)
- Minimal disk space usage (only caches accessed files)
- Real-time access to all bucket content, including new files
- Much lower network bandwidth usage
- No duplication of data

## Prerequisites

- Docker Desktop for Mac or Linux
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
   docker exec -it turbomount ls -la /mnt/s3fs
   ```

4. **Check the CLIENT/PROJECT structure:**
   ```bash
   docker exec -it turbomount find /mnt/s3fs -type d -maxdepth 2
   ```

## Integration with Existing Projects

To integrate TurboMount with your existing Docker Compose project:

1. Make sure the network name in `docker-compose.yml` matches your project's network
2. Add the TurboMount service to your main `docker-compose.yml` file or use the `--file` option:
   ```bash
   docker-compose -f docker-compose.yml -f TurboMount/docker-compose.yml up -d
   ```

## Using with MinIO

When using TurboMount with MinIO or other S3-compatible storage:

1. Set the `S3_PUBLIC_ENDPOINT` environment variable to your MinIO server's endpoint URL:
   ```
   S3_PUBLIC_ENDPOINT=https://s3.yourdomain.com
   ```
2. Make sure your MinIO server has proper TLS certificates installed if using HTTPS

## Performance Tuning

The default configuration should work well for most scenarios, but you can tune performance by modifying these parameters in `start.sh`:

- `parallel_count`: Number of parallel connections (default: 20)
- `multipart_size`: Size of multipart uploads in MB (default: 52)
- `max_stat_cache_size`: Number of entries in the stat cache (default: 100000)
- `use_cache`: Path to the cache directory (default: /tmp/s3fs-cache)

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

3. **Check FUSE mount status:**
   ```bash
   docker exec -it turbomount mountpoint -q /mnt/s3fs && echo "Mounted" || echo "Not mounted"
   ```

4. **Check mount options:**
   ```bash
   docker exec -it turbomount mount | grep s3fs
   ```

5. **Force remount if needed:**
   ```bash
   docker exec -it turbomount umount -f /mnt/s3fs
   docker exec -it turbomount /mnt/start.sh
   ```

## Credits

- [s3fs-fuse](https://github.com/s3fs-fuse/s3fs-fuse)
- Ubuntu base image 