# Use the latest version of Ubuntu
FROM ubuntu:latest

# Build argument for architecture - defaults to arm64 for Apple Silicon, can be overridden
ARG ARCH=arm64

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
    libfuse2 \
    ca-certificates \
    unzip \
    rsync \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Install AWS CLI v2 - Using the official installer
RUN curl "https://awscli.amazonaws.com/awscli-exe-linux-$(uname -m).zip" -o "awscliv2.zip" \
    && unzip awscliv2.zip \
    && ./aws/install \
    && rm -rf aws awscliv2.zip

# Install the AWS S3 Mount tool
RUN wget https://s3.amazonaws.com/mountpoint-s3-release/latest/${ARCH}/mount-s3.deb \
    && dpkg -i mount-s3.deb \
    && rm mount-s3.deb

# Create mount directories
RUN mkdir -p /mnt/s3fs /mnt/shared

# Copy startup script and make it executable
COPY start.sh /mnt/start.sh
RUN chmod +x /mnt/start.sh

# Add documentation
LABEL maintainer="John Rogers"
LABEL description="Docker container for mounting S3 compatible storage using AWS Mountpoint for S3"
LABEL version="1.0"
LABEL name="colourstream-turbomount"

# Set the working directory
WORKDIR /mnt

# Set the entry point
CMD ["/mnt/start.sh"] 