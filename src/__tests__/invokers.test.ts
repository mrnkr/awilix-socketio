import { createContainer, AwilixContainer, asValue, asFunction } from 'awilix'
import { Socket } from 'socket.io'
import { makeClassInvoker, makeFunctionInvoker, inject, makeInvoker, adaptToMiddleware } from '../invokers'

describe('invokers', function() {
  let container: AwilixContainer
  let methodSpy: jest.Mock
  let factorySpy: jest.Mock
  let constructorSpy: jest.Mock
  let socket: Socket & { container: AwilixContainer }

  beforeEach(function() {
    factorySpy = jest.fn()
    constructorSpy = jest.fn()
    methodSpy = jest.fn()
    container = createContainer()
    container.register('param', asValue(42))
    socket = { container } as any
  })

  describe('makeFunctionInvoker', function () {
    it('returns callable handler after determining passed arg is a factory function', function () {
      function target({ param }: any) {
        factorySpy()
        const obj = {
          method(socket: Socket) {
            methodSpy()
            expect(this).toBe(obj)
            return [socket, param]
          }
        }
        return obj
      }

      const invoker = makeInvoker(target)

      // Call it twice.
      invoker('method').bind(socket)()
      const result = invoker('method').bind(socket)()

      expect(result).toEqual([socket, 42])
      expect(factorySpy).toHaveBeenCalledTimes(2)
      expect(methodSpy).toHaveBeenCalledTimes(2)
    })

    it('returns callable handler calling makeFunctionInvoker directly', function () {
      function target({ param }: any) {
        factorySpy()
        const obj = {
          method(socket: Socket) {
            methodSpy()
            expect(this).toBe(obj)
            return [socket, param]
          }
        }
        return obj
      }

      const invoker = makeFunctionInvoker(target)

      // Call it twice.
      invoker('method').bind(socket)()
      const result = invoker('method').bind(socket)()

      expect(result).toEqual([socket, 42])
      expect(factorySpy).toHaveBeenCalledTimes(2)
      expect(methodSpy).toHaveBeenCalledTimes(2)
    })
  })

  describe('makeClassInvoker', function() {
    it('returns callable handler after determining passed arg is a class', function() {
      class Target {
        param: any
        constructor({ param }: any) {
          constructorSpy()
          this.param = param
        }

        method(socket: Socket, additional: any) {
          methodSpy()
          expect(this).toBeInstanceOf(Target)
          return [socket, this.param, additional]
        }
      }

      const invoker = makeInvoker(Target)

      // Call it twice.
      invoker('method').bind(socket)('hello')
      const result = invoker('method').bind(socket)('hello')

      expect(result).toEqual([socket, 42, 'hello'])
      expect(constructorSpy).toHaveBeenCalledTimes(2)
      expect(methodSpy).toHaveBeenCalledTimes(2)
    })

    it('returns callable handler calling makeClassInvoker directly', function() {
      class Target {
        param: any
        constructor({ param }: any) {
          constructorSpy()
          this.param = param
        }

        method(socket: Socket, additional: any) {
          methodSpy()
          expect(this).toBeInstanceOf(Target)
          return [socket, this.param, additional]
        }
      }

      const invoker = makeClassInvoker(Target)

      // Call it twice.
      invoker('method').bind(socket)('hello')
      const result = invoker('method').bind(socket)('hello')

      expect(result).toEqual([socket, 42, 'hello'])
      expect(constructorSpy).toHaveBeenCalledTimes(2)
      expect(methodSpy).toHaveBeenCalledTimes(2)
    })
  })

  describe('adapt to middleware', function() {
    it('returns callable middleware', function() {
      function target({ param }: any) {
        factorySpy()
        const obj = {
          method(socket: Socket) {
            methodSpy()
            expect(this).toBe(obj)
            return [socket, param]
          }
        }
        return obj
      }

      const invoker = makeInvoker(target)
      const middleware = adaptToMiddleware(invoker('method'))

      middleware(socket)
      const result = middleware(socket, 'next()')

      expect(result).toEqual([socket, 42])
      expect(factorySpy).toHaveBeenCalledTimes(2)
      expect(methodSpy).toHaveBeenCalledTimes(2)
    })
  })

  describe('inject', () => {
    describe('passing a function', () => {
      it('converts function to resolver returns callable middleware', () => {
        const converted = inject(({ param }: any) => {
          constructorSpy()
          return (socket: Socket & { container: AwilixContainer }, additional: any) => {
            methodSpy()
            return [socket, param, additional]
          }
        })

        // Call it twice.
        converted(socket, 'hello')
        const result = converted(socket, 'hello')

        expect(result).toEqual([socket, 42, 'hello'])
        expect(constructorSpy).toHaveBeenCalledTimes(2)
        expect(methodSpy).toHaveBeenCalledTimes(2)
      })
    })

    describe('passing a resolver', () => {
      it('converts function to resolver returns callable middleware', () => {
        const converted = inject(
          asFunction(({ param }: any) => {
            constructorSpy()
            return (socket: Socket & { container: AwilixContainer }, additional: any) => {
              methodSpy()
              return [socket, param, additional]
            }
          })
        )

        // Call it twice.
        converted(socket, 'hello')
        const result = converted(socket, 'hello')

        expect(result).toEqual([socket, 42, 'hello'])
        expect(constructorSpy).toHaveBeenCalledTimes(2)
        expect(methodSpy).toHaveBeenCalledTimes(2)
      })
    })
  })
})
