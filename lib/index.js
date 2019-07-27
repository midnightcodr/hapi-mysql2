'use strict'

const mysql = require('mysql2/promise')
const Joi = require('@hapi/joi')

const singleOption = Joi.object({
  settings: [Joi.string().default('mysql://localhost/test'), Joi.object()],
  decorate: [true, Joi.string()]
})

const optionsSchema = Joi.array()
  .items(singleOption)
  .min(1)
  .single()

exports.plugin = {
  async register (server, pluginOptions) {
    let options
    try {
      options = await optionsSchema.validate(pluginOptions)
    } catch (err) {
      server.log(['hapi-mysql2', 'error'], err)
      throw err
    }

    const decorationTypes = new Set(
      options.map(option => typeof option.decorate)
    )
    if (decorationTypes.size > 1) {
      throw new Error('You cannot mix different types of decorate options')
    }

    const expose = {
      lib: mysql
    }

    async function connect (connectionOptions) {
      /* $lab:coverage:off$ */
      if (typeof connectionOptions.settings === 'string') {
        /* $lab:coverage:on$ */
        const connectConfig = new URL(connectionOptions.settings)
        if (!connectConfig.hostname || !connectConfig.pathname) {
          throw new Error('Invalid connection URL')
        }
      }
      const pool = await mysql.createPool(connectionOptions.settings)
      const { user, host, database } = pool.pool.config.connectionConfig
      const info = `${user}@${host}/${database}`

      server.log(['hapi-mysql2', 'info'], `hapi connection created for ${info}`)
      if (typeof connectionOptions.decorate === 'string') {
        const decoration = Object.assign({ pool }, expose)
        server.decorate('server', connectionOptions.decorate, decoration)
        server.decorate('request', connectionOptions.decorate, decoration)
      }
      return pool
    }
    let pools = []
    try {
      pools = await Promise.all(options.map(connect))
    } catch (err) {
      server.log(['hapi-mysql2', 'error'], err)
      throw err
    }
    expose.pool = options.length === 1 ? pools[0] : pools

    if (decorationTypes.has('boolean')) {
      server.decorate('server', 'mysql', expose)
      server.decorate('request', 'mysql', expose)
    } else if (decorationTypes.has('undefined')) {
      Object.keys(expose).forEach(key => {
        server.expose(key, expose[key])
      })
    }

    server.events.on('stop', () => {
      ;[].concat(expose.pool).forEach(pool => {
        try {
          const { user, host, database } = pool.pool.config.connectionConfig
          const info = `${user}@${host}/${database}`
          server.log(
            ['hapi-mysql2', 'info'],
            `ending mysql connection pool for ${info}`
          )
          pool.end()
        } catch (err) {
          /* $lab:coverage:off$ */
          server.log(['hapi-mysql2', 'error'], err)
          /* $lab:coverage:on$ */
        }
      })
    })
  },
  pkg: require('../package.json')
}
