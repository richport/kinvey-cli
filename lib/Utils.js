/**
 * Copyright (c) 2018, Kinvey, Inc. All rights reserved.
 *
 * This software is licensed to you under the Kinvey terms of service located at
 * http://www.kinvey.com/terms-of-use. By downloading, accessing and/or using this
 * software, you hereby accept such terms of service  (and any agreement referenced
 * therein) and agree that you have read, understand and agree to be bound by such
 * terms of service and are of legal age to agree to such terms with Kinvey.
 *
 * This software contains valuable confidential and proprietary information of
 * KINVEY, INC and is subject to applicable licensing agreements.
 * Unauthorized reproduction, transmission or distribution of this file and its
 * contents is a violation of applicable laws.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const async = require('async');
const chalk = require('chalk');
const validUrl = require('valid-url');
const isemail = require('isemail');
const uuidV4 = require('uuid-v4');
const isempty = require('lodash.isempty');
const lodashGet = require('lodash.get');
const lodashOmitBy = require('lodash.omitby');
const lodashSortBy = require('lodash.sortby');
const logger = require('./logger.js');
const moment = require('moment');
const { ActiveItemTypes, DomainTypes, Errors, PromptMessages } = require('./Constants');
const KinveyError = require('./KinveyError');

const Utils = {};
Utils.formatHost = function formatHost(host) {
  let validHost = validUrl.isHttpUri(host);
  if (validHost) {
    if (validHost.slice(-1) !== '/') {
      validHost = `${validHost}/`;
    }
    return validHost;
  }

  validHost = validUrl.isHttpsUri(host);
  if (validHost) {
    if (validHost.slice(-1) !== '/') {
      validHost = `${validHost}/`;
    }
    return validHost;
  }

  return `https://${host}-manage.kinvey.com/`;
};

Utils.formatList = function formatList(list, name = 'name') {
  const result = list.map(el => ({
    name: el[name],
    value: el
  }));
  result.sort((x, y) => {
    if (x[name].toLowerCase() < y[name].toLowerCase()) return -1;
    return 1;
  });
  return result;
};

Utils.formatHostList = function formatHostList(list) {
  const result = list.map(el => ({
    name: el,
    value: el
  }));
  result.unshift({
    name: 'all hosts',
    value: null
  });
  return result;
};

Utils.readFile = function readFile(file, cb) {
  logger.debug('Reading contents from file %s', chalk.cyan(file));
  return fs.readFile(file, cb);
};

Utils.readJSON = function readJSON(file, cb) {
  logger.debug('Reading JSON from file %s', chalk.cyan(file));
  return async.waterfall([
    next => Utils.readFile(file, next),
    (data, next) => {
      let json = null;
      try {
        logger.debug('Parsing JSON from file: %s', chalk.cyan(file));
        json = JSON.parse(data);
      } catch (error) {
        logger.warn('Invalid JSON in file %s', chalk.cyan(file));
        return next(error);
      }
      return next(null, json);
    }
  ], cb);
};

/**
 * Reads a file synchronously and returns the data in JSON. Exceptions are not caught.
 * @param {string} filePath
 */
Utils.readJSONSync = function readJSONSync(filePath) {
  const rawData = fs.readFileSync(filePath);
  const jsonData = JSON.parse(rawData);
  return jsonData;
};

Utils.writeFile = function writeFile(file, contents, cb) {
  logger.debug('Writing contents to file %s', chalk.cyan(file));
  return fs.writeFile(file, contents, cb);
};

Utils.writeJSON = function writeJSON(file, json, cb) {
  const contents = JSON.stringify(json);
  return Utils.writeFile(file, contents, cb);
};

Utils.isValidMFAToken = function isValidMFAToken(value) {
  return (/^\d{6}$/.test(value));
};

Utils.isValidEmail = function isValidEmail(value) {
  return !Utils.isNullOrUndefined(value) && isemail(value);
};

Utils.isNullOrUndefined = function isNullOrUndefined(value) {
  return value == null;
};

Utils.isEmpty = function isEmpty(value) {
  return isempty(value);
};

Utils.isValidTimestamp = function isValidTimestamp(ts) {
  return moment(ts, moment.ISO_8601, true).isValid();
};

Utils.isValidNonZeroInteger = function isValidNonZeroInteger(number) {
  if (number === 0 || number === '0') return false;
  return /^\d+$/.test(number);
};

