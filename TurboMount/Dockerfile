# Use the latest version of Ubuntu
FROM ubuntu:latest

# Set environment variables
ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1

# Update and install dependencies
RUN apt-get update && apt-get install -y \
    vim \
    grep \
    wget \
    curl \
    fuse3 \
    libfuse3-dev \
    s3fs \
    ca-certificates \
    unzip \
    rsync \
    procps \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Install AWS CLI v2 (compatible with arm64 architecture)
RUN curl "https://awscli.amazonaws.com/awscli-exe-linux-aarch64.zip" -o "awscliv2.zip" \
    && unzip awscliv2.zip \
    && ./aws/install \
    && rm -rf awscliv2.zip aws

# Create mount directories
RUN mkdir -p /mnt/s3fs

# Copy startup script and make it executable
COPY start.sh /mnt/start.sh
RUN chmod +x /mnt/start.sh

# Add documentation
LABEL maintainer="John Rogers"
LABEL description="Docker container for mounting S3 compatible storage using s3fs-fuse"
LABEL version="2.0"
LABEL name="colourstream-turbomount"

# Set the working directory
WORKDIR /mnt

# Set the entry point
CMD ["/mnt/start.sh"] 