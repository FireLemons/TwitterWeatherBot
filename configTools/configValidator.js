'use strict'

/** @fileoverview Checks the bot configuration file for mistakes. */
const config = require('../config.json')
const configFieldValidator = require('./configFieldValidator.js')
const fs = require('fs')
const path = require('path')
const promise = require('../promise.js')
const Twitter = require('twitter')

// Prints a hint about valid filter restrictions
function printFilterRestrictionHint () {
  console.log('  The "restriction" field is used to determine the type of filter. Possible values for restriction are:')
  console.log('    "after" - Filters by date')
  console.log('      filter.path must lead to a date string')
  console.log('      filter.value must be a number')
  console.log('      All alerts with dates before the current time + value(hours) will be removed')
  console.log('    "before" - Filters by date')
  console.log('      filter.path must lead to a date string')
  console.log('      filter.value must be a number')
  console.log('      All alerts with dates after the current time + value(hours) will be removed')
  console.log('    "contains" - Filters by the contents of an array')
  console.log('      filter.path must lead to an array')
  console.log('      filter.value must be a primitive value potentially found in the arrays filter.path leads to')
  console.log('      All alerts with arrays containing value will be kept')
  console.log('    "has" - Filters by whether a path exists in the object')
  console.log('      filter.path is the path to try to access in the alert object')
  console.log('      filter.value is true if alerts with valid paths are kept false if alerts are removed')
  console.log('      All alerts with valid paths are kept is value is true false otherwise')
  console.log('      This type of filter is used before the other filters')
  console.log('    "equals" - Filters alerts by comparing primitive values')
  console.log('      filter.path is the path to the primitve value to be compare')
  console.log('      filter.value is the value to compare with')
  console.log('      All alerts with values at path equal to the filter value will be kept')
  console.log('    "matches" - Filters by testing strings in the alerts for a regex match')
  console.log('      filter.path must lead to a string')
  console.log('      filter.value must be a regex string')
  console.log('      All alerts with strings at path matching value will be kept')
  console.log('\n  Example: remove all alerts that have been overridden by a later alert.')
  console.log('  {')
  console.log('    "restriction": "has",')
  console.log('    "path": "properties.replacedBy",')
  console.log('    "value": 0')
  console.log('  }')
}

// Prints a hint about valid filter paths
function printFilterPathHint () {
  console.log('  Correct format is key.key.key')
  console.log('  For example: to access "c" in the object below')
  console.log('    {')
  console.log('      "a": {')
  console.log('        "b": {')
  console.log('          "c": 1')
  console.log('        }')
  console.log('      }')
  console.log('    }')
  console.log('  Path would be "a.b.c"')
}

// Prints a hint about valid elevation values
function printElevationHint () {
  console.log('  "elevation" is the elevation of the area in meters')
  console.log('  evevations are between -413(Dead Sea Depression) and 8848(Peak of Mt.Everest) meters')
  console.log('  A typical "elevation" looks like: "elevation": 200')
}

// Prints a hint about valid latitude values
function printLatitudeHint () {
  console.log('  "lat" is the north latitude(north is positive, south is negative) in degrees')
  console.log('  latitudes are between -90 and 90 degrees')
  console.log('  A typical "lat" looks like: "lat": 40.596')
}

// Prints a hint about valid longitude values
function printLongitudeHint () {
  console.log('  "long" is the longitude west(west is negative, east is positive) in degrees')
  console.log('  longitudes are between -180 and 180 degrees')
  console.log('  A typical "long" looks like: "long": -90.596')
}

// Prints a hint about valid log directory paths
function printLogDirectoryHint () {
  console.log('  "logDir" is the path to the directory to store logs in')
  console.log('  A typical "logDir" looks like: "logDir": "logs"')
}

// Prints a hint about valid location parameters
function printOpenWeatherMapsLocationHint () {
  console.log('  "location" contains get parameters to send to api.openweathermap.org/2.5/forecast to specify forecast location')
  console.log('  Valid key value pairs are:')
  console.log('    "q": "CITY_NAME,ISO_3166_COUNTRY_CODE"')
  console.log('    OR')
  console.log('    "id": "CITY_ID"')
  console.log('    OR')
  console.log('    "lat": "LATITIUDE",')
  console.log('    "lon": "LONGITUDE"')
  console.log('    OR')
  console.log('    "zip": "ZIP_CODE,ISO_3166_COUNTRY_CODE"')
}

