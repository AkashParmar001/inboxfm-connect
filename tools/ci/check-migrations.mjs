import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'

const require = createRequire(import.meta.url)
const root = fileURLToPath(new URL('../../', import.meta.url))
const apiRoot = path.join(root, 'packages/server/api')
const env = { ...dotenv.parse(readFileSync(path.join(apiRoot, '.env.tests'))), ...process.env, AP_DEV_PIECES: '', AP_ENVIRONMENT: 'dev', AP_EDITION: 'ce' }
const cli = [require.resolve('ts-node/dist/bin.js'), '--transpile-only', '-r', 'tsconfig-paths/register', '-P', 'tsconfig.app.json', require.resolve('typeorm/cli.js')]
const dataSource = ['-d', 'src/app/database/migration-data-source.ts']

console.log('Applying migrations to the test database.')
execFileSync(process.execPath, [...cli, 'migration:run', ...dataSource], { cwd: apiRoot, env, stdio: 'inherit' })
console.log('Checking for schema changes without a migration.')
execFileSync(process.execPath, [...cli, 'migration:generate', '-p', ...dataSource, 'src/app/database/migration/postgres/check', '--dryrun', '--check'], { cwd: apiRoot, env, stdio: 'inherit' })

