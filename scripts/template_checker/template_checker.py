#!/usr/bin/env python3
"""
Template Checker Script

This script finds template files in the project and compares them with their parent files,
focusing on structural differences while ignoring value/secret changes.

Usage:
    python template_checker.py [--dir DIR] [--verbose]

Options:
    --dir DIR     Directory to search for template files (default: current directory)
    --verbose     Display more detailed output

Example:
    python template_checker.py --dir /path/to/project --verbose
"""

import os
import re
import sys
import argparse
import difflib
import fnmatch
import datetime
from typing import List, Dict, Tuple, Set, Optional

# Define patterns for template files
TEMPLATE_PATTERNS = [
    "*.template.*",
    "*.template",
    "*.env.template",
    "*/*.template.*",
    "*/*.template",
    "*/*.env.template",
]

# Define patterns to exclude from template search
EXCLUDE_PATTERNS = [
    "**/config.template.js",
    "**/mirotalk/app/src/config.template.js",
    "**/mirotalk_backup/app/src/config.template.js",
    "**/.git*/**",  # Ignore files in git directories
]

# Define patterns for values/secrets to ignore
IGNORE_PATTERNS = [
    # Environment variables
    r'^([A-Z0-9_]+)=.*$',
    # API keys and secrets
    r'.*_SECRET=.*$',
    r'.*_KEY=.*$',
    r'.*_TOKEN=.*$',
    r'.*_PASSWORD=.*$',
    # Common configuration values
    r'^\s*"?[a-zA-Z0-9_]+"?\s*:\s*"[^"]*"',
    r'^\s*"?[a-zA-Z0-9_]+"?\s*:\s*\d+',
    # Docker Compose specific values
    r'^\s*-\s*"[^"]*=[^"]*"$',
]

# Default reports directory
REPORTS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'reports')

