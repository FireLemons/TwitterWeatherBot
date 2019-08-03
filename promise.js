'use strict'

const https = require('https')

/** @fileoverview node requests in the form of promises. */
module.exports = {
  // Sends a get request for json
  //  @param  {string} url The url for the request
  //  @param  {object} params Options accepted by node's http.request see https://nodejs.org/api/http.html#http_http_request_options_callback for more information
  //  @return {Promise} A promise that is fulfilled when json from the request is parsed into an object
  getJSONPromiseGet (url, params) {
    if (typeof url !== 'string') {
      throw new TypeError('Param url must be a string')
    }

    if (params && (!(params instanceof Object) || params instanceof Array)) {
      throw new TypeError('Param params must be an object')
    }

    return new Promise(function (resolve, reject) {
      const handleResponse = (res) => {
        // reject on bad status or not json
        const { statusCode } = res
        const contentType = res.headers['content-type']

        if (statusCode !== 200) {
          return reject(new Error(`Request Failed. Status Code: ${statusCode}`))
        } else if (!/^application\/([a-zA-Z]+\+)*json/.test(contentType)) {
          return reject(new Error(`Invalid content-type. Expected application/json but received ${contentType}`))
        }

        // cumulate data
        let json = []
        res.on('data', function (chunk) {
          json.push(chunk)
        })

        // resolve on end
        res.on('end', function () {
          try {
            json = JSON.parse(Buffer.concat(json).toString())
          } catch (e) {
            reject(e)
          }

          resolve(json)
        })
      }

      const req = params ? https.get(url, params, handleResponse) : https.get(url, handleResponse)

      // reject on request error
      req.on('error', (err) => {
        // This is not a "Second reject", just a different sort of failure
        reject(err)
      })

      // IMPORTANT
      req.end()
    })
  },

  // Sends a post request for json
  //  @param  {string} url The url for the request
  //  @param  {object} params Options accepted by node's http.request see https://nodejs.org/api/http.html#http_http_request_options_callback for more information
  //  @return {Promise} A promise that is fulfilled when json from the request is parsed into an object
  getJSONPromisePost (url, params) {
    if (typeof url !== 'string') {
      throw new TypeError('Param url must be a string')
    }

    if (params) {
      if (!(params instanceof Object) || params instanceof Array) {
        throw new TypeError('Param params must be an object')
      }
      params.method = 'POST'
    } else {
      params = {
        mathod: 'POST'
      }
    }

    return new Promise(function (resolve, reject) {
      const req = https.request(url, params, (res) => {
        // reject on bad status or not json
        const { statusCode } = res
        const contentType = res.headers['content-type']

        if (statusCode !== 200) {
          return reject(new Error(`Request Failed. Status Code: ${statusCode}`))
        } else if (!/^application\/([a-zA-Z]+\+)*json/.test(contentType)) {
          return reject(new Error(`Invalid content-type. Expected application/json but received ${contentType}`))
        }

        // cumulate data
        let json = []
        res.on('data', function (chunk) {
          json.push(chunk)
        })

        // resolve on end
        res.on('end', function () {
          try {
            json = JSON.parse(Buffer.concat(json).toString())
          } catch (e) {
            reject(e)
          }

          resolve(json)
        })
      })

      // reject on request error
      req.on('error', (err) => {
        // This is not a "Second reject", just a different sort of failure
        reject(err)
      })

      // IMPORTANT
      req.end()
    })
  }
}
