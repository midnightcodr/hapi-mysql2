'use strict'
const Hapi = require('@hapi/hapi')
const Lab = require('@hapi/lab')
const { expect } = require('@hapi/code')
const lab = (exports.lab = Lab.script())

const getUrl = () => {
  return 'mysql://dbuser@dbhost/dbname'
}

lab.experiment('#hapi-mysql2 tests', () => {
  let server

  lab.beforeEach(async () => {
    server = Hapi.Server()
  })
  lab.test('should reject invalid options', async () => {
    try {
      await server.register({
        plugin: require('./'),
        options: {
          ssettings: {}
        }
      })
    } catch (err) {
      expect(err).to.exist()
    }
  })

  lab.test('should reject invalid url without hostname', async () => {
    try {
      await server.register({
        plugin: require('./'),
        options: {
          settings: 'mysql://'
        }
      })
    } catch (err) {
      expect(err).to.exist()
      expect(err.message).to.equal('Invalid connection URL')
    }
  })
  lab.test('should reject invalid url without pathname', async () => {
    try {
      await server.register({
        plugin: require('./'),
        options: {
          settings: 'mysql://localhost'
        }
      })
    } catch (err) {
      expect(err).to.exist()
      expect(err.message).to.equal('Invalid connection URL')
    }
  })

  lab.test('should reject invalid decorate', async () => {
    try {
      await server.register({
        plugin: require('./'),
        options: {
          settings: 'mysql://localhost',
          decorate: 1
        }
      })
    } catch (err) {
      expect(err).to.exist()
    }
  })

  lab.test('should be able to register plugin with just URL', async () => {
    await server
      .register({
        plugin: require('./'),
        options: {
          settings: getUrl()
        }
      })
      .then(async () => {
        const pool = server.plugins['hapi-mysql2'].pool
        expect(server.registrations['hapi-mysql2']).to.exist()
        await pool.end()
      })
  })

  lab.test('should log configuration upon successful connection', async () => {
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

    expect(logEntry).to.equal(
      {
        channel: 'app',
        timestamp: logEntry.timestamp,
        tags: ['hapi-mysql2', 'info'],
        data: `hapi connection created for dbuser@dbhost/dbname`
      },
      { prototype: false }
    )
    await server.plugins['hapi-mysql2'].pool.end()
  })

  lab.test('should be able to find the plugin on exposed objects', async () => {
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
        expect(plugin.pool).to.exist()
        expect(plugin.lib).to.exist()
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

  lab.test(
    'should be able to find the plugin on decorated objects',
    async () => {
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
          expect(plugin.pool).to.exist()
          expect(plugin.lib).to.exist()
          return null
        }
      })
      await server.inject({
        validate: false,
        method: 'GET',
        url: '/'
      })
      server.mysql.pool.end()
    }
  )

  lab.test(
    'should be able to find the plugin on custom decorated objects',
    async () => {
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
          expect(plugin.pool).to.exist()
          expect(plugin.lib).to.exist()
          return '.'
        }
      })
      await server.inject({
        validate: false,
        method: 'GET',
        url: '/'
      })
      await server.testMysql.pool.end()
    }
  )

  lab.test(
    'should be able to find the plugin on custom multiple decorated objects',
    async () => {
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
          expect(testMysql1.pool).to.exist()
          expect(testMysql1.lib).to.exist()

          expect(testMysql2.pool).to.exist()
          expect(testMysql2.lib).to.exist()
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
    }
  )

  lab.test('should fail to mix different decorations', async () => {
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
      expect(err).to.exist()
      expect(err.message).to.equal(
        'You cannot mix different types of decorate options'
      )
    }
  })

  lab.test('should shut down pool when server stops', async () => {
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
    expect(logEntry).to.equal(
      {
        channel: 'app',
        timestamp: logEntry.timestamp,
        tags: ['hapi-mysql2', 'info'],
        data: 'ending mysql connection pool for dbuser@dbhost/dbname'
      },
      { prototype: false }
    )
  })
})
