suite('azure table (sas)', function() {
  var Promise     = require('promise');
  var assert      = require('assert');
  var debug       = require('debug')('auth:test:azure');
  var helper      = require('./helper');
  var slugid      = require('slugid');
  var _           = require('lodash');
  var azure       = require('fast-azure-storage');
  var taskcluster = require('taskcluster-client');

  test('azureAccounts', function() {
    return helper.auth.azureAccounts(
    ).then(function(result) {
      assert.deepEqual(result.accounts, _.keys(helper.cfg.app.azureAccounts));
    });
  });

  test('azureAccountTables', async function() {
    // First make sure the table exists
    await helper.auth.azureTableSAS(
      helper.testaccount,
      'TestTable'
    );
    return helper.auth.azureAccountTables(
      helper.testaccount,
    ).then(function(result) {
      assert(result.tables.includes('TestTable'));
    });
  });

  test('azureTableSAS', function() {
    return helper.auth.azureTableSAS(
      helper.testaccount,
      'TestTable'
    ).then(function(result) {
      assert(typeof(result.sas) === 'string', "Expected some form of string");
      assert(new Date(result.expiry).getTime() > new Date().getTime(),
             "Expected expiry to be in the future");
    });
  });

  test('azureTableSASLevel (read-write)', async function() {
    let res = await helper.auth.azureTableSASLevel(
      helper.testaccount,
      'TestTable',
      'read-write',
    ).then(function(result) {
      assert(typeof(result.sas) === 'string', "Expected some form of string");
      assert(new Date(result.expiry).getTime() > new Date().getTime(),
             "Expected expiry to be in the future");
      return result;
    });
    let table = new azure.Table({
      accountId: helper.testaccount,
      sas: res.sas,
    });
    // This should not error since this is read-write
    return table.insertEntity('TestTable', {PartitionKey: taskcluster.slugid(), RowKey: 'c'});
  });

  test('azureTableSASLevel (read-only)', async function() {
    let res = await helper.auth.azureTableSASLevel(
      helper.testaccount,
      'TestTable',
      'read-only',
    ).then(function(result) {
      assert(typeof(result.sas) === 'string', "Expected some form of string");
      assert(new Date(result.expiry).getTime() > new Date().getTime(),
             "Expected expiry to be in the future");
      return result;
    });
    let table = new azure.Table({
      accountId: helper.testaccount,
      sas: res.sas,
    });
    // This should not error since this is read-write
    return table.insertEntity('TestTable', {PartitionKey: taskcluster.slugid(), RowKey: 'c'}).then(() => {
      assert(false, "This should not have been allowed to write!");
    }, (err) => {
      assert.equal(err.code, 'ResourceNotFound', 'This should not be able to see the table at all.');
    });
  });

  test('azureTableSASLevel (invalid level)', function() {
    return helper.auth.azureTableSASLevel(
      helper.testaccount,
      'TestTable',
      'foo-bar-baz',
    ).then(function(result) {
      assert(false, "This should have thrown an error");
    }).catch(function(err) {
      assert.equal(err.message, "Level 'foo-bar-baz' is not valid. Must be one of ['read-write', 'read-only'].");
    });
  });

  var rootCredentials = {
    clientId: 'root',
    accessToken: helper.rootAccessToken
  };


  test('azureTableSAS (allowed table)', function() {
    // Restrict access a bit
    var auth = new helper.Auth({
      baseUrl:          helper.baseUrl,
      credentials:      rootCredentials,
      authorizedScopes: [
        'auth:azure-table-access:' + helper.testaccount + '/allowedTable'
      ]
    });
    return auth.azureTableSAS(
      helper.testaccount,
      'allowedTable'
    ).then(function(result) {
      assert(typeof(result.sas) === 'string', "Expected some form of string");
      assert(new Date(result.expiry).getTime() > new Date().getTime(),
             "Expected expiry to be in the future");
    });
  });

  test('azureTableSAS (unauthorized table)', function() {
    // Restrict access a bit
    var auth = new helper.Auth({
      baseUrl:          helper.baseUrl,
      credentials:      rootCredentials,
      authorizedScopes: [
        'auth:azure-table-access:' + helper.testaccount + '/allowedTable'
      ]
    });
    return auth.azureTableSAS(
      helper.testaccount,
      'unauthorizedTable'
    ).then(function(result) {
      assert(false, "Expected an authentication error!");
    }, function(err) {
      assert(err.statusCode == 403, "Expected authorization error!");
    });
  });
});
