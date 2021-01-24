'use strict';

/**
 * Transforms a node http/s request to a simplified mountebank http/s request
 * that will be shown in the API
 * @module
 */

function transform (request) {
    const helpers = require('../../util/helpers'),
        queryString = require('querystring'),
        url = new URL(request.url, 'http://localhost'),
        search = url.search === '' ? '' : url.search.substr(1),
        headersHelper = require('./headersHelper'),
        headers = headersHelper.headersFor(request.rawHeaders),
        transformed = {
            requestFrom: helpers.socketName(request.socket),
            method: request.method,
            path: url.pathname,
            query: queryString.parse(search),
            headers,
            body: request.body,
            ip: request.socket.remoteAddress
        },
        contentType = headersHelper.getHeader('Content-Type', headers);

    if (request.body && isUrlEncodedForm(contentType)) {
        transformed.form = queryString.parse(request.body);
    }

    return transformed;
}

function isUrlEncodedForm (contentType) {
    if (!contentType) {
        return false;
    }

    const index = contentType.indexOf(';'),
        type = index !== -1 ? contentType.substr(0, index).trim() : contentType.trim();

    return type === 'application/x-www-form-urlencoded';
}

/**
 * Creates the API-friendly http/s request
 * @param {Object} request - The raw http/s request
 * @returns {Object} - Promise resolving to the simplified request
 */
function createFrom (request) {
    return new Promise(resolve => {
        const chunks = [];
        request.on('data', chunk => { chunks.push(Buffer.from(chunk)); });
        request.on('end', () => {
            const headersHelper = require('./headersHelper'),
                headers = headersHelper.headersFor(request.rawHeaders),
                contentEncoding = headersHelper.getHeader('Content-Encoding', headers),
                zlib = require('zlib'),
                buffer = Buffer.concat(chunks);

            if (contentEncoding === 'gzip') {
                try {
                    request.body = zlib.gunzipSync(buffer).toString();
                }
                catch (error) { /* do nothing */ }
            }
            else {
                request.body = buffer.toString();
            }
            resolve(transform(request));
        });
    });
}

module.exports = { createFrom };