class TemplateChecker:
    def __init__(self, base_dir: str, verbose: bool = False):
        self.base_dir = os.path.abspath(base_dir)
        self.verbose = verbose
        self.template_files = []
        self.parent_files = {}  # Map of template file to parent file
        self.differences = {}   # Map of template file to missing lines
        
    def is_excluded_file(self, file_path: str) -> bool:
        """Check if a file should be excluded based on the exclude patterns."""
        for pattern in EXCLUDE_PATTERNS:
            if fnmatch.fnmatch(file_path, pattern):
                return True
        return False
        
    def find_template_files(self) -> List[str]:
        """Find all template files in the project."""
        template_files = []
        
        print(f"Searching for template files in {self.base_dir}...")
        
        for root, _, files in os.walk(self.base_dir):
            for pattern in TEMPLATE_PATTERNS:
                for filename in fnmatch.filter(files, pattern):
                    template_path = os.path.join(root, filename)
                    rel_path = os.path.relpath(template_path, self.base_dir)
                    
                    # Skip excluded files
                    if self.is_excluded_file(rel_path):
                        if self.verbose:
                            print(f"Excluding file: {rel_path}")
                        continue
                        
                    template_files.append(rel_path)
                    if self.verbose:
                        print(f"Found template file: {rel_path}")
        
        self.template_files = template_files
        return template_files
    
    def find_parent_files(self) -> Dict[str, str]:
        """Match template files with their parent files."""
        parent_files = {}
        
        print("\nMatching template files with parent files...")
        
        for template_file in self.template_files:
            # Try different patterns to match parent files
            parent_file = None
            
            # Pattern 1: file.template.ext -> file.ext
            match = re.match(r'^(.+)\.template(\..+)$', template_file)
            if match:
                potential_parent = f"{match.group(1)}{match.group(2)}"
                if os.path.exists(os.path.join(self.base_dir, potential_parent)):
                    parent_file = potential_parent
            
            # Pattern 2: file.template -> file
            if not parent_file:
                match = re.match(r'^(.+)\.template$', template_file)
                if match:
                    potential_parent = match.group(1)
                    if os.path.exists(os.path.join(self.base_dir, potential_parent)):
                        parent_file = potential_parent
            
            # Pattern 3: file.env.template -> file.env
            if not parent_file:
                match = re.match(r'^(.+)\.env\.template$', template_file)
                if match:
                    potential_parent = f"{match.group(1)}.env"
                    if os.path.exists(os.path.join(self.base_dir, potential_parent)):
                        parent_file = potential_parent
            
            if parent_file:
                # Check if parent_file is a file, not a directory
                parent_path = os.path.join(self.base_dir, parent_file)
                if os.path.isfile(parent_path):
                    parent_files[template_file] = parent_file
                    print(f"Matched: {template_file} -> {parent_file}")
                else:
                    print(f"WARNING: Parent path '{parent_file}' is not a file.")
            else:
                print(f"WARNING: No parent file found for {template_file}")
        
        self.parent_files = parent_files
        return parent_files
    
    def is_value_line(self, line: str) -> bool:
        """Check if a line contains a value/secret that should be ignored."""
        for pattern in IGNORE_PATTERNS:
            if re.match(pattern, line):
                return True
        return False
    
    def normalize_line(self, line: str) -> str:
        """Normalize a line by replacing values with placeholders."""
        # Strip whitespace
        line = line.strip()
        
        # Replace environment variable values
        line = re.sub(r'^([A-Z0-9_]+)=.*$', r'\1=<VALUE>', line)
        
        # Replace secrets and keys
        line = re.sub(r'^(.*_SECRET=).*$', r'\1<SECRET>', line)
        line = re.sub(r'^(.*_KEY=).*$', r'\1<KEY>', line)
        line = re.sub(r'^(.*_TOKEN=).*$', r'\1<TOKEN>', line)
        line = re.sub(r'^(.*_PASSWORD=).*$', r'\1<PASSWORD>', line)
        
        # Replace JSON/YAML values
        line = re.sub(r'(^\s*"?[a-zA-Z0-9_]+"?\s*:\s*)"[^"]*"', r'\1"<VALUE>"', line)
        line = re.sub(r'(^\s*"?[a-zA-Z0-9_]+"?\s*:\s*)\d+', r'\1<NUMBER>', line)
        
        # Replace Docker Compose values
        line = re.sub(r'(^\s*-\s*"[^"]*=)[^"]*"$', r'\1<VALUE>"', line)
        
        return line
    
    def find_missing_lines(self, template_file: str, parent_file: str) -> List[str]:
        """Find lines that are in the parent file but missing from the template file."""
        template_path = os.path.join(self.base_dir, template_file)
        parent_path = os.path.join(self.base_dir, parent_file)
        
        # Additional check to make sure both paths are files
        if not os.path.isfile(template_path):
            print(f"ERROR: Template path '{template_path}' is not a file.")
            return []
        
        if not os.path.isfile(parent_path):
            print(f"ERROR: Parent path '{parent_path}' is not a file.")
            return []
        
        try:
            with open(template_path, 'r', encoding='utf-8', errors='replace') as f:
                template_lines = f.readlines()
            
            with open(parent_path, 'r', encoding='utf-8', errors='replace') as f:
                parent_lines = f.readlines()
            
            # Normalize lines to focus on structure
            normalized_template_lines = []
            normalized_parent_lines = []
            
            for line in template_lines:
                if line.strip() and not line.strip().startswith('#'):
                    normalized_template_lines.append(self.normalize_line(line))
            
            for line in parent_lines:
                if line.strip() and not line.strip().startswith('#'):
                    normalized_parent_lines.append(self.normalize_line(line))
            
            # Find lines in parent that are not in template
            missing_lines = []
            
            # Create sets of normalized lines for comparison
            template_line_set = set(normalized_template_lines)
            
            for i, line in enumerate(normalized_parent_lines):
                if line not in template_line_set:
                    # Get original non-normalized line
                    if i < len(parent_lines):
                        original_line = parent_lines[i].rstrip()
                        missing_lines.append(original_line)
            
            return missing_lines
        except Exception as e:
            print(f"ERROR: Failed to compare '{template_file}' and '{parent_file}': {str(e)}")
            return []
    
    def analyze_all_files(self) -> Dict[str, List[str]]:
        """Analyze all template files to find missing lines."""
        missing_lines = {}
        
        print("\nComparing template files with parent files...")
        
        for template_file, parent_file in self.parent_files.items():
            print(f"Comparing: {template_file} <-> {parent_file}")
            lines = self.find_missing_lines(template_file, parent_file)
            
            if lines:
                missing_lines[template_file] = lines
                if self.verbose:
                    print(f"  Found {len(lines)} missing lines")
                    for line in lines[:5]:
                        print(f"  - {line}")
                    if len(lines) > 5:
                        print(f"  ... and {len(lines) - 5} more")
            else:
                print("  No missing lines found")
        
        self.differences = missing_lines
        return missing_lines
    
    def generate_report(self) -> str:
        """Generate a report of the missing lines in template files."""
        timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        report_lines = []
        report_lines.append("# Template File Missing Content Report")
        report_lines.append("")
        report_lines.append(f"Generated: {timestamp}")
        report_lines.append("")
        report_lines.append(f"Base directory: {self.base_dir}")
        report_lines.append(f"Template files found: {len(self.template_files)}")
        report_lines.append(f"Parent files matched: {len(self.parent_files)}")
        report_lines.append(f"Files with missing content: {len(self.differences)}")
        report_lines.append("")
        
        if not self.differences:
            report_lines.append("## Summary")
            report_lines.append("")
            report_lines.append("No missing content found in template files compared to their parent files.")
            return "\n".join(report_lines)
        
        report_lines.append("## Missing Content")
        report_lines.append("")
        
        for template_file, missing_lines in self.differences.items():
            parent_file = self.parent_files[template_file]
            report_lines.append(f"### {template_file}")
            report_lines.append(f"*Compared to: {parent_file}*")
            report_lines.append("")
            
            if not missing_lines:
                report_lines.append("No missing content found.")
            else:
                report_lines.append("Missing lines that should be added to the template:")
                report_lines.append("```")
                for line in missing_lines:
                    report_lines.append(line)
                report_lines.append("```")
            
            report_lines.append("")
        
        return "\n".join(report_lines)
    
    def run(self) -> str:
        """Run the template checker and return a report."""
        self.find_template_files()
        self.find_parent_files()
        self.analyze_all_files()
        return self.generate_report()


