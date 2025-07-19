# Security Policy

## Supported Versions

We release patches for security vulnerabilities. Which versions are eligible for receiving such patches depends on the CVSS v3.0 Rating:

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

We take the security of our software seriously. If you believe you have found a security vulnerability in our repository, please report it to us as described below.

**Please do not report security vulnerabilities through public GitHub issues.**

### How to Report a Security Vulnerability

Please report security vulnerabilities by emailing the lead maintainers at:
- security@oculair.ca

You should receive a response within 48 hours. If for some reason you do not, please follow up via email to ensure we received your original message.

### What to Include in Your Report

Please include the requested information listed below (as much as you can provide) to help us better understand the nature and scope of the possible issue:

- Type of issue (e.g., buffer overflow, SQL injection, cross-site scripting, etc.)
- Full paths of source file(s) related to the manifestation of the issue
- The location of the affected source code (tag/branch/commit or direct URL)
- Any special configuration required to reproduce the issue
- Step-by-step instructions to reproduce the issue
- Proof-of-concept or exploit code (if possible)
- Impact of the issue, including how an attacker might exploit the issue

This information will help us triage your report more quickly.

### Preferred Languages

We prefer all communications to be in English.

## Disclosure Policy

When we receive a security bug report, we will:

1. Confirm the problem and determine the affected versions
2. Audit code to find any potential similar problems
3. Prepare fixes for all releases still under maintenance
4. Release new versions of all affected packages as soon as possible

## Security Configuration

### Environment Variables

This application uses several environment variables that must be kept secure:

- `LETTA_BASE_URL`: The base URL for the Letta API
- `LETTA_PASSWORD`: Authentication credential for Letta API
- `XBACKBONE_URL`: Optional URL for XBackbone integration
- `XBACKBONE_TOKEN`: Optional authentication token for XBackbone

**Never commit these values to version control.** Always use environment variables or secure secret management systems.

### Best Practices

1. **API Credentials**: Never hardcode API credentials in source code
2. **Environment Files**: Add `.env` files to `.gitignore`
3. **Access Control**: Limit access to production environment variables
4. **Audit Logging**: Monitor API access and authentication attempts
5. **Dependencies**: Keep all dependencies up to date using Dependabot
6. **Code Scanning**: We use CodeQL for automated security scanning

### Security Features

This project includes several security measures:

- Automated dependency updates via Dependabot
- CodeQL security scanning on all PRs and commits
- Docker image vulnerability scanning with Trivy
- Input validation using Zod schemas
- Structured logging without sensitive data exposure
- Secure defaults for all optional security parameters

## Security Advisories

Security advisories will be published through GitHub's Security Advisory feature. Users can subscribe to notifications to stay informed about security updates.

## Responsible Disclosure

We kindly ask security researchers to practice responsible disclosure and allow us reasonable time to address vulnerabilities before public disclosure. We commit to:

- Responding promptly to security reports
- Keeping reporters informed about remediation progress
- Crediting researchers who report valid security issues (unless they prefer to remain anonymous)
- Not pursuing legal action against researchers who follow responsible disclosure