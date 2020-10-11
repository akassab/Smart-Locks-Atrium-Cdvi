// Imports
const SuperAgent = require("superagent");
const QueryString = require("querystring");
const RC4 = require("./rc4");
const Crypto = require("crypto");
const CryptXml = require("./crypt-xml");
const Xml2Js = require("xml2js");
const DefaultReqBodies = require("./default-req-bodies");
const Debug = require("debug");


// functions
const rc4 = RC4.rc4;
const parseString = Xml2Js.parseString;
var debug1 = Debug('constructor');
var debugParseResponse = Debug('parseResponse()');
var debugExecuteCallbacks = Debug('executeCallbacks()');
var debugLogin = Debug('login()');
var debugSetUserKeyCode = Debug('setUserKeyCode()');
var debugAddUser = Debug('addUser()')
var debugSetUserAccessLevel = Debug('setUserAccessLevel()')
// constant http routines
const GET_LOGIN = {
  name: "GET_LOGIN",
  number: 0,
};
const POST_LOGIN = {
  name: "POST_LOGIN",
  number: 1,
};
const POST_ADD_USER = {
  name: "POST_ADD_USER",
  number: 2,
};
const POST_SET_KEYCODE = {
  name: "POST_SET_KEYCODE",
  number: 3,
};
const POST_SET_ACCESS_LEVEL = {
  name: "POST_SET_ACCESS_LEVEL",
  number: 4,
};

// constant default req bodys
const DEFAULT_ADD_USER_BODY_PARSED =
    DefaultReqBodies.DEFAULT_ADD_USER_BODY_PARSED;
const DEFAULT_SET_KEYCODE_BODY_PARSED =
    DefaultReqBodies.DEFAULT_SET_BODY_KEYCODE_PARSED;
const DEFAULT_SET_ACCESS_LEVEL_BODY_PARSED =
    DefaultReqBodies.DEFAULT_SET_ACCESS_LEVEL_BODY_PARSED;


class Atrium {
  constructor(url, username, password) {
    this.url = url;
    this.username = username;
    this.password = password;
    this.cookieAndKey = {
      cookie: "",
      key: "",
    };
    this.agent = SuperAgent.agent();
    this.newUserId = -1;
    var debugf = Debug('http');
    debug1('Finished constructing!')
  }

  executeCallback(callbacks) {
    debugExecuteCallbacks('Entered.')
    if (callbacks.length == 0) {
      debugExecuteCallbacks('Finished all callbacks.')
      this.newUserId = -1;
    } else if (callbacks[0].length == 0) {
      debugExecuteCallbacks("Invalid: Given empty callback.");
    } else if (callbacks[0][0] == "addUser") {
      var firstCallback = callbacks[0];
      callbacks.shift();
      if (firstCallback.length != 3) {
        debugExecuteCallbacks("Invalid: Calling addUser() with invalid number of params.");
      } else {
        debugExecuteCallbacks("Calling addUser().");
        this.addUser(firstCallback[1], firstCallback[2], callbacks);
      }
    } else if (callbacks[0][0] == "setKeyCode") {
      var firstCallback = callbacks[0];
      callbacks.shift();
      if (firstCallback.length != 2) {
        debugExecuteCallbacks("Invalid: Calling setUserKeyCode() with invalid number of params.");
      } else {
        debugExecuteCallbacks("Calling setUserKeyCode().");
        this.setUserKeyCode(firstCallback[1], callbacks);
      }
    } else if (callbacks[0][0] == "setAccessLevel") {
      var firstCallback = callbacks[0];
      callbacks.shift();
      if (firstCallback.length != 1) {
        debugExecuteCallbacks("Invalid: Calling setAccessLevel() with invalid number of params.");
      } else {
        debugExecuteCallbacks("Calling setAccessLevel().");
        this.setAccessLevel(callbacks);
      }
    }
  }
  parseResponse(response, callType, callbacks) {
    debugParseResponse('Entered with ' + callType.name + ", Status:", response.status )
    var this_class = this;
    var responseBodyText = response.text;
    if (
        callType == POST_ADD_USER ||
        callType == POST_SET_KEYCODE ||
        callType == POST_SET_ACCESS_LEVEL
    ) {
      if (callType == POST_ADD_USER) {
        const decryptResponseBody = CryptXml.decryptXml(
            responseBodyText,
            this_class.cookieAndKey.key
        );
        parseString(decryptResponseBody, function (err, parsedResponse) {
          if (err) {
            debugParseResponse(callType.name,"cdvi xml2js error." )
            debugParseResponse(err);
          }
          else {
            this_class.newUserId = parsedResponse.USERS_T_USER.GENERAL[0]["$"].id;
            debugParseResponse('Done adding user. Calling next callback.')
            this_class.executeCallback(callbacks);
          }
        });
      }
      else {
        debugParseResponse('Done setting keycode / access level. Calling next callback.')
        this_class.executeCallback(callbacks);
      }
    }
    else if (callType == GET_LOGIN || callType == POST_LOGIN) {
      var responseHeader = response.headers;
      parseString(responseBodyText, function (err, parsedResponseBody) {
        if (err) {
          debugParseResponse(callType.name,"cdvi xml2js error." )
          debugParseResponse(err);
        }
        else {
          this_class.cookieAndKey.cookie = responseHeader["set-cookie"];
          this_class.cookieAndKey.key = parsedResponseBody.LOGIN.KEY[0];
          if (callType == POST_LOGIN) {
            debugParseResponse(callType.name,"Login Status:",!!parsedResponseBody.LOGIN.ERROR[0]);
            debugParseResponse('Done logging in user. Calling next callback.')
            this_class.executeCallback(callbacks);
          } else {
            const username = rc4(
                this_class.cookieAndKey.key,
                this_class.username
            );
            const password = Crypto.createHash("md5")
                .update(this_class.cookieAndKey.key + this_class.password)
                .digest("hex");
            const loginPostData = `login_user=${username}&login_pass=${password}`;
            const loginResponse = this_class.agent
                .post(`${ATRIUM_URL}/login.xml`)
                .send(loginPostData)
                .end((err, res) => {
                  if (err) {
                    debugParseResponse("Error:", callType.name,"Post request." );
                    debugParseResponse(err);
                  }
                  else {
                    debugParseResponse('Done getting initial cookie calling next callbacik..')
                    this_class.parseResponse(res, POST_LOGIN, callbacks);
                  }
                });
          }
        }
      });
    } else {
      debugParseResponse("Invalid callType.");
    }
  }

