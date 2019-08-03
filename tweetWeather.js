'use strict'

const Twitter = require('twitter')

module.exports = class TweetWeather {
  constructor (config, logger, stats) {
    this.localStationAccount = config.localStationHandle
    this.logger = logger
    this.stats = stats
    this.twitterClient = new Twitter({
      consumer_key: config.consumer_key,
      consumer_secret: config.consumer_secret,
      access_token_key: config.access_token_key,
      access_token_secret: config.access_token_secret
    })
  }

  // Retweets all of another twitter account's tweets mad in the past hour
  retweetLocalStationTweets () {
    const params = {
      count: 10,
      exclude_replies: true,
      trim_user: true,
      screen_name: this.localStationAccount
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
    if (message.length > 280) {
      throw new Error(`Message too long: ${message}`)
    }

    return this.twitterClient.post('statuses/update', { status: message })
  }
}
