'use strict';
var v, isElectron = process.versions && process.versions.electron;
if (process.platform === 'win32') {
	module.exports = require('./bin/win32-'+process.arch+'-54/fswin.node');
} else {
	throw 'this module only works on windows';
}