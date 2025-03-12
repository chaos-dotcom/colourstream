#!/bin/bash
#
# Script to run the template checker on the project
#

# Set working directory to the project root
cd "$(dirname "$0")/.." || exit 1

# Default values
VERBOSE=false
OUTPUT=""
DIR="."

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    -v|--verbose)
      VERBOSE=true
      shift
      ;;
    -o|--output)
      OUTPUT="$2"
      shift 2
      ;;
    -d|--dir)
      DIR="$2"
      shift 2
      ;;
    -h|--help)
      echo "Usage: check-templates.sh [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  -v, --verbose          Enable verbose output"
      echo "  -o, --output FILE      Save report to FILE (auto-saved to reports directory)"
      echo "  -d, --dir DIR          Specify directory to check (default: current directory)"
      echo "  -h, --help             Show this help message"
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      echo "Use --help for usage information"
      exit 1
      ;;
  esac
done

# Build the command
CMD="python3 scripts/template_checker/template_checker.py --dir \"$DIR\""

if [ "$VERBOSE" = true ]; then
  CMD="$CMD --verbose"
fi

if [ -n "$OUTPUT" ]; then
  CMD="$CMD --output \"$OUTPUT\""
fi

# Run the template checker
echo "Running template checker..."
eval "$CMD"