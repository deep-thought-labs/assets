/**
 * Deploy script: builds projects in sources/ and copies output into public/.
 *
 * Flow:
 * 1. Load scripts/deploy.config.js (list of { source, dest, copyFrom? }).
 * 2. For each entry: run "npm install" and "npm run build" in sources/<source>/.
 * 3. Create dest directory if needed; copy dist/ contents to dest.
 * 4. If copyFrom is set, copy each listed project folder (e.g. "html") into dest as well.
 *
 * Run from repo root: node scripts/deploy.js  (or npm run deploy)
 */
const path = require('path')
const fs = require('fs')
const { execSync } = require('child_process')

const ROOT = path.resolve(__dirname, '..')
const configPath = path.join(__dirname, 'deploy.config.js')

/** Copies directory src into dest (creates dest); merges subdirectories and overwrites files. */
function copyDirRecursive(src, dest) {
  if (!fs.existsSync(src)) return
  fs.mkdirSync(dest, { recursive: true })
  const entries = fs.readdirSync(src, { withFileTypes: true })
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name)
    const destPath = path.join(dest, entry.name)
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath)
    } else {
      fs.copyFileSync(srcPath, destPath)
    }
  }
}

function main() {
  let config
  try {
    config = require(configPath)
  } catch (err) {
    console.error('Failed to load deploy.config.js:', err.message)
    process.exit(1)
  }

  if (!Array.isArray(config) || config.length === 0) {
    console.log('deploy.config.js has no projects configured.')
    return
  }

  for (const entry of config) {
    const { source, dest: destRel, copyFrom } = entry
    if (!source || !destRel) {
      console.warn('Skipping entry (missing source or dest):', entry)
      continue
    }

    const projectDir = path.join(ROOT, 'sources', source)
    const destDir = path.join(ROOT, destRel)

    if (!fs.existsSync(projectDir)) {
      console.warn(`sources/${source}/ not found, skipping.`)
      continue
    }

    console.log(`\n--- ${source} ---`)

    try {
      execSync('npm install', { cwd: projectDir, stdio: 'inherit' })
    } catch (err) {
      console.error(`npm install failed in sources/${source}/`)
      process.exit(1)
    }

    try {
      execSync('npm run build', { cwd: projectDir, stdio: 'inherit' })
    } catch (err) {
      console.error(`npm run build failed in sources/${source}/`)
      process.exit(1)
    }

    fs.mkdirSync(destDir, { recursive: true })

    const distDir = path.join(projectDir, 'dist')
    if (fs.existsSync(distDir)) {
      console.log(`  Copying dist/ → ${destRel}/`)
      copyDirRecursive(distDir, destDir)
    }

    if (Array.isArray(copyFrom) && copyFrom.length > 0) {
      for (const dirName of copyFrom) {
        const fromDir = path.join(projectDir, dirName)
        if (fs.existsSync(fromDir) && fs.statSync(fromDir).isDirectory()) {
          console.log(`  Copying ${dirName}/ → ${destRel}/`)
          copyDirRecursive(fromDir, destDir)
        } else {
          console.warn(`  ${dirName}/ not found in sources/${source}/, skipping.`)
        }
      }
    }

    console.log(`  Done: ${destRel}/`)
  }

  console.log('\nDeploy finished.')
}

main()
