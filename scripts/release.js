const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Load environment variables from .env file
function loadEnv() {
    const envPath = path.join(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
        const envConfig = require('dotenv').config();
        if (envConfig.error) {
            console.warn('Error loading .env file:', envConfig.error);
        }
    } else {
        console.warn('.env file not found. Make sure to create one from .env.example');
    }
    
    // Verify Gitea token is set
    if (!process.env.GITEA_TOKEN) {
        console.warn('GITEA_TOKEN not found in environment variables.');
        console.warn('Please set it in your .env file or as an environment variable.');
        console.warn('You can create a token in Gitea: Settings > Applications > Generate New Token');
    }
}

function exec(command) {
    try {
        return execSync(command, { stdio: 'inherit' });
    } catch (error) {
        console.error(`Failed to execute: ${command}`);
        throw error;
    }
}

function bumpVersion(version, type) {
    const [major, minor, patch] = version.split('.').map(Number);
    switch (type) {
        case 'major':
            return `${major + 1}.0.0`;
        case 'minor':
            return `${major}.${minor + 1}.0`;
        case 'patch':
            return `${major}.${minor}.${patch + 1}`;
        case 'prerelease':
            return `${major}.${minor}.${patch}-beta.1`;
        default:
            return version;
    }
}

function determineVersionBumpFromMessages(commitMessages) {
    console.log('Analyzing commits:', commitMessages);
    
    if (commitMessages.includes('BREAKING CHANGE')) return 'major';
    if (commitMessages.includes('feat:')) return 'minor';
    if (commitMessages.includes('fix:')) return 'patch';
    if (commitMessages.includes('beta')) return 'prerelease';
    return 'patch'; // Default to patch if no conventional commits found
}

function runWithRetries(command, maxAttempts = 3) {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            console.log(`Attempt ${attempt}/${maxAttempts}: ${command}`);
            exec(command);
            return;
        } catch (error) {
            if (attempt === maxAttempts) throw error;
            console.log(`Attempt ${attempt} failed, retrying in 3 seconds...`);
            execSync('sleep 3');
        }
    }
}

async function release() {
    try {
        // Load environment variables first
        loadEnv();
        
        // Switch to main and update
        console.log('Switching to main branch...');
        exec('git checkout main');
        exec('git pull origin main');
        
        // Get current version from package.json
        const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
        const currentVersion = packageJson.version;
        console.log(`Current version: ${currentVersion}`);
        
        // Capture commits from dev before merge
        console.log('Analyzing commits from dev branch...');
        const commitMessages = execSync('git log main..dev --pretty=format:"%B"').toString();
        console.log('Commits to be included:', commitMessages);
        
        // Determine version bump based on captured commits
        const versionBump = determineVersionBumpFromMessages(commitMessages);
        console.log(`Version bump type: ${versionBump}`);
        
        // Calculate new version before merge
        const newVersion = bumpVersion(currentVersion, versionBump);
        console.log(`New version will be: ${newVersion}`);
        
        // Store the current dev commit hash for changelog generation
        const devCommit = execSync('git rev-parse dev').toString().trim();
        
        // Merge dev into main
        console.log('Merging dev into main...');
        exec('git merge dev --no-ff -m "chore: merge dev into main for release"');
        
        // Update version in package.json
        packageJson.version = newVersion;
        fs.writeFileSync('package.json', JSON.stringify(packageJson, null, 2) + '\n');
        
        // Update version in all files
        process.env.VERSION_BUMP = versionBump;
        process.env.NEW_VERSION = newVersion;
        runWithRetries('npm run update:version');
        
        // Stage version changes
        exec('git add package.json package-lock.json');
        exec('git add client/package.json || true');
        exec('git add docker-compose.prod.yml || true');
        exec(`git commit -m "chore: release tak-manager@${newVersion} [skip ci]"`);
        
        // Generate changelog and release notes
        console.log('Generating changelog...');
        const lastTag = execSync('git describe --tags --abbrev=0').toString().trim();
        
        // Generate the formatted changelog entry
        const currentDate = new Date().toISOString().split('T')[0];
        const changelogCmd = `git cliff --config cliff.toml --tag "v${newVersion}" --unreleased --strip all`;
        const releaseNotes = execSync(changelogCmd).toString().trim();
        
        // Create the formatted entry with version header
        const formattedEntry = `## [${newVersion}] - ${currentDate}\n\n${releaseNotes}`;
        
        // Update CHANGELOG.md
        const changelogPath = path.join(process.cwd(), 'CHANGELOG.md');
        let changelog = fs.readFileSync(changelogPath, 'utf8');
        const versionHeader = '## [';
        const insertIndex = changelog.indexOf(versionHeader);
        changelog = changelog.slice(0, insertIndex) + formattedEntry + '\n\n' + changelog.slice(insertIndex);
        fs.writeFileSync(changelogPath, changelog);
        
        // Stage and commit changelog
        exec('git add CHANGELOG.md');
        exec(`git commit --amend --no-edit`);
        
        // Delete existing tag if it exists
        try {
            exec(`git tag -d v${newVersion}`);
            exec(`git push origin :refs/tags/v${newVersion}`);
        } catch (error) {
            // Tag doesn't exist, that's fine
        }
        
        // Create new tag with formatted release notes
        exec(`git tag -a v${newVersion} -m "TAK Manager v${newVersion}" -m "${formattedEntry}"`);
        
        // Push changes and tags to main
        exec('git push origin main');
        exec(`git push origin v${newVersion}`);
        
        // Create release in Gitea if token exists
        const giteaToken = process.env.GITEA_TOKEN;
        if (giteaToken) {
            // Use the same formatted content we generated for the changelog
            // This ensures consistency between changelog and release notes
            const releaseData = {
                tag_name: `v${newVersion}`,
                name: `TAK Manager v${newVersion}`,
                body: releaseNotes,  // Use the raw release notes without the version header
                draft: false,
                prerelease: false
            };
            
            // Use a temporary file to ensure proper JSON escaping
            const tempFile = path.join(process.cwd(), 'temp-release-data.json');
            fs.writeFileSync(tempFile, JSON.stringify(releaseData, null, 2));
            
            try {
                // Use curl with the file to preserve formatting
                exec(`curl -X POST "https://gitea.local.ubuntuserver.buzz/api/v1/repos/Jake/Tak-Manager/releases" \
                    -H "Authorization: token ${giteaToken}" \
                    -H "Content-Type: application/json" \
                    -d @${tempFile}`);
            } finally {
                // Clean up temp file
                if (fs.existsSync(tempFile)) {
                    fs.unlinkSync(tempFile);
                }
            }
        } else {
            console.warn('GITEA_TOKEN not set, skipping release creation');
        }
        
        // Sync changes back to dev branch
        console.log('Syncing changes back to dev branch...');
        exec('git checkout dev');
        exec('git merge main');
        exec('git push origin dev');
        
        console.log('Release completed successfully!');
        console.log(`Version bumped from ${currentVersion} to ${newVersion}`);
        
    } catch (error) {
        console.error('Release failed:', error);
        process.exit(1);
    }
}

release().catch(console.error); 