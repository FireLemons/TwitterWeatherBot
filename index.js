'use strict'

const config = require('./config.json')
const Extra = require('./extra.js')
const fs = require('fs')
const path = require('path')
const schedule = require('node-schedule')
const TwitterManager = require('./tweetWeather.js')
const weatherTools = require('./weather.js')
const winston = require('winston')
const util = require('./util.js')

/*
 * Set up logging
 */
const dateFormat = {
  month: 'long',
  day: '2-digit',
  hour12: false,
  hour: 'numeric',
  minute: 'numeric',
  second: 'numeric'
}
const formatDate = new Intl.DateTimeFormat('en-US', dateFormat).format

// Makes human readable timestamps
//  @return {string} A timestamp in the form: FULL_MONTH_NAME DAY HH:MM:SS
function getCurrentTimeFormatted () {
  var date = new Date()
  var formattedDate = formatDate(date)

  if (formattedDate.length < 22) {
    var spaceIndex = formattedDate.indexOf(' ')

    formattedDate = formattedDate.substr(0, spaceIndex).padEnd(10) + formattedDate.substr(spaceIndex + 1)
  }

  return formattedDate.replace(',', '')
}

// Gets the line number of an Error
//  @param  {Error} An Error object
//  @return {number} The line number where the Error occurred
function getErrorSource (error) {
  const { stack } = error

  for (var firstNewLineIndex = 0; firstNewLineIndex < stack.length && stack[firstNewLineIndex] !== '\n'; firstNewLineIndex++) {
  }

  for (var secondNewLineIndex = firstNewLineIndex + 1; secondNewLineIndex < stack.length && stack[secondNewLineIndex] !== '\n'; secondNewLineIndex++) {
  }

  const errorSourceData = stack.substr(firstNewLineIndex, secondNewLineIndex - firstNewLineIndex).match(/([\w]+\.js):([\d]+):[\d]+\)$/)

  return {
    fileName: errorSourceData[1],
    lineNumber: parseInt(errorSourceData[2])
  }
}

// Create the log directory if it doesn't exist
var { log: { logDir } } = config

if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir)
}

const MESSAGE = Symbol.for('message')
const LEVEL = Symbol.for('level')

// Holds an error message and a line number
class TrackedError {
  constructor (error) {
    if (error instanceof Error) {
      Object.assign(this, error)
      Object.assign(this, getErrorSource(error))
      this.message = error.message
    } else {
      throw new Error('Could not instantiate LineNumberError from non Error object')
    }
  }
}

// Formats log entries with timestamps and sometimes line numbers
//  @param {object} logEntry The log entry to be formatted
const logEntryFormatter = (logEntry) => {
  const timestamp = {
    time: getCurrentTimeFormatted()
  }

  if (logEntry instanceof Error) {
    logEntry = new TrackedError(logEntry)
  }

  const logAsJSON = Object.assign(timestamp, logEntry)

  logEntry[MESSAGE] = JSON.stringify(logAsJSON)

  return logEntry
}

// Init logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format(logEntryFormatter)(),
  exceptionHandlers: [
    new winston.transports.Console(),
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      maxsize: 10000
    })
  ],
  // Starts a delayed process shutdown so the logger has time to write exceptions to files.
  //  @param {object} err An error describing the reason for shutting down
  exitOnError: function (err) {
    function * exitNotifier () {
      yield `Process encountered a fatal error.${(err.code) ? ' Code: ' + err.code : ''} Exiting in...`
      yield 3
      yield 2
      yield 1
    }

    const exitMessage = exitNotifier()

    const exitSequence = setInterval(function () {
      const message = exitMessage.next().value

      if (message) {
        console.log(message)
      } else {
        process.exit(1)
      }
    }, 1000)

    return false
  },
  transports: [
    new winston.transports.Console({
      level: 'warn'
    }),
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      maxsize: 1000000
    }),
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log'),
      maxsize: 1000000
    })
  ]
})

// Logs errors for some process disruptions
//  @param {string} The name of the signal that triggered the disruption
var disruptHandler = (signal) => {
  logger.error(new Error('Weather bot process killed unexpectedly by ' + signal))
  process.exit(1)
}

process.on('SIGINT', disruptHandler)
process.on('SIGHUP', disruptHandler)

// Logs errors for unhandled promises
process.on('unhandledRejection', (reason, p) => {
  logger.error(`Unhandled Rejection reason: ${JSON.stringify(reason)}`)
  console.log(p)
})

// Init Weather Data Object
const weatherFetcher = new weatherTools.DataFetcher(config.alerts, config.open_weather_map, logger)

// Init extra statement generator
const extraGenerator = new Extra(config.coordinates, logger)

/*
 * Load stats
 */

let _stats
// Saves the stats object to a file
const saveStats = () => {
  fs.writeFile('./data/stats.json', JSON.stringify(_stats), (error) => {
    if (error) {
      logger.error(error)
    }
  })
}

