import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { i18n, i18nUtils } from '@/lib/i18n'

describe('i18n runtime and crowdin localization pipeline (#177)', () => {
  it('initializes i18n with English as the fallback and active language', () => {
    expect(i18n.isInitialized).toBe(true)
    expect(i18nUtils.getLanguage()).toBe('en')
  })

  it('translates core header and sidebar navigation keys', () => {
    expect(i18n.t('Overview')).toBe('Overview')
    expect(i18n.t('Integrations')).toBe('Integrations')
    expect(i18n.t('Connections')).toBe('Connections')
    expect(i18n.t('Actions')).toBe('Actions')
    expect(i18n.t('Triggers')).toBe('Triggers')
    expect(i18n.t('Trigger Bindings')).toBe('Trigger Bindings')
    expect(i18n.t('Scheduled Tasks')).toBe('Scheduled Tasks')
    expect(i18n.t('MCP Hub')).toBe('MCP Hub')
    expect(i18n.t('Activity')).toBe('Activity')
    expect(i18n.t('Developers')).toBe('Developers')
    expect(i18n.t('API Keys')).toBe('API Keys')
    expect(i18n.t('Settings')).toBe('Settings')
    expect(i18n.t('Developer Console')).toBe('Developer Console')
    expect(i18n.t('Search integrations, tools, routes...')).toBe('Search integrations, tools, routes...')
    expect(i18n.t('Dev Environment')).toBe('Dev Environment')
    expect(i18n.t('Sign out')).toBe('Sign out')
  })

  it('validates crowdin.yml declares a real, valid source translation file', () => {
    const crowdinPath = path.resolve(__dirname, '../../../../crowdin.yml')
    expect(fs.existsSync(crowdinPath)).toBe(true)

    const crowdinContent = fs.readFileSync(crowdinPath, 'utf8')
    const sourceMatch = crowdinContent.match(/source:\s*(packages\/web\/public\/locales\/en\/translation\.json)/)
    expect(sourceMatch).not.toBeNull()

    const relativeSource = sourceMatch![1]
    const absoluteSource = path.resolve(__dirname, '../../../../', relativeSource)
    expect(fs.existsSync(absoluteSource)).toBe(true)

    const rawJson = fs.readFileSync(absoluteSource, 'utf8')
    const parsed = JSON.parse(rawJson) as Record<string, string>
    expect(typeof parsed).toBe('object')
    expect(Object.keys(parsed).length).toBeGreaterThan(2000)

    // Key UI strings must exist in the source translation file
    expect(parsed['Overview']).toBe('Overview')
    expect(parsed['Integrations']).toBe('Integrations')
    expect(parsed['Connections']).toBe('Connections')
    expect(parsed['Scheduled Tasks']).toBe('Scheduled Tasks')
    expect(parsed['Trigger Bindings']).toBe('Trigger Bindings')
    expect(parsed['Search integrations, tools, routes...']).toBe('Search integrations, tools, routes...')
  })
})
