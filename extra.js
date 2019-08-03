'use strict'

const celestial = require('./celestial.js')
const util = require('./util.js')

/** @fileoverview A collection of functions for generating various statements about the weather*/
module.exports = class ExtraGenerator {
  constructor (coordinates, logger) {
    this.logger = logger
    this.coordinates = coordinates
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
    const extra = {}

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
      extra.type = 'beaufort'
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
}
