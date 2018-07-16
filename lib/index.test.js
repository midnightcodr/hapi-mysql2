/* global beforeEach, describe, it */
'use strict'
const chai = require('chai')
const expect = chai.expect
chai.use(require('chai-shallow-deep-equal'))
const Hapi = require('hapi')
let server

beforeEach(async () => {
  server = Hapi.Server()
})

const getUrl = () => {
  return process.env.url || 'mysql://localhost/test'
}

describe('#hapi-mysql2 tests', () => {
  it('should reject invalid options', async () => {
    try {
      await server.register({
        plugin: require('./'),
        options: {
          ssettings: {}
        }
      })
    } catch (err) {
      expect(err).to.be.an('error')
    }
  })

  it('should reject invalid url connection options', async () => {
    try {
      await server.register({
        plugin: require('./'),
        options: {
          settings: 'mysql://localhost'
        }
      })
    } catch (err) {
      expect(err).to.be.an('error')
      expect(err.message).to.equal('Invalid connection URL')
    }
  })

  it('should reject invalid decorate', async () => {
    try {
      await server.register({
        plugin: require('./'),
        options: {
          settings: 'mysql://localhost',
          decorate: 1
        }
      })
    } catch (err) {
      expect(err).to.be.an('error')
    }
  })

  it('should be able to register plugin with just URL', async () => {
    await server
      .register({
        plugin: require('./'),
        options: {
          settings: getUrl()
        }
      })
      .then(async () => {
        const pool = server.plugins['hapi-mysql2'].pool
        expect(server.registrations).to.have.property('hapi-mysql2')
        await pool.end()
      })
  })

  it('should log configuration upon successfull connection', async () => {
    let logEntry
    server.events.once('log', entry => {
      logEntry = entry
    })

    await server.register({
      plugin: require('./'),
      options: {
        settings: getUrl()
      }
    })

    expect(logEntry).to.shallowDeepEqual({
      channel: 'app',
      timestamp: logEntry.timestamp,
      tags: ['hapi-mysql2', 'info']
    })
    expect(logEntry.data).to.match(/^hapi connection created for/)
    await server.plugins['hapi-mysql2'].pool.end()
  })

  it('should be able to find the plugin on exposed objects', async () => {
    await server.register({
      plugin: require('./'),
      options: {
        settings: getUrl()
      }
    })

    server.route({
      method: 'GET',
      path: '/',
      handler: request => {
        const plugin = request.server.plugins['hapi-mysql2']
        expect(plugin).to.have.property('pool')
        expect(plugin).to.have.property('lib')
        return '.'
      }
    })
    await server.inject({
      validate: false,
      method: 'GET',
      url: '/'
    })
    await server.plugins['hapi-mysql2'].pool.end()
  })

  it('should be able to find the plugin on decorated objects', async () => {
    await server.register({
      plugin: require('./'),
      options: {
        settings: getUrl(),
        decorate: true
      }
    })

    server.route({
      method: 'GET',
      path: '/',
      handler: request => {
        const plugin = request.server.mysql
        expect(plugin).to.have.property('pool')
        expect(plugin).to.have.property('lib')
        return null
      }
    })
    await server.inject({
      validate: false,
      method: 'GET',
      url: '/'
    })
    server.mysql.pool.end()
  })

  it('should be able to find the plugin on custom decorated objects', async () => {
    await server.register({
      plugin: require('./'),
      options: {
        settings: getUrl(),
        decorate: 'testMysql'
      }
    })
    server.route({
      method: 'GET',
      path: '/',
      handler: request => {
        const plugin = request.server.testMysql
        expect(plugin).to.have.property('pool')
        expect(plugin).to.have.property('lib')
        return '.'
      }
    })
    await server.inject({
      validate: false,
      method: 'GET',
      url: '/'
    })
    await server.testMysql.pool.end()
  })

  it('should be able to find the plugin on custom multiple decorated objects', async () => {
    await server.register({
      plugin: require('./'),
      options: [
        {
          settings: getUrl(),
          decorate: 'testMysql1'
        },
        {
          settings: getUrl(),
          decorate: 'testMysql2'
        }
      ]
    })

    server.route({
      method: 'GET',
      path: '/multiple',
      handler: request => {
        const testMysql1 = request.server.testMysql1
        const testMysql2 = request.server.testMysql2
        expect(testMysql1).to.have.property('pool')
        expect(testMysql1).to.have.property('lib')

        expect(testMysql2).to.have.property('pool')
        expect(testMysql2).to.have.property('lib')
        return null
      }
    })

    await server.inject({
      validate: false,
      method: 'GET',
      url: '/multiple'
    })
    await server.testMysql1.pool.end()
    await server.testMysql2.pool.end()
  })

  it('should fail to mix different decorations', async () => {
    try {
      await server.register({
        plugin: require('./'),
        options: [
          {
            settings: getUrl(),
            decorate: true
          },
          {
            settings: getUrl(),
            decorate: 'testMysql'
          }
        ]
      })
    } catch (err) {
      expect(err).to.be.an('error')
      expect(err.message).to.equal(
        'You cannot mix different types of decorate options'
      )
    }
  })

  it('should shut down pool when server stops', async () => {
    let logEntry
    server.events.on('log', entry => {
      logEntry = entry
    })
    await server.register({
      plugin: require('./'),
      options: [
        {
          settings: getUrl(),
          decorate: true
        }
      ]
    })
    await server.stop()
    expect(logEntry).to.shallowDeepEqual({
      channel: 'app',
      timestamp: logEntry.timestamp,
      tags: ['hapi-mysql2', 'info']
    })
    expect(logEntry.data).to.match(/^ending mysql connection pool/)
  })
})