// Checks an object for unrecognized keys. Prints out a warning for each unrecognized key.
//  @param  {object} object The object to check keys for
//  @param  {string} path The path to the object in the config
//  @param  {array} validKeys A list of recognized keys
function checkKeys (object, path, validKeys) {
  for (const key in object) {
    if (validKeys.indexOf(key) === -1) {
      console.log(`WARNING: Unrecognized key "${key}" in ${path}`)
    }
  }
}

// Checks if a value is a string. Prints an error if the value is undefined or not a string
//  @param  {any} str The value to be checked
//  @param  {string} path The path to str in the config object
//  @return {boolean} True if str is a string
function checkString (str, path) {
  if (str === undefined) {
    const lastPeriod = path.lastIndexOf('.')
    console.log(`ERROR: missing field "${path.substr(lastPeriod + 1)}" in ${path.substr(0, lastPeriod)}`)
    return false
  } else if (typeof str !== 'string') {
    console.log(`ERROR: ${path} must be a string`)
    return false
  }

  return true
}

// Checks if a value is a number. Prints an error if the value is undefined or not a number
//  @param  {any} num The value to be checked
//  @param  {string} path The path to num in the config object
//  @return {boolean} True if num is a number
function checkNumber (num, path) {
  if (num === undefined) {
    const lastPeriod = path.lastIndexOf('.')
    console.log(`ERROR: missing field "${path.substr(lastPeriod + 1)}" in ${path.substr(0, lastPeriod)}`)
    return false
  } else if (isNaN(num)) {
    console.log(`ERROR: ${path} must be a number`)
    return false
  }

  return true
}

// Checks if a value is an object. Prints an error if the value is undefined or not an object
//  @param  {any} obj The value to be checked
//  @param  {string} path The path to obj in the config object
//  @return {boolean} True if obj is an object
function checkObject (obj, path) {
  if (obj === undefined) {
    const lastPeriod = path.lastIndexOf('.')
    console.log(`ERROR: missing field "${path.substr(lastPeriod + 1)}" in ${path.substr(0, lastPeriod)}`)
    return false
  } else if (!(obj instanceof Object) || obj instanceof Array) {
    console.log(`ERROR: ${path} must be an object`)
    return false
  }

  return true
}

