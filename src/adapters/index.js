/**
 * Adapters 
 */

'use strict';

/* Requires ------------------------------------------------------------------*/

const debug = require('debug')('kalm');

/* Methods -------------------------------------------------------------------*/

class Adapters {

	/**
	 * Adapters constructor
	 */
	constructor() {
		this.list = {};

		// If running in the browser, do not load net adapters
		if (process.env.NODE_ENV !== 'browser') {
			this.list.ipc = require('./ipc');
			this.list.tcp = require('./tcp');
			this.list.udp = require('./udp');
		}
	}

	/**
	 * Returns the selected adapter
	 * @param {string} adapter The name of the adapter to return
	 * @returns {object|undefined} The adapter
	 */
	resolve(adapter) {
		if (this.list.hasOwnProperty(adapter)) {
			return this.list[adapter];
		}
		else {
			debug('error: no adapter "' + adapter + '" found');
			return;
		}
	}

	/**
	 * Registers a new adapter
	 * @param {string} name The name of the adapter
	 * @param {object} mod The body of the adapter
	 */
	register(name, mod) {
		debug('log: registering new adapter "' + name + '":');
		this.list[name] = mod;
	}
}

/* Exports -------------------------------------------------------------------*/

module.exports = new Adapters;