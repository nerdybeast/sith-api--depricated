'use strict';

const _ = require('lodash');
const jsforce = require('jsforce');
const Debug = require('./debug');
const cache = require('./cache');

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

    /**
     * 
     */
    let orgPollers = new Set();

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

        //Called when the client emits this message
        socket.on('hand-shake', function(username, callback) {
            
            _debug.log('Main Socket Handshake');

            let profile = cache.get(username);

            if(profile) {
                profile.socketId = this.id;
                cache.set(username, profile);
            }

            //The clients callback function will receive this data;
            callback(this.id);
        });

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

        socket.on('initialize-dashboard', function(username, callback) {
            
            let socketId = this.id;

            _debug.log(`initialize-dashboard received username`, username);
            _debug.log('initialize-dashboard socket id', socketId);

            //Get our connected client by the socket id.
            let client = connectedClients.get(socketId);

            //Will be true if a profile hasn't been attached to this connected client yet. 
            if(client.username === null) {
                
                //Set the given profile on this connected client since we can now make a "socket id" => "profile" association. 
                //NOTE: Map() values are by reference so there is no need to call connectedClients.set() here now that we have manipulated a map value. 
                client.username = username;
            }

            let profile = cache.get(`USERS:${username}`);
            let socketNamespace = `${profile.user_id}-${profile.organization_id}`;
            let orgLimitSocket = io.of(socketNamespace);
            
            //Send the socket namespace back to the client so it knows what namespace to start listening to for dashboard updates.
            //NOTE: Invoking this callback here will not stop execution of this method.
            callback({ socketNamespace });

            let previousLimits;

            let run = () => {
               
                //_debug.log('run() username', username);
               
                if(!orgPollers.has(username)) { return; }

                let startTime = new Date().getTime();

                let conn = new jsforce.Connection({ 
                    instanceUrl: profile.instance_url,
                    accessToken: profile.session_id
                });

                conn.limits().then(currentLimits => {

                    //_debug.log(`run() called, took`, new Date().getTime() - startTime);

                    if(!_.isEqual(previousLimits, currentLimits)) {
                        previousLimits = currentLimits;
                        orgLimitSocket.emit('org-limits-update', currentLimits);
                    }

                    setTimeout(run, 2000);
                });
            };

            if(!orgPollers.has(username)) {
                orgPollers.add(username);
                run();
            }

        });
    });

    function clientUpdate(action, socketId) {

        if(action === 'add') {
            connectedClients.set(socketId, { username: null });
        }

        if(action === 'remove') {
            
            let client = connectedClients.get(socketId);
            connectedClients.delete(socketId);
            
            let count = 0;
            connectedClients.forEach((value) => {
                if(value.username === client.username) { count++; }
            });

            //Will be true if this was the last socket for a given profile.
            if(count === 0) {
                orgPollers.delete(client.username);
            }
        }

        _debug.log(`Number of Clients Connected => ${connectedClients.size}`);

        if(connectedClients.size > 0) {
            //TODO: Figure out what cleanup needs to happen when no clients are connected.
        }
    }

}