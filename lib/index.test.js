'use strict'
const Hapi = require('hapi')
const mysql = require('mysql')

// not using beforeEach and share a
// server instance because one test
// might affect the results of others

const createServer = () => {
	return new Hapi.Server()
}

const getUrl = () => {
	return process.env.url || 'mysql://localhost/test'
}

test('should reject invalid options', () => {
	const server = createServer()
	server.register({
		register: require('./'),
		options: {
			ssettings: {}
		},
	}, (err) => {
		expect(err).toBeTruthy()
	})
})

test('should reject invalid url connection options', () => {
	const server = createServer()
	server.register({
		register: require('./'),
		options: {
			settings: 'mysql://localhost'
		},
	}, (err) => {
		expect(err).toBeInstanceOf(Error)
		expect(err.message).toEqual('Invalid connection URL')
	})
})

test('should reject invalid decorate', () => {
	const server = createServer()
	server.register({
		register: require('./'),
		options: {
			settings: 'mysql://localhost',
			decorate: 1
		},
	}, (err) => {
		expect(err).toBeTruthy()
	})
})

test('should be able to register plugin with just URL', () => {
	const server = createServer()
	server.register({
		register: require('./'),
		options: {
			settings: getUrl()
		},
	}, () => {
		const pool = server.plugins['hapi-mysql2'].pool
		expect(pool).toBeTruthy()
		pool.end()
	})
})

test('should log configuration upon successfull connection', () => {
	const server = createServer()
	let logEntry;
	server.once('log', (entry) => {
		logEntry = entry;
	});

	server.register({
		register: require('./'),
		options: {
			settings: 'mysql://localhost/test'
		}
	}, (err) => {

		if (err) {
			throw err
		}

		expect(logEntry).toMatchObject({
			timestamp: logEntry.timestamp,
			tags: ['hapi-mysql2', 'info'],
			data: expect.stringMatching(/^hapi connection created for/),
			internal: false
		});
		server.plugins['hapi-mysql2'].pool.end()
	});
});


test('should be able to find the plugin on exposed objects', () => {
	const server = createServer()
	server.connection()
	server.register({
		register: require('./'),
		options: {
			settings: getUrl()
		}
	}, (err) => {
		expect(err).toBeFalsy()

		server.route({
			method: 'GET',
			path: '/',
			handler: (request, reply) => {
				const plugin = request.server.plugins['hapi-mysql2']
				expect(plugin.pool).toBeTruthy()
				expect(plugin.lib).toBeTruthy()
				reply('.')
			}
		})
		server.inject({
			validate: false,
			method: 'GET',
			url: '/'
		}, () => {
			server.plugins['hapi-mysql2'].pool.end()
		})
	})
})

test('should be able to find the plugin on decorated objects', () => {
	const server = createServer()
	server.connection()
	server.register({
		register: require('./'),
		options: {
			settings: getUrl(),
			decorate: true
		}
	}, (err) => {
		expect(err).toBeFalsy()

		server.route({
			method: 'GET',
			path: '/',
			handler: (request, reply) => {
				const plugin = request.server.mysql
				expect(plugin.pool).toBeTruthy()
				expect(plugin.lib).toBeTruthy()
				reply('.')
			}
		})
		server.inject({
			validate: false,
			method: 'GET',
			url: '/'
		}, () => {
			server.mysql.pool.end()
		})
	})
})

test('should be able to find the plugin on custom decorated objects', () => {
	const server = createServer()
	server.connection()
	server.register({
		register: require('./'),
		options: {
			settings: getUrl(),
			decorate: 'testMysql'
		}
	}, (err) => {
		expect(err).toBeFalsy()

		server.route({
			method: 'GET',
			path: '/',
			handler: (request, reply) => {
				const plugin = request.server.testMysql
				expect(plugin.pool).toBeTruthy()
				expect(plugin.lib).toBeTruthy()
				reply('.')
			}
		})
		server.inject({
			validate: false,
			method: 'GET',
			url: '/'
		}, () => {
			server.testMysql.pool.end()
		})
	})
})

test('should be able to find the plugin on custom multiple decorated objects', () => {
	const server = createServer()
	server.connection()
	server.register({
		register: require('./'),
		options: [{
			settings: getUrl(),
			decorate: 'testMysql1'
		}, {
			settings: getUrl(),
			decorate: 'testMysql2'
		}]
	}, (err) => {
		expect(err).toBeFalsy()

		server.route({
			method: 'GET',
			path: '/multiple',
			handler: (request, reply) => {
				const testMysql1 = request.server.testMysql1
				const testMysql2 = request.server.testMysql2
				expect(testMysql1.pool).toBeTruthy()
				expect(testMysql1.lib).toBeTruthy()

				expect(testMysql2.pool).toBeTruthy()
				expect(testMysql2.lib).toBeTruthy()
				reply('.')
			}
		})
		server.inject({
			validate: false,
			method: 'GET',
			url: '/multiple'
		}, () => {
			server.testMysql1.pool.end()
			server.testMysql2.pool.end()
		})
	})
})

test('should fail to mix different decorations', () => {
	const server = createServer()
	server.register({
		register: require('./'),
		options: [{
			settings: getUrl(),
			decorate: true
		}, {
			settings: getUrl(),
			decorate: 'testMysql'
		}]
	}, (err) => {
		expect(err).toBeInstanceOf(Error)
		expect(err.message).toEqual('You cannot mix different types of decorate options')
	})
})
