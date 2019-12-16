'use strict'

const _ = require('lodash')
const promise = require('./promise.js')
const util = require('./util.js')

// Shortened descriptions and symbols for weather condition codes
// See https://openweathermap.org/weather-conditions for full code information
const weatherStatusCodeMap = require('./data/statusCodeMap.json')

// Converts an angle into cardinal direction
//  @param  {number} azimuth A number representing an angle in the range [0, 360)
//  @return {string} A character representing a cardinal direction or 2 character representing an intercardinal direction
function getWindDirectionAsCardinal (azimuth) {
  switch (Math.round(azimuth / 45)) {
    case 0:
    case 8:
      return '⬇️'
    case 1:
      return '↙️'
    case 2:
      return '⬅️'
    case 3:
      return '↖️'
    case 4:
      return '⬆️'
    case 5:
      return '↗️'
    case 6:
      return '➡️'
    case 7:
      return '↘️'
  }
}

module.exports = {
  DataFetcher: class Weather {
    //  @param {object} config The "weather" object from config.json
    //  @param {object} logger A winston logger
    constructor (config, logger) {
      this.logger = logger

      // Prepare weather get request URLs from config
      const OWM = config.openWeatherMap
      const OWMlocation = OWM.location
      let OWMQueryParams = ''

      for (const paramName in OWMlocation) {
        if (Object.prototype.hasOwnProperty.call(OWMlocation, paramName)) {
          OWMQueryParams += '&' + paramName + '=' + OWMlocation[paramName]
        }
      }

      this.weatherRequestURL = `https://api.openweathermap.org/data/2.5/forecast?${OWMQueryParams.substr(1)}&units=metric&APPID=${OWM.key}`

      const alerts = config.alerts

      if (alerts && !alerts.disabled) {
        const alertParams = alerts.params
        let alertQueryParams = ''

        for (const paramName in alertParams) {
          if (Object.prototype.hasOwnProperty.call(alertParams, paramName)) {
            alertQueryParams += '&' + paramName + '=' + alertParams[paramName]
          }
        }

        this.alertAppInfo = alerts.app

        if (alerts.filters && !alerts.filters.disabled) {
          this.alertFilters = alerts.filters

          // Prioritize "has" filters first
          this.alertFilters.sort((filter1, filter2) => {
            if (filter1.restriction === filter2.restriction) {
              return 0
            } else if (filter1.restriction === 'has') {
              return -1
            } else {
              return 1
            }
          })
        }

        this.alertURL = `https://api.weather.gov/alerts?${alertQueryParams.substr(1)}`
      }
    }

    // Sends the get request for weather alerts.
    //  @param {function} onDataLoaded(parsedWeatherAlertData): The callback to run on the weather alert data after it loads and is parsed as an Object
    //      @param {object} parsedWeatherAlertData: The alert data. See https://www.weather.gov/documentation/services-web-api#/default/get_alerts for more information.
    //  @param {function} onFailure(errors) The callback to run if there is a problem with loading the data
    //      @param {Error[]} errors The error(s) causing the failure
    getWeatherAlertsPromise () {
      this.logger.info('Attempt fetch weather alerts')

      return promise.getJSONPromiseGet(this.alertURL,
        {
          headers: {
            'User-Agent': `${this.alertAppInfo.name}/v${this.alertAppInfo.version} (${this.alertAppInfo.website}; ${this.alertAppInfo.contact})`
          }
        })
    }

    // Sends the get request for weather forecasts.
    //  @param {function} onDataLoaded(parsedWeatherData): The callback to run on the weather data after it loads and is parsed as an Object
    //      @param {object} parsedWeatherData: The weather data. See https://openweathermap.org/forecast5#parameter for details about the structure of the Object.
    //  @param {function} onFailure(errors) The callback to run if there is a problem with loading the data
    //      @param {Error[]} errors The error(s) causing the failure
    getForecastPromise () {
      this.logger.info('Attempt fetch weather data')

      return promise.getJSONPromisePost(this.weatherRequestURL)
    }

    // Filters weather alerts
    // @param  {object[]} alerts A list of weather alerts to be filtered
    // @param  {object[]} filters A list of objects in the form
    //   {
    //     "path": "", The PATH to the value to filter by
    //     "value": "" The VALUE to be used for filtering
    //     "keep": true|false True to discard all alerts not matching the filter false to discard all alerts matching the filter
    //     "restriction": "", One of the below restrictions
    //        "after"     - PATH leads to a date string. Matches alerts with dates after and excluding the current time + VALUE(hours)
    //        "before"    - PATH leads to a date string. Matches alerts with dates before and excluding the current time + VALUE(hours)
    //        "contains"  - PATH leads to an array. Matches alerts with arrays containing VALUE
    //        "has"       - Matches if PATH in an alert object exits. VALUE not needed and not used
    //        "equals"    - PATH leads to a primitive value. Matches alerts with VALUE exactly equal to the value at path
    //        "matches"   - PATH leads to a string. Matches alerts where the string is a match for the regex stored in VALUE
    //   }
    // @return {object[]} A list of weather alerts matching the specified filters
    filterAlerts (alerts) {
      if (!Array.isArray(alerts)) {
        throw new TypeError('Param alerts must be an array')
      }

      // Return when either there are no filters or there's nothing to filter
      if (!(alerts.length && this.alertFilters && this.alertFilters.length)) {
        return alerts
      }

      let unfilteredAlerts = alerts.slice(0)
      let filteredAlerts

      this.alertFilters.forEach((filter) => {
        filteredAlerts = []

        let filterTest

        switch (filter.restriction) {
          case 'after':
            filterTest = (alertElem) => {
              const dateAtPath = new Date(_.get(alertElem, filter.path))

              if (Number.isNaN(dateAtPath.getTime())) {
                throw new TypeError('Could not filter using restriction after. Value at path invalid date string.')
              }

              const referenceDate = new Date()
              referenceDate.setHours(filter.value + referenceDate.getHours())

              if ((referenceDate - dateAtPath < 0) === filter.keep) {
                filteredAlerts.push(alertElem)
              }
            }
            break
          case 'before':
            filterTest = (alertElem) => {
              const dateAtPath = new Date(_.get(alertElem, filter.path))

              if (Number.isNaN(dateAtPath.getTime())) {
                throw new TypeError('Could not filter using restriction before. Value at path invalid date string.')
              }

              const referenceDate = new Date()
              referenceDate.setHours(filter.value + referenceDate.getHours())

              if ((referenceDate - dateAtPath > 0) === filter.keep) {
                filteredAlerts.push(alertElem)
              }
            }
            break
          case 'contains':
            filterTest = (alertElem) => {
              const valueAtPath = _.get(alertElem, filter.path)

              if (!Array.isArray(valueAtPath)) {
                throw new TypeError('Could not filter using restriction contains. Value at path not array.')
              }

              if ((valueAtPath.indexOf(filter.value) > -1) === filter.keep) {
                filteredAlerts.push(alertElem)
              }
            }
            break
          case 'equals':
            filterTest = (alertElem) => {
              if ((_.get(alertElem, filter.path) === filter.value) === filter.keep) {
                filteredAlerts.push(alertElem)
              }
            }
            break
          case 'has':
            filterTest = filter.keep ? (alertElem) => {
              try {
                if (_.get(alertElem, filter.path) !== undefined) {
                  filteredAlerts.push(alertElem)
                }
              } catch (e) {
                // do nothing
              }
            }
              : (alertElem) => {
                try {
                  if(_.get(alertElem, filter.path) === undefined){
                    filteredAlerts.push(alertElem)
                  }
                } catch (e) {
                  filteredAlerts.push(alertElem)
                }
              }
            break
          case 'matches':
            filterTest = (alertElem) => {
              const regex = new RegExp(filter.value)
              const valueAtPath = _.get(alertElem, filter.path)

              if (typeof valueAtPath !== 'string') {
                throw new TypeError('Could not filter using restriction mathces. Value at path not string.')
              }

              if (regex.test(_.get(alertElem, filter.path)) === filter.keep) {
                filteredAlerts.push(alertElem)
              }
            }
            break
        }

        unfilteredAlerts.forEach(filterTest)
        unfilteredAlerts = filteredAlerts.slice(0)
      })

      return filteredAlerts
    }
  },

  // Generates a warning message
  //  @param  {object} alertData A parsed json object from api.weather.gov/alerts. See https://www.weather.gov/documentation/services-web-api#/default/get_alerts for more information.
  //  @return {string[]} An array containing messages desribing the nature of each active alert.
  getAlertMessage (alertData) {
    const alertEvent = alertData.properties.event
    let message = `ALERT: ${alertEvent}\n`

    const start = new Date(alertData.properties.effective)
    const end = new Date(alertData.properties.ends)

    message += `Lasting from ${start.toDateString().substr(0, 10)} ${start.getHours()}:00 `
    message += alertData.properties.ends ? `to ${end.toDateString().substr(0, 10)} ${end.getHours()}:00\n\n` : 'indefinitely'

    const alertDefintions = require('./data/alertDefinitions.json')
    message += alertDefintions[alertEvent]

    return message
  },

  // Generates the default forecast message.
  //  @param  {object} weatherData The weather data Object recieved from OpenWeatherMap
  //  @return {string} A message describing the condition, temperature, and wind for the next 9 hours. Max 142 characters.
  generateForecastMessage (weatherData) {
    const forecastData = weatherData.list.slice(0, 3)
    let defaultForecast = (Math.random() > 0.000228310502) ? 'Forecast' : 'Fourcast'

    for (const { dt, main, weather, wind: { deg, speed } } of forecastData) {
      const conditions = {
        symbol: weatherStatusCodeMap[weather[0].id].symbol,
        temp: {
          max: Math.round(main.temp_max),
          min: Math.round(main.temp_min)
        },
        time: new Date(dt * 1000).toTimeString().substr(0, 2),
        wind: {
          direction: getWindDirectionAsCardinal(deg),
          speed: speed.toPrecision(2)
        }
      }

      util.validateNotNull(conditions)

      defaultForecast += '\n'
      defaultForecast += `${conditions.time}:00:${conditions.symbol}, [${conditions.temp.min},${conditions.temp.max}]°C, 💨 ${conditions.wind.speed} m/s ${conditions.wind.direction}`
    }

    defaultForecast += '\n\n'

    return defaultForecast
  }
}
