'use strict';

const _ = require('lodash');
const jsforce = require('jsforce');
const Debug = require('./debug');
const Salesforce = require('./salesforce');
const customSerializer = require('./json-api-serializer');

let _debug = new Debug('IO-MANAGER');

module.exports = function(io) {

    /**
     * Will hold a list of ids for all of the connected clients.
     * 
     * Example:
     * {
     *   "/#Gx--O3lOpS7xV9xJAAAB": {
     *     "username": "black.panther@salesforce.com.sandbox"
     *   },
     *   "/#FFliDi-M48SjhMa4AAAC": {
     *     "username": "black.widow@salesforce.com.someOtherSandbox"
     *   }
     * }
     */
    let connectedClients = new Map();

    let orgPollers = new Map();
    let traceFlagPollers = new Map();

    //Fires every time a client connects
    io.on('connection', (socket) => {
        
        _debug.log(`Client Connected => ${socket.id}`);
        clientUpdate('add', socket.id);

        //Will emit to just the new client that has connected.
        socket.emit('debug-from-server', 'Welcome new client! Shhh, you are the only one seeing this message...');

        //Emits to all clients except for the client that just connected.
        socket.broadcast.emit('debug-from-server', 'A new client just connected but wont get this message.');

        //Will emit to all clients that are connected (including the client that just connected).
        io.emit('debug-from-server', 'ALL clients will get this message.');

        //Custom hook
        socket.on('debug-from-client', function(from, data) {
            _debug.log(`Received message from ${from} =>`, data);
        });
        
        //Default socket.io hook, fires when a client disconnects
        socket.on('disconnect', function() {
            
            let socketId = this.id; 

            _debug.log(`Client Disconnected => ${socketId}`);
            _debug.log(`socket on disconnect arguments`, arguments);

            clientUpdate('remove', socketId);
        });

        socket.on('initialize-dashboard', function(user, cb) {
            
            if(!user) { return; }

            clientUpdate('update', this.id, user);

            _debug.log(`initialize-dashboard received user id => ${user.id}`);
            _debug.log('initialize-dashboard socket id', this.id);

            let socketNamespace = `${user.id}-${user.orgId}`;
            let orgLimitSocket = io.of(socketNamespace);
            
            //Send the socket namespace back to the client so it knows what namespace to start listening to for dashboard updates.
            //NOTE: Invoking this callback here will not stop execution of this method.
            if(cb && typeof cb === 'function') {
                cb(socketNamespace);
            }

            let previousLimits;

            let run = (isInitialStart) => {
               
                if(!orgPollers.has(user.username)) { return; }

                let conn = new jsforce.Connection({ 
                    instanceUrl: user.instanceUrl,
                    accessToken: user.sessionId
                });

                conn.limits().then(currentLimits => {

                    if(!_.isEqual(previousLimits, currentLimits)) {
                        previousLimits = currentLimits;
                        orgLimitSocket.emit('org-limits-update', currentLimits);
                    }

                    setTimeout(run, 2000);
                });
            };

            let poller = orgPollers.get(user.username);
            if(poller && !poller.isPolling) {
                poller.isPolling = true;
                run();
            }

        });

        socket.on('initialize-traceflag-tracking', function(user, cb) {

            if(!user) { return; }

            clientUpdate('update', this.id, user);

            _debug.log(`initialize-traceflag-tracking received user id => ${user.id}`);
            _debug.log('initialize-traceflag-tracking socket id', this.id);

            let socketNamespace = `traceflags-${user.id}-${user.orgId}`;
            let traceFlagSocket = io.of(socketNamespace);

            if(cb && typeof cb === 'function') {
                cb(socketNamespace);
            }

            let existingTraceFlags;

            let run = () => {

                if(!traceFlagPollers.has(user.username)) { return; }

                let sf = new Salesforce({
                    accessToken: user.sessionId,
                    instanceUrl: user.instanceUrl
                }, {
                    userId: user.id,
                    orgId: user.orgId
                });

                sf.getTraceFlagsByUserId(user.id).then(currentTraceFlags => {

                    let records = customSerializer.traceFlag(currentTraceFlags.fieldNames, currentTraceFlags.records);

                    if(!_.isEqual(existingTraceFlags, records)) {
                        existingTraceFlags = records;
                        traceFlagSocket.emit('trace-flag-update', records);
                    }

                    setTimeout(run, 2000);
                });
            };

            let poller = traceFlagPollers.get(user.username);
            if(poller && !poller.isPolling) {
                poller.isPolling = true;
                run();
            }
        });
    });

    function clientUpdate(action, socketId, user) {

        switch(action) {
            case 'add': {
                connectedClients.set(socketId, null);
                break;
            }
            case 'remove': {
                //NOTE: the param "user" is not available in this case.
                
                let client = connectedClients.get(socketId);
                if(!client) { break; }

                connectedClients.delete(socketId);
                
                if(!_userConnected(client.username)) {
                    orgPollers.delete(client.username);
                    traceFlagPollers.delete(client.username);
                }

                break;
            }
            case 'update': {

                connectedClients.set(socketId, user);

                if(!orgPollers.has(user.username)) {
                    orgPollers.set(user.username, {
                        isPolling: false
                    });
                }

                if(!traceFlagPollers.has(user.username)) {
                    traceFlagPollers.set(user.username, {
                        isPolling: false
                    });
                }

                break;
            }
        }

        _debug.log(`Number of Clients Connected => ${connectedClients.size}`);

        if(connectedClients.size > 0) {
            //TODO: Figure out what cleanup needs to happen when no clients are connected.
        }
    }

    function _userConnected(username) {
        let count = 0;
        connectedClients.forEach(client => {
            if(client.username === username) {
                count++;
            }
        });
        return count > 0;
    }
}