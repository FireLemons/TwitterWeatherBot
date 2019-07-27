'use strict'

/** @fileoverview Checks the bot configuration file for mistakes. */
const config = require('../config.json')
const configFieldValidator = require('./configFieldValidator.js')
const path = require('path')

// Prints a hint about valid filter restrictions
function printFilterRestrictionHint () {
  console.log('The "restriction" field is used to determine the type of filter. Possible values for restriction are:')
  console.log('  "after" - Filters by date')
  console.log('    filter.path must lead to a date string')
  console.log('    filter.value must be a number')
  console.log('    All alerts with dates before the current time + value(hours) will be removed')
  console.log('  "before" - Filters by date')
  console.log('    filter.path must lead to a date string')
  console.log('    filter.value must be a number')
  console.log('    All alerts with dates after the current time + value(hours) will be removed')
  console.log('  "contains" - Filters by the contents of an array')
  console.log('    filter.path must lead to an array')
  console.log('    filter.value must be a primitive value potentially found in the arrays filter.path leads to')
  console.log('    All alerts with arrays containing value will be kept')
  console.log('  "has" - Filters by whether a path exists in the object')
  console.log('    filter.path is the path to try to access in the alert object')
  console.log('    filter.value is true if alerts with valid paths are kept false if alerts are removed')
  console.log('    All alerts with valid paths are kept is value is true false otherwise')
  console.log('    This type of filter is used before the other filters')
  console.log('  "equals" - Filters alerts by comparing primitive values')
  console.log('    filter.path is the path to the primitve value to be compare')
  console.log('    filter.value is the value to compare with')
  console.log('    All alerts with values at path equal to the filter value will be kept')
  console.log('  "matches" - Filters by testing strings in the alerts for a regex match')
  console.log('    filter.path must lead to a string')
  console.log('    filter.value must be a regex string')
  console.log('    All alerts with strings at path matching value will be kept')
  console.log('\nExample: remove all alerts that have been overridden by a later alert.')
  console.log('{')
  console.log('  "restriction": "has",')
  console.log('  "path": "properties.replacedBy",')
  console.log('  "value": 0')
  console.log('}')
}

// Prints a hint about valid filter paths
function printFilterPathHint () {
  console.log('  Correct format is key.key.key')
  console.log('  For example: to access "c" in the object below')
  console.log('  {')
  console.log('    "a": {')
  console.log('      "b": {')
  console.log('        "c": 1')
  console.log('      }')
  console.log('    }')
  console.log('  }')
  console.log('Path would be "a.b.c"')
}

// Prints a hint about valid elevation values
function printElevationHint () {
  console.log('"elevation" is the elevation of the area in meters')
  console.log('evevations are between -413(Dead Sea Depression) and 8848(Peak of Mt.Everest) meters')
  console.log('A typical "elevation" looks like: "elevation": 200')
}

// Prints a hint about valid latitude values
function printLatitudeHint () {
  console.log('"lat" is the north latitude(north is positive, south is negative) in degrees')
  console.log('latitudes are between -90 and 90 degrees')
  console.log('A typical "lat" looks like: "lat": 40.596')
}

// Prints a hint about valid longitude values
function printLongitudeHint () {
  console.log('"long" is the longitude west(west is negative, east is positive) in degrees')
  console.log('longitudes are between -180 and 180 degrees')
  console.log('A typical "long" looks like: "long": -90.596')
}

// Prints a hint about valid log directory paths
function printLogDirectoryHint () {
  console.log('"logDir" is the path to the directory to store logs in')
  console.log('A typical "logDir" looks like: "logDir": "logs"')
}

