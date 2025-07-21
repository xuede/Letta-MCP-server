# Publishing to npm

This guide explains how to publish the letta-mcp-server package to npm.

## Prerequisites

1. **npm account**: Create an account at https://www.npmjs.com/
2. **Login to npm**: Run `npm login` and enter your credentials
3. **Two-factor authentication**: Enable 2FA on your npm account for security

## Pre-publish Checklist

Before publishing, ensure:

- [ ] All tests pass: `npm test`
- [ ] Code is linted: `npm run lint`
- [ ] Code is formatted: `npm run format:check`
- [ ] Coverage is adequate: `npm run test:coverage`
- [ ] README is up to date
- [ ] CHANGELOG is updated (if applicable)
- [ ] Version number is appropriate

## Publishing Process

### 1. First-time Setup

If this is your first time publishing this package:

```bash
# Verify you're logged in
npm whoami

# Check package contents that will be published
npm pack --dry-run

# Review the files that will be included
```

### 2. Version Update

Use npm version commands to update the version and create a git tag:

```bash
# For a patch release (1.1.0 -> 1.1.1)
npm version patch

# For a minor release (1.1.0 -> 1.2.0)
npm version minor

# For a major release (1.1.0 -> 2.0.0)
npm version major
```

This will:
- Update the version in package.json
- Run pre/post version scripts
- Create a git commit and tag
- Push to remote repository

### 3. Publish to npm

```bash
# Publish to npm registry
npm publish

# Or for a beta/pre-release
npm publish --tag beta
```

The `prepublishOnly` script will automatically run tests and checks before publishing.

### 4. Verify Publication

After publishing:

```bash
# Check the package on npm
npm view letta-mcp-server

# Test installation
npm install -g letta-mcp-server
letta-mcp --version
```

## Versioning Guidelines

Follow semantic versioning (semver):

- **MAJOR** (x.0.0): Breaking API changes
- **MINOR** (0.x.0): New features, backwards compatible
- **PATCH** (0.0.x): Bug fixes, backwards compatible

## Access Control

To add collaborators who can publish:

```bash
npm owner add <username> letta-mcp-server
```

## Troubleshooting

### Common Issues

1. **Authentication failed**: Run `npm login` again
2. **Version already exists**: Bump the version number
3. **Files missing**: Check .npmignore configuration
4. **Tests failing**: Fix tests before publishing

### Unpublishing

⚠️ Use with caution! Unpublishing can break dependencies.

```bash
# Unpublish a specific version (within 72 hours)
npm unpublish letta-mcp-server@1.1.0

# Deprecate instead of unpublishing
npm deprecate letta-mcp-server@1.1.0 "Critical bug, please upgrade"
```

## CI/CD Publishing

### Automated Publishing Setup

The repository includes GitHub Actions workflows for automated publishing:

1. **Main Release Workflow** (`.github/workflows/publish.yml`)
   - Triggers on GitHub release creation
   - Manual trigger with version selection (patch/minor/major)
   - Runs tests and quality checks before publishing
   - Creates GitHub release automatically

2. **Pre-release Workflow** (`.github/workflows/publish-prerelease.yml`)
   - Triggers on push to develop/beta/alpha branches
   - Publishes with appropriate npm tags (alpha, beta, rc)
   - Includes timestamp in version for uniqueness

### Setup Requirements

1. **Add npm token to GitHub Secrets**:
   - Generate token at: https://www.npmjs.com/settings/[username]/tokens
   - Use "Automation" token type
   - Add to repository secrets as `NPM_TOKEN`

2. **Optional Secrets**:
   - `LETTA_BASE_URL`: For running integration tests
   - `LETTA_PASSWORD`: For running integration tests

### Publishing via GitHub Actions

#### Regular Release
```bash
# Option 1: Manual trigger from Actions tab
# Go to Actions → Publish to npm → Run workflow
# Select version type (patch/minor/major)

# Option 2: Create a GitHub release
# Go to Releases → Create new release
# Tag version as v1.2.0 (workflow will publish)
```

#### Pre-release
```bash
# Automatic: Push to develop/beta/alpha branch
git push origin develop

# Manual: Run pre-release workflow
# Go to Actions → Publish Pre-release → Run workflow
# Select tag (alpha/beta/rc)
```

### Version Tags

- **Latest**: Default install (`npm install letta-mcp-server`)
- **Beta**: Beta testing (`npm install letta-mcp-server@beta`)
- **Alpha**: Early testing (`npm install letta-mcp-server@alpha`)
- **RC**: Release candidate (`npm install letta-mcp-server@rc`)

## Post-publish

After successful publication:

1. Create a GitHub release with release notes
2. Update documentation if needed
3. Announce in relevant channels
4. Monitor npm downloads and issues