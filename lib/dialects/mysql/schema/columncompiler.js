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
function ColumnCompiler_MySQL() {
  _columncompiler.default.apply(this, arguments);

  this.modifiers = [
    'unsigned',
    'nullable',
    'defaultTo',
    'comment',
    'collate',
    'first',
    'after',
  ];
}

(0, _inherits.default)(ColumnCompiler_MySQL, _columncompiler.default); // Types
// ------

(0, _lodash.assign)(ColumnCompiler_MySQL.prototype, {
  increments({ primaryKey = true } = {}) {
    return primaryKey
      ? 'int unsigned not null auto_increment primary key'
      : 'int unsigned not null auto_increment';
  },

  bigincrements({ primaryKey = true } = {}) {
    return primaryKey
      ? 'bigint unsigned not null auto_increment primary key'
      : 'bigint unsigned not null auto_increment';
  },

  bigint: 'bigint',

  double(precision, scale) {
    if (!precision) return 'double';
    return `double(${this._num(precision, 8)}, ${this._num(scale, 2)})`;
  },

  integer(length) {
    length = length ? `(${this._num(length, 11)})` : '';
    return `int${length}`;
  },

  mediumint: 'mediumint',
  smallint: 'smallint',

  tinyint(length) {
    length = length ? `(${this._num(length, 1)})` : '';
    return `tinyint${length}`;
  },

  text(column) {
    switch (column) {
      case 'medium':
      case 'mediumtext':
        return 'mediumtext';

      case 'long':
      case 'longtext':
        return 'longtext';

      default:
        return 'text';
    }
  },

  mediumtext() {
    return this.text('medium');
  },

  longtext() {
    return this.text('long');
  },

  enu(allowed) {
    return `enum('${allowed.join("', '")}')`;
  },

  datetime: 'datetime',
  timestamp: 'timestamp',

  bit(length) {
    return length ? `bit(${this._num(length)})` : 'bit';
  },

  binary(length) {
    return length ? `varbinary(${this._num(length)})` : 'blob';
  },

  // Modifiers
  // ------
  defaultTo(value) {
    const defaultVal = ColumnCompiler_MySQL.super_.prototype.defaultTo.apply(
      this,
      arguments
    );

    if (this.type !== 'blob' && this.type.indexOf('text') === -1) {
      return defaultVal;
    }

    return '';
  },

  unsigned() {
    return 'unsigned';
  },

  comment(comment) {
    if (comment && comment.length > 255) {
      helpers.warn(
        'Your comment is longer than the max comment length for MySQL'
      );
    }

    return comment && `comment '${comment}'`;
  },

  first() {
    return 'first';
  },

  after(column) {
    return `after ${this.formatter.wrap(column)}`;
  },

  collate(collation) {
    return collation && `collate '${collation}'`;
  },
});
var _default = ColumnCompiler_MySQL;
exports.default = _default;
module.exports = exports.default;
