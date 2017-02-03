var azure       = require('fast-azure-storage');
var api         = require('./v1');

api.declare({
  method:     'get',
  route:      '/azure/:account/table/:table',
  name:       'azureTableSAS',
  input:      undefined,
  output:     'azure-table-access-response.json#',
  deferAuth:  true,
  stability:  'stable',
  scopes:     [['auth:azure-table-access:<account>/<table>']],
  title:      "Get Shared-Access-Signature for Azure Table",
  description: [
    "Get a shared access signature (SAS) string for use with a specific Azure",
    "Table Storage table. By not specifying a level as in azureTableSASLevel,",
    "you always get read-write from this. Note: This will create the",
    "table, if it doesn't already exist.",
  ].join('\n')
}, async function(req, res) {
  var account   = req.params.account;
  var tableName = req.params.table;

  // Check that the client is authorized to access given account and table
  if (!req.satisfies({
    account:    account,
    table:      tableName,
  })) {
    return;
  }
  return await azureTableSASBase(res, this.azureAccounts, account, tableName);
});

api.declare({
  method:     'get',
  route:      '/azure/:account/table/:table/:level',
  name:       'azureTableSASLevel',
  input:      undefined,
  output:     'azure-table-access-response.json#',
  deferAuth:  true,
  stability:  'stable',
  scopes:     [['auth:azure-table-access:<account>/<table>/<level>']],
  title:      "Get Shared-Access-Signature for Azure Table (with level)",
  description: [
    "Get a shared access signature (SAS) string for use with a specific Azure",
    "Table Storage table.  This function is quite similar to azureTableSAS,",
    "except that it takes a level as well. We need two separate functions because",
    "the other function was defined first without the concept of a level.",
    "Note: If level is 'read-write', this will create the",
    "table, if it doesn't already exist.",
  ].join('\n')
}, async function(req, res) {
  var account   = req.params.account;
  var tableName = req.params.table;
  var level     = req.params.level;

  if (!['read-write', 'read-only'].includes(level)) {
    return res.status(404).json({
      message:    "Level '" + level + "' is not valid. Must be one of ['read-write', 'read-only']."
    });
  }

  // Check that the client is authorized to access given account and table
  if (!req.satisfies({
    account:    account,
    table:      tableName,
    level:      level,
  })) {
    return;
  }
  return await azureTableSASBase(res, this.azureAccounts, account, tableName, level);
});

async function azureTableSASBase(res, azureAccounts, account, tableName, level='read-write') {

  // Check that the account exists
  if (!azureAccounts[account]) {
    return res.status(404).json({
      message:    "Account '" + account + "' not found, can't delegate access"
    });
  }

  // Construct client
  var table = new azure.Table({
    accountId:  account,
    accessKey:  azureAccounts[account]
  });

  // Create table ignore error, if it already exists
  if (level === 'read-write') {
    try {
      await table.createTable(tableName);
    } catch (err) {
      if (err.code !== 'TableAlreadyExists') {
        throw err;
      }
    }
  }

  let perm = level === 'read-write';

  // Construct SAS
  var expiry = new Date(Date.now() + 25 * 60 * 1000);
  var sas = table.sas(tableName, {
    start:    new Date(Date.now() - 15 * 60 * 1000),
    expiry:   expiry,
    permissions: {
      read:       true,
      add:        perm,
      update:     perm,
      delete:     perm,
    }
  });

  // Return the generated SAS
  return res.reply({
    sas:      sas,
    expiry:   expiry.toJSON()
  });
};