Utils.validateEmail = function validateEmail(value) {
  if (Utils.isValidEmail(value)) {
    return true;
  }

  return PromptMessages.INVALID_EMAIL_ADDRESS;
};

Utils.isStringWhitespace = function isStringWhitespace(value) {
  const trimmedValue = value.trim();
  return trimmedValue.length < 1;
};

Utils.askForValue = function askForValue(value) {
  if (Utils.isNullOrUndefined(value)) {
    return true;
  }

  return false;
};

Utils.validateString = function validateString(value) {
  if (!Utils.isStringWhitespace(value)) {
    return true;
  }

  return PromptMessages.INVALID_STRING;
};

Utils.validateMFAToken = function validateMFAToken(value) {
  if (Utils.isValidMFAToken(value)) {
    return true;
  }

  return PromptMessages.INVALID_MFA_TOKEN;
};

Utils.Endpoints = {
  getIdPartFromId: id => (Utils.isNullOrUndefined(id) ? '' : `/${id}`),
  version: schemaVersion => `v${schemaVersion}`,
  session: () => 'session',
  apps: (schemaVersion, appId) => `${Utils.Endpoints.version(schemaVersion)}/apps${Utils.Endpoints.getIdPartFromId(appId)}`,
  envs: (schemaVersion, envId) => `${Utils.Endpoints.version(schemaVersion)}/environments${Utils.Endpoints.getIdPartFromId(envId)}`,
  envsByAppId: (schemaVersion, appId) => `${Utils.Endpoints.apps(schemaVersion, appId)}/environments`,
  collections: (schemaVersion, envId, collName) => `${Utils.Endpoints.envs(schemaVersion, envId)}/collections${Utils.Endpoints.getIdPartFromId(collName)}`,
  orgs: (schemaVersion, orgId) => `${Utils.Endpoints.version(schemaVersion)}/organizations${Utils.Endpoints.getIdPartFromId(orgId)}`,
  jobs: (schemaVersion, id) => `${Utils.Endpoints.version(schemaVersion)}/jobs${Utils.Endpoints.getIdPartFromId(id)}`,
  services: (schemaVersion, serviceId) => `${Utils.Endpoints.version(schemaVersion)}/services${Utils.Endpoints.getIdPartFromId(serviceId)}`,
  serviceEnvs: (schemaVersion, serviceId, svcEnvId) => `${Utils.Endpoints.services(schemaVersion, serviceId)}/environments${Utils.Endpoints.getIdPartFromId(svcEnvId)}`,
  serviceStatus: (schemaVersion, serviceId, svcEnvId) => `${Utils.Endpoints.serviceEnvs(schemaVersion, serviceId, svcEnvId)}/status`,
  serviceLogs: (schemaVersion, serviceId, svcEnvId) => `${Utils.Endpoints.serviceEnvs(schemaVersion, serviceId, svcEnvId)}/logs`,
  sites: (schemaVersion, siteId) => `${Utils.Endpoints.version(schemaVersion)}/sites${Utils.Endpoints.getIdPartFromId(siteId)}`,
  siteEnvs: (schemaVersion, siteId, siteEnvId) => `${Utils.Endpoints.sites(schemaVersion, siteId)}/environments${Utils.Endpoints.getIdPartFromId(siteEnvId)}`,
  siteDeploy: (schemaVersion, siteId, siteEnvId) => `${Utils.Endpoints.siteEnvs(schemaVersion, siteId, siteEnvId)}/files`,
  sitePublish: (schemaVersion, siteId) => `${Utils.Endpoints.sites(schemaVersion, siteId)}/publish`,
  siteUnpublish: (schemaVersion, siteId) => `${Utils.Endpoints.sites(schemaVersion, siteId)}/unpublish`,
  siteStatus: (schemaVersion, siteId) => `${Utils.Endpoints.sites(schemaVersion, siteId)}/status`
};

Utils.getCommandNameFromOptions = function getCommandNameFromOptions(options) {
  let name;
  if (options._ && options._.length) {
    name = options._.join(' ');
  }

  return name;
};

