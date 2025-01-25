// update-version.js
const fs = require('fs');
const path = require('path');

const packageJsonPath = path.join(__dirname, '../client/package.json');
const versionFilePath = path.join(__dirname, 'version.txt');

const version = fs.readFileSync(versionFilePath, 'utf8').trim();
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

packageJson.version = version;

fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
console.log(`Updated version to ${version}`);