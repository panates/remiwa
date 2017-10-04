/*!
 * klow
 * Copyright(c) 2017 Panates Ltd.
 */

const assert = require('assert');
const errorex = require('errorex');
const express = require('express');
const bodyParser = require('body-parser');
const isPlainObject = require('putil-isplainobject');
const stringify = require('putil-stringify');

/*
 * Module variables
 */
const CONTENTYPE_JSON = 'application/json';
const METHODS = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head'];
const ArgumentError = errorex.ArgumentError;

/**
 *
 * @param {Object} service
 * @param {Object} cfg
 * @return {Endpoint}
 * @constructor
 */
function Endpoint(service, cfg) {

  if (METHODS.indexOf(cfg.method) < 0)
    throw new ArgumentError('`method` property is empty or invalid');

  if (!(cfg.route && typeof cfg.route === 'string'))
    throw new ArgumentError('`route` property is empty or invalid');

  defineConst(this,
      {
        service: service,
        operationId: cfg.operationId,
        method: cfg.method,
        route: cfg.route,
        consumes: Array.isArray(cfg.consumes) ?
            cfg.consumes : [cfg.consumes || CONTENTYPE_JSON],
        produces: Array.isArray(cfg.produces) ?
            cfg.produces : [cfg.produces || CONTENTYPE_JSON],
        parameters: cfg.parameters,
        output: cfg.output
      });

  defineConst(this, '_router', new express.Router({
    mergeParams: true
  }), false);

  if (cfg.consumes && ['post', 'put', 'patch'].indexOf(cfg.method) >= 0) {
    const b = [];
    for (var i in cfg.consumes) {
      const s = String(cfg.consumes[i]);
      if (s.match(/\b(\/json)|(\+json)\b/i) && b.indexOf('json') < 0) {
        this._router.use(bodyParser.json({
          type: 'json',
          limit: '4MB'
        }));
        b.push('json');
      } else if (s.toLowerCase() ===
          'application/x-www-form-urlencoded' &&
          b.indexOf('urlencoded') < 0) {
        this._router.use(bodyParser.urlencoded({
          type: 'urlencoded',
          limit: '4MB'
        }));
        b.push('urlencoded');
      }
    }
  }

  if (cfg.use) {
    const arr = Array.isArray(cfg.use) ? cfg.use : [cfg.use];
    for (var k in arr)
      this._router.use(arr[k]);
  }
  const self = this;
  var nreq;
  var nres;
  // Middleware for request and response wrapping
  self._router.use(function(req, res, next) {
    nreq = wrapRequest(self, req);
    nres = wrapResponse(self, res);
    next();
  });

  (Array.isArray(cfg.handler) ? cfg.handler : [cfg.handler]).forEach(function(handler) {
    assert(typeof handler === 'function', 'Invalid "handler" property');
    var fn;
    if (handler.length >= 4) {
      fn = function(err, req, res, next) {
        try {
          const o = handler(err, nreq, nres, next);
          if (isPromise(o))
            o.catch(next);
        } catch (e) {
          next(e);
        }
      };
    } else {
      fn = function(req, res, next) {
        try {
          const o = handler(nreq, nres, next);
          if (isPromise(o))
            o.catch(next);
        } catch (e) {
          next(e);
        }
      };
    }
    Object.defineProperty(fn, 'name', {
      value: self.operationId,
      enumerable: true
    });
    self._router.use(fn);
  });
}

Endpoint.prototype = {};

/**
 *  Create a proxy for request object
 *  @param {Object} endpoint
 *  @param {Object} req
 *  @return {Object}
 */
function wrapRequest(endpoint, req) {
  // Prepare params
  var params = {};
  if (endpoint.parameters) {
    // Build a scoped query object
    // istanbul ignore next
    if (req.query) {
      Object.getOwnPropertyNames(req.query).forEach(function(key) {
        if (key.indexOf('.') >= 0) {
          const a = key.split('.');
          const prm = endpoint.parameters[a[0]];
          const _in = prm && prm.in;
          if (_in && _in.startsWith('body'))
            return;
          var scope = params;
          for (var i = 0; i < a.length; i++)
            if (i < a.length - 1)
              scope = scope[a[i]] = scope[a[i]] || {};
            else scope[a[i]] = req.query[key];
        } else {
          const prm = endpoint.parameters[key];
          const _in = prm && prm.in;
          if (!(_in && _in.startsWith('body')))
            params[key] = req.query[key];
        }
      });
    }

    // merge request params
    Object.assign(params, req.params);

    // merge body params
    if (isPlainObject(req.body)) {
      Object.getOwnPropertyNames(endpoint.parameters).every(function(key) {
        const prm = endpoint.parameters[key];
        if (prm.in && prm.in.startsWith('body')) {
          const a = prm.in.split('/');
          if (a.length > 1)
            params[key] = req.body[a[1]];
          else {
            params[key] = req.body;
          }
        }
        return true;
      });
    }
    // decode
    const typ = endpoint.service.schema.get(endpoint.operationId + 'In');
    params = typ.decode(params, req);
  }

  var result = {params: params};
  Object.setPrototypeOf(result, req);
  return result;
}

/**
 *  Create a proxy for response object
 *  @param {Object} endpoint
 *  @param {Object} res
 *  @return {Object}
 */
function wrapResponse(endpoint, res) {
  var result = {
    end: wrapResponseEnd(endpoint, res)
  };
  Object.setPrototypeOf(result, res);
  return result;
}

function wrapResponseEnd(endpoint, res) {
  return function end(value, options) {
    const outType = !endpoint.output ? null :
        endpoint.service.schema.get(endpoint.operationId + 'Out');
    if (!value)
      return res.end();
    try {
      if (endpoint.produces.indexOf(CONTENTYPE_JSON) >= 0) {
        if (!res.headersSent)
          res.setHeader('Content-Type', CONTENTYPE_JSON);
        if (outType) {
          value = outType.encode(value, outType.name);
        }
        value = jsonStringify(value, options);
      }
    } catch (e) {
      if (!res.headersSent)
        res.status(500);
      value = e.message;
    }
    res.end(value);
  };
}

/*
 * Helper functions
 */
function isPromise(o) {
  return o && (o instanceof Promise ||
      (typeof o.then === 'function' && typeof o.catch === 'function'));
}

function jsonStringify(obj, options) {
  return stringify(obj, function(k, v) {
    if (options && options.ignoreNulls && v === null)
      return;
    return v;
  });
}

function defineConst(obj, name, value, enumerable) {
  if (typeof name === 'object') {
    enumerable = value;
    Object.getOwnPropertyNames(name).forEach(function(property) {
      Object.defineProperty(obj, property, {
        value: name[property],
        writable: false,
        configurable: false,
        enumerable: enumerable || enumerable === undefined
      });
    });
  } else
    Object.defineProperty(obj, name, {
      value: value,
      writable: false,
      configurable: false,
      enumerable: enumerable || enumerable === undefined
    });
}

/*
 * Expose module
 */
module.exports = Endpoint;