Utils.getErrorFromRequestError = function getErrorFromRequestError(err) {
  let errResult;
  const errCode = err.code;
  if (errCode === 'ENOTFOUND') {
    errResult = new KinveyError(Errors.InvalidConfigUrl);
  } else if (errCode === 'ETIMEDOUT') {
    errResult = new KinveyError(Errors.RequestTimedOut);
  } else if (errCode === 'ECONNRESET') {
    errResult = new KinveyError(Errors.ConnectionReset);
  } else if (errCode === 'ECONNREFUSED') {
    errResult = new KinveyError(errCode, `Connection refused at ${err.address}`);
  } else {
    errResult = err;
  }

  return errResult;
};

Utils.isMFATokenError = function isMFATokenError(err) {
  return err && err.name === 'InvalidTwoFactorAuth';
};

Utils.findAndSortInternalServices = function findAndSortInternalServices(services) {
  const result = services.filter(el => el.type === 'internal');
  result.sort((x, y) => {
    if (x.name.toLowerCase() < y.name.toLowerCase()) {
      return -1;
    }

    return 1;
  });

  return result;
};

Utils.isArtifact = function isArtifact(artifacts, base, filepath) {
  const relative = path.normalize(path.relative(base, filepath));
  for (let i = 0; i < artifacts.length; i += 1) {
    const pattern = artifacts[i];
    if (relative.indexOf(pattern) === 0 || (`${relative}/`) === pattern) return true;
  }
  return false;
};

Utils.getDeviceInformation = function getDeviceInformation(cliVersion) {
  const info = `kinvey-cli/${cliVersion} ${os.platform()} ${os.release()}`;
  return info;
};

/**
 * Asserts whether a value is of UUID v4 format. Values without dashes are accepted, too.
 * Returns false if value is null or undefined.
 * @param {String} value
 * @returns {*}
 */
Utils.isUUID = function isUUID(value) {
  if (Utils.isNullOrUndefined(value)) {
    return false;
  }

  const dash = '-';
  const lengthWithDashes = 36;
  const lengthValue = value.length;
  const couldBeRegularUUUID = value.includes(dash) && lengthValue === lengthWithDashes;
  if (couldBeRegularUUUID) {
    return uuidV4.isUUID(value);
  }

  const lengthWithoutDashes = 32;
  const couldBeUUIDWithoutDashes = lengthValue === lengthWithoutDashes;
  if (!couldBeUUIDWithoutDashes) {
    return false;
  }

  const valueWithDashes = `${value.slice(0, 8)}${dash}${value.slice(8, 12)}${dash}${value.slice(12, 16)}${dash}${value.slice(16, 20)}${dash}${value.slice(20)}`;
  return uuidV4.isUUID(valueWithDashes);
};

Utils.isEnvID = function isEnvID(value) {
  if (Utils.isNullOrUndefined(value)) {
    return false;
  }

  // kid_SklZwh7dN
  const lengthEnvId = 13;
  const isId = value.length === lengthEnvId && value.startsWith('kid_');
  return isId;
};

Utils.validateActiveItemType = function validateActiveItemType(itemType) {
  if (!ActiveItemTypes.includes(itemType)) {
    throw new KinveyError(`Invalid item type: ${itemType}.`);
  }
};

/**
 * Returns error for ItemNotSpecified.
 * @param {Constants.EntityType} entityType
 * @returns {KinveyError}
 */
Utils.getItemError = function getItemError(entityType) {
  const msg = `No ${entityType} identifier is specified and active ${entityType} is not set.`;
  return new KinveyError(Errors.ItemNotSpecified.NAME, msg);
};

Utils.isEntityError = function isEntityError(err) {
  if (Utils.isNullOrUndefined(err)) {
    return false;
  }

  return err.name === Errors.NoEntityFound.NAME || err.name === Errors.TooManyEntitiesFound.NAME;
};

/**
 * Returns error for generic entity errors with custom message.
 * @param {Constants.EntityType} entityType
 * @param {String} identifier
 * @param {String} errName Error name. Must be either 'NotFound' or 'TooManyFound'.
 * @returns {KinveyError}
 */
Utils.getCustomEntityError = function getCustomEntityError(entityType, identifier, errName) {
  if (errName === Errors.NoEntityFound.NAME) {
    return Utils.getCustomNotFoundError(entityType, identifier);
  }

  if (errName === Errors.TooManyEntitiesFound.NAME) {
    const lastPart = identifier ? ` with identifier '${identifier}'.` : '.';
    const msg = `Found too many ${entityType}s${lastPart}`;
    return new KinveyError(Errors.TooManyEntitiesFound.NAME, msg);
  }

  return new KinveyError('UnknownError', `Failed to construct proper error for error name: ${errName}`);
};

