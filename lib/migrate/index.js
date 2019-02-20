'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true,
});
exports.default = void 0;

var _fs = _interopRequireDefault(require('fs'));

var _path = _interopRequireDefault(require('path'));

var _mkdirp = _interopRequireDefault(require('mkdirp'));

var _bluebird = _interopRequireDefault(require('bluebird'));

var helpers = _interopRequireWildcard(require('../helpers'));

var _lodash = require('lodash');

var _inherits = _interopRequireDefault(require('inherits'));

function _interopRequireWildcard(obj) {
  if (obj && obj.__esModule) {
    return obj;
  } else {
    var newObj = {};
    if (obj != null) {
      for (var key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          var desc =
            Object.defineProperty && Object.getOwnPropertyDescriptor
              ? Object.getOwnPropertyDescriptor(obj, key)
              : {};
          if (desc.get || desc.set) {
            Object.defineProperty(newObj, key, desc);
          } else {
            newObj[key] = obj[key];
          }
        }
      }
    }
    newObj.default = obj;
    return newObj;
  }
}

function _interopRequireDefault(obj) {
  return obj && obj.__esModule ? obj : { default: obj };
}

// Migrator
// -------
function LockError(msg) {
  this.name = 'MigrationLocked';
  this.message = msg;
}

(0, _inherits.default)(LockError, Error);
const CONFIG_DEFAULT = Object.freeze({
  extension: 'js',
  loadExtensions: [
    '.co',
    '.coffee',
    '.eg',
    '.iced',
    '.js',
    '.litcoffee',
    '.ls',
    '.ts',
  ],
  tableName: 'knex_migrations',
  lockTableName: null,
  columnName: 'name',
  schemaName: null,
  directory: './migrations',
  disableTransactions: false,
}); // The new migration we're performing, typically called from the `knex.migrate`
// interface on the main `knex` object. Passes the `knex` instance performing
// the migration.

class Migrator {
  constructor(knex) {
    this.knex = knex;
    this.config = this.setConfig(knex.client.config.migrations);
    this._activeMigration = {
      fileName: null,
    };
  } // Migrators to the latest configuration.

  latest(config) {
    this.config = this.setConfig(config);
    return this._migrationData()
      .tap(validateMigrationList)
      .spread((all, completed) => {
        const migrations = (0, _lodash.difference)(all, completed);
        const transactionForAll =
          !this.config.disableTransactions &&
          (0, _lodash.isEmpty)(
            (0, _lodash.filter)(migrations, (name) => {
              const migration = require(_path.default.join(
                this._absoluteConfigDir(),
                name
              ));

              return !this._useTransaction(migration);
            })
          );

        if (transactionForAll) {
          return this.knex.transaction((trx) =>
            this._runBatch(migrations, 'up', trx)
          );
        } else {
          return this._runBatch(migrations, 'up');
        }
      });
  } // Rollback the last "batch" of migrations that were run.

  rollback(config) {
    return _bluebird.default.try(() => {
      this.config = this.setConfig(config);
      return this._migrationData()
        .tap(validateMigrationList)
        .then((val) => this._getLastBatch(val))
        .then((migrations) => {
          return this._runBatch(
            (0, _lodash.map)(migrations, this.config.columnName),
            'down'
          );
        });
    });
  }

  status(config) {
    this.config = this.setConfig(config);
    return _bluebird.default
      .all([
        getTable(
          this.knex,
          this.config.tableName,
          this.config.schemaName
        ).select('*'),
        this._listAll(),
      ])
      .spread((db, code) => db.length - code.length);
  } // Retrieves and returns the current migration version we're on, as a promise.
  // If no migrations have been run yet, return "none".

  currentVersion(config) {
    this.config = this.setConfig(config);
    return this._listCompleted().then((completed) => {
      const val = (0, _lodash.max)(
        (0, _lodash.map)(completed, (value) => value.split('_')[0])
      );
      return (0, _lodash.isUndefined)(val) ? 'none' : val;
    });
  }

  forceFreeMigrationsLock(config) {
    this.config = this.setConfig(config);

    const lockTable = this._getLockTableName();

    return getSchemaBuilder(this.knex, this.config.schemaName)
      .hasTable(lockTable)
      .then((exist) => exist && this._freeLock());
  } // Creates a new migration, with a given name.

