'user strict';

const mysql = require('mysql');
const Joi = require('joi');
const Async = require('async');

const singleOption = Joi.object({
	settings: [
		Joi.string().default('mysql://localhost'),
		Joi.object()
	],
	decorate: [
		true, Joi.string()
	]
});

const optionsSchema = Joi.array().items(singleOption).min(1).single();

exports.register = (server, pluginOptions, next) => {
	optionsSchema.validate(pluginOptions, (err, options) => {
		if(err) {
			return next(err);
		}

		const decorationTypes = new Set(options.map((option) => typeof option.decorate));
		if (decorationTypes.size > 1) {
			return next(new Error('You cannot mix different types of decorate options'));
		}

		const expose = {
			lib: mysql
		};

		const connect = (connectionOptions, done) => {
			const pool = mysql.createPool(connectionOptions.settings);
			const poolConfig = pool.config.connectionConfig
			const info = `${poolConfig.user}@${poolConfig.host}`

			server.log(['hapi-mysql2', 'info'], `hapi connection created for ${info}`);
			if(typeof connectionOptions.decorate === 'string') {
				const decoration = Object.assign({ pool }, expose);
				server.decorate('server', connectionOptions.decorate, decoration);
				server.decorate('request', connectionOptions.decorate, decoration);
			}
			done(null, pool);
		};

		Async.map(options, connect, (err, pools) => {

			if (err) {
				server.log(['hapi-mysql2', 'error'], err);
				return next(err);
			}

			expose.pool = options.length === 1 ? pools[0] : pools;

			if (decorationTypes.has('boolean')) {
				server.decorate('server', 'mysql', expose);
				server.decorate('request', 'mysql', expose);
			}
			else if (decorationTypes.has('undefined')) {
				Object.keys(expose).forEach((key) => {

					server.expose(key, expose[key]);
				});
			}

			server.on('stop', () => {

				[].concat(expose.pool).forEach((pool) => {

					try {
						const poolConfig = pool.config.connectionConfig
						const info = `${poolConfig.user}@${poolConfig.host}`
						server.log(['hapi-mysql2', 'info'], `ending mysql connection pool ${info}`)
						pool.end();
					} catch(err) {
						server.log(['hapi-mysql2', 'error'], err)

					}
				});
			});

			next();
		});
	});
}
exports.register.attributes = {
	pkg: require('../package.json')
};
