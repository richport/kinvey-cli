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

const express = require('express');
const bodyParser = require('body-parser');
const isEqual = require('lodash.isequal');

const { HTTPMethod, ServiceStatus } = require('./../lib/Constants');
const { isEmpty } = require('./../lib/Utils');
const fixtureUser = require('./fixtures/user.json');
const fixtureApps = require('./fixtures/apps.json');
const fixtureApp = require('./fixtures/app.json');
const fixtureEnvs = require('./fixtures/envs.json');
const fixtureEnv = require('./fixtures/env.json');
const fixtureCollections = require('./fixtures/collections.json');
const fixtureCollection = require('./fixtures/collection.json');
const fixtureOrgs = require('./fixtures/orgs.json');
const fixtureServices = require('./fixtures/datalinks.json');
const fixtureInternalFlexService = require('./fixtures/internal-flex-service.json');
const fixtureSvcEnvs = require('./fixtures/svc-envs-one.json');
const fixtureServicesStatuses = require('./fixtures/datalinks-status-response.json');
const fixtureSites = require('./fixtures/sites');
const fixtureSiteEnvBody = require('./fixtures/site-env-body');
const fixtureSiteEnvs = require('./fixtures/site-envs-one');
const fixtureJob = require('./fixtures/job.json');
const fixtureJobs = require('./fixtures/jobs.json');
const fixtureInternalDataLink = require('./fixtures/kinvey-dlc.json');
const fixtureLogs = require('./fixtures/logs.json');

const fixtureSvcEnv = fixtureSvcEnvs[0];

const testsConfig = require('./TestsConfig');

const existentUserOne = fixtureUser.existentOne;

const serviceNotFound = {
  code: 'ServiceNotFound',
  description: 'The specified service could not be found.'
};
const svcEnvNotFound = {
  code: 'ServiceEnvironmentNotFound',
  description: 'The specified service environment could not be found.'
};

const siteNotFound = {
  code: 'SiteNotFound',
  description: 'The specified website could not be found.'
};

let server;

function runServer(app, port, done) {
  server = app.listen(port, (err) => {
    if (done) {
      // console.log(`Mock server running on ${port}`);
      return done(err, server);
    }

    console.log(`Mock server running on ${port}`);
  });
}

function isAuthenthicated(headers, expectedToken) {
  if (!headers) {
    return false;
  }

  const expectedHeaderValue = `Kinvey ${expectedToken}`;
  return headers.authorization === expectedHeaderValue;
}