  make(name, config) {
    this.config = this.setConfig(config);

    if (!name) {
      return _bluebird.default.reject(
        new Error('A name must be specified for the generated migration')
      );
    }

    return this._ensureFolder(config)
      .then((val) => this._generateStubTemplate(val))
      .then((val) => this._writeNewMigration(name, val));
  } // Lists all available migration versions, as a sorted array.

  _listAll(config) {
    this.config = this.setConfig(config);
    const loadExtensions = this.config.loadExtensions;
    return _bluebird.default
      .promisify(_fs.default.readdir, {
        context: _fs.default,
      })(this._absoluteConfigDir())
      .then((migrations) => {
        return (0, _lodash.filter)(migrations, function(value) {
          const extension = _path.default.extname(value);

          return (0, _lodash.includes)(loadExtensions, extension);
        }).sort();
      });
  } // Ensures a folder for the migrations exist, dependent on the migration
  // config settings.

  _ensureFolder() {
    const dir = this._absoluteConfigDir();

    return _bluebird.default
      .promisify(_fs.default.stat, {
        context: _fs.default,
      })(dir)
      .catch(() => _bluebird.default.promisify(_mkdirp.default)(dir));
  } // Ensures that a proper table has been created, dependent on the migration
  // config settings.

  _ensureTable(trx = this.knex) {
    const _this$config = this.config,
      tableName = _this$config.tableName,
      schemaName = _this$config.schemaName;

    const lockTable = this._getLockTableName();

    const lockTableWithSchema = this._getLockTableNameWithSchema();

    return getSchemaBuilder(trx, schemaName)
      .hasTable(tableName)
      .then(
        (exists) =>
          !exists && this._createMigrationTable(tableName, schemaName, trx)
      )
      .then(() => getSchemaBuilder(trx, schemaName).hasTable(lockTable))
      .then(
        (exists) => !exists && this._createMigrationLockTable(lockTable, trx)
      )
      .then(() => getTable(trx, lockTable, this.config.schemaName).select('*'))
      .then(
        (data) =>
          !data.length &&
          trx.into(lockTableWithSchema).insert({
            is_locked: 0,
          })
      );
  }

  _createMigrationTable(tableName, schemaName, trx = this.knex) {
    return getSchemaBuilder(trx, schemaName).createTable(
      getTableName(tableName),
      function(t) {
        t.increments();
        t.string('name');
        t.integer('batch');
        t.timestamp('migration_time');
      }
    );
  }

  _createMigrationLockTable(tableName, trx = this.knex) {
    return getSchemaBuilder(trx, this.config.schemaName).createTable(
      tableName,
      function(t) {
        t.integer('is_locked');
      }
    );
  }

  _getLockTableName() {
    return this.config.lockTableName
      ? this.config.lockTableName
      : this.config.tableName + '_lock';
  }

  _getLockTableNameWithSchema() {
    return this.config.schemaName
      ? this.config.schemaName + '.' + this._getLockTableName()
      : this._getLockTableName();
  }

  _isLocked(trx) {
    const tableName = this._getLockTableName();

    return getTable(this.knex, tableName, this.config.schemaName)
      .transacting(trx)
      .forUpdate()
      .select('*')
      .then((data) => data[0].is_locked);
  }

  _lockMigrations(trx) {
    const tableName = this._getLockTableName();

    return getTable(this.knex, tableName, this.config.schemaName)
      .transacting(trx)
      .update({
        is_locked: 1,
      });
  }

  _getLock(trx) {
    const transact = trx ? (fn) => fn(trx) : (fn) => this.knex.transaction(fn);
    return transact((trx) => {
      return this._isLocked(trx)
        .then((isLocked) => {
          if (isLocked) {
            throw new Error('Migration table is already locked');
          }
        })
        .then(() => this._lockMigrations(trx));
    }).catch((err) => {
      throw new LockError(err.message);
    });
  }

  _freeLock(trx = this.knex) {
    const tableName = this._getLockTableName();

    return getTable(trx, tableName, this.config.schemaName).update({
      is_locked: 0,
    });
  } // Run a batch of current migrations, in sequence.