  initialize(callbacks) { }

  login(callbacks) {
    debugLogin('Entered.')
    var this_class = this;
    const homeResponse = this_class.agent
        .get(`${ATRIUM_URL}/login.xml`)
        .end((err, res) => {
          if (err) {
            debugLogin('Error: Get Request.')
            debugLogin(err);
          }
          else {
            debugLogin('Calling parseResponse().')
            this_class.parseResponse(res, GET_LOGIN, callbacks);
          }
        });
  }

  addUser(firstName, lastName, callbacks) {
    debugAddUser('Entered.')
    var this_class = this;
    if (
        firstName == null ||
        lastName == null ||
        firstName.length == 0 ||
        lastName.length == 0
    ) {
      debugAddUser("Invalid: firstname/lastname.");
    }
    else {
      var addUserBody = QueryString.parse(
          QueryString.stringify(DEFAULT_ADD_USER_BODY_PARSED)
      );
      addUserBody.T_user_fn = firstName;
      addUserBody.T_user_ln = lastName;
      const encryptAddingScript = CryptXml.encryptXmlToList(
          QueryString.stringify(addUserBody),
          this_class.cookieAndKey.key
      );
      const addUserResponse = this_class.agent
          .post(`${ATRIUM_URL}/users_T_user.xml`)
          .set("Content-Type", "text/plain")
          .set("Accept", "*/*")
          .type("form")
          .send(`post_enc=${encryptAddingScript[0]}`)
          .send(`post_chk=${encryptAddingScript[1]}`)
          .end((err, res) => {
            if (err) {
              debugAddUser("Error: Post Request.");
              debugAddUser(err);
            }
            else {
              debugAddUser('Calling parseResponse().')
              this_class.parseResponse(res, POST_ADD_USER, callbacks);
            }
          });
    }
  }

  setUserKeyCode(keyCode, callbacks) {
    debugSetUserKeyCode('Entered.')
    var this_class = this;
    if (keyCode.length != 5) {
      debugSetUserKeyCode("Invalid: Number of digits in keycode.");
    } else if (this_class.newUserId == -1) {
      debugSetUserKeyCode("Invalid: newUserId (a new user) doesnt exist.");
    } else {
      var setKeyCodeBody = QueryString.parse(
          QueryString.stringify(DEFAULT_SET_KEYCODE_BODY_PARSED)
      );
      setKeyCodeBody.T_user_id = this_class.newUserId;
      setKeyCodeBody.T_user_code_num = keyCode;
      const encryptedSetKeyCodeScript = CryptXml.encryptXmlToList(
          QueryString.stringify(setKeyCodeBody),
          this_class.cookieAndKey.key
      );
      const setUserKeyCodeResponse = this_class.agent
          .post(`${ATRIUM_URL}/users_T_user.xml`)
          .set("Content-Type", "text/plain")
          .set("Accept", "*/*")
          .type("form")
          .send(`post_enc=${encryptedSetKeyCodeScript[0]}`)
          .send(`post_chk=${encryptedSetKeyCodeScript[1]}`)
          .end((err, res) => {
            if (err) {
              debugSetUserKeyCode("Error: Post Request.");
              debugSetUserKeyCode(err);
            }
            else {
              debugSetUserKeyCode('Calling parseResponse().')
              this_class.parseResponse(res, POST_SET_KEYCODE, callbacks);
            }
          });
    }
  }

  setAccessLevel(callbacks) {
    debugSetUserAccessLevel('Entered.');
    var this_class = this;
    if (this_class.newUserId == -1) {
      debugSetUserAccessLevel("Invalid: newUserId (a new user) doesnt exist.");
    } else {
      var setAccessLevelBody = QueryString.parse(
          QueryString.stringify(DEFAULT_SET_ACCESS_LEVEL_BODY_PARSED)
      );
      setAccessLevelBody.T_access_user_id = this_class.newUserId;
      const encryptedSetAccessLevelScript = CryptXml.encryptXmlToList(
          QueryString.stringify(setAccessLevelBody),
          this_class.cookieAndKey.key
      );
      const setAccessLevelResponse = this_class.agent
          .post(`${ATRIUM_URL}/users_T_access.xml`)
          .set("Content-Type", "text/plain")
          .set("Accept", "*/*")
          .type("form")
          .send(`post_enc=${encryptedSetAccessLevelScript[0]}`)
          .send(`post_chk=${encryptedSetAccessLevelScript[1]}`)
          .end((err, res) => {
            if (err) {
              debugSetUserAccessLevel("Error: Post Request.");
              debugSetUserAccessLevel(err);
            }
            else {
              debugSetUserAccessLevel('Calling parseResponse().');
              this_class.parseResponse(res, POST_SET_ACCESS_LEVEL, callbacks);
            }
          });
    }
  }
}