def main():
    parser = argparse.ArgumentParser(description='Check template files against their parent files')
    parser.add_argument('--dir', default='.', help='Directory to search for template files')
    parser.add_argument('--verbose', action='store_true', help='Display more detailed output')
    parser.add_argument('--output', help='Output file for the report (default: stdout)')
    parser.add_argument('--exclude', action='append', help='Additional patterns to exclude (can be used multiple times)')
    args = parser.parse_args()
    
    # Add any additional exclude patterns from command line
    if args.exclude:
        for pattern in args.exclude:
            EXCLUDE_PATTERNS.append(pattern)
    
    checker = TemplateChecker(args.dir, args.verbose)
    report = checker.run()
    
    if args.output:
        # If no directory is specified in the output path, use the reports directory
        output_path = args.output
        if not os.path.dirname(output_path):
            # Ensure reports directory exists
            os.makedirs(REPORTS_DIR, exist_ok=True)
            
            # Add timestamp to filename if not provided
            base_name, ext = os.path.splitext(output_path)
            if not ext:
                ext = '.md'
            
            timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
            if '_' not in base_name and timestamp not in base_name:
                output_path = f"{base_name}_{timestamp}{ext}"
            
            output_path = os.path.join(REPORTS_DIR, output_path)
        
        # Create parent directory if it doesn't exist
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(report)
        print(f"\nReport saved to {output_path}")
    else:
        print("\n" + report)


if __name__ == '__main__':
    main() 