  _runBatch(migrations, direction, trx) {
    return (
      this._getLock(trx) // When there is a wrapping transaction, some migrations
        // could have been done while waiting for the lock:
        .then(() => (trx ? this._listCompleted(trx) : []))
        .then(
          (completed) =>
            (migrations = (0, _lodash.difference)(migrations, completed))
        )
        .then(() =>
          _bluebird.default.all(
            (0, _lodash.map)(
              migrations,
              (0, _lodash.bind)(this._validateMigrationStructure, this)
            )
          )
        )
        .then(() => this._latestBatchNumber(trx))
        .then((batchNo) => {
          if (direction === 'up') batchNo++;
          return batchNo;
        })
        .then((batchNo) => {
          return this._waterfallBatch(batchNo, migrations, direction, trx);
        })
        .tap(() => this._freeLock(trx))
        .catch((error) => {
          let cleanupReady = _bluebird.default.resolve();

          if (error instanceof LockError) {
            // If locking error do not free the lock.
            helpers.warn(`Can't take lock to run migrations: ${error.message}`);
            helpers.warn(
              'If you are sure migrations are not running you can release the ' +
                'lock manually by deleting all the rows from migrations lock ' +
                'table: ' +
                this._getLockTableNameWithSchema()
            );
          } else {
            if (this._activeMigration.fileName) {
              helpers.warn(
                `migration file "${this._activeMigration.fileName}" failed`
              );
            }

            helpers.warn(`migration failed with error: ${error.message}`); // If the error was not due to a locking issue, then remove the lock.

            cleanupReady = this._freeLock(trx);
          }

          return cleanupReady.finally(function() {
            throw error;
          });
        })
    );
  } // Validates some migrations by requiring and checking for an `up` and `down`
  // function.

  _validateMigrationStructure(name) {
    const migration = require(_path.default.join(
      this._absoluteConfigDir(),
      name
    ));

    if (
      typeof migration.up !== 'function' ||
      typeof migration.down !== 'function'
    ) {
      throw new Error(
        `Invalid migration: ${name} must have both an up and down function`
      );
    }

    return name;
  } // Lists all migrations that have been completed for the current db, as an
  // array.

  _listCompleted(trx = this.knex) {
    const _this$config2 = this.config,
      tableName = _this$config2.tableName,
      schemaName = _this$config2.schemaName;
    return this._ensureTable(trx)
      .then(() =>
        trx
          .from(getTableName(tableName, schemaName))
          .orderBy('id')
          .select('name')
      )
      .then((migrations) =>
        (0, _lodash.map)(migrations, this.config.columnName)
      );
  } // Gets the migration list from the specified migration directory, as well as
  // the list of completed migrations to check what should be run.

  _migrationData() {
    return _bluebird.default.all([this._listAll(), this._listCompleted()]);
  } // Generates the stub template for the current migration, returning a compiled
  // template.

  _generateStubTemplate() {
    const stubPath =
      this.config.stub ||
      _path.default.join(__dirname, 'stub', this.config.extension + '.stub');

    return _bluebird.default
      .promisify(_fs.default.readFile, {
        context: _fs.default,
      })(stubPath)
      .then((stub) =>
        (0, _lodash.template)(stub.toString(), {
          variable: 'd',
        })
      );
  } // Write a new migration to disk, using the config and generated filename,
  // passing any `variables` given in the config to the template.

  _writeNewMigration(name, tmpl) {
    const config = this.config;

    const dir = this._absoluteConfigDir();

    if (name[0] === '-') name = name.slice(1);
    const filename = yyyymmddhhmmss() + '_' + name + '.' + config.extension;
    return _bluebird.default
      .promisify(_fs.default.writeFile, {
        context: _fs.default,
      })(_path.default.join(dir, filename), tmpl(config.variables || {}))
      .return(_path.default.join(dir, filename));
  } // Get the last batch of migrations, by name, ordered by insert id in reverse
  // order.

  _getLastBatch() {
    const _this$config3 = this.config,
      tableName = _this$config3.tableName,
      schemaName = _this$config3.schemaName;
    return getTable(this.knex, tableName, schemaName)
      .where('batch', function(qb) {
        qb.max('batch').from(getTableName(tableName, schemaName));
      })
      .orderBy('id', 'desc');
  } // Returns the latest batch number.

  _latestBatchNumber(trx = this.knex) {
    return trx
      .from(getTableName(this.config.tableName, this.config.schemaName))
      .max('batch as max_batch')
      .then((obj) => obj[0].max_batch || 0);
  } // If transaction config for a single migration is defined, use that.
  // Otherwise, rely on the common config. This allows enabling/disabling
  // transaction for a single migration at will, regardless of the common
  // config.

