Inspired by https://github.com/Marsup/hapi-mongodb, here's another simple
mysql plugin for hapijs that supports multiple connections.

Update: Starting from version 1.0.0 this plugin only supports Hapi version 17 and above. If you are using hapijs prior to version 17, please checkout version [0.9.5](https://github.com/midnightcodr/hapi-mysql2/tree/0.9.5)

Usage example: 

```javascript
const Hapi = require('hapi')
const Boom = require('boom')

const launchServer = async function() {
    const clientOpts = {
        settings: 'mysql://user:secret@localhost/test?insecureAuth=true',
        decorate: true
    }
    const server = Hapi.Server({ port: 8080 })

    await server.register({
        plugin: require('hapi-mysql2'),
        options: clientOpts
    })

    server.route({
        method: 'GET',
        path: '/mysql',
        async handler(request) {
            const pool = request.mysql.pool

            try {
                result = await pool.query('select 1 as counter')
                return result
            } catch (err) {
                throw Boom.internal('Internal Mysql Error', err)
            }
        }
    })

    await server.start()
    console.log(`Server started at ${server.info.uri}`)
}

launchServer().catch(err => {
    console.error(err)
    process.exit(1)
})

```

See [lib/index.test.js](lib/index.test.js) for more usage examples.
