# awilix-socketio

[![gitter](https://badges.gitter.im/Join%20Chat.svg)](https://gitter.im/mrnkr/awilix-socketio?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)
[![NPM version](https://img.shields.io/npm/v/awilix-socketio.svg?style=flat-square)](https://www.npmjs.com/package/awilix-socketio)
[![Build](https://travis-ci.org/mrnkr/awilix-socketio.svg?branch=master)](https://travis-ci.org/mrnkr/awilix-socketio)
[![codecov.io](https://codecov.io/github/mrnkr/awilix-socketio/coverage.svg?branch=master)](https://codecov.io/github/mrnkr/awilix-socketio?branch=master)
[![js-standard-style](https://img.shields.io/badge/code%20style-standard-brightgreen.svg)](http://standardjs.com/)
[![Twitter Follow][twitter-image]][twitter-url]

[twitter-image]:https://img.shields.io/twitter/follow/xmr_nkr.svg?style=social&label=Follow%20me
[twitter-url]:https://twitter.com/xmr_nkr

Awilix helpers and scope-instantiating middleware for **Socket.io**. 🐨

# Table of Contents

- [Installation](#installation)
- [Basic Usage](#basic-usage)
- [Why do I need it?](#why-do-i-need-it)
  - [Manual](#manual)
  - [Using awilix-socketio](#using-awilix-socketio)
- [API](#api)
- [Contributing](#contributing)
  - [npm run scripts](#npm-run-scripts)
- [Author](#author)

# Installation

```
npm install awilix-socketio
```

_Requires Node v6 or above_

# Basic Usage

Add the middleware to your Socket.io app.

```js
const { asClass, asValue, createContainer } = require('awilix')
const { scopePerRequest } = require('awilix-socketio')

const container = createContainer()
container.register({
  // Scoped lifetime = new instance per request
  // Imagine the TodosService needs a `user`.
  // class TodosService { constructor({ user }) { } }
  todosService: asClass(TodosService).scoped()
})

// Add the middleware, passing it your Awilix container.
// This will attach a scoped container on the socket instance.
io.use(scopePerRequest(container))

// Now you can add request-specific data to the scope.
io.use((socket, next) => {
  socket.container.register({
    user: asValue(socket.request.user) // from some authentication middleware..
  })
  return next()
})
```

Then in your event handlers...

```js
const { makeInvoker } = require('awilix-socketio')

function makeAPI({ todosService }) {
  return {
    find: (socket) => {
      return todosService.find().then(result => {
        socket.emit('response', result)
      })
    }
  }
}

const api = makeInvoker(makeAPI)

// Creates middleware that will invoke `makeAPI`
// for each request, giving you a scoped instance.
io.on('find', api('find'))
```

# Why do I need it?

You can certainly use Awilix with Socket.io without this library, but follow along and you might see why it's useful.

Imagine this simple imaginary Todos app, written in ES6:

```js
// A totally framework-independent piece of application code.
// Nothing here is remotely associated with HTTP, Koa or anything.
class TodosService {
  constructor({ currentUser, db }) {
    // We depend on the current user!
    this.currentUser = currentUser
    this.db = db
  }

  getTodos() {
    // use your imagination ;)
    return this.db('todos').where('user', this.currentUser.id)
  }
}

// Here's a Koa API that calls the service
class TodoAPI {
  constructor({ todosService }) {
    this.todosService = todosService
  }
  getTodos(socket) {
    return this.todosService.getTodos().then(todos => socket.emit('response', todos))
  }
}
```

So the problem with the above is that the `TodosService` needs a `currentUser` for it to function. Let's first try solving this manually, and then with `awilix-socketio`.

## Manual

This is how you would have to do it without Awilix at all.

```js
import db from './db'

io.on('todos', () => {
  // We need a new instance for each request,
  // else the currentUser trick wont work.
  // this should point to the socket instance
  const api = new TodoAPI({
    todosService: new TodosService({
      db,
      // current user is request specific.
      currentUser: this.request.user
    })
  })

  // invoke the method.
  return api.getTodos(this)
})
```

Let's do this with Awilix instead. We'll need a bit of setup code.

```js
import { asValue, createContainer, Lifetime } from 'awilix'

const container = createContainer()

// The `TodosService` lives in services/TodosService
container.loadModules(['services/*.js'], {
  // we want `TodosService` to be registered as `todosService`.
  formatName: 'camelCase',
  resolverOptions: {
    // We want instances to be scoped to the Socket.io event.
    // We need to set that up.
    lifetime: Lifetime.SCOPED
  }
})

// imagination is a wonderful thing.
io.use(someAuthenticationMethod())

// We need a middleware to create a scope per request.
// Hint: that's the scopePerRequest middleware in `awilix-socketio` ;)
io.use((socket, next) => {
  // We want a new scope for each request!
  socket.container = container.createScope()
  // The `TodosService` needs `currentUser`
  socket.container.register({
    currentUser: asValue(socket.request.user) // from auth middleware.. IMAGINATION!! :D
  })
  return next()
})
```

Okay! Let's try setting up that API again!

```js
io.on('todos', () => {
  // We have our scope available!
  const api = new TodoAPI(this.container.cradle) // Awilix magic!
  return api.getTodos(this)
})
```

A lot cleaner, but we can make this even shorter!

```js
// Just invoke `api` with the method name and
// you've got yourself a middleware that instantiates
// the API and calls the method.
const api = methodName => {
  // create our handler
  return function() {
    const controller = new TodoAPI(this.container.cradle)
    return controller[method](this)
  }
}

// adding more events is way easier!
io.on('todos', api('getTodos'))
```

## Using `awilix-socketio`

In our event handler, do the following:

```js
import { makeInvoker } from 'awilix-socketio'

const api = makeInvoker(TodoAPI)
io.on('todos', api('getTodos'))
```

And in your Socket.io setup:

```js
import { asValue, createContainer, Lifetime } from 'awilix'
import { scopePerRequest } from 'awilix-socketio'

const container = createContainer()

// The `TodosService` lives in services/TodosService
container.loadModules(
  [
    ['services/*.js', Lifetime.SCOPED] // shortcut to make all services scoped
  ],
  {
    // we want `TodosService` to be registered as `todosService`.
    formatName: 'camelCase'
  }
)

// imagination is a wonderful thing.
app.use(someAuthenticationMethod())

// Woah!
app.use(scopePerRequest(container))
app.use((socket, next) => {
  // We still want to register the user!
  // socket.container is a scope!
  socket.container.register({
    currentUser: asValue(socket.request.user) // from auth middleware.. IMAGINATION!! :D
  })
})
```

Now **that** is way simpler!

```js
import { makeInvoker } from 'awilix-socketio'

function makeTodoAPI({ todosService }) {
  return {
    getTodos: socket => {
      return todosService.getTodos().then(todos => socket.emit('response', todos))
    }
  }
}

const api = makeInvoker(makeTodoAPI)
io.on('todos', api('getTodos'))
```

That concludes the tutorial! Hope you find it useful, I know I have.

# API

The package exports the following **Socket.io handler factories**:

- `scopePerRequest(container)`: creates a scope per request.
- `makeInvoker(functionOrClass, opts)(methodName)`: using `isClass`, calls either `makeFunctionInvoker` or `makeClassInvoker`.
- `makeClassInvoker(Class, opts)(methodName)`: resolves & calls `methodName` on the resolved instance, passing it the socket and the arguments you put in.
- `makeFunctionInvoker(function, opts)(methodName)`: resolves & calls `methodName` on the resolved instance, passing it the socket and the arguments you put in.
- `makeResolverInvoker(resolver, opts)`: used by the other invokers, exported for convenience.
- `adaptToMiddleware(memberInvoker)`: Handlers in Socket.io receive any kind of argument and have `this` to reference the socket. Middleware, on the other hand, receive (socket, next). This turns handlers into middleware seamlessly.
- `inject(middlewareFactory)`: resolves the middleware per request.
  ```js
  app.use(
    inject(({ userService }) => (socket, ...args) => {
      /**/
    })
  )
  ```

# Contributing

## `npm run` scripts

- `npm run test`: Runs tests once
- `npm run lint`: Lints + formats the code once
- `npm run cover`: Runs code coverage using `istanbul`

# Author

Alvaro Nicoli - [@xmr_nkr](https://twitter.com/xmr_nkr)

# Based on

- [Awilix-Koa](https://github.com/jeffijoe/awilix-koa)
