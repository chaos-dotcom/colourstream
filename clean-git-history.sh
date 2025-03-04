#!/bin/bash

# Script to remove sensitive files from git history
# This script will remove all traces of sensitive files from the git history
# while keeping the actual files on the filesystem

echo "This script will remove sensitive files from your git history."
echo "Make sure you have a backup of your repository before proceeding."
echo "This operation is IRREVERSIBLE and will rewrite your git history."
echo ""
echo "Press Ctrl+C to cancel or Enter to continue..."
read

# Files to remove from git history
FILES_TO_REMOVE=(
  "global.env"
  "backend/.env"
  "frontend/.env"
  "mirotalk/.env"
  "ovenmediaengine/.env"
  "traefik/acme.json"
  "traefik/acme.json.backup"
  "traefik/certs/chain.pem"
  "traefik/certs/fullchain.pem"
  "traefik/certs/privkey.pem"
  "traefik/certs/letsencrypt.key"
  "traefik/certs/letsencrypt.key.pem"
  "traefik/certs/letsencrypt.key.pem.enc"
  "certs/chain.pem"
  "certs/fullchain.pem"
  "certs/privkey.pem"
  "certs/acme.json"
)

# Backup sensitive files
echo "Backing up sensitive files..."
mkdir -p .git-sensitive-backup
for file in "${FILES_TO_REMOVE[@]}"; do
  if [ -f "$file" ]; then
    dir=$(dirname ".git-sensitive-backup/$file")
    mkdir -p "$dir"
    cp "$file" ".git-sensitive-backup/$file"
    echo "Backed up $file"
  fi
done

# Use git filter-repo to remove files from history
echo "Installing git-filter-repo if not already installed..."
pip install git-filter-repo

echo "Removing sensitive files from git history..."
for file in "${FILES_TO_REMOVE[@]}"; do
  echo "Removing $file from git history..."
  git filter-repo --path "$file" --invert-paths --force
done

# Restore the backed up files
echo "Restoring sensitive files to the filesystem..."
for file in "${FILES_TO_REMOVE[@]}"; do
  if [ -f ".git-sensitive-backup/$file" ]; then
    dir=$(dirname "$file")
    mkdir -p "$dir"
    cp ".git-sensitive-backup/$file" "$file"
    echo "Restored $file"
  fi
done

echo "Adding sensitive files to .gitignore to prevent future commits..."
for file in "${FILES_TO_REMOVE[@]}"; do
  if ! grep -q "^$file$" .gitignore; then
    echo "$file" >> .gitignore
    echo "Added $file to .gitignore"
  fi
done

echo ""
echo "Cleaning complete. The sensitive files have been removed from git history"
echo "but remain on your filesystem."
echo ""
echo "IMPORTANT: This operation has rewritten your git history. If you have already"
echo "pushed this repository to a remote, you will need to force push:"
echo ""
echo "  git push origin --force"
echo ""
echo "Make sure all collaborators are aware of this change, as they will need to"
echo "re-clone the repository or use 'git pull --rebase' to avoid conflicts." 