  _useTransaction(migration, allTransactionsDisabled) {
    const singleTransactionValue = (0, _lodash.get)(
      migration,
      'config.transaction'
    );
    return (0, _lodash.isBoolean)(singleTransactionValue)
      ? singleTransactionValue
      : !allTransactionsDisabled;
  } // Runs a batch of `migrations` in a specified `direction`, saving the
  // appropriate database information as the migrations are run.

  _waterfallBatch(batchNo, migrations, direction, trx) {
    const trxOrKnex = trx || this.knex;
    const _this$config4 = this.config,
      tableName = _this$config4.tableName,
      schemaName = _this$config4.schemaName,
      disableTransactions = _this$config4.disableTransactions;

    const directory = this._absoluteConfigDir();

    let current = _bluebird.default.bind({
      failed: false,
      failedOn: 0,
    });

    const log = [];
    (0, _lodash.each)(migrations, (migration) => {
      const name = migration;
      this._activeMigration.fileName = name;
      migration = require(directory + '/' + name); // We're going to run each of the migrations in the current "up".

      current = current
        .then(() => {
          if (!trx && this._useTransaction(migration, disableTransactions)) {
            return this._transaction(migration, direction, name);
          }

          return warnPromise(
            migration[direction](trxOrKnex, _bluebird.default),
            name
          );
        })
        .then(() => {
          log.push(_path.default.join(directory, name));

          if (direction === 'up') {
            return trxOrKnex.into(getTableName(tableName, schemaName)).insert({
              name,
              batch: batchNo,
              migration_time: new Date(),
            });
          }

          if (direction === 'down') {
            return trxOrKnex
              .from(getTableName(tableName, schemaName))
              .where({
                name,
              })
              .del();
          }
        });
    });
    return current.thenReturn([batchNo, log]);
  }

  _transaction(migration, direction, name) {
    return this.knex.transaction((trx) => {
      return warnPromise(
        migration[direction](trx, _bluebird.default),
        name,
        () => {
          trx.commit();
        }
      );
    });
  }

  _absoluteConfigDir() {
    return _path.default.resolve(process.cwd(), this.config.directory);
  }

  setConfig(config) {
    return (0, _lodash.assign)({}, CONFIG_DEFAULT, this.config || {}, config);
  }
} // Validates that migrations are present in the appropriate directories.

exports.default = Migrator;

function validateMigrationList(migrations) {
  const all = migrations[0];
  const completed = migrations[1];
  const diff = (0, _lodash.difference)(completed, all);

  if (!(0, _lodash.isEmpty)(diff)) {
    throw new Error(
      `The migration directory is corrupt, the following files are missing: ${diff.join(
        ', '
      )}`
    );
  }
}

function warnPromise(value, name, fn) {
  if (!value || typeof value.then !== 'function') {
    helpers.warn(`migration ${name} did not return a promise`);
    if (fn && typeof fn === 'function') fn();
  }

  return value;
} // Ensure that we have 2 places for each of the date segments.

function padDate(segment) {
  segment = segment.toString();
  return segment[1] ? segment : `0${segment}`;
} // Get a date object in the correct format, without requiring a full out library
// like "moment.js".

function yyyymmddhhmmss() {
  const d = new Date();
  return (
    d.getFullYear().toString() +
    padDate(d.getMonth() + 1) +
    padDate(d.getDate()) +
    padDate(d.getHours()) +
    padDate(d.getMinutes()) +
    padDate(d.getSeconds())
  );
} //Get schema-aware table name

function getTableName(tableName, schemaName) {
  return schemaName ? `${schemaName}.${tableName}` : tableName;
} //Get schema-aware query builder for a given table and schema name

function getTable(trxOrKnex, tableName, schemaName) {
  return schemaName
    ? trxOrKnex(tableName).withSchema(schemaName)
    : trxOrKnex(tableName);
} //Get schema-aware schema builder for a given schema nam

function getSchemaBuilder(trxOrKnex, schemaName) {
  return schemaName
    ? trxOrKnex.schema.withSchema(schemaName)
    : trxOrKnex.schema;
}

module.exports = exports.default;
