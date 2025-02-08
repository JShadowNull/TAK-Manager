// update-version.js
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { execSync } = require('child_process');

// Define paths
const rootDir = path.join(__dirname, '..');
const versionFilePath = path.join(__dirname, 'version.txt');
const paths = {
  root: path.join(rootDir, 'package.json'),
  client: path.join(rootDir, 'client/package.json'),
  wrapper: path.join(rootDir, 'tak-manager-wrapper/web/package.json'),
  dockerCompose: path.join(rootDir, 'docker-compose.prod.yml'),
  innoSetup: path.join(rootDir, 'tak-manager-wrapper/inno-tak.iss'),
};

// Read version from version.txt
const version = fs.readFileSync(versionFilePath, 'utf8').trim();

// Update package.json files
function updatePackageJson(filePath) {
  console.log(`Updating version in ${filePath}`);
  const packageJson = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const oldVersion = packageJson.version;
  packageJson.version = version;
  fs.writeFileSync(filePath, JSON.stringify(packageJson, null, 2) + '\n');
  return oldVersion !== version; // return true if version changed
}

// Update docker-compose.prod.yml
function updateDockerCompose(filePath) {
  console.log(`Updating version in ${filePath}`);
  const dockerCompose = yaml.load(fs.readFileSync(filePath, 'utf8'));
  const oldImage = dockerCompose.services.app.image;
  dockerCompose.services.app.image = `tak-manager:${version}`;
  fs.writeFileSync(filePath, yaml.dump(dockerCompose, { lineWidth: -1 }));
  return oldImage !== `tak-manager:${version}`; // return true if image changed
}

// Update inno-tak.iss version
function updateInnoSetup(filePath) {
  console.log(`Updating version in ${filePath}`);
  let content = fs.readFileSync(filePath, 'utf8');
  const oldContent = content;
  content = content.replace(/#define MyAppVersion ".*"/, `#define MyAppVersion "v${version}"`);
  fs.writeFileSync(filePath, content);
  return oldContent !== content; // return true if content changed
}

// Git operations
function gitCommitAndTag() {
  try {
    // Check if we're in a git repository
    execSync('git rev-parse --is-inside-work-tree', { stdio: 'ignore' });
    
    // Stage the changed files
    execSync('git add package.json client/package.json tak-manager-wrapper/web/package.json docker-compose.prod.yml tak-manager-wrapper/inno-tak.iss');
    
    // Create commit
    execSync(`git commit -m "chore: bump version to ${version}"`, { stdio: 'pipe' });
    
    // Create tag
    execSync(`git tag -a v${version} -m "Version ${version}"`, { stdio: 'pipe' });
    
    console.log(`Created git commit and tag for version ${version}`);
  } catch (error) {
    console.warn('Git operations failed:', error.message);
  }
}

try {
  let changes = false;
  
  // Update all files and track if any changes were made
  changes = updatePackageJson(paths.root) || changes;
  changes = updatePackageJson(paths.client) || changes;
  changes = updatePackageJson(paths.wrapper) || changes;
  changes = updateDockerCompose(paths.dockerCompose) || changes;
  changes = updateInnoSetup(paths.innoSetup) || changes;
  
  if (changes) {
    console.log(`Successfully updated files to version ${version}`);
    gitCommitAndTag();
  } else {
    console.log('No version changes needed - files already at correct version');
  }
} catch (error) {
  console.error('Error updating version:', error);
  process.exit(1);
}