function build(
  {
    schemaVersion = testsConfig.defaultSchemaVersion,
    port = testsConfig.port,
    existentUser = fixtureUser.existent,
    token = fixtureUser.token,
    nonExistentUser = fixtureUser.nonexistent,
    serviceStatus = ServiceStatus.ONLINE,
    svcEnvs = fixtureSvcEnvs,
    orgs = fixtureOrgs,
    apps = fixtureApps,
    sites = fixtureSites,
    site = fixtureSites[0],
    siteEnvBody = fixtureSiteEnvBody,
    siteEnvs = fixtureSiteEnvs,
    service = fixtureInternalFlexService,
    updatedSvcEnv = null,
    envVars = null,
    envs = fixtureEnvs,
    runtime = null,
    colls = fixtureCollections,
    jobType = 'recycleService',
    serviceLogsQuery = {},
    domainType = 'appId', // appId, organizationId
    domainEntityId = fixtureApp.id,
    require2FAToken = false,
    twoFactorToken = fixtureUser.validTwoFactorToken
  },
  done
) {
  const versionPart = `v${schemaVersion}`;

  const app = express();

  app.use(bodyParser.json());

  app.use((req, res, next) => {
    const requiresAuth = !(req.method === HTTPMethod.POST && req.url === '/session');
    if (requiresAuth) {
      const isAuth = isAuthenthicated(req.headers, token);
      if (!isAuth) {
        return res.status(401).send({
          code: 'InvalidCredentials',
          description: 'Authorization token invalid or expired.'
        });
      }
    }

    next();
  });

  // LOGIN/LOGOUT
  app.post('/session', (req, res) => {
    if (!req.body) {
      return res.sendStatus(400);
    }

    const errTwoFactorToken = {
      code: 'InvalidTwoFactorAuth',
      description: 'Two-factor authentication is required, but a token was missing from your request.'
    };

    if (require2FAToken && req.body.twoFactorToken !== twoFactorToken.toString()) {
      return res.status(403).send(errTwoFactorToken);
    }

    const email = req.body.email;
    const pass = req.body.password;
    if (email === existentUser.email && pass === existentUser.password) {
      return res.send({ email: existentUser.email, token: fixtureUser.token });
    } else if (email === existentUserOne.email && pass === existentUserOne.password) {
      return res.send({ email: existentUserOne.email, token: fixtureUser.tokenOne });
    } else if (email === nonExistentUser.email && pass === nonExistentUser.password) {
      return res.status(401).send({
        code: 'InvalidCredentials',
        description: 'Invalid e-mail and/or password.'
      });
    }

    const errRes = {
      code: 'ValidationError',
      description: 'Validation failed.',
      errors: [{
        field: 'password',
        message: 'Missing required property: password'
      }]
    };

    res.status(422).send(errRes);
  });

  app.delete('/session', (req, res) => res.sendStatus(204));

  // SERVICES
  app.get(`/${versionPart}/services/:id/environments/:envId/status`, (req, res) => {
    const id = req.params.id;
    const service = fixtureServices.find(x => x.id === id);
    if (!service) {
      return res.status(404).send(serviceNotFound);
    }

    const envId = req.params.envId;
    const status = fixtureServicesStatuses.find(dl => dl.id === envId);
    if (!status) {
      return res.status(404).send(svcEnvNotFound);
    }

    res.send(status.status);
  });

  app.get(`/${versionPart}/services/:id/environments/:envId/logs`, (req, res) => {
    const id = req.params.id;
    const service = fixtureServices.find(x => x.id === id);
    if (!service) {
      return res.status(404).send(serviceNotFound);
    }

    const envId = req.params.envId;
    const status = svcEnvs.find(x => x.id === envId);
    if (!status) {
      return res.status(404).send(svcEnvNotFound);
    }

    const query = req.query;
    if (!isEqual(query, serviceLogsQuery)) {
      return res.status(400).send({ description: `CLI sent bad query: ${JSON.stringify(query)}` });
    }

    res.send(fixtureLogs);
  });

  app.get(`/${versionPart}/services/:id/environments/:envId`, (req, res) => {
    const id = req.params.id;
    const wantedService = fixtureServices.find(x => x.id === id);
    if (!wantedService) {
      return res.status(404).send(serviceNotFound);
    }

    const envId = req.params.envId;
    const svcEnv = svcEnvs.find(x => x.id === envId);
    if (!svcEnv) {
      return res.status(404).send(svcEnvNotFound);
    }

    res.send(svcEnv);
  });

  app.get(`/${versionPart}/services/:id/environments`, (req, res) => {
    const id = req.params.id;
    const wantedService = fixtureServices.find(x => x.id === id);
    if (!wantedService) {
      return res.status(404).send(serviceNotFound);
    }

    res.send(svcEnvs);
  });

  app.post(`/${versionPart}/services/:id/environments`, (req, res) => {
    const body = req.body;
    if (!body) {
      return res.sendStatus(400);
    }

    const runtimesDiffer = runtime != body.runtime;
    const envVarsDiffer = (envVars && !isEqual(body.environmentVariables, envVars)) ||
      (!envVars && body.environmentVariables);
    if (!body.name || !body.secret || envVarsDiffer || runtimesDiffer) {
      return res.sendStatus(400);
    }

    const result = Object.assign({ id: fixtureSvcEnv.id }, body);
    res.status(201).send(result);
  });

  app.put(`/${versionPart}/services/:id/environments/:envId`, (req, res) => {
    const id = req.params.id;
    const wantedService = fixtureServices.find(x => x.id === id);
    if (!wantedService) {
      return res.status(404).send(serviceNotFound);
    }

    const svcEnvId = req.params.envId;
    if (!svcEnvs.find(x => x.id === svcEnvId)) {
      return res.status(404).send(svcEnvNotFound);
    }

    if (!isEqual(req.body, updatedSvcEnv)) {
      return res.status(400).send(req.body);
    }

    return res.send(req.body);
  });

  app.get(`/${versionPart}/services/:id`, (req, res) => {
    const id = req.params.id;
    const wantedService = fixtureServices.find(x => x.id === id);
    if (wantedService) {
      res.send(wantedService);
    } else {
      res.status(404).send(serviceNotFound);
    }
  });

  app.get(`/${versionPart}/services`, (req, res) => {
    const query = req.query;
    const unexpectedQueryIsSent = !domainType && !isEmpty(query);
    const queryIsWrong = domainType && Object.keys(query)[0] !== domainType;
    if (unexpectedQueryIsSent || queryIsWrong) {
      return res.status(400).send({ description: `CLI sent bad query: ${JSON.stringify(query)}. Expected: ${domainType}: ${domainEntityId}` });
    }

    if (domainType && query[domainType] !== domainEntityId) {
      return res.send([]);
    }

    res.send(fixtureServices);
  });

  app.post(`/${versionPart}/services`, (req, res) => {
    const body = req.body;
    if (!body.name || body.name !== service.name || body.type !== service.type) {
      return res.sendStatus(400);
    }

    res.status(201).send(service);
  });


  app.delete(`/${versionPart}/services/:id`, (req, res) => {
    const id = req.params.id;
    if (id === service.id) {
      return res.sendStatus(204);
    }

    res.status(404).send(siteNotFound);
  });


  // SITES
  app.post(`/${versionPart}/sites/:id/environments`, (req, res) => {
    const id = req.params.id;
    if (!sites.find(x => x.id === id)) {
      return res.status(404).send(siteNotFound);
    }

    if (!isEqual(req.body, siteEnvBody)) {
      return res.status(400).send(`CLI sent bad body: ${JSON.stringify(req.body, null, 2)}`);
    }

    res.status(201).send(siteEnvs[0]);
  });

  app.get(`/${versionPart}/sites/:id/environments`, (req, res) => {
    const id = req.params.id;
    if (!sites.find(x => x.id === id)) {
      return res.status(404).send(siteNotFound);
    }

    res.status(200).send(siteEnvs);
  });

  app.post(`/${versionPart}/sites/:id/publish`, (req, res) => {
    const body = req.body;
    if (!body || !body.environmentId || body.type !== 'kinvey' || body.domainName !== site.name) {
      return res.status(400).send(`CLI sent bad body: ${JSON.stringify(body, null, 2)}`);
    }

    const id = req.params.id;
    if (!sites.find(x => x.id === id)) {
      return res.status(404).send(siteNotFound);
    }

    res.status(200).send({
      lastPublishedAt: '2018-12-26T11:49:46.096Z',
      environmentId: '8c204740466f4b8dabf114ee6a3e09d6',
      publicUrl: 'https://a0.dev.kinvey.rocks'
    });
  });

  app.post(`/${versionPart}/sites/:id/unpublish`, (req, res) => {
    const id = req.params.id;
    if (!sites.find(x => x.id === id)) {
      return res.status(404).send(siteNotFound);
    }

    res.sendStatus(204);
  });

  app.delete(`/${versionPart}/sites/:id`, (req, res) => {
    const id = req.params.id;
    if (!sites.find(x => x.id === id)) {
      return res.status(404).send(siteNotFound);
    }

    res.sendStatus(204);
  });

  app.get(`/${versionPart}/sites/:id`, (req, res) => {
    const id = req.params.id;
    const site = sites.find(x => x.id === id);
    if (!site) {
      return res.status(404).send(siteNotFound);
    }

    res.status(200).send(site);
  });

  app.get(`/${versionPart}/sites`, (req, res) => {
    res.send(sites);
  });

  app.post(`/${versionPart}/sites`, (req, res) => {
    const body = req.body;
    if (!body || body.name !== site.name) {
      return res.status(400).send(`CLI sent bad body: ${JSON.stringify(body, null, 2)}`);
    }

    res.status(201).send(site);
  });


  // JOBS
  app.get(`/${versionPart}/jobs/:id`, (req, res) => {
    const id = req.params.id;
    if (!id) {
      return res.send([]);
    }

    const wantedJob = fixtureJobs.find(x => x.jobId === id);
    if (wantedJob) {
      res.send(wantedJob);
    } else {
      res.status(404).send({
        code: 'JobNotFound',
        description: 'The specified job could not be found.'
      });
    }
  });

  app.post(`/${versionPart}/jobs`, (req, res) => {
    const body = req.body;
    const isAsExpected = body && body.type === jobType && body.params && body.params.serviceId === fixtureInternalDataLink.id
      && svcEnvs.find(x => x.id === body.params.serviceEnvironmentId);
    if (!isAsExpected) {
      if (body.params.serviceId !== fixtureInternalDataLink.id) {
        return res.status(404).send(serviceNotFound);
      }

      if (!svcEnvs.find(x => x.id === body.params.serviceEnvironmentId)) {
        return res.status(404).send(svcEnvNotFound);
      }

      return res.status(400).send({ description: `CLI has constructed bad job: ${JSON.stringify(body)}` });
    }

    res.send({ job: 'idOfJobThatIsRecyclingTheService' });
  });


  // ENVS BY APP
  app.get(`/${versionPart}/apps/:id/environments`, (req, res) => {
    const id = req.params.id;
    const wantedApp = apps.find(x => x.id === id);
    if (!wantedApp) {
      return res.status(404).send({
        code: 'AppNotFound',
        description: 'The specified app could not be found.'
      });
    }

    res.send(envs);
  });

  app.post(`/${versionPart}/apps/:id/environments`, (req, res) => {
    const id = req.params.id;
    const wantedApp = apps.find(x => x.id === id);
    if (!wantedApp) {
      return res.status(404).send({
        code: 'AppNotFound',
        description: 'The specified app could not be found.'
      });
    }

    if (!req.body.name || req.body.name !== fixtureEnv.name) {
      return res.sendStatus(400);
    }

    res.send(fixtureEnv);
  });

  // COLLECTIONS
  app.get(`/${versionPart}/environments/:id/collections`, (req, res) => {
    const id = req.params.id;
    const wantedEnv = envs.find(x => x.id === id);
    if (wantedEnv) {
      return res.send(colls);
    }

    res.status(404).send({
      code: 'EnvironmentNotFound',
      description: 'The specified environment could not be found.'
    });
  });

  app.post(`/${versionPart}/environments/:id/collections`, (req, res) => {
    const id = req.params.id;
    const wantedEnv = envs.find(x => x.id === id);
    if (!wantedEnv) {
      return res.status(404).send({
        code: 'EnvironmentNotFound',
        description: 'The specified environment could not be found.'
      });
    }

    if (!req.body.name || req.body.name !== fixtureCollection.name) {
      return res.sendStatus(400);
    }

    res.send(fixtureCollection);
  });

  app.delete(`/${versionPart}/environments/:id/collections/:name`, (req, res) => {
    const id = req.params.id;
    const wantedEnv = envs.find(x => x.id === id);
    if (!wantedEnv) {
      return res.status(404).send({
        code: 'EnvironmentNotFound',
        description: 'The specified environment could not be found.'
      });
    }

    if (req.params.name !== fixtureCollection.name) {
      return res.status(404).send({
        code: 'CollectionNotFound',
        description: 'The specified collection could not be found.'
      });
    }

    res.sendStatus(204);
  });

  // ENVS
  app.get(`/${versionPart}/environments/:id`, (req, res) => {
    const id = req.params.id;
    const wantedEnv = envs.find(x => x.id === id);
    if (wantedEnv) {
      return res.send(wantedEnv);
    }

    res.status(404).send({
      code: 'EnvironmentNotFound',
      description: 'The specified environment could not be found.'
    });
  });

  app.delete(`/${versionPart}/environments/:id`, (req, res) => {
    const id = req.params.id;
    const wantedEnv = envs.find(x => x.id === id);
    if (wantedEnv) {
      return res.sendStatus(204);
    }

    res.status(404).send({
      code: 'EnvironmentNotFound',
      description: 'The specified environment could not be found.'
    });
  });

  // APPS
  app.get(`/${versionPart}/apps/:id`, (req, res) => {
    const id = req.params.id;
    const wantedApp = apps.find(x => x.id === id);
    if (wantedApp) {
      return res.send(wantedApp);
    }

    res.status(404).send({
      code: 'AppNotFound',
      description: 'The specified app could not be found.'
    });
  });

  app.delete(`/${versionPart}/apps/:id`, (req, res) => {
    const id = req.params.id;
    if (apps.find(x => x.id === id)) {
      return res.sendStatus(204);
    }

    res.status(404).send({
      code: 'AppNotFound',
      description: 'The specified app could not be found.'
    });
  });

  app.get(`/${versionPart}/apps`, (req, res) => {
    res.send(apps);
  });

  app.post(`/${versionPart}/apps`, (req, res) => {
    if (!req.body.name || req.body.name !== fixtureApp.name) {
      return res.sendStatus(400);
    }

    res.status(201).send(fixtureApp);
  });

  // ORGS
  app.get(`/${versionPart}/organizations/:id`, (req, res) => {
    const id = req.params.id;
    if (id) {
      const wantedOrg = orgs.find(x => x.id === id);
      if (wantedOrg) {
        return res.send(wantedOrg);
      }
    }

    res.status(404).send({
      code: 'OrganizationNotFound',
      description: 'The specified organization could not be found.'
    });
  });

  app.get(`/${versionPart}/organizations`, (req, res) => {
    res.send(orgs);
  });

  app.all('/', (req, res) => {
    res.send(404);
  });

  if (server && server.listening === true) {
    server.close(() => {
      runServer(app, port, done);
    });
  } else {
    runServer(app, port, done);
  }
}

// build({});


module.exports = (originalOptions, done) => {
  const options = originalOptions || {};
  return build(options, done);
};
