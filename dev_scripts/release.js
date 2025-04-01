const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const prompt = require('prompt-sync')();

function loadEnv() {
    const envPath = path.join(process.cwd(), '.env.github');
    if (fs.existsSync(envPath)) {
        try {
            const envFile = fs.readFileSync(envPath, 'utf8');
            envFile.split('\n').forEach(line => {
                const [key, ...values] = line.replace(/#.*/, '').split('=');
                const value = values.join('=').trim();
                if (key && value) {
                    process.env[key.trim()] = value
                        .replace(/^['"]/, '')
                        .replace(/['"]$/, '');
                }
            });
        } catch (error) {
            console.warn('Error loading .env.github file:', error.message);
        }
    } else {
        console.warn('.env.github file not found. Create one with your GitHub token.');
    }

    // Verify GitHub token exists
    if (!process.env.GITHUB_TOKEN) {
        console.warn('\nGITHUB_TOKEN not found in .env.github file.');
        console.warn('Add it like this:');
        console.warn('GITHUB_TOKEN=ghp_yourTokenHere\n');
        console.warn('Create a token: https://github.com/settings/tokens/new?scopes=repo');
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
        
        // Get version input from user
        let newVersion;
        while (true) {
            newVersion = prompt(`Enter new version (current: ${currentVersion}): `).trim();
            if (/^\d+\.\d+\.\d+(-beta\.\d+)?$/.test(newVersion)) {
                break;
            }
            console.log('Invalid version format. Use semver format (e.g. 1.2.3 or 1.2.3-beta.1)');
        }
        
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
        
        // Create release in GitHub if token exists
        const githubToken = process.env.GITHUB_TOKEN;
        if (githubToken) {
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
                body: releaseBody,
                draft: false,
                prerelease: newVersion.includes('-beta')
            });

            // Create GitHub release using API
            exec(`curl -X POST \
                "https://api.github.com/repos/Jake/Tak-Manager/releases" \
                -H "Authorization: token ${githubToken}" \
                -H "Content-Type: application/json" \
                -H "User-Agent: Tak-Manager-Release-Script" \
                -d '${releaseData.replace(/'/g, "'\\''")}'`);
        } else {
            console.warn('GITHUB_TOKEN not set, skipping release creation');
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