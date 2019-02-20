'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true,
});
exports.default = void 0;

var _inherits = _interopRequireDefault(require('inherits'));

var _columncompiler = _interopRequireDefault(
  require('../../../schema/columncompiler')
);

var helpers = _interopRequireWildcard(require('../../../helpers'));

var _lodash = require('lodash');

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

// MySQL Column Compiler
// -------
function ColumnCompiler_MSSQL() {
  _columncompiler.default.apply(this, arguments);

  this.modifiers = ['nullable', 'defaultTo', 'first', 'after', 'comment'];
}

(0, _inherits.default)(ColumnCompiler_MSSQL, _columncompiler.default); // Types
// ------

(0, _lodash.assign)(ColumnCompiler_MSSQL.prototype, {
  increments({ primaryKey = true } = {}) {
    return primaryKey
      ? 'int identity(1,1) not null primary key'
      : 'int identity(1,1) not null';
  },

  bigincrements({ primaryKey = true } = {}) {
    return primaryKey
      ? 'bigint identity(1,1) not null primary key'
      : 'bigint identity(1,1) not null';
  },

  bigint: 'bigint',

  double(precision, scale) {
    if (!precision) return 'decimal';
    return `decimal(${this._num(precision, 8)}, ${this._num(scale, 2)})`;
  },

  floating(precision, scale) {
    if (!precision) return 'decimal';
    return `decimal(${this._num(precision, 8)}, ${this._num(scale, 2)})`;
  },

  integer(length) {
    // ignore length
    return `int`;
  },

  mediumint: 'int',
  smallint: 'smallint',

  tinyint(length) {
    length = length ? `(${this._num(length, 1)})` : '';
    return `tinyint${length}`;
  },

  varchar(length) {
    return `nvarchar(${this._num(length, 255)})`;
  },

  text: 'nvarchar(max)',
  mediumtext: 'nvarchar(max)',
  longtext: 'nvarchar(max)',
  // TODO: mssql supports check constraints as of SQL Server 2008
  // so make enu here more like postgres
  enu: 'nvarchar(100)',
  uuid: 'uniqueidentifier',
  datetime: 'datetime',
  timestamp: 'datetime',

  bit(length) {
    if (length > 1) {
      helpers.warn('Bit field is exactly 1 bit length for MSSQL');
    }

    return 'bit';
  },

  binary(length) {
    return length ? `varbinary(${this._num(length)})` : 'varbinary(max)';
  },

  bool: 'bit',

  // Modifiers
  // ------
  defaultTo(value) {
    const defaultVal = ColumnCompiler_MSSQL.super_.prototype.defaultTo.apply(
      this,
      arguments
    );

    if (this.type !== 'blob' && this.type.indexOf('text') === -1) {
      return defaultVal;
    }

    return '';
  },

  first() {
    helpers.warn('Column first modifier not available for MSSQL');
    return '';
  },

  after(column) {
    helpers.warn('Column after modifier not available for MSSQL');
    return '';
  },

  comment(comment) {
    if (comment && comment.length > 255) {
      helpers.warn(
        'Your comment is longer than the max comment length for MSSQL'
      );
    }

    return '';
  },
});
var _default = ColumnCompiler_MSSQL;
exports.default = _default;
module.exports = exports.default;
