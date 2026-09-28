import { addActionUtils } from '../../src/lib/flows/operations/add-action-util'
import { FlowActionType, PieceAction } from '../../src/lib/flows/actions/action'

function pieceAction({ name, input }: { name: string, input: Record<string, unknown> }): PieceAction {
    return {
        name,
        valid: true,
        displayName: name,
        lastUpdatedDate: '2026-01-01T00:00:00.000Z',
        type: FlowActionType.PIECE,
        settings: {
            pieceName: '@inboxfm-connect/piece-store',
            pieceVersion: '1.0.0',
            actionName: 'store_value',
            propertySettings: {},
            input,
            errorHandlingOptions: {},
        },
    }
}

function duplicatedInput({
    input,
    oldNameToNewName,
}: {
    input: Record<string, unknown>
    oldNameToNewName: Record<string, string>
}): Record<string, unknown> {
    const step = pieceAction({ name: Object.keys(oldNameToNewName)[0], input })
    const cloned = addActionUtils.clone(step, oldNameToNewName)
    if (cloned.type !== FlowActionType.PIECE) {
        throw new Error('expected the clone to stay a piece action')
    }
    return cloned.settings.input
}

describe('addActionUtils.clone step renaming', () => {
    it('renames the step reference inside a simple mustache mention', () => {
        const input = duplicatedInput({
            input: { text: 'Hello {{ step_1 }}' },
            oldNameToNewName: { step_1: 'step_2' },
        })
        expect(input.text).toBe('Hello {{ step_2 }}')
    })

    it('renames every reference when a token contains nested mustache expressions', () => {
        const input = duplicatedInput({
            input: { text: '{{ step_1 | default({{ trigger.x }}) + step_1 }}' },
            oldNameToNewName: { step_1: 'step_9' },
        })
        expect(input.text).toBe('{{ step_9 | default({{ trigger.x }}) + step_9 }}')
    })

    it('preserves a string literal that contains "}}" and still renames its step', () => {
        const input = duplicatedInput({
            input: { text: "{{ step_1['a}}b'] }}" },
            oldNameToNewName: { step_1: 'step_2' },
        })
        expect(input.text).toBe("{{ step_2['a}}b'] }}")
    })

    it('escapes regex metacharacters in the old step name', () => {
        const input = duplicatedInput({
            input: { text: '{{ a+b }}' },
            oldNameToNewName: { 'a+b': 'step_2' },
        })
        expect(input.text).toBe('{{ step_2 }}')
    })

    it('leaves text outside mustache mentions untouched', () => {
        const input = duplicatedInput({
            input: { text: 'step_1 stays as plain prose, {{ step_1 }} is renamed' },
            oldNameToNewName: { step_1: 'step_2' },
        })
        expect(input.text).toBe('step_1 stays as plain prose, {{ step_2 }} is renamed')
    })

    it('updates the cloned step name', () => {
        const step = pieceAction({ name: 'step_1', input: {} })
        const cloned = addActionUtils.clone(step, { step_1: 'step_2' })
        expect(cloned.name).toBe('step_2')
        expect(cloned.displayName).toBe('step_1 Copy')
    })
})
