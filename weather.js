'use strict'

const celestial = require('./celestial.js')
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

module.exports = class Weather {
  //  @param {object} config The contents of config.json as an object
  //  @param {object} logger A winston logger
  constructor (config, logger) {
    // Prepare weather get request URLs from config
    const alertParams = config.alerts.params
    let alertQueryParams = ''
    const OWM = config.open_weather_map
    const OWMlocation = OWM.location
    let OWMQueryParams = ''

    for (const paramName in alertParams) {
      if (Object.prototype.hasOwnProperty.call(alertParams, paramName)) {
        alertQueryParams += '&' + paramName + '=' + alertParams[paramName]
      }
    }

    for (const paramName in OWMlocation) {
      if (Object.prototype.hasOwnProperty.call(OWMlocation, paramName)) {
        OWMQueryParams += '&' + paramName + '=' + OWMlocation[paramName]
      }
    }

    this.alertAppInfo = config.alerts.app

    if (config.alerts.filters) {
      this.alertFilters = config.alerts.filters

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
    this.weatherRequestURL = `https://api.openweathermap.org/data/2.5/forecast?${OWMQueryParams.substr(1)}&units=metric&APPID=${OWM.key}`

    this.coordinates = config.coordinates
    this.logger = logger
  }

  // Generates a warning message
  //  @param  {object} alertData A parsed json object from api.weather.gov/alerts. See https://www.weather.gov/documentation/services-web-api#/default/get_alerts for more information.
  //  @return {string[]} An array containing messages desribing the nature of each active alert.
  getAlertMessage (alertData) {
    const alertEvent = alertData.properties.event
    let message = `ALERT: ${alertEvent}\n`

    const start = new Date(alertData.properties.effective)
    const end = new Date(alertData.properties.ends)

    message += `Lasting from ${start.toDateString().substr(0, 10)} ${start.getHours()}:00 to ${end.toDateString().substr(0, 10)} ${end.getHours()}:00\n\n`

    const alertDefintions = require('./data/alertDefinitions.json')
    message += alertDefintions[alertEvent]

    return message
  }

  // Generates a statement about the current wind speed using the beaufort scale
  //  @param  {number} windSpeed The windSpeed in m/s
  //  @return {string} A statement about how the current wind speed scores on the beaufort scale
  getBeaufort (windSpeed) {
    const beaufort = {}

    if (windSpeed < 0.5) {
      beaufort['description'] = '"calm"'
      beaufort['fact'] = 'Smoke rises vertically.'
    } else if (windSpeed < 1.6) {
      beaufort['description'] = '"light air"'
      beaufort['fact'] = 'Wind direction is shown by smoke drift but not by wind vanes.'
    } else if (windSpeed < 3.4) {
      beaufort['description'] = 'a "light breeze"'
      beaufort['fact'] = 'Wind is felt on the face and leaves rustle.'
    } else if (windSpeed < 5.6) {
      beaufort['description'] = 'a "gentle breeze"'
      beaufort['fact'] = 'Leaves and small twigs are moved. Light flags are extended.'
    } else if (windSpeed < 8) {
      beaufort['description'] = 'a "moderate breeze"'
      beaufort['fact'] = 'Dust and loose paper are raised. Small branches are moved.'
    } else if (windSpeed < 10.8) {
      beaufort['description'] = 'a "fresh breeze"'
      beaufort['fact'] = 'Small trees are swayed. Crested wavelets form on inland waters.'
    } else if (windSpeed < 13.9) {
      beaufort['description'] = 'a "strong breeze"'
      beaufort['fact'] = 'Large branches are moved. Umbrellas are used with difficulty.'
    } else if (windSpeed < 17.2) {
      beaufort['description'] = 'a "near gale"'
      beaufort['fact'] = 'Whole trees are moved. There is resistance when walking against the wind.'
    } else if (windSpeed < 20.8) {
      beaufort['description'] = 'a "gale"'
      beaufort['fact'] = 'Twigs are broken off trees. The wind impedes progress.'
    } else if (windSpeed < 24.5) {
      beaufort['description'] = 'a "strong gale"'
      beaufort['fact'] = 'Slight structural damage is caused (chimney pots and slates removed).'
    } else if (windSpeed < 28.5) {
      beaufort['description'] = 'a storm'
      beaufort['fact'] = 'Trees are uprooted. There is considerable structural damage.'
    } else if (windSpeed < 32.7) {
      beaufort['description'] = 'a "violent storm"'
      beaufort['fact'] = 'A very rarely experienced event accompanied by widespread damage.'
    } else {
      beaufort['description'] = 'a "hurricane force"'
      beaufort['fact'] = 'Causes devastation.'
    }

    return `A ${windSpeed}m/s wind is ${beaufort.description} on the beaufort scale. ${beaufort.fact}`
  }

  // Gets a random extra message to append to each update.
  //  @param  {object} parsedWeatherData The weather data Object recieved from OpenWeatherMap
  //  @return {object} An object containing
  //            {string} statement A random extra statement to append to each update
  //            {string} type The type of extra statement generated
  getExtra (parsedWeatherData) {
    this.logger.info('Generating extra statement.')

    if (!(parsedWeatherData instanceof Object)) {
      console.log(parsedWeatherData)
      throw new Error('Parameter parsedWeatherData must be an object')
    }

    const messageRoll = Math.random()
    let extra = {}

    if (messageRoll < 0.01) {
      this.logger.info('Generating joke')
      extra.type = 'joke'
      extra.statement = this.getJoke(parsedWeatherData.list[0])
    } else if (messageRoll < 0.1) {
      this.logger.info('Generating tutorial')
      extra.type = 'tutorial'
      extra.statement = this.getTutorial()
    } else if (messageRoll < 0.35) {
      const eventRoll = Math.random()

      if (eventRoll < 0.6) {
        this.logger.info('Generating sunrise')
        extra.type = 'sunrise'
        extra.statement = celestial.getDayNight(this.coordinates)
      } else if (eventRoll < 0.8) {
        this.logger.info('Generating lunar')
        extra.type = 'lunar'
        extra.statement = celestial.getLunarPhase()
      } else {
        this.logger.info('Generating season')
        extra.type = 'season'
        extra.statement = celestial.getSeasonProgress()
      }
    } else if (messageRoll < 0.5) {
      this.logger.info('Generating trivia')
      extra.type = 'trivia'
      extra.statement = this.getBeaufort(parsedWeatherData.list[0].wind.speed.toPrecision(2))
    } else {
      const forecastData = parsedWeatherData.list.slice(0, 3)
      const stat = util.pickRandom(['precipitation', 'precipitation', 'precipitation', 'pressure', 'humidity', 'cloudiness'])
      
      this.logger.info(`Generating extra stat: ${stat}`)
      
      extra.statement = this.getExtraStat(stat, forecastData)
      extra.type = extra.statement.match(/^Expected ([a-zA-Z]+)[: ]/)[1]
    }
    
    return extra
  }

  // Gets an extended forecast for 3 extra stats not usually presesnt in the main forecast
  //  @param  {string} stat The name of the extra stat to feature.
  //  @param  {object} forecastData An array of 3 objects containing weather data
  //  @return {string} A forecast message displaying the given stat
  getExtraStat (stat, forecastData) {
    if (stat === 'precipitation') {
      const precipitationStats = forecastData.map((elem) => {
        return {
          time: new Date(elem.dt * 1000).toTimeString().substr(0, 2),
          rain: (elem.rain instanceof Object) ? elem.rain['3h'] : undefined,
          snow: (elem.snow instanceof Object) ? elem.snow['3h'] : undefined
        }
      })

      if (precipitationStats.reduce((acc, elem) => acc || elem.rain || elem.snow, 0)) { // check if any precipitation is present
        let precipitation = 'Expected Precipitation:\n'

        for (let i = 0; i < 3; i++) {
          const pStat = precipitationStats[i]
          const rain = pStat.rain.toFixed(2)
          const snow = pStat.snow.toFixed(2)

          if (rain || snow) {
            precipitation += `${pStat.time}:00: `
            precipitation += (rain) ? `${rain} mm/h rain` : ''
            precipitation += (snow) ? `, ${snow} mm/h snow.` : '.'
            precipitation += '\n'
          }
        }

        return precipitation.substr(0, precipitation.length - 1)
      } else {
        stat = util.pickRandom(['pressure', 'humidity', 'cloudiness'])
      }
    }

    switch (stat) {
      case 'pressure':
        let pressure = 'Expected Pressure:\n'

        forecastData.forEach((elem) => {
          pressure += `${new Date(elem.dt * 1000).toTimeString().substr(0, 2)}:00: ${elem.main.grnd_level}hPa\n`
        })

        return pressure.substr(0, pressure.length - 1)
      case 'humidity':
        let humidity = 'Expected Humidity:\n'

        forecastData.forEach((elem) => {
          humidity += `${new Date(elem.dt * 1000).toTimeString().substr(0, 2)}:00: ${elem.main.humidity}%\n`
        })

        return humidity.substr(0, humidity.length - 1)
      case 'cloudiness':
        let cloudiness = 'Expected Cloud Coverage:\n'

        forecastData.forEach((elem) => {
          cloudiness += `${new Date(elem.dt * 1000).toTimeString().substr(0, 2)}:00: ${elem.clouds.all}%\n`
        })

        return cloudiness.substr(0, cloudiness.length - 1)
      default:
        throw new Error(`Could not get extra stat "${stat}"`)
    }
  }

  // Generates the default forecast message.
  //  @param  {object} parsedWeatherData The weather data Object recieved from OpenWeatherMap
  //  @return {string} A message describing the condition, temperature, and wind for the next 9 hours. Max 142 characters.
  generateForecastMessage (parsedWeatherData) {
    const forecastData = parsedWeatherData.list.slice(0, 3)
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

  // Retrieves a joke from data/jokes.json
  //  @param  {object} currentConditions The conditions for the near future
  //  @return {String} A joke.
  getJoke (currentConditions) {
    if (!(currentConditions instanceof Object)) {
      throw new TypeError('Param currentConditions must be an Object')
    }

    const jokes = require('./data/jokes.json')
    const jokePool = jokes.general

    if ((currentConditions.main.temp_min + currentConditions.main.temp_max) / 2 >= 30) {
      jokePool.concat(jokes.hot)
    }

    return util.pickRandom(jokePool)
  }

  // Generates a random message explaining some of the messages the bot displays.
  //  @param  {number=} id The id of the specified tutorial.
  //  @return {string} If an id is given, the tutorial message with the given id otherwise a random explanation message.
  getTutorial (id) {
    const iconDefinitions = require('./data/iconDefinitions.json')

    if (!id) {
      id = Math.floor(Math.random() * (2 + iconDefinitions.length))
    }

    switch (id) {
      case 0:
        return 'The beaufort scale is a way of measuring wind speed based on observing things blown by the wind rather than using instruments.'
      case 1:
        return `The pressure displayed is at ground level. Columbia is ${this.coordinates.elevation}m above sea level.`
      default: // Icon Definitions
        const iconDefinition = iconDefinitions[id - 2]
        return `${iconDefinition.icon} indicates ${iconDefinition.conditions.replace(',', ' or')}\nSee all the icon meanings at https://firelemons.github.io/COMOWeather/`
    }
  }

  // Filters weather alerts
  // @param  {object[]} alerts A list of weather alerts to be filtered
  // @param  {object[]} filters A list of objects in the form
  //   {
  //     "restriction": "", One of the below restrictions
  //        "after"     - Path leads to a date string. All alerts with dates before value will be removed
  //        "before"    - Path leads to a date string. All alerts with dates after value will be removed
  //        "contains"  - Path leads to an array. All alerts with arrays containing value will be kept
  //        "has"       - Checks if path exits. Value specifies whether alerts with valid paths will be kept or removed.
  //        "equals"    - Path leads to a primitive value. All alerts with value matching the value at path will be kept
  //        "matches"   - Path leads to a string. All alerts matching the regex stored in value will be kept
  //     "path": "", The path to the value to filter by
  //     "value": "" The value to be used for filtering
  //   }
  // @return {object[]} A list of weather alerts matching the specified filters
  filterAlerts (alerts) {
    if (!Array.isArray(alerts)) {
      throw new TypeError('Param alerts must be an array')
    }

    // Either there are no filters or there's nothing to filter
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
            const dateAtPath = new Date(util.getValue(alertElem, filter.path))

            if (Number.isNaN(dateAtPath.getTime())) {
              throw new TypeError('Could not filter using restriction after. Value at path invalid date string.')
            }

            const referenceDate = new Date()
            referenceDate.setHours(filter.value + referenceDate.getHours())

            if (referenceDate - dateAtPath < 0) {
              filteredAlerts.push(alertElem)
            }
          }
          break
        case 'before':
          filterTest = (alertElem) => {
            const dateAtPath = new Date(util.getValue(alertElem, filter.path))

            if (Number.isNaN(dateAtPath.getTime())) {
              throw new TypeError('Could not filter using restriction before. Value at path invalid date string.')
            }

            const referenceDate = new Date()
            referenceDate.setHours(filter.value + referenceDate.getHours())

            if (referenceDate - dateAtPath > 0) {
              filteredAlerts.push(alertElem)
            }
          }
          break
        case 'contains':
          filterTest = (alertElem) => {
            const valueAtPath = util.getValue(alertElem, filter.path)

            if (!Array.isArray(valueAtPath)) {
              throw new TypeError('Could not filter using restriction contains. Value at path not array.')
            }

            if (valueAtPath.indexOf(filter.value) > -1) {
              filteredAlerts.push(alertElem)
            }
          }
          break
        case 'equals':
          filterTest = (alertElem) => {
            if (util.getValue(alertElem, filter.path) === filter.value) {
              filteredAlerts.push(alertElem)
            }
          }
          break
        case 'has':
          filterTest = filter.value ? (alertElem) => {
            try {
              if (util.getValue(alertElem, filter.path) !== undefined) {
                filteredAlerts.push(alertElem)
              }
            } catch (e) {
              // do nothing
            }
          }
            : (alertElem) => {
              try {
                util.getValue(alertElem, filter.path)
              } catch (e) {
                filteredAlerts.push(alertElem)
              }
            }
          break
        case 'matches':
          filterTest = (alertElem) => {
            const regex = new RegExp(filter.value)
            const valueAtPath = util.getValue(alertElem, filter.path)

            if (typeof valueAtPath !== 'string') {
              throw new TypeError('Could not filter using restriction mathces. Value at path not string.')
            }

            if (regex.test(util.getValue(alertElem, filter.path))) {
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
}
