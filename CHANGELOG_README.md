# Changelog Management Guide

## Overview

The changelog is an automatically maintained file that documents all notable changes to the project. It follows the [Keep a Changelog](https://keepachangelog.com/) format and [Semantic Versioning](https://semver.org/) principles.

## Structure

```markdown
# Changelog

## [Unreleased]
All changes that haven't been released yet are stored here.

### Added
- New features and capabilities

### Changed
- Changes to existing functionality

### Fixed
- Bug fixes and error corrections

### Documentation
- Documentation updates and improvements

## [1.0.1] - YYYY-MM-DD
Previous version changes...

[Unreleased]: https://github.com/user/repo/compare/v1.0.1...HEAD
[1.0.1]: https://github.com/user/repo/releases/tag/v1.0.1
```

## Commit Message Format

The changelog is automatically updated based on your commit messages. Use these prefixes:

- `feat:` - Adds entry to "Added" section
  ```bash
  git commit -m "feat: add new login system"
  ```

- `fix:` - Adds entry to "Fixed" section
  ```bash
  git commit -m "fix: resolve memory leak in data processing"
  ```

- `refactor:` or `style:` - Adds entry to "Changed" section
  ```bash
  git commit -m "refactor: improve code structure"
  git commit -m "style: update UI components"
  ```

- `docs:` - Adds entry to "Documentation" section
  ```bash
  git commit -m "docs: update API documentation"
  ```

- Any other prefix defaults to "Changed" section
  ```bash
  git commit -m "chore: update dependencies"
  ```

## Version Management

### Version Bumping
To create a new version:

```bash
git commit -m "chore: bump version to X.Y.Z"
```

This will:
1. Create a new version section
2. Move all [Unreleased] changes to the new version
3. Update version links
4. Add the current date

### Version Numbers (Semantic Versioning)

- `MAJOR.MINOR.PATCH` (e.g., 1.0.1)
  - MAJOR: Breaking changes
  - MINOR: New features, backward compatible
  - PATCH: Bug fixes, backward compatible

## Entry Format

Each changelog entry includes:
```markdown
- [repository-name] Commit message [commit-hash] (date) by author
```

Example:
```markdown
- [tak-manager] Add new login system [a1b2c3d] (2024-02-08) by John Doe
```

## Repository Integration

The changelog system works across both main repository and submodules:

- Main Repository (`tak-manager`)
  - Changes are prefixed with `[tak-manager]`
  - Uses version from `version/version.txt`

- Wrapper Submodule (`tak-manager-wrapper`)
  - Changes are prefixed with `[tak-manager-wrapper]`
  - Integrates with main repository's changelog

## Managing the Changelog

### Viewing Changes
- Unreleased changes are always at the top
- Each version section shows changes since the last release
- Version comparison links at the bottom allow easy diff viewing

### Best Practices

1. **Commit Messages**
   - Use clear, descriptive messages
   - Always include the appropriate prefix
   - One change per commit

2. **Versioning**
   - Bump versions appropriately based on changes
   - Major version: Breaking changes
   - Minor version: New features
   - Patch version: Bug fixes

3. **Reviewing**
   - Review the changelog before releases
   - Ensure all significant changes are documented
   - Check that entries are in appropriate sections

### Common Tasks

1. **Adding a Feature**
   ```bash
   git commit -m "feat: add new feature description"
   ```

2. **Fixing a Bug**
   ```bash
   git commit -m "fix: resolve specific issue"
   ```

3. **Releasing a Version**
   ```bash
   # Update version.txt first
   git commit -m "chore: bump version to 1.0.2"
   ```

4. **Documentation Updates**
   ```bash
   git commit -m "docs: update documentation details"
   ```

## Troubleshooting

1. **Missing Entries**
   - Ensure commit message has correct prefix
   - Check if commit was amended properly

2. **Version Links**
   - Links are automatically updated on version bumps
   - Manual fix: Update links at bottom of CHANGELOG.md

3. **Multiple Entries**
   - Caused by multiple amends
   - Reset and recommit if necessary

## Additional Notes

- The changelog is automatically maintained by git hooks
- All changes are tracked in the [Unreleased] section until a version bump
- Each repository's changes are clearly marked
- Links at the bottom provide easy version comparison
- The system handles both repositories in a single changelog 