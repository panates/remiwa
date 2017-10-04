/* eslint-disable */

const assert = require('assert');
const http = require('http');
const request = require('supertest');

const ApiService = require('..');

describe('ApiService', function() {

  var service;

  beforeEach(function() {
    service = ApiService();
  });

  it('should check config argument', function(done) {
    var t = 0;
    try {
      service.define();
    } catch (e) {
      t++;
    }
    assert.equal(t, 1);
    try {
      service.define(123);
    } catch (e) {
      t++;
    }
    assert.equal(t, 2);
    try {
      service.define([]);
    } catch (e) {
      t++;
    }
    assert.equal(t, 3);
    done();
  });

  it('should check `operationId` property', function(done) {
    try {
      service.define({
        route: '/clients',
        method: 'get'
      });
    } catch (e) {
      done();
      return;
    }
    assert(0);
  });

  it('should check `method` property', function(done) {
    try {
      service.define({
        operationId: 'listClients',
        route: '/clients',
        method: 'aaa'
      });
    } catch (e) {
      done();
      return;
    }
    assert(0);
  });

  it('should check `route` property is not empty', function(done) {
    try {
      service.define({
        operationId: 'listClients',
        method: 'get',
        handler: function(req, res, next) {}
      });
    } catch (e) {
      done();
      return;
    }
    assert(0);
  });

  it('should check `route` property is valid', function(done) {
    try {
      service.define({
        operationId: 'listClients',
        route: 123,
        method: 'get',
        handler: function(req, res, next) {}
      });
    } catch (e) {
      done();
      return;
    }
    assert(0);
  });

  it('should operationId can be defined once', function(done) {
    service.define({
      operationId: 'listClients',
      route: '/clients',
      method: 'get',
      handler: function(req, res, next) {}
    });
    try {
      service.define({
        operationId: 'listClients',
        route: '/clients',
        method: 'get',
        handler: function(req, res, next) {}
      });
    } catch (e) {
      done();
      return;
    }
    assert(0);
  });

  it('should create a new type for parameters object', function(done) {
    service.define({
      operationId: 'listClients',
      route: '/clients',
      method: 'get',
      handler: function(req, res, next) {}
    });
    assert.equal(service.schema.get('listClientsIn').base.name, 'Object');
    done();
  });

  it('should create a new type for output object', function(done) {
    service.define({
      operationId: 'listClients',
      route: '/clients',
      method: 'get',
      output: 'string',
      handler: function(req, res, next) {}
    });
    assert.equal(service.schema.get('listClientsOut').base.name, 'String');
    done();
  });

  it('should verify `parameters` parameter', function(done) {
    try {
      service.define({
        operationId: 'listClients',
        route: '/clients',
        method: 'get',
        parameters: '1aa',
        handler: function(req, res, next) {}
      });
    } catch (e) {
      done();
      return;
    }
    assert(0);
    done();
  });

  it('should verify `output` parameter', function(done) {
    try {
      service.define({
        operationId: 'listClients',
        route: '/clients',
        method: 'get',
        output: '1aa',
        handler: function(req, res, next) {}
      });
    } catch (e) {
      done();
      return;
    }
    assert(0);
    done();
  });

  it('should use other middle-ware', function(done) {
    service.use(function(req, res, next) {
      next();
    });
    var server = http.createServer(service);
    request(server)
        .post('/')
        .send('{}')
        .expect(404, done);
  });

  it('should use other middle-ware', function(done) {
    service.use(function(req, res, next) {
      const e = new Error('Any error');
      e.status = 400;
      next(e);
    });
    var server = http.createServer(service);
    request(server)
        .post('/')
        .send('{}')
        .expect(400, done);
  });

});
