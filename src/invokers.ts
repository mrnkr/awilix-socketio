import {
  asFunction,
  Resolver,
  AwilixContainer,
  ResolverOptions,
  Constructor,
  asClass,
  ClassOrFunctionReturning,
  FunctionReturning
} from 'awilix'
import { isClass } from 'awilix/lib/utils'
import assert from 'assert'
import { Socket } from 'socket.io'

type MethodName = string | number | null;

/**
 * Creates either a function invoker or a class invoker, based on whether
 * the argument can be classified as a class or not. Uses Awilix' `isClass` utility.
 *
 * @param functionOrClass
 * The function or class to invoke.
 *
 * @param opts
 * Resolver options for the class/function.
 */
export function makeInvoker<T>(
  functionOrClass: ClassOrFunctionReturning<T>,
  opts?: ResolverOptions<T>
) {
  return isClass(functionOrClass)
    ? /*tslint:disable-next-line*/
      makeClassInvoker(functionOrClass as Constructor<T>, opts)
    : /*tslint:disable-next-line*/
      makeFunctionInvoker(functionOrClass as FunctionReturning<T>, opts)
}

/**
 * Returns a function that when called with a name,
 * returns another function to be used as Koa middleware.
 * That function will run `fn` with the container cradle as the
 * only parameter, and then call the `methodToInvoke` on
 * the result.
 *
 * @param, {Function} fn
 * @return {(methodToInvoke: string) => (...args) => void}
 */
export function makeFunctionInvoker<T>(
  fn: FunctionReturning<T>,
  opts?: ResolverOptions<T>
) {
  return makeResolverInvoker(asFunction(fn, opts))
}

/**
 * Same as `makeInvoker` but for classes.
 *
 * @param  {Class} Class
 * @return {(methodToInvoke: string) => (...args) => void}
 */
export function makeClassInvoker<T>(
  Class: Constructor<T>,
  opts?: ResolverOptions<T>
) {
  return makeResolverInvoker(asClass(Class, opts))
}

/**
 * Returns a function that when called with a method name,
 * returns another function to be used as Koa middleware.
 * That function will run `container.build(resolver)`, and
 * then call the method on the result, passing in the Koa context
 * and `next()`.
 *
 * @param, {Resolver} resolver
 * @return {(methodToInvoke: string) => (...args) => void}
 */
export function makeResolverInvoker<T>(resolver: Resolver<T>) {
  /**
   * 2nd step is to create a method to invoke on the result
   * of the resolver.
   *
   * @param  {MethodName} methodToInvoke
   * @return {(...args) => void}
   */
  return function makeMemberInvoker(methodToInvoke: MethodName) {
    /**
     * The invoker middleware.
     *
     * @param  {Socket & { container: AwilixContainer }} this
     * @param  {...*} rest
     * @return {*}
     */
    return function memberInvoker(this: Socket & { container: AwilixContainer }, ...rest: any[]) {
      const container = this.container
      const resolved: any = container.build(resolver)
      assert(
        methodToInvoke,
        `methodToInvoke must be a valid method type, such as string, number or symbol, but was ${String(
          methodToInvoke
        )}`
      )
      return resolved[methodToInvoke!](this, ...rest)
    }
  }
}

/**
 * Receives a member invoker and turns the event handler it returns into Socket.io middleware
 * Implementation is flexible in terms of arguments other than the socket but in reality there will
 * only be one other argument (the next callback)
 *
 * @export
 * @param {((this: Socket & { container: AwilixContainer }, ...rest: any[]) => any)} memberInvoker
 * @returns {*}
 */
export function adaptToMiddleware(memberInvoker: (this: Socket & { container: AwilixContainer }, ...rest: any[]) => any) {
  return function middlewareInvoker(socket: Socket, ...rest: any[]) {
    return memberInvoker.bind(socket as Socket & { container: AwilixContainer })(...rest)
  }
}

/**
 * Injects dependencies into the middleware factory when the middleware is invoked.
 *
 * @param factory
 */
export function inject(factory: ClassOrFunctionReturning<any> | Resolver<any>) {
  const resolver = getResolver(factory)
  /**
   * The invoker middleware.
   */
  return function middlewareFactoryHandler(socket: Socket & { container: AwilixContainer }, ...rest: any[]) {
    const container = socket.container
    const resolved: any = container.build(resolver)
    return resolved(socket, ...rest)
  }
}

/**
 * Wraps or returns a resolver.
 */
function getResolver<T>(
  arg: ClassOrFunctionReturning<T> | Resolver<T>
): Resolver<T> {
  if (typeof arg === 'function') {
    /*tslint:disable-next-line*/
    return asFunction(arg as any)
  }

  return arg
}
