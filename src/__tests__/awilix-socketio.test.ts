import * as awilixSocketio from '../'

describe('awilix-socketio', function() {
  it('exists', function() {
    expect(awilixSocketio).toBeDefined()
    expect(awilixSocketio.scopePerRequest).toBeDefined()
    expect(awilixSocketio.makeInvoker).toBeDefined()
    expect(awilixSocketio.makeClassInvoker).toBeDefined()
  })
})
