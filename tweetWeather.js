'use strict'

const Twitter = require('twitter')
const util = require('./util.js')

module.exports = class TweetWeather {
  constructor (config, logger, weatherTools) {
    this.localStationAccount = config.localStationID
    this.logger = logger
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
      if (error) {
        this.logger.error(error)
        return
      }

      const rtParams = {
        trim_user: true
      }

      tweets.forEach((tweet) => {
        if (new Date() - new Date(tweet.created_at) < 360000) {
          this.twitterClient.post(`statuses/retweet/${tweet.id_str}.json`, rtParams, (error, tweets, response) => {
            if (error) {
              this.logger.error(error)
              return
            }

            this.logger.log(`Received ${response} from retweet request.`)
          })
        }
      })
    })
  }

  // Get periodic update message
  //  @param  {object} parsedWeatherData The weather data Object recieved from OpenWeatherMap
  //  @param  {boolean} isLate True if the bot missed a twitter update. False otherwise.
  //  @return {string} A weather update message to be posted to twitter.
  getStatusMessage (parsedWeatherData, isLate) {
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

      return message
    } catch (e) {
      this.logger.error(e)
    }
  }

  // Tweets weather messages
  //  @param {string} message The message to be sent(max length 280).
  sendTweet (message) {
    const tweetWeatherObject = this

    this.twitterClient.post('statuses/update', { status: message }, function (error, tweet, response) {
      if (error) {
        tweetWeatherObject.logger.error(error)
      }

      tweetWeatherObject.logger.info('Sent tweet.')
      tweetWeatherObject.logger.info(`Recieved ${response}`)
    })
  }
}
