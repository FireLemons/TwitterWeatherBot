const https = require('https');
const util = require('./util.js');

//Shortened descriptions and symbols for weather condition codes
//See https://openweathermap.org/weather-conditions for full code information
const weatherStatusCodeMap = require('./data/statusCodeMap.json');

module.exports = class Weather{
    constructor(config, logger){
        //Prepare weather get request URL from config 
        var {location} = config,
            locationParams = '';

        for(var paramName in location){
            if (location.hasOwnProperty(paramName)) {
                locationParams += paramName + '=' + location[paramName];
            }
        }

        this.logger = logger;
        this.weatherRequestURL = `https://api.openweathermap.org/data/2.5/forecast?${locationParams}&units=metric&APPID=${config.key}`;
    }
    
    //Gets a statement about the current wind speed using the beaufort scale
    //  @param {Number} windSpeed The windSpeed in m/s
    //  @returns {String} A statement about how the current wind speed scores on the beaufort scale
    getBeaufort(windSpeed){
        let beaufort = {};
        
        if(windSpeed < .5){
            beaufort['description'] = 'calm';
            beaufort['fact'] = 'Smoke rises vertically.';
        } else if(windSpeed < 1.6) {
            beaufort['description'] = 'light air';
            beaufort['fact'] = 'Direction shown by smoke drift but not by wind vanes.';
        } else if(windSpeed < 3.4) {
            beaufort['description'] = 'light breeze';
            beaufort['fact'] = 'Wind felt on face; leaves rustle; wind vane moved by wind.';
        } else if(windSpeed < 5.6) {
            beaufort['description'] = 'gentle breeze';
            beaufort['fact'] = 'Leaves and small twigs in motion; light flags extended.';
        } else if(windSpeed < 8) {
            beaufort['description'] = 'moderate breeze';
            beaufort['fact'] = 'Raises dust and loose paper; small branches moved.';
        } else if(windSpeed < 10.8) {
            beaufort['description'] = 'fresh breeze';
            beaufort['fact'] = 'Small trees sway; crested wavelets form on inland waters.';
        } else if(windSpeed < 13.9) {
            beaufort['description'] = 'strong breeze';
            beaufort['fact'] = 'Large branches in motion; umbrellas used with difficulty.';
        } else if(windSpeed < 17.2) {
            beaufort['description'] = 'near gale';
            beaufort['fact'] = 'Whole trees in motion; resistance felt walking against the wind.';
        } else if(windSpeed < 20.8) {
            beaufort['description'] = 'gale';
            beaufort['fact'] = 'Twigs break off trees; generally impedes progress.';
        } else if(windSpeed < 24.5) {
            beaufort['description'] = 'strong gale';
            beaufort['fact'] = 'Slight structural damage (chimney pots and slates removed).';
        } else if(windSpeed < 28.5) {
            beaufort['description'] = 'storm';
            beaufort['fact'] = 'trees uprooted; considerable structural damage.';
        } else if(windSpeed < 32.7) {
            beaufort['description'] = 'violent storm';
            beaufort['fact'] = 'Very rarely experienced; accompanied by widespread damage.';
        } else {
            beaufort['description'] = 'hurricane force';
            beaufort['fact'] = 'Devastation.';
        }
        
        return `${windSpeed}m/s wind is a "${beaufort.description}" on the beaufort scale. Wind effects include:${beaufort.fact}`;
    }
    
    //Gets a random extra message to append to each update.
    //  @param {Object} parsedWeatherData The weather data Object recieved from OpenWeatherMap
    //  @returns {String} A random extra message to append to each update
    getExtra(parsedWeatherData){
        let messageRoll = Math.random();
        
        if(messageRoll < .05){//joke
            let jokes = require('./data/jokes.json');
            
            return util.pickRandom(jokes);
        } else if (messageRoll < .1) {//tutorials
        } else if (messageRoll < .4) {//celestial event
            //equinox, solstice, moon phase & high tide
        } else if (messageRoll < .7) {//trivia
            //beaufort scale
            return getBeaufort(parsedWeatherData.list[0].wind.speed.toPrecision(2));
        } else {//random extra stat
            const forecastData = parsedWeatherData.list.slice(0, 3);
            
            
            
            for(data of forecastData){
                
            }
        }
    }
    
    //Gets the default forecast message.
    //  @param {Object} parsedWeatherData The weather data Object recieved from OpenWeatherMap
    //  @returns {String} A message describing the condition, temperature, and wind for the next 9 hours. Max 142 characters.
    getForecast(parsedWeatherData){

        const forecastData = parsedWeatherData.list.slice(0, 3);
        var defaultForecast = (Math.random() > 0.000228310502) ? 'Forecast' : 'Fourcast';
        
        for(let {dt_txt, main, weather, wind: {deg, speed}} of forecastData){
            let conditions = {
                symbol: weatherStatusCodeMap[weather[0].id].symbol,
                temp: {
                    max: Math.round(main.temp_max),            
                    min: Math.round(main.temp_min)
                },
                time: util.getCST(dt_txt.substr(11, 2)),
                wind: {
                    direction: this.getWindDirectionAsCardinal(deg),
                    speed: speed.toPrecision(2)
                }
            };
            
            util.validateNotNull(conditions);
            
            defaultForecast += '\n';
            defaultForecast += `${conditions.time}:00:${conditions.symbol}, [${conditions.temp.min},${conditions.temp.max}]°C, 💨 ${conditions.wind.speed} m/s ${conditions.wind.direction}`;
        }
        
        defaultForecast += '\n\n';
        
        return defaultForecast;
    }
    
    //Converts an angle into cardinal direction
    //  @param {Number} azimuth A number representing an angle in the range [0, 360)
    //  @return {String} A character representing a cardinal direction or 2 character representing an intercardinal direction
    getWindDirectionAsCardinal(azimuth){
        switch(Math.round(azimuth / 45)){
            case 0:
                return '⬇️';
            case 1:
                return '↙️';
            case 2:
                return '⬅️';
            case 3:
                return '↖️';
            case 4:
                return '⬆️';
            case 5:
                return '↗️';
            case 6:
                return '➡️';
            case 7:
                return '↘️';
        }
    }
    
    //Sends the get request for weather data.
    //  @param {Function} onDataLoaded(parsedWeatherData): The callback to run on the weather data after it has been loaded and parsed as an Object
    //      @param {Object} parsedWeatherData: The weather data. See https://openweathermap.org/forecast5#parameter for details about the structure of the Object.
    //  @param {Function} onFailure(errors) The callback to run if there is a problem with loading the data
    //      @param {Error[]} errors The error(s) causing the failure
    loadWeather(onDataLoaded, onFailure){
        this.logger.info('Attempt fetch weather data');
        
        https.get(this.weatherRequestURL, (res) => {
            const { statusCode } = res;
            const contentType = res.headers['content-type'];
            
            let error;
            
            if(statusCode !== 200){
                error = new Error(`Request Failed. Status Code: ${statusCode}`);
            } else if (!/^application\/json/.test(contentType)) {
                error = new Error(`Invalid content-type. Expected application/json but received ${contentType}`);
            }
            
            if (error) {
                onFailure([
                    error
                ]);
                
                res.resume();
                return;
            }

            res.setEncoding('utf8');
            
            let rawData = '';
            
            res.on('data', (chunk) => {
                rawData += chunk;
            });
            
            res.on('end', () => {
                try {
                    const parsedWeatherData = JSON.parse(rawData);
                    
                    if(typeof onDataLoaded === 'function'){
                        onDataLoaded(parsedWeatherData);
                    }else{
                        onFailure([
                            new Error('Weather data loaded callback parameter "onDataLoaded" not a function.'),
                            new Error('Type of "onDataLoaded" is ' + typeof onDataLoaded)
                        ]);
                    }
                } catch(e) {
                    onFailure([e]);
                }
            });
        }).on('error', (e) => {
            onFailure([e]);
        });
    }
}