#!/bin/bash

# ColourStream UFW Setup Script
# This script configures UFW firewall rules for the ColourStream docker-compose stack

# Reset UFW to default settings (optional, comment out if you want to keep existing rules)
ufw --force reset

# Set default policies
ufw default deny incoming
ufw default allow outgoing

# Allow SSH (always include this to avoid getting locked out)
ufw allow ssh

# HTTP/HTTPS for Traefik
ufw allow 80/tcp
ufw allow 443/tcp

# Traefik Dashboard
ufw allow 8090/tcp

# Frontend
ufw allow 3000/tcp

# OvenMediaEngine Origin
ufw allow 8081/tcp  # OVT(Origin)1
ufw allow 8082/tcp  # OVT(Origin)2
ufw allow 9000/tcp  # OVT(Origin)
ufw allow 1935/tcp  # RTMP Provider
ufw allow 9999/tcp  # SRT
ufw allow 3333/tcp  # WebRTC Signaling / LLHLS
ufw allow 3334/tcp  # TLS WebRTC Signaling / LLHLS
ufw allow 3478/tcp  # WebRTC TURN
# WebRTC UDP ports
ufw allow proto udp from any to any port 10000:10004

# OvenMediaEngine Edge
ufw allow 4333/tcp  # WebRTC Signaling / LLHLS
ufw allow 3479/tcp  # WebRTC TURN
# WebRTC UDP ports
ufw allow proto udp from any to any port 10005:10009

# Coturn TURN server
ufw allow 3480/tcp
ufw allow 3480/udp
ufw allow 5350/tcp
ufw allow 5350/udp
# TURN UDP port range
ufw allow proto udp from any to any port 30000:31000

# Enable the firewall
ufw --force enable

# Show status
ufw status verbose

echo "UFW rules have been set up for ColourStream services." 