Utils.getCustomNotFoundError = function getCustomNotFoundError(entityType, identifier) {
  const lastPart = identifier ? ` with identifier '${identifier}'.` : '.';
  const msg = `Could not find ${entityType}${lastPart}`;
  return new KinveyError(Errors.NoEntityFound.NAME, msg);
};

/**
 * Returns original error or an error with custom message (if initial error is a generic entity error).
 * @param {Error} err
 * @param {Constants.EntityType} entityType
 * @param {String} identifier
 * @returns {Error}
 */
Utils.getTransformedError = function getTransformedError(err, entityType, identifier) {
  if (!Utils.isEntityError(err)) {
    return err;
  }

  return Utils.getCustomEntityError(entityType, identifier, err.name);
};

Utils.getValueFromObject = function getValueFromObject(obj, path, defaultValue = 'Not set') {
  return lodashGet(obj, path, defaultValue);
};

Utils.mapFromSource = function mapFromSource(mapping, originalSource) {
  const mappingKeys = Object.keys(mapping);
  const sourceIsArr = Array.isArray(originalSource);
  let source;
  if (!sourceIsArr) {
    source = [originalSource];
  } else {
    source = originalSource;
  }

  const result = source.map((item) => {
    const targetItem = {};

    mappingKeys.forEach((k) => {
      let targetKeyValue;
      const valueOfMappingKey = mapping[k];
      if (typeof valueOfMappingKey === 'function') {
        targetKeyValue = valueOfMappingKey(item);
      } else {
        targetKeyValue = Utils.getValueFromObject(item, mapping[k]);
      }

      targetItem[k] = targetKeyValue;
    });

    return targetItem;
  });

  return sourceIsArr ? result : result[0];
};

/**
 * Returns an object from a string of key-value pairs where key1[secondaryDelimiter]value[primaryDelimiter] (e.g key1=value1,key2=value2).
 * Throws an error if pattern is not valid.
 * @param {String} dsv Delimiter separated key-values.
 * @param {String} primaryDelimiter Delimiter that separates key-value pairs.
 * @param {String} secondaryDelimiter Delimiter that separates keys from values.
 * @returns {Object}
 */
Utils.getObjectFromDelimiterSeparatedKeyValuePairs = function getObjectFromDelimiterSeparatedKeyValuePairs(dsv, primaryDelimiter = ',', secondaryDelimiter = '=') {
  if (typeof dsv !== 'string') {
    throw new Error('Expected string.');
  }

  const listOfKeyValuePairs = dsv.split(primaryDelimiter);
  if (Utils.isEmpty(listOfKeyValuePairs)) {
    throw new Error('Empty list.');
  }

  const result = {};
  listOfKeyValuePairs.reduce((accumulator, pair) => {
    const delimiterIndex = pair.indexOf(secondaryDelimiter);
    if (delimiterIndex < 0) {
      throw new Error(`No delimiter ('${secondaryDelimiter}') in '${pair}'.`);
    }

    const key = pair.substring(0, delimiterIndex);
    const value = pair.substring(delimiterIndex + 1, pair.length);
    if (key.length < 1 || value.length < 1) {
      throw new Error(`Invalid key-value pair: ${pair}`);
    }

    accumulator[key] = value;
    return accumulator;
  }, result);

  return result;
};

/**
 * Sorts a list of objects.
 * @param {Array} list
 * @param {String} [property] Property to sort by. Defaults to 'name'.
 * @returns {Array.<Object>}
 */
Utils.sortList = function sortList(list, property = 'name') {
  return lodashSortBy(list, x => x[property].toLowerCase());
};

/**
 * Returns a message that contains info about the entity in use.
 * @param {Constants.EntityType} entityType
 * @param identifier
 * @returns {string}
 */
Utils.getUsingEntityMsg = function getUsingEntityMsg(entityType, identifier) {
  return `Using ${entityType}: ${identifier}`;
};

/**
 * Removes keys from object that have value of null or undefined. Returns new object.
 * @param {Object} obj
 * @returns {Object}
 */
Utils.stripNullOrUndefined = function stripNullOrUndefined(obj) {
  return lodashOmitBy(obj, Utils.isNullOrUndefined);
};

module.exports = Utils;
