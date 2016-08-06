var Sqlite3 = require('sqlite3').verbose();
var RSVP    = require('rsvp');
var Crypto  = require('crypto');
var _       = require('lodash');
var fs      = require('fs');
var path    = require('path');

var expandHomeDir  = require('expand-home-dir');
var QUERY = '' +
'   SELECT coalesce(list.ZLINKID, list.Z_PK) as "id", ' +
'   list.ZME as "is_me", ' +
'   list.ZFIRSTNAME as "first_name", ' +
'   list.ZMIDDLENAME as "middle_name",' +
'   list.ZLASTNAME as "last_name", ' +
'   list.ZORGANIZATION as "organization", ' +
'   phonebook.ZFULLNUMBER as "phone_number",' +
'   phonebook.ZLABEL as "phone_label", ' +
'   mails.ZADDRESSNORMALIZED as "email", ' +
'   mails.ZLABEL as "email_label", ' +
'   messages.ZADDRESS as "messaging_address",' +
'	(SELECT ZSERVICENAME FROM ZABCDSERVICE as ZS WHERE ZS.Z_PK = messages.zservice) as "messaging_service",' +
'   postal.ZSTREET as "street_address",' +
'   postal.ZCITY as "city",' +
'   postal.ZSTATE as "state",' +
'   postal.ZZIPCODE as "zip_code",' +
'   postal.ZLABEL as "street_address_label"' +
'FROM ZABCDRECORD AS list ' +
'LEFT OUTER JOIN ZABCDPHONENUMBER AS phonebook ON phonebook.zowner = list.z_pk ' +
'LEFT OUTER JOIN ZABCDEMAILADDRESS AS mails ON mails.zowner = list.z_pk ' +
'LEFT OUTER JOIN ZABCDMESSAGINGADDRESS AS messages ON messages.zowner = list.z_pk ' +
'LEFT OUTER JOIN ZABCDPOSTALADDRESS AS postal ON postal.zowner = list.z_pk ' +
'ORDER BY "First Name"';

function getConnection(path) {
  return new RSVP.Promise(function(resolve, reject) {
    return new Sqlite3.Database(path, Sqlite3.OPEN_READONLY, function(err) {
      if (err) {
        reject(this);
      }
      else {
        resolve(this);
      }
    });
  });
}

// Resets the maps so on subsequent calls we don't get overlaps
function reset() {
  emails = {};
  addresses = {};
  messengers = {};
  phones = {};
  names = {};
}

function fixLabelForDisplay(label) {
  // The labels come in like this: _$!<Mobile>!$_
  // and we don't want that

  if (label) {
    try {
      return label.match(/([A-Z])\w+/)[0];
    }
    catch(e) {
      return label;
    }
  }
}

function addEmailAddress(row) {
  if (!emails[row.id]) {
    emails[row.id] = [];
  }

  var email = compactObject({
    address: row.email,
    label: fixLabelForDisplay(row.email_label)
  });

  if (email.address) {
    emails[row.id].push(email);
  }
}

function addMessagingAddress(row) {
  if (!messengers[row.id]) {
    messengers[row.id] = [];
  }

  var messenger = compactObject({
    address: row.messaging_address,
    service: row.messaging_service
  });

  if (messenger.address) {
    messengers[row.id].push(messenger);
  }
}

function addPhone(row) {
  if (!phones[row.id]) {
    phones[row.id] = [];
  }

  var phone = compactObject({
    number: row.phone_number,
    label:  fixLabelForDisplay(row.phone_label)
  });

  if (phone.number) {
    phones[row.id].push(phone);
  }
}

function addPostalAddress(row) {
  if (!addresses[row.id]) {
    addresses[row.id] = [];
  }

  var address = compactObject({
    street_address: row.street_address,
    city:           row.city,
    state:          row.state,
    zipcode:        row.zip_code,
    label:          fixLabelForDisplay(row.street_address_label)
  });

  if (address.street_address) {
    addresses[row.id].push(address);
  }
}

function addName(row) {
  var basics = compactObject({
    first_name:          row.first_name,
    middle_name:         row.middle_name,
    last_name:           row.last_name,
    organization:        row.organization,
    is_me:               !!row.is_me
  });

  if (!names[row.id]) {
    names[row.id] = basics;
  }
  else {
    names[row.id] = _.merge(names[row.id], basics);
  }
}

function prepareRow(row) {
  addName(row);
  addPhone(row);
  addPostalAddress(row);
  addMessagingAddress(row);
  addEmailAddress(row);
}

function buildPayload() {
  var ids = Object.keys(names);
  contacts = [];

  var remove = function(d) {
    return !_.isEmpty(d);
  };

  for (var i = 0; i <= ids.length; i++) {
    var id = ids[i];
    var contact =  _.pickBy(names[id], _.isString);

    if (contact.first_name || contact.last_name || contact.organization) {
      contact.messengers = prepareList(messengers[id]);
      contact.emails     = prepareList(emails[id]);
      contact.addresses  = prepareList(addresses[id]);
      contact.phones     = prepareList(phones[id]);
      contact._id        = id;

      contacts.push(contact);
    }
  }

  return contacts;
}

function compactObject(item) {
  return _.pickBy(item, _.isString);
}

function prepareList(items) {
  var cleaned = _.map(items, function(item) {
    return compactObject(item);
  });

  return _.uniqWith(items, _.isEqual);
}

function fetchResults(path, query) {
  var promise = new RSVP.Promise(function(resolve, reject) {
    getConnection(path).then(function(db) {
      db.serialize(function() {
        db.each(query, function(error, row) {
          // get an overall map for relating data
          prepareRow(row);
        }, function() { // FINISHED CALLBACK
          resolve();
        });
      });
      db.close();
    }, function(reason) {
      reject("Couldn't open selected database at " + path);
    });
  });

  return promise;
}

function getDirectories(srcpath) {
  return fs.readdirSync(srcpath).filter(function(file) {
    return fs.statSync(path.join(srcpath, file)).isDirectory();
  });
}

module.exports = function(options) {
  reset();
  var sourcePath        = expandHomeDir("~/Library/Application Support/AddressBook/Sources/");
  var dbName            = "AddressBook-v22.abcddb";
  var sourceDirectories = getDirectories(sourcePath);
  var promises = [];

  // Gather up all the contacts from the different source databases
  for (var i = 0; i < sourceDirectories.length; i++) {
      var p = path.join(sourcePath, sourceDirectories[i], dbName);

      try {
        fs.accessSync(p, fs.F_OK);
        promises.push(fetchResults(p, QUERY));
      }
      catch(e) {
        // file doesn't exist, nbd
      }
  }

  return RSVP.Promise.all(promises).then(function(resolve, reject) {
    return buildPayload();
  });
};
