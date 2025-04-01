// update-version.js
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const readline = require('readline');

// Define paths
const rootDir = path.join(__dirname, '..');
const paths = {
  root: path.join(rootDir, 'package.json'),
  client: path.join(rootDir, 'client/package.json'),
  wrapper: path.join(rootDir, 'TAK-Wrapper/web/package.json'),
  dockerCompose: path.join(rootDir, 'docker-compose.yml'),
  takWrapperDockerCompose: path.join(rootDir, 'TAK-Wrapper/docker-compose.yml'),
  innoSetup: path.join(rootDir, 'TAK-Wrapper/inno-tak.iss'),
  versionTxt: path.join(rootDir, 'TAK-Wrapper/version.txt'),
  app: path.join(rootDir, 'TAK-Wrapper/app.py'),
  pyprojectToml: path.join(rootDir, 'pyproject.toml'),
  serverPyprojectToml: path.join(rootDir, 'server/pyproject.toml'),
};

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Prompt for version
function promptForVersion() {
  return new Promise((resolve) => {
    // Get current version from package.json for reference
    const rootPackage = JSON.parse(fs.readFileSync(paths.root, 'utf8'));
    const currentVersion = rootPackage.version;
    
    rl.question(`Enter new version (current: ${currentVersion}): `, (version) => {
      // Validate version format (x.y.z)
      const versionRegex = /^\d+\.\d+\.\d+$/;
      if (!versionRegex.test(version)) {
        console.log('Invalid version format. Please use format: x.y.z');
        rl.close();
        process.exit(1);
      }
      resolve(version);
      rl.close();
    });
  });
}

// Update package.json files
function updatePackageJson(filePath, version) {
  console.log(`Updating version in ${filePath}`);
  const packageJson = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const oldVersion = packageJson.version;
  packageJson.version = version;
  fs.writeFileSync(filePath, JSON.stringify(packageJson, null, 2) + '\n');
  return oldVersion !== version; // return true if version changed
}

// Update docker-compose.yml
function updateDockerCompose(filePath, version) {
  console.log(`Updating version in ${filePath}`);
  const dockerCompose = yaml.load(fs.readFileSync(filePath, 'utf8'));
  
  // Handle different docker-compose structures
  if (dockerCompose.services.app) {
    // Original structure with 'app' service
    const oldImage = dockerCompose.services.app.image;
    dockerCompose.services.app.image = `tak-manager:${version}`;
    fs.writeFileSync(filePath, yaml.dump(dockerCompose, { lineWidth: -1 }));
    return oldImage !== `tak-manager:${version}`;
  } else if (dockerCompose.services.prod) {
    // New structure with 'prod' service
    const oldImage = dockerCompose.services.prod.image;
    dockerCompose.services.prod.image = `tak-manager:${version}`;
    fs.writeFileSync(filePath, yaml.dump(dockerCompose, { lineWidth: -1 }));
    return oldImage !== `tak-manager:${version}`;
  } else {
    console.log(`Warning: Couldn't find app or prod service in ${filePath}`);
    return false;
  }
}

// Update inno-tak.iss version
function updateInnoSetup(filePath, version) {
  console.log(`Updating version in ${filePath}`);
  let content = fs.readFileSync(filePath, 'utf8');
  const oldContent = content;
  content = content.replace(/#define MyAppVersion ".*"/, `#define MyAppVersion "v${version}"`);
  fs.writeFileSync(filePath, content);
  return oldContent !== content; // return true if content changed
}

// Update version.txt
function updateVersionTxt(filePath, version) {
  console.log(`Updating version in ${filePath}`);
  const content = `v${version}\n`;
  fs.writeFileSync(filePath, content);
}

// Update app.py version
function updateAppVersion(filePath, version) {
  console.log(`Updating version in ${filePath}`);
  let content = fs.readFileSync(filePath, 'utf8');
  const oldContent = content;
  content = content.replace(/TAK Manager v\d+\.\d+\.\d+/, `TAK Manager v${version}`);
  fs.writeFileSync(filePath, content);
  return oldContent !== content; // return true if content changed
}

// Update pyproject.toml version
function updatePyprojectToml(filePath, version) {
  console.log(`Updating version in ${filePath}`);
  let content = fs.readFileSync(filePath, 'utf8');
  const oldContent = content;
  content = content.replace(/version = "[\d\.]+"/g, `version = "${version}"`);
  fs.writeFileSync(filePath, content);
  return oldContent !== content; // return true if content changed
}

// Main function
async function main() {
  try {
    // Prompt for version
    const version = await promptForVersion();
    console.log(`Updating all files to version ${version}...`);
    
    let changes = false;
    
    // Update all files and track if any changes were made
    changes = updatePackageJson(paths.root, version) || changes;
    changes = updatePackageJson(paths.client, version) || changes;
    changes = updatePackageJson(paths.wrapper, version) || changes;
    changes = updateDockerCompose(paths.dockerCompose, version) || changes;
    changes = updateDockerCompose(paths.takWrapperDockerCompose, version) || changes;
    changes = updateInnoSetup(paths.innoSetup, version) || changes;
    changes = updateVersionTxt(paths.versionTxt, version) || changes;
    changes = updateAppVersion(paths.app, version) || changes;
    changes = updatePyprojectToml(paths.pyprojectToml, version) || changes;
    changes = updatePyprojectToml(paths.serverPyprojectToml, version) || changes;
    
    if (changes) {
      console.log(`Successfully updated files to version ${version}`);
    } else {
      console.log('No version changes needed - files already at correct version');
    }
  } catch (error) {
    console.error('Error updating version:', error);
    process.exit(1);
  }
}

// Run the main function
main();