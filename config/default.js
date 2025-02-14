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

const path = require('path');
const os = require('os');

module.exports = {
  host: 'https://manage.kinvey.com/',
  logFetchDefault: 100,
  logFetchLimit: 2000,
  defaultSchemaVersion: 3,
  artifacts: ['.git', '.svn', 'node_modules', 'output.log'],
  timeout: 10 * 1000,
  flexProjectUploadTimeout: 30 * 1000,
  siteUploadTimeout: 40 * 1000,
  paths: {
    project: path.join(process.cwd(), '.kinvey'),
    package: path.join(process.cwd()),
    session: path.join(os.homedir(), '.kinvey-cli')
  }
};
