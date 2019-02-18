import { createContainer, asClass, asFunction } from 'awilix'
import * as http from 'http';
import socketio, { Socket } from 'socket.io'
import socketio_client from 'socket.io-client'
import { adaptToMiddleware, scopePerRequest, makeInvoker, makeClassInvoker } from '../'
import { AddressInfo } from 'net';

class TestService {
  constructor({ serviceConstructor }: any) {
    /**/
  }
}

class TestClass {
  constructor({ testClassConstructor, testService }: any) {
    /**/
  }

  handle(socket: Socket) {
    socket.emit('success')
  }
}

function testFactoryFunction({
  testFactoryFunctionInvocation,
  testService
}: any) {
  return {
    handle(socket: Socket) {
      socket.emit('success')
    }
  }
}

function createServer(spies: any): Promise<http.Server> {
  const app = http.createServer();
  const io  = socketio(app);

  const container = createContainer()
    .register({
      testService: asClass(TestService).scoped()
    })
    // These will be registered as transient.
    .register(
      Object.keys(spies).reduce((obj: any, key) => {
        obj[key] = asFunction(spies[key])
        return obj
      }, {})
    )
  io.use(scopePerRequest(container))

  const fnAPI = makeInvoker(testFactoryFunction)
  const classAPI = makeClassInvoker(TestClass)
  io.on('connection', socket => {
    socket.on('function', fnAPI('handle'))
    socket.on('class', classAPI('handle'))
  })

  return new Promise((resolve, reject) => {
    let server: http.Server
    server = app.listen((err: any) => (err ? reject(err) : resolve(server)))
  })
}

describe('integration', function() {
  let client: SocketIOClient.Socket
  let server: http.Server
  let serviceConstructor: jest.Mock
  let testClassConstructor: jest.Mock
  let testFactoryFunctionInvocation: jest.Mock

  beforeEach(function(done) {
    serviceConstructor = jest.fn()
    testClassConstructor = jest.fn()
    testFactoryFunctionInvocation = jest.fn()
    const spies = {
      serviceConstructor,
      testClassConstructor,
      testFactoryFunctionInvocation
    }
    return createServer(spies).then(s => {
      server = s
      const addr = server.address()
      client = socketio_client(`http://localhost:${(addr as AddressInfo).port}`)
      done()
    })
  })

  afterEach(function(done) {
    client.disconnect()
    server.close()
    done()
  })

  describe('makeInvoker', function() {
    it('makes sure the spy is called once for each request', function(done) {
      client.on('success', () => {
        expect(testClassConstructor).not.toHaveBeenCalled()
        expect(testFactoryFunctionInvocation).toHaveBeenCalled()
        expect(serviceConstructor).toHaveBeenCalled()
        done()
      })
      client.emit('function')
    })
  })

  describe('makeClassInvoker', function() {
    it('makes sure the spy is called once for each request', function(done) {
      client.on('success', () => {
        expect(testFactoryFunctionInvocation).not.toHaveBeenCalled()
        expect(testClassConstructor).toHaveBeenCalled()
        expect(serviceConstructor).toHaveBeenCalled()
        done()
      })
      client.emit('class')
    })
  })
})
