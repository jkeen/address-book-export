var mocha          = require('mocha');
var chai           = require('chai');
var chaiAsPromised = require("chai-as-promised");
var expect         = chai.expect;
var _              = require('lodash');
var importer       = require('../index');
var expandHomeDir  = require('expand-home-dir');

chai.use(chaiAsPromised);

var _this = this;
describe("basics", function () {
  it('should really have some more tests', function() {
    expect(importer);
  });
});
