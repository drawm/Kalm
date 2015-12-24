/**
 * Net class
 * This is the regroupement of all the i/o adapters and their wrapping methods
 * @exports {Net}
 */

'use strict';

/* Requires ------------------------------------------------------------------*/

var decode = require('msgpack-decode');
var msgpack = require('msgpack-lite');

/* Methods -------------------------------------------------------------------*/

/**
 * Net class
 * @constructor
 * @param {Kalm} K Kalm reference
 * @param {function} callback The callback method
 */
function Net(K, callback) {
	this.p = K;

	var utils = this.p.components.utils;
	var config = this.p.config;
	var cl = this.p.components.console;

	var baseAdapters = ['ipc', 'tcp', 'udp'];
	var _self = this;

	this.adapters = {};

	this.callWrapper = {
		origin: { h: '0.0.0.0', p: 80 },
		meta: { sId: '', id: process.pid }
	};
	
	utils.async.all(baseAdapters.filter(function(adapter) {
		return adapter in config.adapters;
	}).map(function(adapter) {
		return function(resolve) {
			var adapterPkg = require('./adapters/' + adapter + '.adapter');
			_self.loadAdapter.call(_self, adapter, adapterPkg, resolve);
		};
	}), function() {
		if (callback) callback(_self);
	});
}

/**
 * Loads an adapter
 * @method loadAdapter
 * @memberof Net
 * @param {object} adapter The adapter object to load (adapter definition)
 * @param {function} callback The callback method
 */
Net.prototype.loadAdapter = function(name, adapter, callback) {
	var config = this.p.config;
	var cl = this.p.components.console;

	cl.log(
		' - Starting ' + name + ' server' + 
		' [ :' + config.adapters[name].port + ' ]'
	);

	this.adapters[name] = new adapter(this.p);
	this.adapters[name].listen(
		config.adapters[name], 
		this.handleRequest.bind(this), 
		callback
	);
};

/**
 * Interface for client creation, redirects to proper adapter
 * @method createClient
 * @memberof Net
 * @param {Service} peer The peer to create a client for
 * @returns {object|null} The created client or null on error
 */
Net.prototype.createClient = function(socket, peer) {
	var config = this.p.config;

	if (!(peer.adapter in this.adapters)) return null;

	socket.client = this.adapters[peer.adapter].createClient(
		config.connections[peer.adapter], 
		peer
	);
};

/**
 * Interface for client sending method, redirects to proper adapter
 * @method send
 * @memberof Net
 * @param {Service} peer The peer to create a client for
 * @param {?} payload The payload to send
 * @param {Socket} socket The socket to use
 * @param {function} callback The callback method 
 */
Net.prototype.send = function(peer, payload, socket, callback) {
	var config = this.p.config;
	var system = this.p.components.system;

	if (!(peer.adapter in this.adapters)) {
		return callback('Unknown type "' + peer.adapter + '"');
	}

	this.callWrapper.origin.h = system.location;
	this.callWrapper.origin.p = config.connections[peer.adapter].port;
	this.callWrapper.meta.sId = peer.label;
	this.callWrapper.payload = payload;

	this.adapters[peer.adapter].send(peer, this.callWrapper, socket, callback);
}

/**
 * Global capture method for incomming requests.
 * Redirects to the appropriate peer's handling method 
 * @method handleRequest
 * @memberof Net
 * @param {object} req The incomming request payload
 * @param {function} reply The reply interface
 */
Net.prototype.handleRequest = function(req, server) {
	var config = this.p.config;
	var peer;
	var reply;
	var _self = this;

	req = decode(req);

	if (!req.payload) req = { payload: req };
	if (!req.origin) req.origin = {};
	req.origin.adapter = server.type;

	if (req.meta) {
		peer = peers.find(req.meta.sId, req.origin, true);

		reply = function(payload, callback) {
			// Service existing or created during handleRequest
			var socket = peer.socket();
			_self.send.call(_self, peer, payload, socket, callback);
		}

		if (peer.onRequest.getNumListeners() > 0) {
			peer.onRequest.dispatch(req, reply);
			return true;
		}
	}

	// Not captured by any peer, no packet info - should drop
	// cl.warn('Unhandled request');
}

/* Exports -------------------------------------------------------------------*/

module.exports = Net;