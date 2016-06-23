'use strict';

const _ = require('lodash');

module.exports = function(io) {

    //Will hold a list of ids for all of the connected clients.
    let connectedClients = new Set();

    //Fires every time a client connects
    io.on('connection', (socket) => {
        
        console.log(`Client Connected => ${socket.id}`);
        clientUpdate('add', socket.id);

        //Will emit to just the new client that has connected.
        socket.emit('debug-from-server', 'Welcome new client!');

        //Emits to all clients except for the client that just connected.
        socket.broadcast.emit('debug-from-server', 'Hey, the new guy wont see this.');

        //Will emit to all clients that are connected (including the client that just connected).
        io.emit('debug-from-server', 'Hey everyone, there is a new client!');

        //Custom hook
        socket.on('debug-from-client', function(from, data) {
            console.log(`Received message from ${from} =>`, data);
        });
        
        //Default socket.io hook, fires when a client disconnects
        socket.on('disconnect', function(from, data) {
            //TODO: Handle a client disconnecting...
            console.log(`Client Disconnected => ${this.id}`);

            clientUpdate('remove', this.id);
        });
    });

    function clientUpdate(action, id) {

        if(action === 'add') {
            connectedClients.add(id);
        }

        if(action === 'remove') {
            connectedClients.delete(id);
        }

        console.log(`Number of Clients Connected => ${connectedClients.size}`);

        if(connectedClients.size > 0) {
            //TODO: Poll for org limits, emit changes to all clients.
        }
    }
}