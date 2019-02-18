import { createContainer, AwilixContainer } from 'awilix'
import { Socket } from 'socket.io'
import { scopePerRequest } from '../scope-per-request'

describe('scopePerRequest', function() {
  it('returns a middleware that creates a scope and attaches it to a context + calls next', function() {
    const container = createContainer()
    const middleware = scopePerRequest(container)
    const next = jest.fn(() => 42)
    const socket = { } as Socket & { container: AwilixContainer }
    const result = middleware(socket, next)
    expect(socket.container).toBeDefined()
    expect(result).toEqual(42)
  })
})