if (!(config instanceof Object) || config instanceof Array) {
  throw new TypeError('Config file must contain a JSON object')
} else {
  // Check weather
  const weather = config.weather

  if (checkObject(weather, 'config.weather')) {
    // Check alerts
    const alerts = weather.alerts

    if (!alerts || alerts.disabled) {
      console.log('INFO: Alerts disabled.')
    } else if (!(alerts instanceof Object) || alerts instanceof Array) {
      console.log('ERROR: config.weather.alerts must be an object')
    } else {
      console.log('INFO: Alerts are enabled.')

      // Check info to be sent in user-agent header to NWS api
      const appInfo = alerts.app
      let validAppInfo = true

      if (!checkObject(appInfo, 'config.weather.alerts.app')) {
        console.log('The app object contains required information to send to the national weather service api for alert data')
        console.log('The "app" object is in the form:\n"app": {\n  "contact": "EMAIL ADDRESS",\n  "name": "APP NAME",\n  "version": "VERSION NO",\n  "website": "APP WEBSITE OR CONTACT WEBSITE"\n}\n')
      } else {
        // Check contact
        const contact = appInfo.contact
        let validContact = checkString(contact, 'config.weather.alerts.app.contact')

        if (validContact && !configFieldValidator.validateAlertsAppContact(appInfo.contact)) {
          console.log('WARNING: field "contact" in config.weather.alerts.app is typically an email address')

          validContact = false
        }

        if (!validContact) {
          console.log('The national weather service api requires contact information in order get alert data')
          console.log('A typical "contact" looks like: "contact": "contact.email@example.com"')
        }

        // Check app name
        const appName = appInfo.name
        let validAppName = checkString(appName, 'config.weather.alerts.app.name')

        if (validAppName && !configFieldValidator.validateNotEmptyString(appName)) {
          console.log('WARNING: field "name" in config.weather.alerts.app is the empty string or contains exclusively whitespace')

          validAppName = false
        }

        if (!validAppName) {
          console.log('The national weather service api requires an app name in order to get alert data')
          console.log('A typical "name" looks like: "name": "ApplicationName"')
        }

        // Check app version
        const version = appInfo.version
        let validVersion = true

        if (version === undefined) {
          console.log('ERROR: missing field "version" in config.weather.alerts.app')

          validVersion = false
        } else if (typeof version !== 'string' && isNaN(version)) {
          console.log('ERROR: field "version" in config.weather.alerts.app must be a string or a number.')

          validVersion = false
        } else if (typeof version === 'string' && !configFieldValidator.validateNotEmptyString(version)) {
          console.log('WARNING: config.weather.alerts.app.version is the empty string or contains exclusively whitespace')

          validVersion = false
        }

        if (!validVersion) {
          console.log('The national weather service api requires an app version in order to get alert data')
          console.log('A typical "version" looks like: "version": "vX.Y"')
        }

        // Check app website
        const website = appInfo.website
        const validWebsite = checkString(website, 'config.weather.alerts.app.website')

        if (validWebsite && !configFieldValidator.validateAlertsAppWebsite(website)) {
          console.log('WARNING: config.weather.alerts.app.website is in an unrecognized format')
        }

        if (!validWebsite) {
          console.log('The national weather service api requires an app related website in order to get alert data')
          console.log('A typical "website" looks like: "website": "https://your.app.url/"')
        }

        validAppInfo = validContact && validAppName && validVersion && validWebsite
        checkKeys(appInfo, 'config.weather.alerts.app', ['contact', 'name', 'version', 'website'])
      }// End check alert app info

      // Check alert filters
      if (alerts.filters === undefined) { // No filters
        console.log('INFO: No alert filters.')
      } else if (!(alerts.filters instanceof Array)) { // Filters wrong type
        console.log('ERROR: config.weather.alerts.filters must be an array.')
      } else if (!alerts.filters.length) { // No filters also
        console.log('INFO: No alert filters.')
      } else { // There are filters
        console.log('INFO: Alert Filters:')

        alerts.filters.forEach((filter, i) => {
          if (!(filter instanceof Object) || filter instanceof Array) {
            console.log('ERROR:   Each filter of config.weather.alerts.filters must be an object')
          } else {
            // Check filter restriction
            const restriction = filter.restriction
            let validRestriction = checkString(restriction, `config.weather.alerts.filters[i].restriction`)

            if (validRestriction && !configFieldValidator.validateAlertsFiltersRestriction(filter.restriction)) {
              console.log(`ERROR:   config.weather.alerts.filters[${i}].restriction has unknown filter restriction: ${filter.restriction}`)

              validRestriction = false
            }

            if (!validRestriction) {
              printFilterRestrictionHint()
            }

            // Check filter path
            const path = filter.path
            let validPath = checkString(path, `config.weather.alerts.filters[i].path`)

            if (validPath && !configFieldValidator.validateAlertsFiltersPath(path)) { // Filter path wrong format
              console.log(`ERROR:   config.weather.alerts.filters[${i}].path is in incorrect format`)

              validPath = false
            }

            if (!validPath) {
              printFilterPathHint()
            }

            // Check keep
            const keep = filter.keep
            const validKeep = configFieldValidator.validateAlertsFiltersKeep(keep)

            if (!validKeep) {
              console.log(`ERROR:   config.weather.alerts.filters[${i}].keep must be a boolean`)
            }

            // Check values
            const value = filter.value
            let validValue = true

            if (validRestriction) {
              try {
                validValue = configFieldValidator.validateAlertsFiltersValue(restriction, value)
              } catch (e) {
                if (e instanceof ReferenceError) {
                  console.log(`ERROR:   Invalid filter config.weather.alerts.filters[${i}] "${restriction}". Filter value missing.`)
                } else if (e instanceof TypeError) {
                  console.log(`ERROR:   Invalid filter config.weather.alerts.filters[${i}] "${restriction}". ${e.message}`)
                }
              }

              if (validPath) {
                switch (restriction) {
                  case 'after':
                    if (validValue && validKeep) {
                      console.log(`INFO:   config.weather.alerts.filters[${i}] will remove all alerts with dates at alert.${path} that are before the time when alerts are fetched + ${filter.value} hour(s).`)
                    }
                    break
                  case 'before':
                    if (validValue && validKeep) {
                      console.log(`INFO:   config.weather.alerts.filters[${i}] will remove all alerts with dates at alert.${path} that are after the time when alerts are fetched + ${filter.value} hour(s).`)
                    }

                    break
                  case 'contains':
                    if (validValue && validKeep) {
                      console.log(`INFO:   config.weather.alerts.filters[${i}] will remove all alerts with arrays at alert.${path} not containing the value ${filter.value}.`)
                    }

                    break
                  case 'equals':
                    if (validValue && validKeep) {
                      console.log(`INFO:   config.weather.alerts.filters[${i}] will remove all alerts with values at alert.${path} equal(strict equality) to ${filter.value}.`)
                    }

                    break
                  case 'has':
                    if (validKeep) {
                      console.log(`INFO:   config.weather.alerts.filters[${i}] will remove all alerts where alert.${filter.path} ${value ? 'does not contain' : 'contains'} a value.`)
                    }
                    break
                  case 'matches':
                    if (validValue && validKeep) {
                      console.log(`INFO:   config.weather.alerts.filters[${i}] will remove all alerts with strings at alert.${path} not matching the regex ${filter.value}.`)
                    } else if (!validValue) {
                      console.log(`ERROR:   Invalid filter config.weather.alerts.filters[${i}] "matches". Filter value is invalid regex.`)
                    }

                    break
                }
              }
            }

            checkKeys(filter, `config.weather.alerts.filters[${i}]`, ['keep', 'restriction', 'path', 'value'])
          }
        })
      }

      // check get params for api.weather.gov
      const params = alerts.params
      let validParams = true
      let alertUrl

      if (checkObject(params, 'config.weather.alerts.params')) {
        let locationParamCount = 0

        locationParamCount += params.area !== undefined
        locationParamCount += params.point !== undefined
        locationParamCount += params.region !== undefined
        locationParamCount += params.region_type !== undefined
        locationParamCount += params.zone !== undefined

        if (locationParamCount > 1) {
          console.log('ERROR: 2 or more of these keys are invalid: area, point, region, region_type, zone in config.weather.alerts.params')

          validParams = false
        } else {
          let alertQueryParams = ''

          for (const paramName in params) {
            if (Object.prototype.hasOwnProperty.call(params, paramName)) {
              alertQueryParams += '&' + paramName + '=' + params[paramName]
            }
          }

          alertUrl = `https://api.weather.gov/alerts?${alertQueryParams.substr(1)}`
          console.log(`INFO: Weather alert url is ${alertUrl}`)
        }

        checkKeys(params, 'config.weather.alerts.params', ['active', 'start', 'end', 'status', 'message_type', 'event', 'code', 'region_type', 'point', 'region', 'area', 'zone', 'urgency', 'severity', 'certainty', 'limit', 'cursor'])
      }

      if (validParams && validAppInfo) {
        console.log('INFO: Fetching alerts from alert URL...')

        const alertAppInfo = config.weather.alerts.app

        const alertPromise = promise.getJSONPromiseGet(alertUrl, {
          headers: {
            'User-Agent': `${alertAppInfo.name}/v${alertAppInfo.version} (${alertAppInfo.website}; ${alertAppInfo.contact})`
          }
        })

        alertPromise.then((alerts) => {
          fs.writeFile('./alerts.json', JSON.stringify(alerts), (error) => {
            if (error) {
              console.log('ERROR: Failed to save alerts to file')
              throw error
            } else {
              console.log(`INFO: Alert data written to ${path.resolve('./alerts.json')}`)
              console.log('WARNING: Alert filters were not tested in fetching the alert data')
            }
          })
        })

        alertPromise.catch((error) => {
          console.log('ERROR: Failed to fetch alert data')
          console.log(error)
        })
      }
    }// End check alerts
    
    // Check Open Weather Map
    const OWM = weather.openWeatherMap

    if (checkObject(OWM, 'config.weather.openWeatherMap')) {
      // Check get params for weather forecast
      const location = OWM.location

      let paramsValid = true
      let keyValid = true

      if (location === undefined) {
        console.log('ERROR: missing "location" in config.weather.openWeatherMap')
        printOpenWeatherMapsLocationHint()

        paramsValid = false
      } else if (!(location instanceof Object) || location instanceof Array) {
        console.log('ERROR: config.weather.openWeatherMap.location must be an object')
        printOpenWeatherMapsLocationHint()

        paramsValid = false
      } else {
        checkKeys(location, 'config.weather.openWeatherMap.location', ['q', 'id', 'lat', 'lon', 'zip'])
      }

      // Check api key
      const apiKey = OWM.key

      keyValid = checkString(apiKey, 'config.weather.openWeatherMap.key')

      if (keyValid && !configFieldValidator.validateNotEmptyString(apiKey)) {
        console.log('ERROR: field "key" in config.weather.openWeatherMap is the empty string or contains exclusively whitespace')

        keyValid = false
      }

      if (paramsValid && keyValid) {
        let OWMQueryParams = ''

        for (const paramName in location) {
          if (Object.prototype.hasOwnProperty.call(location, paramName)) {
            OWMQueryParams += '&' + paramName + '=' + location[paramName]
          }
        }

        const forecastDataUrl = `https://api.openweathermap.org/data/2.5/forecast?${OWMQueryParams.substr(1)}&units=metric&APPID=${OWM.key}`

        console.log(`INFO: Forecast data URL is ${forecastDataUrl}`)
        console.log('INFO: Fetching forecast data from URL...')

        const forecastPromise = promise.getJSONPromisePost(forecastDataUrl)

        forecastPromise.then((data) => {
          fs.writeFile('./forecastData.json', JSON.stringify(data), (error) => {
            if (error) {
              console.log('ERROR: Failed to save forecast data to file')
              throw error
            } else {
              console.log(`INFO: Forecast data written to ${path.resolve('./forecastData.json')}`)
            }
          })
        })

        forecastPromise.catch((error) => {
          console.log('ERROR: Failed to fetch weather request data')
          console.log(error)
        })
      }

      checkKeys(OWM, 'config.weather.openWeatherMap', ['location', 'key'])
    }// End check openWeatherMap
    
    checkKeys(weather, 'config.weather', ['alerts', 'openWeatherMap'])
  }// End check weather

  // Check coordinates
  const coordinates = config.coordinates

  if (checkObject(coordinates, 'config.coordinates')) {
    // Check elevation
    const elevation = coordinates.elevation
    let validElevation = checkNumber(elevation, 'config.coordinates.elevation')

    if (validElevation && !configFieldValidator.validateCoordinatesElevation(elevation)) {
      console.log('ERROR: Field "elevation" in config.coordinates must be between -413 and 8848')

      validElevation = false
    }

    if (!validElevation) {
      printElevationHint()
    }

    // Check latitude
    const latitude = coordinates.lat
    let validLatitude = checkNumber(latitude, 'config.coordinates.lat')

    if (validLatitude && !configFieldValidator.validateCoordinatesLat(latitude)) {
      console.log('ERROR: Field "lat" in config.coordinates must be between -90 and 90')

      validLatitude = false
    }

    if (!validLatitude) {
      printLatitudeHint()
    }

    // Check longitude
    const longitude = coordinates.long
    let validLongitude = checkNumber(longitude, 'config.coordinates.longitude')

    if (validLongitude && !configFieldValidator.validateCoordinatesLong(longitude)) {
      console.log('ERROR: Field "long" in config.coordinates must be between -180 and 180')

      validLongitude = false
    }

    if (!validLongitude) {
      printLongitudeHint()
    }

    if (validElevation && validLatitude && validLongitude) {
      console.log(`INFO: Observer position aka coordinates set as ${elevation}m in elevation, ${Math.abs(latitude)}° ${latitude < 0 ? 'S' : 'N'}, ${Math.abs(longitude)}° ${longitude < 0 ? 'W' : 'E'}`)
    }

    checkKeys(coordinates, 'config.coordinates', ['elevation', 'lat', 'long'])
  }// End check coordinates

  // Check logging
  const log = config.log

  if (checkObject(log, 'config.log')) {
    // Check log directory path
    const logFolder = log.logDir
    let validPath = checkString(logFolder, 'config.log.logDir')

    if (validPath && !configFieldValidator.validateLogLogDir(log.logDir)) {
      console.log('ERROR: Field "logDir" in config.log not recognized as a valid file path')

      validPath = false
    } else {
      console.log(`INFO: Log directory set as: ${path.resolve('../' + log.logDir)}`)
    }

    if (!validPath) {
      printLogDirectoryHint()
    }

    checkKeys(log, 'config.log', ['logDir'])
  }

  // Check Twitter
  const twitter = config.twitter

  if (checkObject(twitter, 'config.twitter')) {
    // Check consumer key
    const consumerKey = twitter.consumer_key
    let validConsumerKey = checkString(consumerKey, 'config.twitter.consumer_key')

    if (validConsumerKey && !configFieldValidator.validateNotEmptyString(consumerKey)) {
      console.log('ERROR: field "consumer_key" in config.twitter is the empty string or contains exclusively whitespace')

      validConsumerKey = false
    }

    // Check consumer secret
    const consumerSecret = twitter.consumer_secret
    let validConsumerSecret = checkString(consumerSecret, 'config.twitter.consumer_key')

    if (validConsumerSecret && !configFieldValidator.validateNotEmptyString(consumerSecret)) {
      console.log('ERROR: field "consumer_secret" in config.twitter is the empty string or contains exclusively whitespace')

      validConsumerSecret = false
    }

    // Check access token key
    const accessTokenKey = twitter.access_token_key
    let validAccessTokenKey = checkString(accessTokenKey, 'config.twitter.access_token_key')

    if (validAccessTokenKey && !configFieldValidator.validateNotEmptyString(accessTokenKey)) {
      console.log('ERROR: field "access_token_key" in config.twitter is the empty string or contains exclusively whitespace')

      validAccessTokenKey = false
    }

    // Check access token secret
    const accessTokenSecret = twitter.access_token_secret
    let validAccessTokenSecret = checkString(accessTokenSecret, 'config.twitter.access_token_secret')

    if (validAccessTokenSecret && !configFieldValidator.validateNotEmptyString(accessTokenSecret)) {
      console.log('ERROR: field "access_token_secret" in config.twitter is the empty string or contains exclusively whitespace')

      validAccessTokenSecret = false
    }

    let twitterClient

    if (validConsumerKey && validConsumerSecret && validAccessTokenKey && validAccessTokenSecret) {
      console.log('INFO: Sending test tweet...')

      twitterClient = new Twitter({
        consumer_key: config.twitter.consumer_key,
        consumer_secret: config.twitter.consumer_secret,
        access_token_key: config.twitter.access_token_key,
        access_token_secret: config.twitter.access_token_secret
      })

      const twitterPromise = twitterClient.post('statuses/update', { status: `Test at ${new Date().toString()}` })

      twitterPromise.then((tweet) => {
        console.log('INFO: Tweet received. Check Twitter for a test status update.')
      })

      twitterPromise.catch((error) => {
        console.log('ERROR: Failed to send test tweet using config credentials')
        console.log(error)
      })
    }

    // Check local weather station id
    const localStationHandle = twitter.localStationHandle
    let validStationHandle = checkString(localStationHandle, 'config.twitter.localStationHandle')

    if (validStationHandle && !configFieldValidator.validateNotEmptyString(localStationHandle)) {
      console.log('ERROR: config.twitter.localStationHandle must be a string')

      validStationHandle = false
    }

    if (validStationHandle && twitterClient) {
      console.log(`INFO: Attempting to fetch tweets from ${localStationHandle}...`)

      const twitterPromise = twitterClient.get('statuses/user_timeline', {
        count: 10,
        exclude_replies: true,
        trim_user: true,
        screen_name: localStationHandle
      })

      twitterPromise.then((posts) => {
        fs.writeFile('./localTwitterPosts.json', JSON.stringify(posts), (error) => {
          if (error) {
            console.log('ERROR: Failed to save twitter posts of local weather station to file')
            throw error
          } else {
            console.log(`INFO: Some twitter posts of ${localStationHandle} written to ${path.resolve('./localTwitterPosts.json')}`)
          }
        })
      })

      twitterPromise.catch((error) => {
        console.log(`ERROR: Failed to fetch tweets from ${localStationHandle}`)
        console.log('  Are you sure you enetered the correct twitter handle?')
        console.log(error)
      })
    }

    checkKeys(twitter, 'config.twitter', ['consumer_key', 'consumer_secret', 'access_token_key', 'access_token_secret', 'localStationHandle'])
  }

  checkKeys(config, 'config', ['coordinates', 'log', 'twitter', 'weather'])
}