// Prints a hint about valid location parameters
function printOpenWeatherMapsLocationHint(){
  console.log('"location" contains get parameters to send to api.openweathermap.org/2.5/forecast to specify forecast location');
  console.log('Valid key value pairs are:');
  console.log('  "q": "CITY_NAME,ISO_3166_COUNTRY_CODE"');
  console.log('  OR');
  console.log('  "id": "CITY_ID"');
  console.log('  OR');
  console.log('  "lat": "LATITIUDE",');
  console.log('  "lon": "LONGITUDE"');
  console.log('  OR');
  console.log('  "zip": "ZIP_CODE,ISO_3166_COUNTRY_CODE"');
}

// Checks and object for unrecognized keys. Prints out warning for each unrecognized key.
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

if (!(config instanceof Object) || config instanceof Array) {
  throw new TypeError('Config file must contain a JSON object')
} else {
  // Check alerts
  const alerts = config.alerts

  if (!alerts || alerts.disabled) {
    console.log('INFO: Alerts disabled.')
  } else if (!(alerts instanceof Object) || alerts instanceof Array) {
    console.log('ERROR: config.alerts must be an object')
  } else {
    console.log('INFO: Alerts are enabled.')

    // Check info to be sent in user-agent header to NWS api
    const appInfo = alerts.app

    if (appInfo === undefined) {
      console.log('ERROR: Enabled alerts require an app object containing required information to send to the national weather service api for a response.')
      console.log('The "app" object is in the form:\n"app": {\n  "contact": "EMAIL ADDRESS",\n  "name": "APP NAME",\n  "version": "VERSION NO",\n  "website": "APP WEBSITE OR CONTACT WEBSITE"\n}\n')
    } else if (!(appInfo instanceof Object) || appInfo instanceof Array) {
      console.log('ERROR: config.alerts.app must be an object')
    } else {
      // Check contact
      const contact = appInfo.contact

      if (contact === undefined) {
        console.log('ERROR: missing field "contact" in config.alerts.app. The national weather service api requires contact information in order to send responses.')
        console.log('A typical "contact" looks like: "contact": "contact.email@example.com"')
      } else if (typeof contact !== 'string') {
        console.log('ERROR: field "contact" in config.alerts.app must be a string.')
      } else if (!configFieldValidator.validateAlertsAppContact(appInfo.contact)) {
        console.log('WARNING: field "contact" in config.alerts.app is typically an email address')
      }

      // Check app name
      const appName = appInfo.name

      if (appName === undefined) {
        console.log('ERROR: missing field "name" in config.alerts.app. The national weather service api requires an app name in order to send responses.')
        console.log('A typical "name" looks like: "name": "ApplicationName"')
      } else if (typeof appName !== 'string') {
        console.log('ERROR: field "name" in config.alerts.app must be a string.')
      } else if (!configFieldValidator.validateAlertsAppName(appName)) {
        console.log('WARNING: field "name" in config.alerts.app is the empty string or contains exclusively whitespace')
      }

      // Check app version
      const version = appInfo.version

      if (version === undefined) {
        console.log('ERROR: missing field "version" in config.alerts.app. The national weather service api requires an app version in order to send responses.')
        console.log('A typical "version" looks like: "version": "vX.Y"')
      } else if (typeof version !== 'string' && isNaN(version)) {
        console.log('ERROR: field "version" in config.alerts.app must be a string or a number.')
      } else if (typeof version === 'string' && !configFieldValidator.validateAlertsAppVersion(version)) {
        console.log('WARNING: field "version" in config.alerts.app is the empty string or contains exclusively whitespace')
      }

      // Check app website
      const website = appInfo.website

      if (website === undefined) {
        console.log('ERROR: missing field "website" in config.alerts.app. The national weather service api requires an app related website in order to send responses.')
        console.log('A typical "website" looks like: "website": "https://your.app.url/"')
      } else if (typeof website !== 'string') {
        console.log('ERROR: field "website" in config.alerts.app must be a string.')
      } else if (!configFieldValidator.validateAlertsAppWebsite(website)) {
        console.log('WARNING: field "website" in config.alerts.app in unrecognized format')
      }

      checkKeys(appInfo, 'config.alerts.app', ['contact', 'name', 'version', 'website'])
    }

    // Check alert filters
    if (alerts.filters === undefined) { // No filters
      console.log('INFO: No alert filters.')
    } else if (!(alerts.filters instanceof Array)) { // Filters wrong type
      console.log('ERROR: config.alerts.filters must be an array.')
    } else if (!alerts.filters.length) { // No filters also
      console.log('INFO: No alert filters.')
    } else { // There are filters
      console.log('INFO: Alert Filters:')

      alerts.filters.forEach((filter, i) => {
        if (!(filter instanceof Object) || filter instanceof Array) {
          console.log('ERROR: each filter of config.alerts.filters must be an object')
        } else {
          const valid = {
            path: true,
            restriction: true,
            value: null
          }

          // Check filter restriction
          if (filter.restriction === undefined) { // Filter restriction missing
            console.log(`ERROR: Filter #${i + 1} in config.alerts.filters missing field "restriction"`)
            printFilterRestrictionHint()

            valid.restriction = false
          } else if (typeof filter.restriction !== 'string') { // Filter restriction wrong type
            console.log(`ERROR: Restriction of filter #${i + 1} in config.alerts.filters not a string`)
            printFilterRestrictionHint()

            valid.restriction = false
          } else if (!configFieldValidator.validateAlertsFiltersRestriction(filter.restriction)) {
            console.log(`ERROR: Filter #${i + 1} has unknown filter restriction: ${filter.restriction}`)
            printFilterRestrictionHint()

            valid.restriction = false
          }

          // Check filter path
          if (filter.path === undefined) { // Filter path missing
            console.log(`ERROR: Filter #${i + 1} in config.alerts.filters missing field "path"`)
            printFilterPathHint()

            valid.path = false
          } else if (typeof filter.path !== 'string') { // Filter path wrong type
            console.log(`ERROR: Path of filter #${i + 1} in config.alerts.filters is not a string`)
            printFilterPathHint()

            valid.path = false
          } else if (!configFieldValidator.validateAlertsFiltersPath(filter.path)) { // Filter path wrong format
            console.log(`ERROR: Path of filter #${i + 1} in config.alerts.filters is in incorrect format`)
            printFilterPathHint()

            valid.path = false
          }

          if (valid.restriction) {
            // Check values
            try {
              valid.value = configFieldValidator.validateAlertsFiltersValue(filter.restriction, filter.value)
            } catch (e) {
              if (e instanceof ReferenceError) {
                console.log(`ERROR: Invalid filter #${i + 1} "${filter.restriction}". Filter value missing.`)
              } else if (e instanceof TypeError) {
                console.log(`ERROR: Invalid filter #${i + 1} "${filter.restriction}". ${e.message}`)
              }
            }
            
            if (valid.path) {
              switch (filter.restriction) {
                case 'after':
                  if (valid.value) {
                    console.log(`INFO: Filter #${i + 1} will remove all alerts with dates at alert.${filter.path} that are before the time when alerts are fetched + ${filter.value} hour(s).`)
                  }
                  break
                case 'before':
                  if (valid.value) {
                    console.log(`INFO: Filter #${i + 1} will remove all alerts with dates at alert.${filter.path} that are after the time when alerts are fetched + ${filter.value} hour(s).`)
                  }

                  break
                case 'contains':
                  if (valid.value) {
                    console.log(`INFO: Filter #${i + 1} will remove all alerts with arrays at alert.${filter.path} not containing the value ${filter.value}.`)
                  }

                  break
                case 'equals':
                  if (valid.value) {
                    console.log(`INFO: Filter #${i + 1} will remove all alerts with values at alert.${filter.path} equal(strict equality) to ${filter.value}.`)
                  }

                  break
                case 'has':
                  console.log(`INFO: Filter #${i + 1} will remove all alerts where alert.${filter.path} ${filter.value ? 'does not contain' : 'contains'} a value.`)
                  break
                case 'matches':
                  if (valid.value) {
                    console.log(`INFO: Filter #${i + 1} will remove all alerts with strings at alert.${filter.path} not matching the regex ${filter.value}.`)
                  } else {
                    console.log(`ERROR: Invalid filter #${i + 1} "matches". Filter value is invalid regex.`)
                  }

                  break
              }
            }
          }
          
          checkKeys(filter, `config.alerts.filters[${i}]`, ['restriction', 'path', 'value'])
        }
      })
    }
    
    // check get params for api.weather.gov
    const params = alerts.params
    
    if (params === undefined) {
      console.log('ERROR: Missing "params" in config.alerts');
    } else if (!(params instanceof Object) || params instanceof Array) {
      console.log('ERROR: config.alerts.params must be an object')
    } else {
      let locationParamCount = 0;
      
      locationParamCount += params.area !== undefined;
      locationParamCount += params.point !== undefined;
      locationParamCount += params.region !== undefined;
      locationParamCount += params.region_type !== undefined;
      locationParamCount += params.zone !== undefined;
      
      if(locationParamCount > 1){
        console.log('ERROR: 2 or more of these keys are invalid: area, point, region, region_type, zone in config.alerts.params');
      } else {
        let alertQueryParams = '';
        
        for (const paramName in params) {
          if (Object.prototype.hasOwnProperty.call(params, paramName)) {
            alertQueryParams += '&' + paramName + '=' + params[paramName]
          }
        }
        
        console.log(`INFO: Weather alert url is https://api.weather.gov/alerts?${alertQueryParams.substr(1)}`);
        console.log('WARNING: Validation of config.alerts.params is very limited. The best way to verify params is to visit the above URL.');
      }
      
      checkKeys(params, 'config.alerts.params', ['active', 'start', 'end', 'status', 'message_type', 'event', 'code', 'region_type', 'point', 'region', 'area', 'zone', 'urgency', 'severity', 'certainty', 'limit', 'cursor'])
    }
  }

  // Check coordinates
  const coordinates = config.coordinates

  if (coordinates === undefined) {
    console.log('ERROR: Missing "coordinates" in config')
  } else if (!(coordinates instanceof Object) || coordinates instanceof Array) {
    console.log('ERROR: config.coordinates must be an object')
  } else {
    let validElevation = true
    let validLatitude = true
    let validLongitude = true

    // Check elevation
    if (coordinates.elevation === undefined) {
      console.log('ERROR: Missing field "elevation" in config.coordinates')
      printElevationHint()

      validElevation = false
    } else if (isNaN(coordinates.elevation)) {
      console.log('ERROR: Field "elevation" in config.coordinates must be a number')
      printElevationHint()

      validElevation = false
    } else if (!configFieldValidator.validateCoordinatesElevation(coordinates.elevation)) {
      console.log('ERROR: Field "elevation" in config.coordinates must be between -413 and 8848')
      printElevationHint()

      validElevation = false
    }

    // Check latitude
    if (coordinates.lat === undefined) {
      console.log('ERROR: Missing field "lat" in config.coordinates')
      printLatitudeHint()

      validLatitude = false
    } else if (isNaN(coordinates.lat)) {
      console.log('ERROR: Field "lat" in config.coordinates must be a number')
      printLatitudeHint()

      validLatitude = false
    } else if (!configFieldValidator.validateCoordinatesLat(coordinates.lat)) {
      console.log('ERROR: Field "lat" in config.coordinates must be between -90 and 90')
      printLatitudeHint()

      validLatitude = false
    }

    // Check longitude
    if (coordinates.long === undefined) {
      console.log('ERROR: Missing field "long" in config.coordinates')
      printLongitudeHint()

      validLongitude = false
    } else if (isNaN(coordinates.long)) {
      console.log('ERROR: Field "long" in config.coordinates must be a number')
      printLongitudeHint()

      validLongitude = false
    } else if (!configFieldValidator.validateCoordinatesLong(coordinates.long)) {
      console.log('ERROR: Field "long" in config.coordinates must be between -180 and 180')
      printLongitudeHint()

      validLongitude = false
    }

    checkKeys(coordinates, 'config.coordinates', ['elevation', 'lat', 'long'])

    if (validElevation && validLatitude && validLongitude) {
      console.log(`INFO: Observer position aka coordinates set as ${coordinates.elevation}m in elevation, ${Math.abs(coordinates.lat)}° ${coordinates.lat < 0 ? 'S' : 'N'}, ${Math.abs(coordinates.long)}° ${coordinates.long < 0 ? 'W' : 'E'}`)
    }
  }

  // Check logging
  const log = config.log

  if (log === undefined) {
    console.log('ERROR: Missing "log" in config')
  } else if (!(log instanceof Object) || log instanceof Array) {
    console.log('ERROR: config.log must be an object')
  } else {
    // Check log directory path
    if (log.logDir === undefined) {
      console.log('ERROR: Missing field "logDir" in config.log')
      printLogDirectoryHint()
    } else if (typeof log.logDir !== 'string') {
      console.log('ERROR: Field "logDir" in config.log must be a string')
      printLogDirectoryHint()
    } else if (!configFieldValidator.validateLogLogDir(log.logDir)) {
      console.log('ERROR: Field "logDir" in config.log not recognized as a valid file path')
      printLogDirectoryHint()
    } else {
      console.log(`INFO: Log directory set as: ${path.resolve('../' + log.logDir)}`)
    }

    checkKeys(log, 'config.log', ['logDir'])
  }

  // Check Open Weather Map 
  const OWM = config.open_weather_map
  
  if(OWM === undefined){
    console.log('ERROR: Missing "open_weather_map" in config')
  } else if(!(OWM instanceof Object) || OWM instanceof Array) {
    console.log('ERROR: config.open_weather_map must be an object')
  } else {
    // Check get params for weather forecast
    const location = OWM.location
    
    let paramsValid = true,
        keyValid = true
    
    if(location === undefined){
      console.log('ERROR: missing "location" in config.open_weather_map')
      printOpenWeatherMapsLocationHint()
      
      paramsValid = false;
    } else if(!(location instanceof Object) || location instanceof Array){
      console.log('ERROR: config.open_weather_map.location must be an object')
      printOpenWeatherMapsLocationHint()
      
      paramsValid = false;
    } else {
      checkKeys(location, 'config.open_weather_map.location', ['q', 'id', 'lat', 'lon', 'zip'])
    }
    
    //Check api key
    const apiKey = OWM.key
    
    if(apiKey === undefined){
      console.log('ERROR: missing field "key" in config.open_weather_map')
      
      keyValid = false
    } else if(typeof apiKey !== 'string'){
      console.log('ERROR: config.open_weather_map.key must be a string')
      
      keyValid = false
    }
    
    if(paramsValid && keyValid){
      let OWMQueryParams = ''
      
      for (const paramName in location) {
        if (Object.prototype.hasOwnProperty.call(location, paramName)) {
          OWMQueryParams += '&' + paramName + '=' + location[paramName]
        }
      }
    
      console.log(`INFO: Forecast data URL is https://api.openweathermap.org/data/2.5/forecast?${OWMQueryParams.substr(1)}&units=metric&APPID=${OWM.key}`)
      console.log('WARNING: Validation of config.open_weather_map is very limited. The best way to verify config.open_weather_map is to visit the above URL.');
    }
    
    checkKeys(OWM, 'config.open_weather_map', ['location', 'key'])
  }

  checkKeys(config, 'config', ['alerts', 'coordinates', 'log', 'open_weather_map', 'twitter'])
}

console.log('INFO: Errors / warnings displayed above if any were present.')
