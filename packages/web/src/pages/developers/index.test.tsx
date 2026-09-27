import { act } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import DevelopersPage from './index'
import { mount } from '@/test/test-utils'

describe('DevelopersPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    })
  })

  it('renders the developers page with SDK and REST contracts', () => {
    const root = mount(
      <MemoryRouter>
        <DevelopersPage />
      </MemoryRouter>
    )

    expect(root.textContent).toContain('Developers & SDK')
    expect(root.textContent).toContain('SDK Installation')
    expect(root.textContent).toContain('TypeScript SDK Example')
    expect(root.textContent).toContain('Direct REST API Contract')
  })

  it('renders the curl snippet with properly closed Authorization header and valid bash syntax (#176)', () => {
    const root = mount(
      <MemoryRouter>
        <DevelopersPage />
      </MemoryRouter>
    )

    const preElements = root.querySelectorAll('pre')
    const restPre = Array.from(preElements).find((pre) => pre.textContent?.includes('curl -X POST'))
    expect(restPre).toBeDefined()

    const snippet = restPre?.textContent ?? ''

    // AC 1: Authorization header has a properly closed quote
    expect(snippet).toMatch(/-H "Authorization: Bearer [^"]+" \\/)

    // AC 2 & 3: Snippet has balanced quotes and valid shell structure
    const doubleQuoteCount = (snippet.match(/"/g) || []).length
    expect(doubleQuoteCount % 2).toBe(0)

    const singleQuoteCount = (snippet.match(/'/g) || []).length
    expect(singleQuoteCount % 2).toBe(0)

    // Validates JSON payload inside curl -d
    const jsonMatch = snippet.match(/-d '([\s\S]*?)'/)
    expect(jsonMatch).not.toBeNull()
    const parsedJson = JSON.parse(jsonMatch![1])
    expect(parsedJson.integration).toBe('@inboxfm-connect/piece-slack')
    expect(parsedJson.tool).toBe('send_message')
    expect(parsedJson.externalUserId).toBe('user_42')
  })

  it('copies the REST snippet when the copy button is clicked', async () => {
    const root = mount(
      <MemoryRouter>
        <DevelopersPage />
      </MemoryRouter>
    )

    const buttons = root.querySelectorAll('button')
    const copyButton = Array.from(buttons).find((b) => b.querySelector('svg'))
    expect(copyButton).toBeDefined()

    await act(async () => {
      copyButton?.click()
    })

    expect(navigator.clipboard.writeText).toHaveBeenCalled()
  })
})
