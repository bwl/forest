# Branching Strategy

Forest uses a minimal **master + next** branching strategy.

## Branches

### `master`
- **Purpose:** Stable production releases
- **Protected:** Yes (recommended)
- **Commits:** Only via merge from `next`
- **Tags:** All version tags (v0.1.0, v0.2.0, etc.)

### `next`
- **Purpose:** Integration and pre-release testing
- **Protected:** Yes (recommended)
- **Commits:** Feature branches merge here
- **Stability:** Should be functional but may have rough edges

### Feature Branches
- **Naming:** `feature/description`, `fix/description`, `refactor/description`
- **Created from:** `next`
- **Merged to:** `next`
- **Lifecycle:** Delete after merge

## Workflow

### Daily Development

1. **Start new work:**
   ```bash
   git checkout next
   git pull origin next
   git checkout -b feature/your-feature-name
   ```

2. **Make changes, commit:**
   ```bash
   git add .
   git commit -m "Description of changes"
   ```

3. **Merge to next:**
   ```bash
   git checkout next
   git pull origin next
   git merge feature/your-feature-name
   git push origin next
   git branch -d feature/your-feature-name
   ```

### Release Process

1. **Ensure next is stable:**
   ```bash
   git checkout next
   # Run tests, verify everything works
   npm run build
   npm run lint
   ```

2. **Merge next to master:**
   ```bash
   git checkout master
   git merge next
   ```

3. **Bump version:**
   ```bash
   # Update package.json and src/cli/commands/version.ts
   npm run build
   git add package.json src/cli/commands/version.ts
   git commit -m "Bump version to X.Y.Z"
   ```

4. **Tag release:**
   ```bash
   git tag -a vX.Y.Z -m "Release vX.Y.Z

   - Feature 1
   - Feature 2
   - Fix 3"
   ```

5. **Push everything:**
   ```bash
   git push origin master --tags
   git checkout next
   git merge master  # Keep next in sync
   git push origin next
   ```

## Quick Reference

| Action | Command |
|--------|---------|
| Start feature | `git checkout -b feature/name next` |
| Merge feature | `git checkout next && git merge feature/name` |
| Release | `git checkout master && git merge next` |
| Tag release | `git tag -a vX.Y.Z -m "..."` |

## Branch Protection (Recommended)

If using GitHub/GitLab, protect these branches:

- **master:** Require pull request reviews, require status checks
- **next:** Require status checks (optional: require reviews)

## Examples

### Adding a new feature:
```bash
git checkout next
git pull origin next
git checkout -b feature/add-search-filters
# ... work on feature ...
git commit -m "Add advanced search filters"
git checkout next
git merge feature/add-search-filters
git push origin next
git branch -d feature/add-search-filters
```

### Releasing version 0.3.0:
```bash
git checkout next
# ... verify next is stable ...
git checkout master
git merge next
# Update version files
npm run build
git add package.json src/cli/commands/version.ts
git commit -m "Bump version to 0.3.0"
git tag -a v0.3.0 -m "Release v0.3.0"
git push origin master --tags
git checkout next
git merge master
git push origin next
```
