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

function getLatestTag() {
    try {
        exec('git fetch --tags');
        const tags = execSync('git tag -l "v*"').toString().split('\n').filter(Boolean);
        if (tags.length === 0) return '0.0.0';
        return tags.sort((a, b) => {
            const verA = a.replace('v', '').split('.').map(Number);
            const verB = b.replace('v', '').split('.').map(Number);
            for (let i = 0; i < 3; i++) {
                if (verA[i] !== verB[i]) return verB[i] - verA[i];
            }
            return 0;
        })[0].replace('v', '');
    } catch (error) {
        console.log('No tags found, starting from 0.0.0');
        return '0.0.0';
    }
}

function determineVersionBump() {
    const latestTag = getLatestTag();
    console.log(`Latest tag: v${latestTag}`);
    
    try {
        const commitMessages = execSync(`git log v${latestTag}..HEAD --pretty=format:"%B"`).toString();
        console.log('Analyzing commits:', commitMessages);
        
        if (commitMessages.includes('BREAKING CHANGE')) return 'major';
        if (commitMessages.includes('feat:')) return 'minor';
        if (commitMessages.includes('fix:')) return 'patch';
        if (commitMessages.includes('beta')) return 'prerelease';
        return 'patch'; // Default to patch if no conventional commits found
    } catch (error) {
        console.log('Error analyzing commits, defaulting to patch');
        return 'patch';
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
        // Switch to main and update
        console.log('Switching to main branch...');
        exec('git checkout main');
        exec('git pull origin main');
        
        // Merge dev into main
        console.log('Merging dev into main...');
        exec('git merge dev --no-ff -m "chore: merge dev into main for release"');
        
        // Determine version bump
        const versionBump = determineVersionBump();
        console.log(`Version bump type: ${versionBump}`);
        
        // Update version and generate changelog
        process.env.VERSION_BUMP = versionBump;
        runWithRetries('npm run update:version');
        runWithRetries('npm run update:changelog');
        
        // Get new version
        const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
        const newVersion = packageJson.version;
        console.log(`New version: ${newVersion}`);
        
        // Stage and commit changes
        exec('git add package.json package-lock.json CHANGELOG.md');
        exec('git add client/package.json || true');
        exec('git add docker-compose.prod.yml || true');
        exec(`git commit -m "chore: release tak-manager@${newVersion} [skip ci]"`);
        
        // Create and push tag
        const releaseNotes = execSync('git cliff --latest').toString();
        
        // Delete existing tag if it exists
        try {
            exec(`git tag -d v${newVersion}`);
            exec(`git push origin :refs/tags/v${newVersion}`);
        } catch (error) {
            // Tag doesn't exist, that's fine
        }
        
        // Create new tag
        exec(`git tag -a v${newVersion} -m "TAK Manager v${newVersion}" -m "${releaseNotes}"`);
        
        // Push changes and tags
        exec('git push origin main');
        exec(`git push origin v${newVersion}`);
        
        // Create release in Gitea
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
        
        // Switch back to dev
        exec('git checkout dev');
        
        console.log('Release completed successfully!');
        
    } catch (error) {
        console.error('Release failed:', error);
        process.exit(1);
    }
}

release().catch(console.error); 