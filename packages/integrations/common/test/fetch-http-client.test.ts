import type { Server } from 'node:http';
import { createServer as createHttpServer } from 'node:http';
import { createServer as createHttpsServer } from 'node:https';
import type { AddressInfo } from 'node:net';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { FetchHttpClient } from '../src/lib/http/core/fetch-http-client';
import { HttpMethod } from '../src/lib/http/core/http-method';

const TLS_BYPASS_ENV_VAR = 'NODE_TLS_REJECT_UNAUTHORIZED';

// Deliberately untrusted fixture: a throwaway self-signed certificate so the test can prove the
// client still rejects endpoints whose certificate Node cannot verify against the system roots.
const SELF_SIGNED_CERTIFICATE = `-----BEGIN CERTIFICATE-----
MIIDTTCCAjWgAwIBAgIQAWMZeF/zAh7FozJ1QrM16zANBgkqhkiG9w0BAQsFADA7
MRIwEAYDVQQDEwlsb2NhbGhvc3QxJTAjBgNVBAoTHGluYm94Zm0tY29ubmVjdCB0
ZXN0IGZpeHR1cmUwIBcNMjAwMTAxMDAwMDAwWhgPMjEyMDAxMDEwMDAwMDBaMDsx
EjAQBgNVBAMTCWxvY2FsaG9zdDElMCMGA1UEChMcaW5ib3hmbS1jb25uZWN0IHRl
c3QgZml4dHVyZTCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBAJWwRVvU
wHTMTDLC3zlh4kXhdkEvNwivemkvTcWLZXX7NKq08Z+okgYkGBO1mHxhfLMqTE9s
8U9oGMCyNpUR2HOOtjtilo0RprQn2Z3xvdOJtLKOf2S9Spf5kwVg9V6UHWWGvOqw
4CC4SgieEgpcPGw0jFsgQbaF8ev/JxvuI5OkdkOni6b7cgSt6OZMsGrdu4R6wsXX
3YzrBSKxbbTroDTRUc24H1l85PF2LNDbTNKzz+awRrv5VWpGKtp7zuor++n+xuL4
yrBRL3H3mUFMh/m/tAQw36YlD6VcIO3Eg+W/uMXfPcEUNnGLn2anoji2/95Wkcn2
xkhSluCMcthBMJECAwEAAaNLMEkwCQYDVR0TBAIwADALBgNVHQ8EBAMCBaAwEwYD
VR0lBAwwCgYIKwYBBQUHAwEwGgYDVR0RBBMwEYIJbG9jYWxob3N0hwR/AAABMA0G
CSqGSIb3DQEBCwUAA4IBAQBzXuMKmIdgUiKoYx9K4ZPhrbMDrvHZwzujwtqVmm4B
0ZVlXR3eCE8RzVKKs5Z1B6NCM+aLAiAT4GhE3N3BdZuhlTqtQfV2n1UPE2wpKjFi
FPB8safDjBofHyDm0QJLHSpQtXiVE2AwUQGdDjDMZn/oDB/PTmopVtJmLn0MW5+I
BxU0fz4SznWab7i0RNZ3JAi95JsggoN3kdoxevMEgwzH2gLhnjf8T0PZxP5cjuSn
zsnjufc406NrwWBD2n907dpKu5JVhlru7G6u+uNcECIsGhDj7LMlOp4WZYppAT4P
Ym4dU0a5m3blvYVIaNC+TlJyLvhXo76wFmJRUu6BbvU3
-----END CERTIFICATE-----`;

