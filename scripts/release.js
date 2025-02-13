const { execSync } = require('child_process');
const fs = require('fs');

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
        
        // Merge dev into main
        console.log('Merging dev into main...');
        exec('git merge dev --no-ff -m "chore: merge dev into main for release"');
        
        // Calculate new version
        const newVersion = bumpVersion(currentVersion, versionBump);
        console.log(`New version will be: ${newVersion}`);
        
        // Update version in package.json
        packageJson.version = newVersion;
        fs.writeFileSync('package.json', JSON.stringify(packageJson, null, 2) + '\n');
        
        // Update version in all files
        process.env.VERSION_BUMP = versionBump;
        process.env.NEW_VERSION = newVersion;
        runWithRetries('npm run update:version');
        
        // Generate changelog
        console.log('Generating changelog...');
        runWithRetries('npm run update:changelog');
        
        // Get the generated changelog for the new version
        const releaseNotes = execSync('git cliff --latest').toString();
        console.log('Release notes generated:', releaseNotes);
        
        // Stage and commit changes
        exec('git add package.json package-lock.json CHANGELOG.md');
        exec('git add client/package.json || true');
        exec('git add docker-compose.prod.yml || true');
        exec(`git commit -m "chore: release tak-manager@${newVersion} [skip ci]"`);
        
        // Delete existing tag if it exists
        try {
            exec(`git tag -d v${newVersion}`);
            exec(`git push origin :refs/tags/v${newVersion}`);
        } catch (error) {
            // Tag doesn't exist, that's fine
        }
        
        // Create new tag with release notes
        exec(`git tag -a v${newVersion} -m "TAK Manager v${newVersion}" -m "${releaseNotes}"`);
        
        // Push changes and tags to main
        exec('git push origin main');
        exec(`git push origin v${newVersion}`);
        
        // Create release in Gitea if token exists
        const giteaToken = process.env.GITEA_TOKEN;
        if (giteaToken) {
            const releaseData = {
                tag_name: `v${newVersion}`,
                name: `TAK Manager v${newVersion}`,
                body: releaseNotes,
                draft: false,
                prerelease: false
            };
            
            exec(`curl -X POST "https://gitea.local.ubuntuserver.buzz/api/v1/repos/Jake/Tak-Manager/releases" \
                -H "Authorization: token ${giteaToken}" \
                -H "Content-Type: application/json" \
                -d '${JSON.stringify(releaseData)}'`);
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