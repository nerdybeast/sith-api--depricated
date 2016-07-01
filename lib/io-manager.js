'use strict';

const _ = require('lodash');
const Debug = require('./debug');
const cache = require('./cache');

let _debug = new Debug('IO-MANAGER');

module.exports = function(io) {

    //Will hold a list of ids for all of the connected clients.
    let connectedClients = new Set();

    //Fires every time a client connects
    io.on('connection', (socket) => {
        
        _debug.log(`Client Connected => ${socket.id}`);
        clientUpdate('add', socket.id);

        //Will emit to just the new client that has connected.
        socket.emit('debug-from-server', 'Welcome new client!');

        //Emits to all clients except for the client that just connected.
        socket.broadcast.emit('debug-from-server', 'Hey, the new guy wont see this.');

        //Will emit to all clients that are connected (including the client that just connected).
        io.emit('debug-from-server', 'Hey everyone, there is a new client!');

        socket.on('hand-shake', function(username, callback) {
            
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
        socket.on('disconnect', function(from, data) {
            
            _debug.log(`Client Disconnected => ${this.id}`);

            clientUpdate('remove', this.id);

            //TODO: Figure out how to stop polling for org limit changes if there are no clients connected
            //or if no clients are currently joined in a room. We are going to spin up a new poller for each 
            //org and we need to stop the ones that don't have clients logged into that org. 
        });
    });

    function clientUpdate(action, id) {

        if(action === 'add') {
            connectedClients.add(id);
        }

        if(action === 'remove') {
            connectedClients.delete(id);
        }

        _debug.log(`Number of Clients Connected => ${connectedClients.size}`);

        if(connectedClients.size > 0) {
            //TODO: Figure out what cleanup needs to happen when no clients are connected.
        }
    }
}