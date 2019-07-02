const https = require('https');
const util = require('./util.js');

//Shortened descriptions and symbols for weather condition codes
//See https://openweathermap.org/weather-conditions for full code information
const weatherStatusCodeMap = require('./statusCodeMap.json');

module.exports = class Weather{
    constructor(logger, config){
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