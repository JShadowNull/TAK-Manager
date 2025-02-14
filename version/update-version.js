// update-version.js
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

// Define paths
const rootDir = path.join(__dirname, '..');
const paths = {
  root: path.join(rootDir, 'package.json'),
  client: path.join(rootDir, 'client/package.json'),
  wrapper: path.join(rootDir, 'tak-manager-wrapper/web/package.json'),
  dockerCompose: path.join(rootDir, 'docker-compose.prod.yml'),
  innoSetup: path.join(rootDir, 'tak-manager-wrapper/inno-tak.iss'),
  versionTxt: path.join(rootDir, 'tak-manager-wrapper/version.txt'), // Added path for version.txt
};

// Read version from root package.json
const rootPackage = JSON.parse(fs.readFileSync(paths.root, 'utf8'));
const version = rootPackage.version;

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

// Update version.txt
function updateVersionTxt(filePath) {
  console.log(`Updating version in ${filePath}`);
  const content = `v${version}\n`;
  fs.writeFileSync(filePath, content);
}

try {
  let changes = false;
  
  // Update all files and track if any changes were made
  changes = updatePackageJson(paths.root) || changes;
  changes = updatePackageJson(paths.client) || changes;
  changes = updatePackageJson(paths.wrapper) || changes;
  changes = updateDockerCompose(paths.dockerCompose) || changes;
  changes = updateInnoSetup(paths.innoSetup) || changes;
  changes = updateVersionTxt(paths.versionTxt) || changes; // Update version.txt
  
  if (changes) {
    console.log(`Successfully updated files to version ${version}`);
  } else {
    console.log('No version changes needed - files already at correct version');
  }
} catch (error) {
  console.error('Error updating version:', error);
  process.exit(1);
}