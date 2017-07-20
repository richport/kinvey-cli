/**
 * Copyright (c) 2017, Kinvey, Inc. All rights reserved.
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

const config = require('config');
const api = require('./lib/api.js');
const prompt = require('../lib/prompt.js');
const user = require('../lib/user.js');
const util = require('../lib/util.js');
const constants = require('./../lib/constants');

const invalidEmail = 'invalid@example.com';
const invalidPassword = 'invalidPass';

const helper = {
  assertLoginIsSuccessful(err, mock, token, done) {
    expect(err).to.not.exist;
    expect(user.isLoggedIn()).to.be.true;
    expect(user.getToken()).to.equal(token);
    expect(mock.isDone()).to.be.true;
    done();
  },
  setCredentialsInEnvironment(user, password) {
    process.env[constants.EnvironmentVariables.User] = user;
    process.env[constants.EnvironmentVariables.Password] = password;
  },
  unsetCredentialsInEnvironment() {
    delete process.env[constants.EnvironmentVariables.User];
    delete process.env[constants.EnvironmentVariables.Password];
  }
};

describe('user', () => {
  describe('isLoggedIn', () => {
    it('should return true if the token was set.', () => {
      user.host = 'abc';
      user.tokens = {
        abc: 123
      };
      return expect(user.isLoggedIn()).to.be.true;
    });

    it('should return false if the token was not set.', () => {
      user.tokens = null;
      user.host = null;
      return expect(user.isLoggedIn()).to.be.false;
    });
  });

  describe('login', () => {
    beforeEach('token', () => {
      return user.token = null;
    });
    before('token', () => {
      return this.token = '123';
    });
    after('token', () => {
      return delete this.token;
    });
    before('email', () => {
      return this.email = 'bob@example.com';
    });
    before('password', () => {
      return this.password = 'test123';
    });
    after('email', () => {
      return delete this.email;
    });
    after('password', () => {
      return delete this.password;
    });

    describe('given valid credentials', () => {
      beforeEach('api', () => {
        this.mock = api
          .post('/session', { email: this.email, password: this.password })
          .reply(200, { email: this.email, token: this.token
        });
      });

      afterEach('api', () => {
        delete this.mock;
        helper.unsetCredentialsInEnvironment();
      });

      it('as args should login.', (cb) => {
        user.login(this.email, this.password, (err) => {
          helper.assertLoginIsSuccessful(err, this.mock, this.token, cb);
        });
      });

      it('as env variables should login', (cb) => {
        helper.setCredentialsInEnvironment(this.email, this.password);

        user.login(null, null, (err) => {
          helper.assertLoginIsSuccessful(err, this.mock, this.token, cb);
        });
      });

      it('as args and invalid as env variables should login', (cb) => {
        helper.setCredentialsInEnvironment(invalidEmail, invalidPassword);

        user.login(this.email, this.password, (err) => {
          helper.assertLoginIsSuccessful(err, this.mock, this.token, cb);
        });
      });
    });

    describe('given invalid credentials', () => {
      beforeEach('api', () => {
        this.mock = api.post('/session')
          .reply(401, {
            code: 'InvalidCredentials',
            description: ''
          });
      });
      afterEach('api', () => {
        helper.unsetCredentialsInEnvironment();
        this.mock.done();
        return delete this.mock;
      });
      before('stub', () => {
        const stub = sinon.stub(prompt, 'getEmailPassword');
        return stub.callsArgWith(2, null, this.email, this.password);
      });
      afterEach('stub', () => {
        return prompt.getEmailPassword.reset();
      });
      after('stub', () => {
        return prompt.getEmailPassword.restore();
      });

      it('should retry when credentials are provided as args', (cb) => {
        this.mock.post('/session')
          .reply(200, {
            email: this.email,
            token: this.token
          });

        user.login(invalidEmail, this.password, (err) => {
          expect(prompt.getEmailPassword).to.be.calledTwice;
          expect(prompt.getEmailPassword).to.be.calledWith(null, null);
          return cb(err);
        });
      });

      it('should not retry when credentials are provided from environment', (cb) => {
        helper.setCredentialsInEnvironment(invalidEmail, invalidPassword);

        user.login(null, null, (err) => {
          expect(err).to.not.exist;
          expect(prompt.getEmailPassword).to.be.calledOnce;
          expect(prompt.getEmailPassword).to.be.calledWith(invalidEmail, invalidPassword);
          cb();
        });
      });
    });

    describe('given incomplete credentials', () => {
      beforeEach('api', () => {
        return this.mock = api.post('/session').reply(200, {
          email: this.email,
          token: this.token
        });
      });
      afterEach('api', () => {
        this.mock.done();
        return delete this.mock;
      });
      before('stub', () => {
        const stub = sinon.stub(prompt, 'getEmailPassword');
        return stub.callsArgWith(2, null, this.email, this.password);
      });
      afterEach('stub', () => {
        return prompt.getEmailPassword.reset();
      });
      after('stub', () => {
        return prompt.getEmailPassword.restore();
      });
      return it('should prompt.', (cb) => {
        return user.login(void 0, this.password, ((err) => {
          expect(prompt.getEmailPassword).to.be.calledOnce;
          expect(prompt.getEmailPassword).to.be.calledWith(void 0, this.password);
          return cb(err);
        }));
      });
    });
  });
  describe('logout', () => {
    before('stub', () => {
      return sinon.stub(util, 'writeJSON').callsArg(2);
    });
    afterEach('stub', () => {
      return util.writeJSON.reset();
    });
    after('stub', () => {
      return util.writeJSON.restore();
    });
    return it('should clear token data from session file.', (cb) => {
      return user.logout((err) => {
        expect(util.writeJSON).to.be.calledOnce;
        expect(util.writeJSON).to.be.calledWith(config.paths.session, '');
        return cb(err);
      });
    });
  });
  describe('refresh', () => {
    before('token', () => {
      return this.token = '123';
    });
    after('token', () => {
      return delete this.token;
    });
    before('login', () => {
      return sinon.stub(user, 'login').callsArg(2);
    });
    afterEach('login', () => {
      return user.login.reset();
    });
    after('login', () => {
      return user.login.restore();
    });
    before('save', () => {
      return sinon.stub(user, 'save').callsArg(0);
    });
    afterEach('save', () => {
      return user.save.reset();
    });
    after('save', () => {
      return user.save.restore();
    });
    it('should login.', (cb) => {
      return user.refresh((err) => {
        expect(user.login).to.be.calledOnce;
        expect(user.login).to.be.calledWith(null, null);
        expect(user.token).to.be.null;
        return cb(err);
      });
    });
    return it('should save.', (cb) => {
      return user.refresh((err) => {
        expect(user.save).to.be.calledOnce;
        return cb(err);
      });
    });
  });
  describe('restore', () => {
    beforeEach('token', () => {
      user.token = null;
      return user.host = null;
    });
    describe('when the session file exists', () => {
      before('token', () => {
        return this.token = '123';
      });
      after('token', () => {
        return delete this.token;
      });
      before('host', () => {
        return this.host = 'abc';
      });
      after('host', () => {
        return delete this.host;
      });
      before('stub', () => {
        const tokens = {};
        tokens[this.host] = this.token;
        return sinon.stub(util, 'readJSON').callsArgWith(1, null, {
          tokens
        });
      });
      afterEach('stub', () => {
        return util.readJSON.reset();
      });
      after('stub', () => {
        return util.readJSON.restore();
      });
      return it('should set the user token.', (cb) => {
        user.host = this.host;
        return user.restore((err) => {
          expect(util.readJSON).to.be.calledOnce;
          expect(util.readJSON).to.be.calledWith(config.paths.session);
          expect(user.getToken()).to.equal(this.token);
          expect(user.host).to.equal(this.host);
          return cb(err);
        });
      });
    });
    describe('when the session file does not exist', () => {
      before('login', () => {
        return sinon.stub(user, 'login').callsArg(2);
      });
      afterEach('login', () => {
        return user.login.reset();
      });
      after('login', () => {
        return user.login.restore();
      });
      before('readJSON', () => {
        return sinon.stub(util, 'readJSON').callsArgWith(1, null, {});
      });
      afterEach('readJSON', () => {
        return util.readJSON.reset();
      });
      after('readJSON', () => {
        return util.readJSON.restore();
      });
      return it('should login.', (cb) => {
        return user.restore((err) => {
          expect(user.login).to.be.calledOnce;
          expect(user.login).to.be.calledWith(null, null);
          expect(user.token).to.be.null;
          return cb(err);
        });
      });
    });
  });
  describe('when the session file is empty', () => {
    before('login', () => {
      sinon.stub(user, 'login').callsArg(2);
    });
    afterEach('login', () => {
      user.login.reset();
    });
    after('login', () => {
      user.login.restore();
    });
    before('readJSON', () => {
      sinon.stub(util, 'readJSON').callsArgWith(1, null, null);
    });
    afterEach('readJSON', () => {
      util.readJSON.reset();
    });
    after('readJSON', () => {
      util.readJSON.restore();
    });
    it('should login.', (cb) => {
      user.restore((err) => {
        expect(user.login).to.be.calledOnce;
        expect(user.login).to.be.calledWith(null, null);
        expect(user.host).to.equal(config.host);
        cb(err);
      });
    });
  });
  describe('save', () => {
    before('stub', () => {
      sinon.stub(util, 'writeJSON').callsArg(2);
    });
    afterEach('stub', () => {
      util.writeJSON.reset();
    });
    after('stub', () => {
      util.writeJSON.restore();
    });
    it('should write the token to file.', (cb) => {
      user.save((err) => {
        const tokens = {
          host: 'https://manage.kinvey.com/',
          tokens: {
            abc: '123'
          }
        };
        tokens.tokens['https://manage.kinvey.com/'] = null;
        expect(util.writeJSON).to.be.calledOnce;
        expect(util.writeJSON).to.be.calledWith(config.paths.session, tokens);
        cb(err);
      });
    });
  });
  describe('setup', () => {
    const email = 'bob@example.com';
    const password = 'test123';

    before('login', () => {
      sinon.stub(user, 'login').callsArg(2);
    });
    afterEach('login', () => {
      user.login.reset();
      helper.unsetCredentialsInEnvironment();
    });
    after('login', () => {
      user.login.restore();
    });
    before('restore', () => {
      sinon.stub(user, 'restore').callsArg(0);
    });
    afterEach('restore', () => {
      user.restore.reset();
    });
    after('restore', () => {
      user.restore.restore();
    });

    it('should restore the user session.', (cb) => {
      user.setup({}, (err) => {
        expect(user.restore).to.be.calledOnce;
        cb(err);
      });
    });

    it('should login given email.', (cb) => {
      user.setup({ email }, (err) => {
        expect(user.login).to.be.calledOnce;
        expect(user.login).to.be.calledWith(email, void 0);
        cb(err);
      });
    });

    it('should login given password.', (cb) => {
      user.setup({ password }, (err) => {
        expect(user.login).to.be.calledOnce;
        expect(user.login).to.be.calledWith(void 0, password);
        cb(err);
      });
    });

    it('should login given email and password.', (cb) => {
      user.setup({ email, password }, (err) => {
        expect(user.login).to.be.calledOnce;
        expect(user.login).to.be.calledWith(email, password);
        cb(err);
      });
    });

    it('should login given email and password in options and invalid ones in environment', (cb) => {
      helper.setCredentialsInEnvironment(invalidEmail, invalidPassword);

      user.setup({ email, password }, (err) => {
        expect(err).to.not.exist;
        expect(user.login).to.be.calledOnce;
        expect(user.login).to.be.calledWith(email, password);
        cb();
      });
    });
  });
});
