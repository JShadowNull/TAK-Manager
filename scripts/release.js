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
        
        // Update and get submodule commits first
        console.log('Checking submodule changes...');
        exec('git submodule update --init --recursive');
        exec('cd tak-manager-wrapper && git checkout main || git checkout master');
        exec('cd tak-manager-wrapper && git pull origin main || git pull origin master');
        
        // Get current version from package.json
        const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
        const currentVersion = packageJson.version;
        console.log(`Current version: ${currentVersion}`);
        
        // Capture commits from both repositories
        console.log('Analyzing commits from both repositories...');
        const mainCommitMessages = execSync('git log main..dev --pretty=format:"%B"').toString();
        let wrapperCommitMessages = '';
        try {
            // Get the last tag in wrapper repository
            const lastWrapperTag = execSync('cd tak-manager-wrapper && git describe --tags --abbrev=0 || echo "none"').toString().trim();
            if (lastWrapperTag !== 'none') {
                wrapperCommitMessages = execSync(`cd tak-manager-wrapper && git log ${lastWrapperTag}..HEAD --pretty=format:"%B"`).toString();
            } else {
                wrapperCommitMessages = execSync('cd tak-manager-wrapper && git log --pretty=format:"%B"').toString();
            }
        } catch (error) {
            console.log('No previous tags in wrapper repository');
            wrapperCommitMessages = execSync('cd tak-manager-wrapper && git log --pretty=format:"%B"').toString();
        }
        
        console.log('Main commits to be included:', mainCommitMessages);
        console.log('Wrapper commits to be included:', wrapperCommitMessages);
        
        // Determine version bump based on captured commits from both repositories
        const mainVersionBump = determineVersionBumpFromMessages(mainCommitMessages);
        const wrapperVersionBump = determineVersionBumpFromMessages(wrapperCommitMessages);
        
        // Use the more significant version bump
        const versionBumpPriority = { major: 3, minor: 2, patch: 1, prerelease: 0 };
        const versionBump = versionBumpPriority[mainVersionBump] >= versionBumpPriority[wrapperVersionBump] 
            ? mainVersionBump 
            : wrapperVersionBump;
            
        console.log(`Version bump type (main): ${mainVersionBump}`);
        console.log(`Version bump type (wrapper): ${wrapperVersionBump}`);
        console.log(`Final version bump type: ${versionBump}`);
        
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
        
        // Delete existing tags if they exist
        try {
            // Main repository
            exec(`git tag -d v${newVersion} || true`);
            exec(`git push origin :refs/tags/v${newVersion} || true`);
            
            // Wrapper repository
            exec(`cd tak-manager-wrapper && git tag -d v${newVersion} || true`);
            exec(`cd tak-manager-wrapper && git push origin :refs/tags/v${newVersion} || true`);
        } catch (error) {
            // Tags don't exist, that's fine
            console.log('No existing tags to delete');
        }
        
        // First, commit any wrapper changes and update its changelog
        console.log('Updating wrapper repository...');
        try {
            // Commit any pending changes in wrapper
            exec(`cd tak-manager-wrapper && git add . && git commit -m "chore: prepare tak-manager-wrapper@${newVersion} for release" || true`);
            
            // Generate and update wrapper's changelog
            const wrapperChangelogCmd = `cd tak-manager-wrapper && git cliff --config cliff.toml --tag "v${newVersion}" --output CHANGELOG.md`;
            exec(wrapperChangelogCmd);
            exec(`cd tak-manager-wrapper && git add CHANGELOG.md`);
            exec(`cd tak-manager-wrapper && git commit --amend --no-edit`);
            
            // Create wrapper tag
            exec(`cd tak-manager-wrapper && git tag -a v${newVersion} -m "TAK Manager Wrapper v${newVersion}"`);
        } catch (error) {
            console.log('Error updating wrapper repository:', error);
        }
        
        // Update the main repository's submodule reference
        exec('git add tak-manager-wrapper');
        exec(`git commit -m "chore: update wrapper submodule for v${newVersion}" || true`);
        
        // Generate main repository's changelog
        console.log('Generating main repository changelog...');
        const mainChangelogCmd = `git cliff --config cliff.toml --tag "v${newVersion}" --output CHANGELOG.md`;
        exec(mainChangelogCmd);
        
        // Read both changelogs for the release notes
        const mainChangelog = fs.readFileSync('CHANGELOG.md', 'utf8');
        const wrapperChangelog = fs.readFileSync('tak-manager-wrapper/CHANGELOG.md', 'utf8');
        
        // Extract the latest version entries from both changelogs
        const extractLatestEntry = (changelog) => {
            const versionMatch = changelog.match(/## \[\d+\.\d+\.\d+\] - \d{4}-\d{2}-\d{2}[\s\S]*?(?=## \[|$)/);
            return versionMatch ? versionMatch[0].trim() : '';
        };
        
        const mainEntry = extractLatestEntry(mainChangelog);
        const wrapperEntry = extractLatestEntry(wrapperChangelog);
        
        // Combine the entries for the release notes
        const releaseNotes = [
            mainEntry.replace(`## [${newVersion}] - ${currentDate}\n\n`, ''),
            wrapperEntry ? '\n### Wrapper Changes\n\n' + wrapperEntry.replace(`## [${newVersion}] - ${currentDate}\n\n`, '') : ''
        ].filter(Boolean).join('\n\n');
        
        // Create the formatted entry with version header
        const currentDate = new Date().toISOString().split('T')[0];
        const formattedEntry = `## [${newVersion}] - ${currentDate}\n\n${releaseNotes}`;
        
        // Stage and commit changelog
        exec('git add CHANGELOG.md');
        exec(`git commit --amend --no-edit`);
        
        // Create main repository tag
        exec(`git tag -a v${newVersion} -m "TAK Manager v${newVersion}" -m "${formattedEntry}"`);
        
        // Push changes and tags
        console.log('Pushing tags to both repositories...');
        // Main repository
        exec('git push origin main');
        exec(`git push origin v${newVersion}`);
        
        // Wrapper repository
        exec('cd tak-manager-wrapper && git push origin HEAD');
        exec(`cd tak-manager-wrapper && git push origin v${newVersion}`);
        
        // Create release in Gitea if token exists
        const giteaToken = process.env.GITEA_TOKEN;
        if (giteaToken) {
            // Wait a moment for the tag to be processed
            console.log('Waiting for tag to be processed...');
            execSync('sleep 2');

            // Use just the release notes without the version header
            const releaseBody = releaseNotes
                .split('\n')
                .map(line => line.trim())
                .filter(Boolean)
                .join('\n');

            // Create the release data with proper escaping
            const releaseData = JSON.stringify({
                tag_name: `v${newVersion}`,
                name: `TAK Manager v${newVersion}`,
                body: releaseBody
            });

            // Use a simpler curl command with the properly escaped JSON
            exec(`curl -X POST \
                "https://gitea.local.ubuntuserver.buzz/api/v1/repos/Jake/Tak-Manager/releases" \
                -H "Authorization: token ${giteaToken}" \
                -H "Content-Type: application/json" \
                -d '${releaseData.replace(/'/g, "'\\''")}'`);
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