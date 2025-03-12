# Template Checker

This tool checks template files against their parent files to identify missing content. It's useful for ensuring that template files are kept in sync with their actual implementations.

## Usage

```bash
# Basic usage
python template_checker.py

# With verbosity
python template_checker.py --verbose

# Save the report to a file
python template_checker.py --output report.md

# Specify a different directory to check
python template_checker.py --dir /path/to/project

# Exclude specific patterns
python template_checker.py --exclude "pattern1" --exclude "pattern2"
```

## Features

- Finds all template files in a project (e.g., `.env.template`, `docker-compose.template.yml`)
- Matches them with their parent files
- Identifies content in the parent files that's missing from the templates
- Normalizes values and secrets for better structural comparison
- Generates detailed reports

## Report Format

The report shows lines that are present in the parent files but missing from the template files. This helps identify configuration settings that should be added to the templates.

## Example

```bash
# Run the check and save the report
python template_checker.py --verbose --output template_report.md
``` 