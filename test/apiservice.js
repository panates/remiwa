/* remiwa
 ------------------------
 (c) 2017-present Panates
 This file may be freely distributed under the MIT license.
 For details and documentation:
 https://github.com/panates/remiwa
 */

const EventEmitter = require('events').EventEmitter;
const errorex = require('errorex');
const express = require('express');
const isPlainObject = require('putil-isplainobject');
const merge = require('putil-merge');
const Schema = require('xtyped');

const Endpoint = require('./endpoint');

const ENDPOINT_NAME_REGEX = /^[A-Za-z]\w*$/;
const ArgumentError = errorex.ArgumentError;

/**
 * Expose `ApiService`.
 */

/**
 * Create an rest api router
 *
 * @return {Function}
 * @api public
 */

function ApiService(options) {
  if (!(this instanceof ApiService))
    return new ApiService(options);

  options = options || {};

  function service(req, res, next) {
    service.handler(req, res, next || function(e) {
      if (e) {
        res.writeHead(e.status ? e.status : 500);
        res.end(String(e));
        return;
      }
      res.writeHead(404);
      res.end();
    });
  }

  // inherit from the correct prototype
  Object.setPrototypeOf(service, this);

  service.endpoints = {};
  service.handler = new express.Router();
  service.schema = new Schema();

  /* Mount event emitter first */
  service.handler.use(function(req, res, next) {
    service.emit('request', req);
    next();
  });

  /* Mount middle-ware router */
  service._mwrouter = new express.Router(options);
  service.handler.use(service._mwrouter);

  /* Mount endpoint router */
  service._eprouter = new express.Router(options);
  service.handler.use(service._eprouter);

  /* mount error handler last */
  service.handler.use(function(err, req, res, next) {
    const e = {message: err.message};
    Object.getOwnPropertyNames(err).forEach(function(key) {
      if (!(key === 'stack' || key === 'name'))
        e[key] = err[key];
    });
    e.url = req.originalUrl;
    e.status = err.status ? err.status : 500;
    if (service.listenerCount('error') > 0)
      service.emit('error', err, e, req);
    if (!res.headersSent) {
      res.status(e.status);
      res.setHeader('Content-Type', 'application/json');
    }
    res.end(JSON.stringify({error: e}));
  });

  return service;
}

/**
 * ApiService prototype inherits from a Function.
 */

/* istanbul ignore next */
ApiService.prototype = function() {};

/**
 * mixin EventEmitter
 */
merge({descriptor: true}, ApiService.prototype, EventEmitter.prototype);

/**
 *
 * @param {Object} cfg
 * @param {String} cfg.operationId
 * @return {Endpoint}
 */
ApiService.prototype.define = function define(cfg) {

  if (!(cfg && isPlainObject(cfg)))
    throw new ArgumentError('Argument `config` is not defined or invalid');

  if (!(cfg.operationId && cfg.operationId.match(ENDPOINT_NAME_REGEX)))
    throw new ArgumentError('`operationId` is not defined or invalid');

  if (this.endpoints[cfg.operationId])
    throw new ArgumentError('Endpoint "' + cfg.operationId +
        '" already defined');

  const endpoint = new Endpoint(this, cfg);

  try {
    this.schema.define(endpoint.operationId + 'In', {
      base: 'object',
      items: endpoint.parameters
    });
  } catch (e) {
    e.message = 'Unable to define ' + endpoint.operationId + 'In. ' + e.message;
    throw e;
  }
  try {
    this.schema.define(endpoint.operationId + 'Out',
        endpoint.output || 'any');
  } catch (e) {
    e.message =
        'Unable to define ' + endpoint.operationId + 'Out. ' + e.message;
  }

  this._eprouter[endpoint.method](endpoint.route, function EndpointRouter(req, res, next) {
    return endpoint._router(req, res, next);
  });

  this.endpoints[endpoint.operationId] = endpoint;
  return endpoint;
};

/**
 *
 * @param {Function} handlers
 */
ApiService.prototype.use = function define(handlers) {
  this._mwrouter.use.apply(this.handler, arguments);
};

module.exports = ApiService;
