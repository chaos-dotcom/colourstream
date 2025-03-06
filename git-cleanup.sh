#!/bin/bash

# Script to remove files from git history that should have been ignored
# Uses git-filter-repo to cleanly rewrite history

echo "This script will remove unwanted files from your git history."
echo "Make sure you have a backup of your repository before proceeding."
echo "This operation is IRREVERSIBLE and will rewrite your git history."
echo ""
echo "Press Ctrl+C to cancel or Enter to continue..."
read

# Check if git-filter-repo is installed
if ! command -v git-filter-repo &> /dev/null; then
    echo "git-filter-repo is not installed. Installing it now..."
    pip install git-filter-repo
    
    # Check if installation was successful
    if ! command -v git-filter-repo &> /dev/null; then
        echo "Failed to install git-filter-repo. Please install it manually:"
        echo "pip install git-filter-repo"
        exit 1
    fi
fi

# Create a temporary file for the paths to remove
TEMP_FILE=$(mktemp)

# List of patterns from .gitignore files
# Add all the patterns from both root and frontend .gitignore
cat << 'EOF' > $TEMP_FILE
db-data/
data/
node_modules/
ssl/
global.env
backend/.env
frontend/.env
mirotalk/.env
ovenmediaengine/.env
certs/
certs/certs/
certs/private/
certs/acme.json
certs/chain.pem
certs/fullchain.pem
certs/privkey.pem
mirotalk_backup/
docker-compose.test.yml
traefik/certs/
traefik/certs/private/
traefik/certs/certs/
traefik/acme.json
traefik/acme.json.backup
traefik/certs/chain.pem
traefik/certs/fullchain.pem
traefik/certs/privkey.pem
traefik/certs/letsencrypt.key
traefik/certs/letsencrypt.key.pem
traefik/certs/letsencrypt.key.pem.enc
traefik/ome/
docker-compose.yml
frontend/node_modules/
frontend/.pnp
frontend/.pnp.js
frontend/coverage/
frontend/build/
.DS_Store
frontend/.DS_Store
frontend/.env.local
frontend/.env.development.local
frontend/.env.test.local
frontend/.env.production.local
frontend/npm-debug.log*
frontend/yarn-debug.log*
frontend/yarn-error.log*
backend/logs/
package-lock.json
EOF

# Back up the sensitive files before filtering
echo "Backing up files that will be removed from git history..."
mkdir -p .git-filtered-backup

# Read each line from the temp file
while IFS= read -r pattern; do
    # Skip empty lines and comments
    [[ -z "$pattern" || "$pattern" =~ ^# ]] && continue
    
    # Remove trailing slash for directory patterns
    pattern=${pattern%/}
    
    # Find all files matching the pattern
    if [[ -d "$pattern" ]]; then
        # It's a directory
        find "$pattern" -type f 2>/dev/null | while read -r file; do
            if [[ -f "$file" ]]; then
                dir=$(dirname ".git-filtered-backup/$file")
                mkdir -p "$dir"
                cp "$file" ".git-filtered-backup/$file" 2>/dev/null
            fi
        done
    elif [[ -f "$pattern" ]]; then
        # It's a file
        dir=$(dirname ".git-filtered-backup/$pattern")
        mkdir -p "$dir"
        cp "$pattern" ".git-filtered-backup/$pattern" 2>/dev/null
    fi
done < "$TEMP_FILE"

# Create filter rules for git-filter-repo
echo "Creating filter rules for git-filter-repo..."
FILTER_FILE=$(mktemp)

# Convert gitignore patterns to git-filter-repo path regex format
while IFS= read -r pattern; do
    # Skip empty lines and comments
    [[ -z "$pattern" || "$pattern" =~ ^# ]] && continue
    
    # Remove trailing slash for directory patterns
    clean_pattern=${pattern%/}
    
    # Escape special characters for regex
    escaped_pattern=$(echo "$clean_pattern" | sed 's/\./\\./g' | sed 's/\*/[^\/]*/g')
    
    # Add the pattern to the filter file
    echo "regex:$escaped_pattern" >> $FILTER_FILE
done < "$TEMP_FILE"

# Run git-filter-repo to remove the files from history
echo "Removing files from git history using git-filter-repo..."
git filter-repo --paths-from-file $FILTER_FILE --invert-paths --force

# Restore the backed up files
echo "Restoring files to the filesystem..."
if [ -d ".git-filtered-backup" ]; then
    find .git-filtered-backup -type f | while read -r file; do
        target_file="${file#.git-filtered-backup/}"
        target_dir=$(dirname "$target_file")
        mkdir -p "$target_dir"
        cp "$file" "$target_file"
    done
fi

# Cleanup
rm $TEMP_FILE
rm $FILTER_FILE

echo ""
echo "Cleaning complete. The unwanted files have been removed from git history"
echo "but remain on your filesystem."
echo ""
echo "IMPORTANT: This operation has rewritten your git history. If you have already"
echo "pushed this repository to a remote, you will need to force push:"
echo ""
echo "  git push origin --force"
echo ""
echo "Make sure all collaborators are aware of this change, as they will need to"
echo "re-clone the repository or use 'git pull --rebase' to avoid conflicts." 