import { AwilixContainer } from 'awilix'
import { Socket } from 'socket.io';

/**
 * Socket.io middleware factory that will create and attach
 * a scope onto a content.
 *
 * @param  {AwilixContainer} container
 * @return {Function}
 */
export function scopePerRequest(container: AwilixContainer) {
  return function scopePerRequestMiddleware(socket: Socket, next: (err?: any) => void) {
    (socket as Socket & { container: AwilixContainer }).container = container.createScope()
    return next()
  }
}
