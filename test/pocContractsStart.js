const path = require('path');

const { Pact } = require('@pact-foundation/pact');
const yargs = require('yargs');

const config = require('./TestsConfig');
const CLIManager = require('./../lib/CLIManager');
const { Namespace } = require('./../lib/Constants');
const logger = require('./../lib/logger.js');
const pkg = require('./../package.json');
const Setup = require('./../lib/Setup');

const MOCK_SERVER_PORT = config.port;

// create CLIManager instance and get ctrl instance
const setup = new Setup(config.paths.session);
const cliVersion = pkg.version;
const Prompter = require('./../lib/Prompter');
const cliManager = new CLIManager({ setup, config, logger, cliVersion, prompter: Prompter, commandsManager: yargs });
const sitesCtrl = cliManager.getController(Namespace.SITE);

describe('Pact', () => {
  // create the Pact object to represent MAPI
  const provider = new Pact({
    consumer: "kinvey-cli",
    provider: "MAPI",
    port: MOCK_SERVER_PORT,
    log: path.resolve(process.cwd(), "logs", "pact.log"),
    dir: path.resolve(process.cwd(), "pacts"),
    logLevel: "DEBUG",
    spec: 2,
  });

  // expected response from MAPI
  const EXPECTED_BODY = [
    {
      id: 1,
      name: "Site 1",
      organizationId: "orgId1"
    },
  ];

  context('when there are a list of websites', () => {
    describe('and there is valid user session', () => {
      before((done) => {
        // Start the mock server
        provider
          .setup()
          .then(() => { // add interactions
            //throw new Error('HEY');
            return provider.addInteraction({
              // The 'state' field specifies a "Provider State"
              state: "sites.listOfOne",
              uponReceiving: "a request for sites",
              withRequest: {
                method: "GET",
                path: "/v3/sites",
                headers: { Accept: "application/json" },
              },
              willRespondWith: {
                status: 200,
                headers: { "Content-Type": "application/json" },
                body: EXPECTED_BODY
              }
            });
          })
          .then(() => { done(); });
      });

      // write the pact file for this consumer-provider pair,
      // and shutdown the associated mock server.
      // You should do this only _once_ per Provider you are testing.
      after(() => {
        return provider.finalize();
      });

      // (4) write your test(s)
      it('list websites', (done) => {
        sitesCtrl.list({}, (err, result) => {
          expect(err).to.not.exist;

          const finalResult = result.rawData;

          // validate the interactions you've registered and expected occurred
          expect(finalResult).to.be.an('array');
          expect(finalResult[0]).to.deep.equal(EXPECTED_BODY[0]);

          // this will throw an error if it fails, telling you what went wrong
          expect(provider.verify()).to.eventually.be.fulfilled;

          done();
        });
      })
    });
  });
});