const SELF_SIGNED_PRIVATE_KEY = `-----BEGIN RSA PRIVATE KEY-----
MIIEowIBAAKCAQEAlbBFW9TAdMxMMsLfOWHiReF2QS83CK96aS9NxYtldfs0qrTx
n6iSBiQYE7WYfGF8sypMT2zxT2gYwLI2lRHYc462O2KWjRGmtCfZnfG904m0so5/
ZL1Kl/mTBWD1XpQdZYa86rDgILhKCJ4SClw8bDSMWyBBtoXx6/8nG+4jk6R2Q6eL
pvtyBK3o5kywat27hHrCxdfdjOsFIrFttOugNNFRzbgfWXzk8XYs0NtM0rPP5rBG
u/lVakYq2nvO6iv76f7G4vjKsFEvcfeZQUyH+b+0BDDfpiUPpVwg7cSD5b+4xd89
wRQ2cYufZqeiOLb/3laRyfbGSFKW4Ixy2EEwkQIDAQABAoIBAAK1+uWVOmiLGCCt
tor0nrtPAFwhGaUsv2HnB0ip8/wRYPRr+zm93OojTnPR7Llo7xAUFqZ0FcEvRI59
0776oCHEnoCAEjOrE4qs85QYkAxkEKuQqNY3VuHedVcKONteAZPIf0SdUCvLhpy2
FyPMpJP9liKi2InQjm9skyXed9K5R0hdgBDAZfam7K/hicwdH6MoOGbH6ABXsGx4
cAgXE7H1RKQx3PSB01h9fj9CygTnxCeUcfWWJLT1lsQYIEGH8/ZPElZZVT5q88N0
s4UzIEkLa8M0gtThD2Mf5zaKy9eHijYXkBPSwuuYwsA/eIExVeqxg2e6XJAXRWIM
WgcjG0ECgYEAz2DvmCxf7FFWWwZvKZlaQHtgNwzdmrFPR9erD+n1aomfYkvtmmp1
xUPrWrxel4YDy75v3QHn5k8C1aKxfqXcINa7yF4QupeQPEWCenCh2uWjwWuOepAf
OrqW29xMfLg08dVsI4cmQUSG9d2aDc0O6j7i+5fluaWbE39VSs6O4KECgYEAuMi4
c4vDTFDEimJrJOpIB7bf6zF00kspQdQgmXrO//sQKIMA3k/ysRFBAKsxxoo7sO7i
Axq0ALsN5oBQLtrEK108p1e1izrfKWLfn6imsGKMvhMrZ9U0HwWB+1cU43AAOUE4
o+O9wHg6l1yExrj2ffU0UEk/+wo7LBAzA83QGfECgYBZxjoSo2snL5L1ttRaqtOC
RKbDTiOE+ys6C6g3LG4cn9VKxVnn1hyDuEJjtlYwvEhaZGeiwld0wVGV0GeMTxr7
cFo8hFQzordDEEhK3wWCcJUyf3BfqJKMZwg1x6mo+EmbQ2wb+T7bVGIkf7lYLiQ9
zdmPVxORCZsXlrECwGbj4QKBgQCt/anYeph5Km/10bgLeWI7iVGMdvQF82m0p1XO
zplM5Q0Q6FGQAv2FBrcLNydWR+Dut/Audh1Ztsfe66EUjT87ib5L38V8hQGOSaBB
CJ9z5EebzhcH3PQH5bq/e/6aLWK4hpYbk5yfN1YMIbyQFadbcOBCXMaWzcprshEn
GstBMQKBgHuyM9HEsNyqJBaxpR0LGROUOs/JCIxFbdjL3pYi8e22dTgbbqm65R+m
f+KJtsU3Kb+wvcTukWOJbwSBIVWGcI2R0z+SfSgB4d+wNmz3hCRA6dQKBa9YWFbO
f9txruttGGT+V0jR5ZWZjRlnHhsPgAjOAB40Zv2wlVbGaGsmRG17
-----END RSA PRIVATE KEY-----`;

let httpServer: Server;
let httpsServer: Server;
let httpBaseUrl: string;
let httpsBaseUrl: string;
let tlsBypassBeforeSuite: string | undefined;

function listen(server: Server): Promise<number> {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.removeListener('error', reject);
      resolve((server.address() as AddressInfo).port);
    });
  });
}

