'use strict'

const Twitter = require('twitter')
const util = require('./util.js')

module.exports = class TweetWeather {
  constructor (config, logger, stats, weatherTools) {
    this.localStationAccount = config.localStationID
    this.logger = logger
    this.stats = stats
    this.weatherTools = weatherTools
    this.twitterClient = new Twitter({
      consumer_key: config.consumer_key,
      consumer_secret: config.consumer_secret,
      access_token_key: config.access_token_key,
      access_token_secret: config.access_token_secret
    })
  }

  // Generates a severe weather alert warning if there is an ongoing alert
  //  @param  {object} parsedAlertData The weather alert data Object recieved from api.weather.gov
  //  @return {string} A weather alert warning to be posted to twitter.
  getAlertMessage (parsedAlertData) {
    try {
      const message = this.weatherTools.getAlertMessage(parsedAlertData)

      if (message.length > 280) {
        throw new Error(`Message too long: ${message}`)
      }

      this.logger.info(`Prepared alert ${message}`)
      return message
    } catch (e) {
      this.logger.error(e)
    }
  }

  // Retweets all of another twitter account's tweets mad in the past hour
  retweetLocalStationTweets () {
    const params = {
      count: 10,
      exclude_replies: true,
      trim_user: true,
      user_id: this.localStationAccount
    }

    this.twitterClient.get('statuses/user_timeline', params, (error, tweets, response) => {
      this.logger.info('Checking for retweets')

      if (error) {
        this.logger.error(error)
        return
      }

      const rtParams = {
        trim_user: true
      }

      if (tweets.length) {
        this.logger.info(`Latest tweet created at: ${tweets[0].created_at}`)
      }

      tweets.forEach((tweet) => {
        if (new Date() - new Date(tweet.created_at) < 3600000) {
          this.logger.info(`Retweeting tweet with id ${tweet.id_str}`)

          this.twitterClient.post(`statuses/retweet/${tweet.id_str}.json`, rtParams, (error, tweets, response) => {
            if (error) {
              this.logger.error(error)
              return
            }

            this.logger.info(`Received ${response} from retweet request.`)
          })
        }
      })
    })
  }

  // Tweets weather messages
  //  @param {string} message The message to be sent(max length 280).
  sendTweet (message) {
    this.twitterClient.post('statuses/update', { status: message }, (error, tweet, response) => {
      if (error) {
        this.logger.error(error)
      }

      this.logger.info('Sent tweet.')
      this.logger.info(`Recieved ${response}`)
    })
  }

  // Send regular forecast message
  //  @param  {object} parsedWeatherData The weather data Object recieved from OpenWeatherMap
  //  @param  {boolean} isLate True if the bot missed a twitter update. False otherwise.
  tweetForecast (parsedWeatherData, isLate) {
    try {
      const forecast = this.weatherTools.getForecast(parsedWeatherData)
      this.logger.info('Created forecast')

      let message = forecast
      const extra = (isLate) ? util.pickRandom(require('./data/jokes.json').late) : this.weatherTools.getExtra(parsedWeatherData)
      this.logger.info(`Generated ${extra}`)

      message += extra

      if (message.length > 280) {
        throw new Error(`Message too long: ${message}`)
      }

      if (message) {
        this.sendTweet(message)
        this.stats.lastUpdate = new Date()
      } else {
        throw new Error('Failed to generate status message.')
      }
    } catch (e) {
      this.logger.error(e)
    }
  }
}
