Inspired by https://github.com/Marsup/hapi-mongodb, here's another simple
mysql plugin for hapijs that supports multiple connections.


Usage example: 

```javascript
const Hapi = require('hapi');
const Boom = require('boom');

const clientOpts = {
    settings: 'mysql://user:secret@localhost/test?insecureAuth=true',
    decorate: true
};

const server = new Hapi.Server();
server.connection({ port: 8000 });

server.register({
    register: require('./lib'),
    options: clientOpts
}, function (err) {
    if (err) {
        console.error(err);
        throw err;
    }

    server.route({
        method: 'GET',
        path: '/mysql',
        handler(request, reply) {
            const pool = request.mysql.pool;

            pool.query('select 1 as counter', (err, result) => {
                if(err) {
                    console.log(err);
                    return reply(Boom.internal('Internal Mysql Error'));
                }
                reply({result});
            })
        }
    });

    server.start(function() {
        console.log(`Server started at ${server.info.uri}`);
    });
});
```

Test instruction:
```
url=mysql://someuser:somepass@somehost/test npm test
```