if (!fs.existsSync('./data/stats.json')) {
  _stats = {
    lastAlertUpdate: new Date(),
    lastUpdate: new Date()
  }

  saveStats()
} else {
  _stats = require('./data/stats.json')
  _stats.lastAlertUpdate = new Date(_stats.lastAlertUpdate)
  _stats.lastUpdate = new Date(_stats.lastUpdate)
}

const stats = util.getWatchedObject(_stats, saveStats)

// Init Twitter Data Object
const tweetWeather = new TwitterManager(config.twitter, logger, stats)

/*
 *  Schedule forecasts to go out every 2 hours.
 */

let retryTimeout = 0

// Tries to fetch forecast data and tweet it
//  @param  {boolean} isLate true if the last scheduled forecast was missed otherwise false
function tryFetchWeather (isLate) {
  const onFailure = (error) => {
    if (retryTimeout <= 262144) {
      logger.warn(error)
      logger.info(`Retrying fetching weather data in ${retryTimeout}ms. Retry ${(retryTimeout / 131072) + 1} of 3`)

      setTimeout(() => {
        tryFetchWeather(isLate)
      }, retryTimeout)

      retryTimeout += 131072
    } else {
      logger.error(error)

      const failureMessage = util.pickRandom(require('./data/jokes.json').error)

      tweetWeather.sendTweet(failureMessage)
        .catch((error) => {
          logger.error('Failed to send failure tweet for forecast')
          logger.error(error)
        })
    }
  }

  weatherFetcher.getForecastPromise().then((forecastData) => {
    let message = weatherTools.generateForecastMessage(forecastData)
    // extra statement
    if (message) {
      // extra statement
      let extra

      if (isLate) {
        message += util.pickRandom(require('./data/jokes.json').late)
      } else {
        extra = extraGenerator.getExtra(forecastData)
        message += extra.statement

        logger.info(`Generated: ${JSON.stringify(extra)}`)
      }

      tweetWeather.sendTweet(message)
        .then((tweet) => {
          stats.lastUpdate = new Date()

          if (!isLate) {
            if (!stats[extra.type]) {
              stats[extra.type] = 0
            }

            stats[extra.type] += 1
          }
        }).catch((error) => {
          logger.error('Failed to send forecast update')
          onFailure(error)
        })
    } else {
      throw new Error('Failed to generate status message.')
    }
  }).catch((error) => {
    logger.error('Failed to fetch forecast data')
    onFailure(error)
  })
}

if (config.alerts && !config.alerts.disabled) {
  let retryAlertTimeout = 0

  function tryFetchAlerts () {
    const onFailure = (error) => {
      if (retryAlertTimeout <= 262144) {
        logger.warn(new Error('Failed to load weather alert data.'))
        logger.warn(error)
        logger.info(`Retrying fetching weather alert data in ${retryAlertTimeout}ms. Retry ${(retryAlertTimeout / 131072) + 1} of 3`)

        setTimeout(() => {
          tryFetchAlerts()
        }, retryAlertTimeout)

        retryAlertTimeout += 131072
      } else {
        logger.error(new Error('Failed to load weather alert data.'))
        logger.error(error)

        tweetWeather.sendTweet('Failed to fetch weather alert data. There could be a weather alert currently.')
          .catch((error) => {
            logger.error('Failed to send weather alert failure message')
            logger.error(error)
          })
      }
    }

    weatherFetcher.getWeatherAlertsPromise().then((alertData) => {
      const alerts = weatherFetcher.filterAlerts(alertData.features)

      if (!alerts.length) {
        stats.lastAlertUpdate = new Date()
      }

      alerts.forEach((alertData) => {
        const alertMessage = weatherTools.getAlertMessage(alertData)

        if (alertMessage) {
          tweetWeather.sendTweet(alertMessage)
            .then((tweet) => {
              stats.lastAlertUpdate = new Date()
            })
            .catch((error) => {
              logger.error('Failed to send weather alert tweet')
              onFailure(error)
            })
        } else if (!alertMessage) {
          logger.error(new Error('Failure in generating alert message'))
          logger.error(alertData)
        }
      })
    }).catch((error) => {
      logger.error('Failed to fetch weather alert data')
      onFailure(error)
    })
  }

  if (new Date() - stats.lastAlertUpdate > 22020000) { // 22020000ms = 6 hours 7 minutes
    tryFetchAlerts()
  }

  schedule.scheduleJob('0 */6 * * *', function () {
    retryAlertTimeout = 0

    tryFetchAlerts()
  })
}

// Detect if computer fell asleep
if (new Date() - stats.lastUpdate > 7620000) { // 7620000ms = 2 hours 7 minutes
  logger.warn(new Error('Missed scheduled twitter update. Presumably by waking from sleep.'))

  tryFetchWeather(true)
}

schedule.scheduleJob('0 */2 * * *', function () {
  retryTimeout = 0

  tryFetchWeather()
})

if (config.twitter.localStationHandle) {
  schedule.scheduleJob('30 */1 * * *', function () {
    tweetWeather.retweetLocalStationTweets()
  })
}

logger.info('Bot process started.')
