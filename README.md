### About
Inspired by https://github.com/Marsup/hapi-mongodb, here's another mysql plugin that is based on node-mysql2 for hapijs that supports multiple connections. 

### Updates
- Starting from version 2, I've switched to using [node-mysql2](https://github.com/sidorares/node-mysql2)
- Starting from version 1.0.0 this plugin only supports Hapi version 17 and above. If you are using hapijs prior to version 17, please checkout version [0.9.5](https://github.com/midnightcodr/hapi-mysql2/tree/0.9.5)
- Starting from version 2.3.0 this plugin only supports Hapi version 18.2 and above. If you are using hapijs prior to that, please checkout version [2.2.5](https://github.com/midnightcodr/hapi-mysql2/tree/2.2.5)


### Options

- `decorate`: string or boolean, mixed use of different types of decorate settings are not allowed.

- `settings`: the options to initialize a pooling connection, can be either a string or object. For detail usage please refer to [https://github.com/mysqljs/mysql#pooling-connections](https://github.com/mysqljs/mysql#pooling-connections), note if you do not specify `connectionLimit` in settings, a default number of 10 will be used.

### Example

```javascript
/*
    Database preparation:
    create database if not exists test;
    create table if not exists info(id int unsigned auto_increment primary key, name varchar(50));
    insert into table info(name) values ('test1'), ('test 2'), ('3'), ('something else');
*/
const Hapi = require('@hapi/hapi')
const Boom = require('@hapi/boom')

const launchServer = async function() {
    const clientOpts = {
        settings: 'mysql://user:secret@localhost/test',
        decorate: true
    }
    const server = Hapi.Server({ port: 8080 })

    await server.register({
        plugin: require('hapi-mysql2'),
        options: clientOpts
    })

    server.route({
        method: 'GET',
        path: '/info',
        async handler(request) {
            const pool = request.mysql.pool

            try {
                const [rows, fields] = await pool.query('select * from test.info limit 10;')
                return rows
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
