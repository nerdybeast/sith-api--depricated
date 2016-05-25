'use strict';

function Debug(debugMessagPrefix) {
    this._prefix = debugMessagPrefix || 'DEBUG';
} 

Debug.prototype.log = function(message, obj) {
    
    console.log('----------------------------------------------------------------');
    
    let prefix = `${this._prefix}: ${message}`
    
    if(obj !== undefined) {
        console.log(`${prefix} =>`, obj);
    } else {
        console.log(prefix);
    }
}

module.exports = Debug;