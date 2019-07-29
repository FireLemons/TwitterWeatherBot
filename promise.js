'use strict'

/** @fileoverview node requests in the form of promises. */
module.exports = {
    // Sends a get request for json
    //  @param  {string} url The url for the request
    //  @param  {object} params Options accepted by node's http.request see https://nodejs.org/api/http.html#http_http_request_options_callback for more information
    //  @return {Promise} A promise that is fulfilled when json from the request is parsed into an object
    getJSONPromise(url, params) {
        return new Promise(function(resolve, reject) {
            let req = http.get(url, params, (res) => {
                // reject on bad or not json
                const { statusCode } = res
                const contentType = res.headers['content-type']
                
                if (statusCode !== 200) {
                    return reject(new Error(`Request Failed. Status Code: ${statusCode}`))
                } else if (!/^application\/([a-zA-Z]+\+)*json/.test(contentType)) {
                    return reject(new Error(`Invalid content-type. Expected application/json but received ${contentType}`))
                }
                
                // cumulate data
                let json = [];
                res.on('data', function(chunk) {
                    json.push(chunk);
                });
                
                // resolve on end
                res.on('end', function() {
                    try {
                        json = JSON.parse(Buffer.concat(json).toString());
                    } catch(e) {
                        reject(e);
                    }
                    
                    resolve(json);
                });
            });
            
            // reject on request error
            req.on('error', (err) => {
                // This is not a "Second reject", just a different sort of failure
                reject(err);
            });
            
            // IMPORTANT
            req.end();
        });
    }
}