'use strict'
const Hapi = require('hapi')

// not using beforeEach and share a
// server instance because one test
// might affect the results of others

const createServer = () => {
    return new Hapi.Server()
}

const getUrl = () => {
    return process.env.url || 'mysql://localhost/test'
}

test('should reject invalid options', async () => {
    expect.assertions(1)
    const server = createServer()
    try {
        await server.register({
            plugin: require('./'),
            options: {
                ssettings: {}
            }
        })
    } catch (err) {
        expect(err).toBeTruthy()
    }
})

test('should reject invalid url connection options', async () => {
    expect.assertions(2)
    const server = createServer()
    try {
        await server.register({
            plugin: require('./'),
            options: {
                settings: 'mysql://localhost'
            }
        })
    } catch (err) {
        expect(err).toBeInstanceOf(Error)
        expect(err.message).toEqual('Invalid connection URL')
    }
})

test('should reject invalid decorate', async () => {
    expect.assertions(1)
    const server = createServer()
    try {
        await server.register({
            plugin: require('./'),
            options: {
                settings: 'mysql://localhost',
                decorate: 1
            }
        })
    } catch (err) {
        expect(err).toBeTruthy()
    }
})

test('should be able to register plugin with just URL', async () => {
    expect.assertions(2)
    const server = createServer()
    await server
        .register({
            plugin: require('./'),
            options: {
                settings: getUrl()
            }
        })
        .then(() => {
            const pool = server.plugins['hapi-mysql2'].pool
            expect(server.registrations['hapi-mysql2']).toBeTruthy()
            expect(pool).toBeTruthy()
            pool.end()
        })
})

test('should log configuration upon successfull connection', async () => {
    expect.assertions(1)
    const server = createServer()
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

    expect(logEntry).toMatchObject({
        channel: 'app',
        timestamp: logEntry.timestamp,
        tags: ['hapi-mysql2', 'info'],
        data: expect.stringMatching(/^hapi connection created for/)
    })
    server.plugins['hapi-mysql2'].pool.end()
})

test('should be able to find the plugin on exposed objects', async () => {
    expect.assertions(2)
    const server = createServer()
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
            expect(plugin.pool).toBeTruthy()
            expect(plugin.lib).toBeTruthy()
            return '.'
        }
    })
    await server.inject({
        validate: false,
        method: 'GET',
        url: '/'
    })
    server.plugins['hapi-mysql2'].pool.end()
})

test('should be able to find the plugin on decorated objects', async () => {
    expect.assertions(2)
    const server = createServer()
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
            expect(plugin.pool).toBeTruthy()
            expect(plugin.lib).toBeTruthy()
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

test('should be able to find the plugin on custom decorated objects', async () => {
    expect.assertions(2)
    const server = createServer()
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
            expect(plugin.pool).toBeTruthy()
            expect(plugin.lib).toBeTruthy()
            return '.'
        }
    })
    await server.inject({
        validate: false,
        method: 'GET',
        url: '/'
    })
    server.testMysql.pool.end()
})

test('should be able to find the plugin on custom multiple decorated objects', async () => {
    expect.assertions(4)
    const server = createServer()
    const res = await server.register({
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
            expect(testMysql1.pool).toBeTruthy()
            expect(testMysql1.lib).toBeTruthy()

            expect(testMysql2.pool).toBeTruthy()
            expect(testMysql2.lib).toBeTruthy()
            return null
        }
    })

    await server.inject({
        validate: false,
        method: 'GET',
        url: '/multiple'
    })
    server.testMysql1.pool.end()
    server.testMysql2.pool.end()
})

test('should fail to mix different decorations', async () => {
    expect.assertions(2)
    const server = createServer()
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
        expect(err).toBeInstanceOf(Error)
        expect(err.message).toEqual(
            'You cannot mix different types of decorate options'
        )
    }
})

test('should shut down pool when server stops', async () => {
    expect.assertions(1)
    const server = createServer()
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
    expect(logEntry).toMatchObject({
        channel: 'app',
        timestamp: logEntry.timestamp,
        tags: ['hapi-mysql2', 'info'],
        data: expect.stringMatching(/^ending mysql connection pool/)
    })
})
