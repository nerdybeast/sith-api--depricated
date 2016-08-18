'use strict';

const express = require('express');
const Promise = require('bluebird');
const _ = require('lodash');
const request = require('request');
const routeErrorHandler = require('../../lib/route-error-handler');
const Debug = require('../../lib/debug');
const db = require('../../lib/db');
    
let _debug = new Debug('MANAGE-USERS');
let router = express.Router();

router.route('/').post((req, res, next) => {
    
    //Will be the new user's profile object after having just authenticated with Salesforce, ex:
    //{ active: true, organization_id: '00D17000000BLCaEAO', id: 'https://test.salesforce.com/id/00D16000000ALCaEAO/005F0000003pgl8IAA', etc... }
    let profile = req.body;

    db.insertProfile(profile).then(result => {
        return res.send();
    }).catch(error => {
        let exception = new Error(error);
        return next(exception);
    });

}).all(routeErrorHandler);

router.route('/:user_id').get((req, res, next) => {

    let profile;

    getAuthTokenAsync().then(result => {

        return getProfileAsync(result.access_token, req.params.user_id);

    }).then(profile => {

        let customDomain = profile.urls.custom_domain;
		let enterprise = profile.urls.enterprise;

        //Add an "instance_url" property to the profile.
        let instanceUrl = customDomain || enterprise.substring(0, enterprise.indexOf('/services'));

        let sessionId = profile.identities[0].access_token;

        return res.send({ instanceUrl, sessionId });

    }).catch(error => {

        return next(error);

    });

}).all(routeErrorHandler);

function getAuthTokenAsync() {

    return new Promise((resolve, reject) => {

        let options = { 
            method: 'POST',
            url: 'https://sith-oath.auth0.com/oauth/token',
            headers: { 'content-type': 'application/json' },
            body: { 
                client_id: process.env.AUTH0_API_CLIENT_ID,
                client_secret: process.env.AUTH0_API_CLIENT_SECRET,
                audience: 'https://sith-oath.auth0.com/api/v2/',
                grant_type: 'client_credentials' 
            },
            json: true 
        };

        request(options, function (error, response, body) {

            if(error || body.error) {
                let exception = new Error(error || body);
                return reject(error);
            }

            return resolve(body);
        });

    });

}

function getProfileAsync(accessToken, userId) {

    return new Promise((resolve, reject) => {

        let options = { 
            method: 'GET',
            url: `https://sith-oath.auth0.com/api/v2/users/${userId}`,
            headers: { 
                'content-type': 'application/json',
                'Authorization': `Bearer ${accessToken}` 
            },
            json: true
        };

        request(options, function (error, response, body) {
            
            if(error || body.error) {
                let exception = new Error(error || body);
                return reject(error);
            }

            return resolve(body);
        });

    });

}

module.exports = router;