function close(server: Server): Promise<void> {
  return new Promise((resolve) => server.close(() => resolve()));
}

function respondJson(response: import('node:http').ServerResponse, statusCode: number, payload: unknown): void {
  response.writeHead(statusCode, { 'content-type': 'application/json' });
  response.end(JSON.stringify(payload));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function tlsFailureCode(error: unknown): string {
  if (!(error instanceof Error) || !isRecord(error.cause)) {
    return '';
  }
  const code = error.cause['code'];
  return typeof code === 'string' ? code : '';
}

async function captureRejection(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
    return undefined;
  } catch (error) {
    return error;
  }
}

describe('FetchHttpClient TLS verification', () => {
  beforeAll(async () => {
    tlsBypassBeforeSuite = process.env[TLS_BYPASS_ENV_VAR];
    delete process.env[TLS_BYPASS_ENV_VAR];

    httpServer = createHttpServer((request, response) => respondJson(response, 200, { ok: true }));
    const httpPort = await listen(httpServer);
    httpBaseUrl = `http://127.0.0.1:${httpPort}`;

    httpsServer = createHttpsServer(
      { cert: SELF_SIGNED_CERTIFICATE, key: SELF_SIGNED_PRIVATE_KEY },
      (request, response) => respondJson(response, 200, { ok: true })
    );
    const httpsPort = await listen(httpsServer);
    httpsBaseUrl = `https://127.0.0.1:${httpsPort}`;

    if (tlsBypassBeforeSuite === undefined) {
      delete process.env[TLS_BYPASS_ENV_VAR];
    } else {
      process.env[TLS_BYPASS_ENV_VAR] = tlsBypassBeforeSuite;
    }
  });

  afterAll(async () => {
    await Promise.all([close(httpServer), close(httpsServer)]);
    if (tlsBypassBeforeSuite === undefined) {
      delete process.env[TLS_BYPASS_ENV_VAR];
    } else {
      process.env[TLS_BYPASS_ENV_VAR] = tlsBypassBeforeSuite;
    }
  });

  beforeEach(() => {
    delete process.env[TLS_BYPASS_ENV_VAR];
  });

  afterEach(() => {
    if (tlsBypassBeforeSuite === undefined) {
      delete process.env[TLS_BYPASS_ENV_VAR];
    } else {
      process.env[TLS_BYPASS_ENV_VAR] = tlsBypassBeforeSuite;
    }
  });

  it('does not disable certificate verification process-wide while sending a request', async () => {
    const response = await new FetchHttpClient().sendRequest({
      method: HttpMethod.GET,
      url: `${httpBaseUrl}/ok`,
    });

    expect(response.status).toBe(200);
    expect(process.env[TLS_BYPASS_ENV_VAR]).toBeUndefined();
  });

  it('leaves an existing NODE_TLS_REJECT_UNAUTHORIZED value untouched', async () => {
    process.env[TLS_BYPASS_ENV_VAR] = '1';

    await new FetchHttpClient().sendRequest({ method: HttpMethod.GET, url: `${httpBaseUrl}/ok` });

    expect(process.env[TLS_BYPASS_ENV_VAR]).toBe('1');
  });

  it('rejects an HTTPS endpoint presenting a self-signed certificate', async () => {
    const failure = await captureRejection(
      new FetchHttpClient().sendRequest({ method: HttpMethod.GET, url: `${httpsBaseUrl}/ok` })
    );

    expect(failure).toBeInstanceOf(Error);
    expect(tlsFailureCode(failure)).toMatch(/CERT|SSL|TLS/);
    expect(process.env[TLS_BYPASS_ENV_VAR]).toBeUndefined();
  });

  it('still performs plain HTTP requests normally', async () => {
    const response = await new FetchHttpClient().sendRequest<{ ok: boolean }>({
      method: HttpMethod.GET,
      url: `${httpBaseUrl}/ok`,
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true });
    expect(process.env[TLS_BYPASS_ENV_VAR]).toBeUndefined();
  });
});
