import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const base = process.env.CI_BASE_SHA || 'origin/dev'
const changed = execFileSync('git', ['diff', '--name-only', '-z', `${base}...HEAD`], { encoding: 'utf8' }).split('\0').filter(Boolean)
const packages = execFileSync('git', ['ls-files', 'packages/integrations/**/package.json'], { encoding: 'utf8' }).trim().split('\n')
const sharedChanged = changed.some((file) => /^(packages\/core\/|packages\/integrations\/(framework|common)\/)/.test(file) || ['package.json', 'bun.lock', 'tsconfig.base.json', '.eslintrc.json'].includes(file))
const affected = packages.filter((file) => sharedChanged || changed.some((change) => change.startsWith(`${path.posix.dirname(file)}/`)))
const names = affected.map((file) => JSON.parse(readFileSync(file, 'utf8')).name).filter((name) => name.startsWith('@inboxfm-connect/piece-'))

if (names.length === 0) {
    console.log('No integration packages affected by this change.')
} else {
    console.log(`Checking ${names.length} integration packages against ${base}.`)
    execFileSync('bun', ['x', 'turbo', 'run', 'lint', 'build', '--concurrency=2', ...names.map((name) => `--filter=${name}`)], { stdio: 'inherit' })
}

