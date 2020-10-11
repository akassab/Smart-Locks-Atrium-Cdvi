# smart-locks-atrium-cdvi
Communicates with Atrium CDVI smart locks in http://storage.squareremoteaccess.com/#/ by running GET and POST requests. Handles setting cookies, and rc4 encryption needed to access portal.

## Functions and Usage
- First intialize class (optional debugger from npm debug)
```javascript
const atrium = new Atrium(
    oldDebugLog,
    ATRIUM_URL,
    ATRIUM_USERNAME,
    ATRIUM_PASSWORD
  );
```
- Create/add new user 
```javascript
  try {
    atrium.login([
      ["addUser", NAME],
    ]);
  } catch (err) {
  }
```
- Create/add user with keycode and access level (currently defaulted to  100)
```javascript
  try {
    atrium.login([
      ["addUser", NAME],
      ["setKeyCode", KEY_CODE],
      ["setAccessLevel"],
    ]);
  } catch (err) {
  }
```
## Languages
- Javascript
