import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { FetchHttpClient } from './fetch-http-client'
import { HttpMethod } from './http-method'

describe('FetchHttpClient TLS security', () => {
  const originalEnv = process.env['NODE_TLS_REJECT_UNAUTHORIZED']

  beforeEach(() => {
    delete process.env['NODE_TLS_REJECT_UNAUTHORIZED']
  })

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = originalEnv
    } else {
      delete process.env['NODE_TLS_REJECT_UNAUTHORIZED']
    }
    vi.restoreAllMocks()
  })

  it('does NOT set NODE_TLS_REJECT_UNAUTHORIZED on the global process environment', async () => {
    const mockResponse = new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse)

    const client = new FetchHttpClient()
    await client.sendRequest({
      method: HttpMethod.GET,
      url: 'https://example.com/api',
    })

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(process.env['NODE_TLS_REJECT_UNAUTHORIZED']).toBeUndefined()
  })

  it('passes caller-supplied custom dispatcher without mutating global TLS settings', async () => {
    const mockResponse = new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse)

    const customDispatcher = { id: 'custom-dispatcher' }
    const client = new FetchHttpClient()
    await client.sendRequest(
      {
        method: HttpMethod.POST,
        url: 'https://example.com/api/secure',
        body: { key: 'value' },
      },
      { dispatcher: customDispatcher }
    )

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://example.com/api/secure',
      expect.objectContaining({
        dispatcher: customDispatcher,
      })
    )
    expect(process.env['NODE_TLS_REJECT_UNAUTHORIZED']).toBeUndefined()
  })

  it('preserves an existing NODE_TLS_REJECT_UNAUTHORIZED environment setting without mutating it', async () => {
    process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '1'
    const mockResponse = new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse)

    const client = new FetchHttpClient()
    await client.sendRequest({
      method: HttpMethod.GET,
      url: 'https://example.com/api',
    })

    expect(process.env['NODE_TLS_REJECT_UNAUTHORIZED']).toBe('1')
  })

  // Mocks TLS rejection; real network path can be verified with manual smoke against badssl.com
  it('propagates TLS connection rejection when self-signed certificate fails verification', async () => {
    const tlsCause = new Error('self signed certificate in certificate chain')
    const tlsError = new TypeError('fetch failed')
    Object.assign(tlsError, { cause: tlsCause })
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(tlsError)

    const client = new FetchHttpClient()
    await expect(
      client.sendRequest({
        method: HttpMethod.GET,
        url: 'https://self-signed.badssl.com/',
      })
    ).rejects.toSatisfy((err: unknown) => {
      return (
        err instanceof TypeError &&
        err.message === 'fetch failed' &&
        (err as any).cause === tlsCause
      )
    })

    expect(process.env['NODE_TLS_REJECT_UNAUTHORIZED']).toBeUndefined()
  })
})
