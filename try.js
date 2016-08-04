var importer       = require('./index');
var importData     = importer().then(function(d) {
  console.log(JSON.stringify(d));
});
