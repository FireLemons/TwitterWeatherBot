const twitter = require('twitter');

module.exports = class TweetWeather{
    constructor(config, logger, weatherTools){
        this.logger = logger;
        this.weatherTools = weatherTools;
        this.twitterClient = new twitter({
            consumer_key: config.consumer_key,
            consumer_secret: config.consumer_secret,
            access_token_key: config.access_token_key,
            access_token_secret: config.access_token_secret
        });
    }
    
    //Get periodic update message
    //  @param {object} parsedWeatherData The weather data Object recieved from OpenWeatherMap
    //  @returns {string} A weather update message to be posted to twitter.
    getStatusMessage(parsedWeatherData){
        try{
            let forecast = this.weatherTools.getForecast(parsedWeatherData);
            this.logger.info('Created forecast');
            
            let message = forecast, 
                extra = this.weatherTools.getExtra(parsedWeatherData);
            this.logger.info(`Generated ${extra}`);
            
            message += extra;
            
            if(message.length > 280){
                throw new Error(`Message too long: ${message}`);
            }
            
            return message;
        }catch(e){
            this.logger.error(e);
            
            if(/^Cannot read property '.+' of undefined$/.test(e.message)){
                this.logger.error(new Error(`Weather data Object in unexpected format: ${e.message}`));
            } else {
                let keyPathCheck = /^Member (.+) of object is undefined|NaN|null$/.exec(e.message);
                
                if(keyPathCheck && keyPathCheck.length > 1){
                    this.logger.error(new Error(`Failed to read ${keyPathCheck[1]} from openWeatherMap object. `));
                } else {
                    this.logger.error(e);
                }
            }
        }
    }
    
    //Tweets weather messages
    //  @param {string} message The message to be sent(max length 280).
    sendTweet(message){
        const tweetWeatherObject = this;
        
        this.twitterClient.post('statuses/update', {status: message},  function(error, tweet, response) {
            if(error){
                tweetWeatherObject.logger.error(error);
            }
            
            tweetWeatherObject.logger.info('Sent tweet.');
            tweetWeatherObject.logger.info(`Recieved ${response}`);
        });
    }
}