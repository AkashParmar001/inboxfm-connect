import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const base = process.env.CI_BASE_SHA || 'origin/dev'
const changed = execFileSync('git', ['diff', '--name-only', '-z', `${base}...HEAD`], { encoding: 'utf8' }).split('\0').filter(Boolean)
const packages = execFileSync('git', ['ls-files', 'packages/integrations/**/package.json'], { encoding: 'utf8' }).trim().split('\n')
const manifest = JSON.parse(readFileSync('package.json', 'utf8'))
const previousManifest = JSON.parse(execFileSync('git', ['show', `${base}:package.json`], { encoding: 'utf8' }))
const dependenciesChanged = ['dependencies', 'overrides', 'resolutions'].some((field) => JSON.stringify(manifest[field]) !== JSON.stringify(previousManifest[field]))
const sharedChanged = dependenciesChanged || changed.some((file) => /^(packages\/core\/(utils|formula|piece-types|execution)\/|packages\/integrations\/(framework|common)\/)/.test(file) || ['bun.lock', 'tsconfig.base.json'].includes(file))
const lintConfigChanged = changed.includes('.eslintrc.json') || changed.some((file) => /^\.prettier/.test(file))
const directlyAffected = packages.filter((file) => changed.some((change) => change.startsWith(`${path.posix.dirname(file)}/`)))
const buildPackages = sharedChanged ? packages : directlyAffected
const lintPackages = lintConfigChanged ? packages : directlyAffected

for (const { task, files } of [{ task: 'lint', files: lintPackages }, { task: 'build', files: buildPackages }]) {
    const names = files.map((file) => JSON.parse(readFileSync(file, 'utf8')).name).filter((name) => name.startsWith('@inboxfm-connect/piece-'))
    if (names.length === 0) {
        console.log(`No integration packages affected for ${task}.`)
        continue
    }
    console.log(`Checking ${task} for ${names.length} integration packages against ${base}.`)
    execFileSync('bun', ['x', 'turbo', 'run', task, '--concurrency=2', ...names.map((name) => `--filter=${name}`)], { stdio: 'inherit' })
}

