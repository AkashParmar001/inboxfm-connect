import { ErrorCode } from '@inboxfm-connect/core-utils'
import { FileCompression, FileType } from '@inboxfm-connect/shared'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fileService } from '../../../../src/app/file/file.service'
import { JwtAudience, JwtSignAlgorithm, jwtUtils } from '../../../../src/app/helper/jwt-utils'

const mockLog = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
} as any

describe('fileService.getFileByToken audience enforcement (Issue #165)', () => {
    const SECRET = 'test-file-token-secret-1234567890'

    beforeEach(() => {
        vi.restoreAllMocks()
        vi.spyOn(jwtUtils, 'getJwtSecret').mockResolvedValue(SECRET)
    })

    it('successfully decodes and returns file when token has JwtAudience.FILE_READ', async () => {
        const fileId = 'file_123'
        const validToken = await jwtUtils.sign({
            payload: {
                fileId,
                fileType: FileType.FLOW_STEP_FILE,
            },
            key: SECRET,
            algorithm: JwtSignAlgorithm.HS256,
            audience: JwtAudience.FILE_READ,
            expiresInSeconds: 300,
        })

        const mockFile = {
            id: fileId,
            projectId: 'proj_123',
            platformId: 'plat_123',
            type: FileType.FLOW_STEP_FILE,
            fileName: 'step_result.json',
            compression: FileCompression.NONE,
            size: 100,
            metadata: {},
            created: '2026-09-27T00:00:00.000Z',
            updated: '2026-09-27T00:00:00.000Z',
        }

        const service = fileService(mockLog)
        vi.spyOn(service, 'getFileOrThrow').mockResolvedValue(mockFile as any)
        const result = await service.getFileByToken(validToken)

        expect(result.id).toBe(fileId)
        expect(result.type).toBe(FileType.FLOW_STEP_FILE)
    })

    it('rejects token without audience with INVALID_BEARER_TOKEN', async () => {
        const tokenWithoutAudience = await jwtUtils.sign({
            payload: {
                fileId: 'file_123',
                fileType: FileType.FLOW_STEP_FILE,
            },
            key: SECRET,
            algorithm: JwtSignAlgorithm.HS256,
            expiresInSeconds: 300,
        })

        const service = fileService(mockLog)
        await expect(service.getFileByToken(tokenWithoutAudience)).rejects.toMatchObject({
            error: {
                code: ErrorCode.INVALID_BEARER_TOKEN,
            },
        })
    })

    it('rejects token signed with foreign audience with INVALID_BEARER_TOKEN', async () => {
        const foreignAudienceToken = await jwtUtils.sign({
            payload: {
                fileId: 'file_123',
                fileType: FileType.FLOW_STEP_FILE,
            },
            key: SECRET,
            algorithm: JwtSignAlgorithm.HS256,
            audience: JwtAudience.USER_INVITATION,
            expiresInSeconds: 300,
        })

        const service = fileService(mockLog)
        await expect(service.getFileByToken(foreignAudienceToken)).rejects.toMatchObject({
            error: {
                code: ErrorCode.INVALID_BEARER_TOKEN,
            },
        })
    })

    it('rejects token signed with MCP OAuth audience with INVALID_BEARER_TOKEN', async () => {
        const mcpToken = await jwtUtils.sign({
            payload: {
                fileId: 'file_123',
                fileType: FileType.FLOW_STEP_FILE,
            },
            key: SECRET,
            algorithm: JwtSignAlgorithm.HS256,
            audience: JwtAudience.MCP_OAUTH_ACCESS,
            expiresInSeconds: 300,
        })

        const service = fileService(mockLog)
        await expect(service.getFileByToken(mcpToken)).rejects.toMatchObject({
            error: {
                code: ErrorCode.INVALID_BEARER_TOKEN,
            },
        })
    })
})
