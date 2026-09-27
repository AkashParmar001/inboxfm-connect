import fs from 'node:fs'
import path from 'node:path'
import { EntitySchema } from 'typeorm'
import { describe, expect, it } from 'vitest'
import { getEntities } from '../../../../src/app/database/database-connection'

export type DiscoveredEntity = {
    exportName: string
    entity: EntitySchema<unknown>
    filePath: string
    relativePath: string
}

export function findEntityFiles(appDir: string): string[] {
    const entries = fs.readdirSync(appDir, { recursive: true })
    const entityFiles: string[] = []

    for (const entry of entries) {
        const fileStr = String(entry)
        if (
            !fileStr.endsWith('.ts') ||
            fileStr.endsWith('.d.ts') ||
            fileStr.includes('migration') ||
            fileStr.includes('.test.ts') ||
            fileStr.includes('.spec.ts')
        ) {
            continue
        }

        const fullPath = path.join(appDir, fileStr)
        const content = fs.readFileSync(fullPath, 'utf-8')
        if (content.includes('new EntitySchema')) {
            entityFiles.push(fullPath)
        }
    }

    return entityFiles
}

export async function discoverEntities(appDir: string): Promise<DiscoveredEntity[]> {
    const files = findEntityFiles(appDir)
    const discovered: DiscoveredEntity[] = []

    for (const filePath of files) {
        const mod = await import(filePath)
        const relativePath = path.relative(appDir, filePath).replace(/\\/g, '/')

        for (const [exportName, exportedVal] of Object.entries(mod)) {
            if (
                exportedVal instanceof EntitySchema ||
                (exportedVal &&
                    typeof exportedVal === 'object' &&
                    'options' in exportedVal &&
                    typeof (exportedVal as Record<string, unknown>).options === 'object' &&
                    'name' in ((exportedVal as Record<string, unknown>).options as Record<string, unknown>))
            ) {
                discovered.push({
                    exportName,
                    entity: exportedVal as EntitySchema<unknown>,
                    filePath,
                    relativePath,
                })
            }
        }
    }

    return discovered
}

export function checkEntityRegistrations(
    discoveredEntities: DiscoveredEntity[],
    registeredEntities: EntitySchema<unknown>[],
): { missing: DiscoveredEntity[], duplicates: string[] } {
    const registeredNames = new Set(registeredEntities.map((e) => e.options.name))
    const missing: DiscoveredEntity[] = []

    for (const discovered of discoveredEntities) {
        const isRegisteredByName = registeredNames.has(discovered.entity.options.name)
        const isRegisteredByRef = registeredEntities.includes(discovered.entity)

        if (!isRegisteredByName || !isRegisteredByRef) {
            missing.push(discovered)
        }
    }

    const seenNames = new Set<string>()
    const duplicates: string[] = []
    for (const entity of registeredEntities) {
        if (seenNames.has(entity.options.name)) {
            duplicates.push(entity.options.name)
        }
        seenNames.add(entity.options.name)
    }

    return { missing, duplicates }
}

describe('Entity Registration Regression Suite (Issue #142)', () => {
    const appDir = path.resolve(__dirname, '../../../../src/app')

    it('scans src/app/**/*.entity.ts and asserts every EntitySchema is in getEntities()', async () => {
        const discovered = await discoverEntities(appDir)
        const registered = getEntities()

        expect(discovered.length).toBeGreaterThan(0)
        expect(registered.length).toBeGreaterThan(0)

        const { missing, duplicates } = checkEntityRegistrations(discovered, registered)

        if (missing.length > 0) {
            const missingDetails = missing
                .map(
                    (m) =>
                        `  - Entity '${m.entity.options.name}' (export '${m.exportName}') in src/app/${m.relativePath}`,
                )
                .join('\n')

            const fixInstructions = missing
                .map(
                    (m) =>
                        `    import { ${m.exportName} } from '../${m.relativePath.replace(/\.ts$/, '')}'`,
                )
                .join('\n')

            const errorMessage =
                `Found ${missing.length} entity file(s) missing from getEntities() in packages/server/api/src/app/database/database-connection.ts:\n` +
                `${missingDetails}\n\n` +
                'Fix:\n' +
                '1. Open packages/server/api/src/app/database/database-connection.ts\n' +
                `2. Import the missing entity schema(s):\n${fixInstructions}\n` +
                '3. Add the exported entity schema(s) to the array returned by getEntities().'

            expect.fail(errorMessage)
        }

        expect(duplicates, `Duplicate entity registrations found in getEntities(): ${duplicates.join(', ')}`).toHaveLength(0)
    })

    it('asserts failure diagnostics report missing entities and actionable fix instructions', () => {
        const fakeEntity = new EntitySchema({
            name: 'unregistered_test_entity',
            tableName: 'unregistered_test_entity',
            columns: {
                id: { type: 'varchar', primary: true },
            },
        })

        const fakeDiscovered: DiscoveredEntity[] = [
            {
                exportName: 'UnregisteredTestEntity',
                entity: fakeEntity,
                filePath: '/mock/src/app/test/unregistered.entity.ts',
                relativePath: 'test/unregistered.entity.ts',
            },
        ]

        const registered = getEntities()
        const { missing } = checkEntityRegistrations(fakeDiscovered, registered)

        expect(missing).toHaveLength(1)
        expect(missing[0].exportName).toBe('UnregisteredTestEntity')
        expect(missing[0].entity.options.name).toBe('unregistered_test_entity')
    })
})
