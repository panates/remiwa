/* eslint-disable */

const assert = require('assert');
const http = require('http');
const request = require('supertest');
const express = require('express');

const ApiService = require('..');

describe('Endpoint', function() {

  var app;
  var server;
  var service;

  beforeEach(function() {
    app = express();
    service = new ApiService();
    app.use(service);
    server = http.createServer(app);
    service.on('error', function(e) {});
  });

  it('should GET listClients', function(done) {
    service.define({
      operationId: 'listClients',
      route: '/clients',
      method: 'get',
      summary: '-',
      description: '-',
      produces: ['application/json'],
      output: 'array',
      handler: listClients
    });
    request(server)
        .get('/clients')
        .send()
        .expect(200, '[{"id":1,"firstName":"A","lastName":"B"}]', done);
  });

  it('should GET getClient', function(done) {
    service.define({
      operationId: 'getClient',
      route: '/clients/:id',
      method: 'get',
      produces: ['application/json'],
      parameters: {
        id: 'number',
        name: {
          'base': 'object',
          'age': 'number',
          items: {
            first: 'string',
            last: 'string'
          }
        }
      },
      handler: getClient
    });
    request(server)
        .get('/clients/123')
        .query({'name.first': 'John', 'name.last': 'Taylor'})
        .send()
        .expect(200, '{"id":123,"firstName":"John","lastName":"Taylor","method":"GET"}', done);
  });

  it('should POST addClient', function(done) {
    service.define({
      operationId: 'addClient',
      route: '/client',
      method: 'post',
      consumes: ['application/json'],
      produces: ['application/json'],
      parameters: {
        id: 'number',
        client: {
          base: 'object',
          in: 'body'
        },
        address: {
          base: 'object',
          in: 'body/address',
          items: {
            state: 'string'
          }
        },
        age: {
          base: 'string',
          in: 'query'
        }
      },
      output: 'any',
      handler: addClient
    });
    request(server)
        .post('/client')
        .query({
          'name.first': 'John',
          'name.last': 'Taylor',
          'address.state': 'ny',
          'age': 5
        })
        .send({name: 'John', address: {state: 'la'}})
        .expect(200, '{"name":"John","state":"la"}', done);
  });

  it('should DELETE deleteClient', function(done) {
    service.define({
      operationId: 'deleteClient',
      route: '/client',
      method: 'post',
      consumes: ['application/json'],
      produces: ['application/json'],
      parameters: {
        id: 'number'
      },
      handler: deleteClient
    });
    request(server)
        .post('/client')
        .query({id: 1})
        .expect(200, done);
  });

  it('should use additional per endpoint middle-ware', function(done) {
    var t = 0;
    service.define({
      operationId: 'listClients',
      route: '/clients',
      method: 'get',
      summary: '-',
      description: '-',
      produces: ['application/json'],
      output: 'array',
      use: function(req, res, next) {
        t++;
        next();
      },
      handler: listClients
    });
    request(server)
        .get('/clients')
        .send()
        .expect(200, function() {
          assert.equal(t, 1);
          done();
        });
  });

  it('should use additional per endpoint middle-wares', function(done) {
    var t = 0;
    service.define({
      operationId: 'listClients',
      route: '/clients',
      method: 'get',
      summary: '-',
      description: '-',
      produces: ['application/json'],
      output: 'array',
      use: [function(req, res, next) {
        t++;
        next();
      }, function(req, res, next) {
        t++;
        next();
      }],
      handler: listClients
    });
    request(server)
        .get('/clients')
        .send()
        .expect(200, function() {
          assert.equal(t, 2);
          done();
        });
  });

  it('should call error handler - next(err)', function(done) {
    service.define({
      operationId: 'listClients',
      route: '/clients',
      method: 'get',
      summary: '-',
      description: '-',
      produces: ['application/json'],
      output: 'array',
      handler: [function(req, res, next) {
        assert.equal(typeof req.setTimeout, 'function');
        assert.equal(typeof res.write, 'function');
        assert.equal(res.finished, false);
        next(new Error('Any error'));
      }, errorHandler]
    });
    request(server)
        .get('/clients')
        .send()
        .expect(500, '{"error":{"message":"Any error","status":500}}', done);
  });

  it('should call error handler - throw err', function(done) {
    service.define({
      operationId: 'listClients',
      route: '/clients',
      method: 'get',
      summary: '-',
      description: '-',
      produces: ['application/json'],
      output: 'array',
      handler: [function(req, res, next) {
        throw new Error('Any error');
      }, errorHandler]
    });
    request(server)
        .get('/clients')
        .send()
        .expect(500, '{"error":{"message":"Any error","status":500}}', done);
  });

  it('should call error handler - promise reject', function(done) {
    service.define({
      operationId: 'listClients',
      route: '/clients',
      method: 'get',
      summary: '-',
      description: '-',
      produces: ['application/json'],
      output: 'array',
      handler: [function(req, res, next) {
        return new Promise(function(resolve, reject) {
          reject(new Error('Any error'));
        });
      }, errorHandler]
    });
    request(server)
        .get('/clients')
        .send()
        .expect(500, '{"error":{"message":"Any error","status":500}}', done);
  });

  it('should handle errors in error handler - throw err', function(done) {
    service.define({
      operationId: 'listClients',
      route: '/clients',
      method: 'get',
      summary: '-',
      description: '-',
      produces: ['application/json'],
      output: 'array',
      handler: [function(req, res, next) {
        next(new Error('Any error'));
      }, function(err, req, res, next) {
        throw new Error(err.message + '2');
      }, errorHandler]
    });
    request(server)
        .get('/clients')
        .send()
        .expect(500, '{"error":{"message":"Any error2","status":500}}', done);
  });

  it('should handle errors in error handler - promise reject', function(done) {
    service.define({
      operationId: 'listClients',
      route: '/clients',
      method: 'get',
      summary: '-',
      description: '-',
      produces: ['application/json'],
      output: 'array',
      handler: [function(req, res, next) {
        next(new Error('Any error'));
      }, function(err, req, res, next) {
        return new Promise(function(resolve, reject) {
          reject(new Error(err.message + '2'));
        });
      }, errorHandler]
    });
    request(server)
        .get('/clients')
        .send()
        .expect(500, '{"error":{"message":"Any error2","status":500}}', done);
  });

});

function listClients(req, res, next) {
  res.end([{
    id: 1,
    firstName: 'A',
    lastName: 'B',
    c: null
  }], {ignoreNulls: true});
}

function getClient(req, res, next) {
  res.writeHead(200);
  res.end({
    id: req.params.id,
    firstName: req.params.name.first || 'A',
    lastName: req.params.name.last || 'B',
    method: req.method
  });
}

function addClient(req, res, next) {
  res.end({name: req.params.client.name, state: req.params.address.state});
}

function deleteClient(req, res, next) {
  if (req.params.id === 1)
    res.end();
  else next(new Error('Invalid id'));
}

function errorHandler(err, req, res, next) {
  next(err);
}