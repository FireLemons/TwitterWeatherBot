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
  let formattedDate = formatDate(new Date())

  if (formattedDate.length < 22) {
    const spaceIndex = formattedDate.indexOf(' ')

    formattedDate = formattedDate.substr(0, spaceIndex).padEnd(10) + formattedDate.substr(spaceIndex + 1)
  }

  return formattedDate.replace(',', '')
}

// Gets the line number of an Error
//  @param  {Error} An Error object
//  @return {number} The line number where the Error occurred
function getErrorSource (error) {
  const { stack } = error

  let firstNewLineIndex,
    secondNewLineIndex

  for (firstNewLineIndex = 0; firstNewLineIndex < stack.length && stack[firstNewLineIndex] !== '\n'; firstNewLineIndex++);
  for (secondNewLineIndex = firstNewLineIndex + 1; secondNewLineIndex < stack.length && stack[secondNewLineIndex] !== '\n'; secondNewLineIndex++);

  const errorSourceData = stack.substr(firstNewLineIndex, secondNewLineIndex - firstNewLineIndex).match(/([\w]+\.js):([\d]+):[\d]+\)$/)

  return {
    fileName: errorSourceData[1],
    lineNumber: parseInt(errorSourceData[2])
  }
}

// Create the log directory if it doesn't exist
const { log: { logDir } } = config

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
const disruptHandler = (signal) => {
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
const weatherFetcher = new weatherTools.DataFetcher(config.weather, logger)

// Init extra statement generator
const extraGenerator = new Extra(config.extra, logger)

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
const twitter = new TwitterManager(config.twitter, logger, stats)

/*
 *  Schedule forecasts to go out every 2 hours.
 */

// Fetch forecast data and tweet it
//  @param  {boolean} isLate true if the last scheduled forecast was missed otherwise false
//  @return {Promise} A promise representing the complete action of fetching and tweeting the weather
function tweetWeather (isLate) {
  return new Promise((resolve, reject) => {
    weatherFetcher.getForecastPromise().then((forecastData) => {
      let message = weatherTools.generateForecastMessage(forecastData)

      if (message) {
        // extra statement
        let extra

        if (config.extra && !config.extra.disabled) {
          if (isLate) {
            message += util.pickRandom(require('./data/jokes.json').late)
          } else {
            extra = extraGenerator.getExtra(forecastData)
            message += extra.statement

            logger.info(`Generated: ${JSON.stringify(extra)}`)
          }

          twitter.sendTweet(message)
            .then((tweet) => {
              stats.lastUpdate = new Date()

              if (!stats[extra.type]) {
                stats[extra.type] = 0
              }

              stats[extra.type] += 1
              resolve()
            }).catch((error) => {
              logger.error('Failed to send forecast update')
              reject(error)
            })
        } else {
          twitter.sendTweet(message)
            .then((tweet) => {
              stats.lastUpdate = new Date()
              resolve()
            }).catch((error) => {
              logger.error('Failed to send forecast update')
              reject(error)
            })
        }
      } else {
        reject(new Error('Failed to generate status message.'))
      }
    }) // end weatherFetcher.getForecastPromise().then((forecastData) => {
      .catch((error) => {
        logger.error('Failed to fetch forecast data')
        reject(error)
      })
  }) // end return new Promise((resolve, reject) => {
}

let retryTimeout = -131072
const maxRetryCount = 3
const retryDelayDelta = 131072

// Wait a while before attempting tweetWeather again
//  @param  {Object}  error Data representing why tweetWeather failed
//  @return {Promise} A promise lasting the length of the timeout
const retry = (error) => {
  return new Promise(function (resolve, reject) {
    logger.warn(error)
    logger.info(`Retrying tweeting weather in ${retryTimeout}ms. Retry ${(retryTimeout / 131072) + 1} of 3`)

    setTimeout(reject.bind(null, error), retryTimeout)

    retryTimeout += retryDelayDelta
  })
}

// Print an error after all retry attempts have been exhausted
//  @param  {Object}  error Data representing why tweetWeather failed
const retriesExhausted = (error) => {
  logger.error(error)

  const failureMessage = util.pickRandom(require('./data/jokes.json').error)

  twitter.sendTweet(failureMessage)
    .catch((error) => {
      logger.error('Failed to send failure tweet for forecast')
      logger.error(error)
    })
}

// Detect if computer fell asleep
if (new Date() - stats.lastUpdate > 7620000) { // 7620000ms = 2 hours 7 minutes
  logger.warn(new Error('Missed scheduled twitter update. Presumably by waking from sleep.'))

  let promiseChain = Promise.reject()

  for (let i = -1; i < maxRetryCount; i++) {
    promiseChain = promiseChain
      .catch(() => {
        return tweetWeather(true)
      })
      .catch(retry)
  }

  promiseChain.catch(retriesExhausted)
}

schedule.scheduleJob('0 */2 * * *', function () {
  retryTimeout = 0

  let promiseChain = Promise.reject()

  for (let i = -1; i < maxRetryCount; i++) {
    promiseChain = promiseChain
      .catch(tweetWeather)
      .catch(retry)
  }

  promiseChain.catch(retriesExhausted)
})

if (typeof config.twitter.localStationHandle === 'string') {
  schedule.scheduleJob('30 */1 * * *', function () {
    twitter.retweetLocalStationTweets()
  })
}

/*
 *  Set up alerts if enabled.
 */

if (config.weather.alerts && !config.weather.alerts.disabled) {
  let retryAlertTimeout = 0

  // Fetch forecast data and tweet it
  //  @return {Promise} A promise representing the complete action of fetching and tweeting the alerts
  function tweetAlerts () {
    return new Promise((resolve, reject) => {
      logger.info('Fetching alerts.')

      weatherFetcher.getWeatherAlertsPromise().then((alertData) => {
        const alerts = weatherFetcher.filterAlerts(alertData.features)

        if (!alerts.length) {
          logger.info('No relevant alerts found')
          stats.lastAlertUpdate = new Date()
        }

        alerts.forEach((alertData) => {
          const alertMessage = weatherTools.getAlertMessage(alertData)

          if (alertMessage) {
            twitter.sendTweet(alertMessage)
              .then((tweet) => {
                stats.lastAlertUpdate = new Date()
                resolve()
              })
              .catch((error) => {
                logger.error('Failed to send weather alert tweet')

                if (error instanceof Array && error[0].code) {
                  let retry = true

                  error.forEach((error) => {
                    const { code } = error

                    switch (code) {
                      case 64:// API account suspended
                      case 88:// Rate limit exceeded
                      case 185:// Status update limit reached
                      case 187:// Duplicate status
                      case 226:// Tweet blocked by malicious tweet filter
                      case 251:// Endpoint deprecated
                      case 326:// Account locked(Manually login to unlock)
                        retry = false
                        logger.error(error)
                        break
                      default:
                        // Do nothing (Non fatal errors)
                    }
                  })

                  if (retry) {
                    reject(error)
                  }
                } else {
                  reject(error)
                }
              })
          } else if (!alertMessage) {
            logger.error(new Error('Failure in generating alert message'))
            logger.error(alertData)
          }
        }) // end alerts.forEach((alertData) => {

        resolve()
      }) // end weatherFetcher.getWeatherAlertsPromise().then((alertData) => {
        .catch((error) => {
          logger.error('Failed to fetch weather alert data')
          reject(error)
        })
    })
  }

  // Wait a while before attempting tweetWeather again
  //  @param  {Object}  error Data representing why tweetWeather failed
  //  @return {Promise} A promise lasting the length of the timeout
  const retryAlert = (error) => {
    return new Promise(function (resolve, reject) {
      logger.warn(error)
      logger.info(`Retrying tweeting weather alerts in ${retryAlertTimeout}ms. Retry ${(retryTimeout / 131072) + 1} of 3`)

      setTimeout(reject.bind(null, error), retryTimeout)

      retryTimeout += retryDelayDelta
    })
  }

  // Print an error after all retry attempts have been exhausted
  //  @param  {Object}  error Data representing why tweetWeather failed
  const retriesAlertExhausted = (error) => {
    logger.error(error)

    twitter.sendTweet('Failed to fetch weather alert data. There could be a weather alert currently.')
      .catch((error) => {
        logger.error('Failed to send weather alert failure message')
        logger.error(error)
      })
  }

  if (new Date() - stats.lastAlertUpdate > 22020000) { // 22020000ms = 6 hours 7 minutes
    let promiseChain = Promise.reject()

    for (let i = -1; i < maxRetryCount; i++) {
      promiseChain = promiseChain
        .catch(tweetAlerts)
        .catch(retryAlert)
    }

    promiseChain.catch(retriesAlertExhausted)
  }

  schedule.scheduleJob('0 */6 * * *', function () {
    retryAlertTimeout = 0

    let promiseChain = Promise.reject()

    for (let i = -1; i < maxRetryCount; i++) {
      promiseChain = promiseChain
        .catch(tweetAlerts)
        .catch(retry)
    }

    promiseChain.catch(retriesAlertExhausted)
  })
}

logger.info('Bot process started.')
