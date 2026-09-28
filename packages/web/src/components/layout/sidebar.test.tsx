import { beforeEach, describe, expect, it } from 'vitest'
import { Sidebar } from './sidebar'
import { apiClient } from '@/lib/api/client'
import { stubApi } from '@/test/api-stub'
import { testProject, testUser } from '@/test/fixtures/api-keys'
import { mountAt, waitFor } from '@/test/test-utils'

const CORE_ITEMS = [
  'Overview',
  'Integrations',
  'Connections',
  'Actions',
  'Triggers',
  'Scheduled Tasks',
  'MCP',
]
const PLATFORM_ITEMS = ['Activity', 'Developers', 'API Keys', 'Settings']
const LEGACY_ITEMS = ['Flows', 'Flow Runs', 'Flow Versions', 'Folders']

describe('Sidebar', () => {
  beforeEach(() => {
    localStorage.clear()
    document.body.innerHTML = ''
  })

  it('renders all developer console navigation groups', () => {
    const container = mountAt(<Sidebar />, { route: '/' })
    const text = container.textContent || ''

    CORE_ITEMS.forEach((label) => expect(text).toContain(label))
    PLATFORM_ITEMS.forEach((label) => expect(text).toContain(label))
  })

  it('does not render legacy flow-builder navigation', () => {
    const container = mountAt(<Sidebar />, { route: '/' })
    const text = container.textContent || ''

    LEGACY_ITEMS.forEach((label) => expect(text).not.toContain(label))
  })

  it('marks the active route with aria-current and active styling', () => {
    const container = mountAt(<Sidebar />, { route: '/integrations' })

    const activeLink = container.querySelector('a[href="/integrations"]')
    expect(activeLink).not.toBeNull()
    expect(activeLink?.getAttribute('aria-current')).toBe('page')
    expect(activeLink?.className).toContain('text-primary')

    const overviewLink = container.querySelector('a[href="/"]')
    expect(overviewLink?.getAttribute('aria-current')).toBeNull()
    expect(overviewLink?.className).not.toContain('text-primary')
  })

  it('shows a neutral project state when the auth context has no project', () => {
    const container = mountAt(<Sidebar />, { route: '/' })

    expect(container.textContent).toContain('No project')
    expect(container.textContent).not.toContain('InboxFM Main Project')
    expect(container.textContent).not.toContain('developer@inboxfm.local')
    expect(container.textContent).toContain('Developer Console')
  })

  it('shows the real project and email from the auth context when available', async () => {
    const project = testProject({ id: 'proj_acme', displayName: 'Acme Ops' })
    apiClient.setToken('test-token')
    apiClient.setProjectId(project.id)
    localStorage.setItem('ap-user', JSON.stringify(testUser({ email: 'dev@example.com' })))
    stubApi([
      {
        match: (url, method) => url.pathname === '/api/v1/projects' && method === 'GET',
        respond: () => ({ body: { data: [project] } }),
      },
    ])

    const container = mountAt(<Sidebar />, { route: '/' })

    await waitFor(() => container.textContent?.includes('Acme Ops') === true)
    expect(container.textContent).toContain('dev@example.com')
    expect(container.textContent).not.toContain('No project')
    expect(container.textContent).not.toContain('developer@inboxfm.local')
  })
})
