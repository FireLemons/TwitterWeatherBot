const https = require('https');
const lune = require('lune');
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
    //  @param {number} windSpeed The windSpeed in m/s
    //  @returns {string} A statement about how the current wind speed scores on the beaufort scale
    getBeaufort(windSpeed){
        let beaufort = {};
        
        if(windSpeed < .5){
            beaufort['description'] = '"calm"';
            beaufort['fact'] = 'Smoke rises vertically.';
        } else if(windSpeed < 1.6) {
            beaufort['description'] = '"light air"';
            beaufort['fact'] = 'Wind direction is shown by smoke drift but not by wind vanes.';
        } else if(windSpeed < 3.4) {
            beaufort['description'] = 'a "light breeze"';
            beaufort['fact'] = 'Wind is felt on the face and leaves rustle.';
        } else if(windSpeed < 5.6) {
            beaufort['description'] = 'a "gentle breeze"';
            beaufort['fact'] = 'Leaves and small twigs are moved. Light flags are extended.';
        } else if(windSpeed < 8) {
            beaufort['description'] = 'a "moderate breeze"';
            beaufort['fact'] = 'Dust and loose paper are raised. Small branches are moved.';
        } else if(windSpeed < 10.8) {
            beaufort['description'] = 'a "fresh breeze"';
            beaufort['fact'] = 'Small trees are swayed. Crested wavelets form on inland waters.';
        } else if(windSpeed < 13.9) {
            beaufort['description'] = 'a "strong breeze"';
            beaufort['fact'] = 'Large branches are moved. Umbrellas are used with difficulty.';
        } else if(windSpeed < 17.2) {
            beaufort['description'] = 'a "near gale"';
            beaufort['fact'] = 'Whole trees are moved. There is resistance when walking against the wind.';
        } else if(windSpeed < 20.8) {
            beaufort['description'] = 'a "gale"';
            beaufort['fact'] = 'Twigs are broken off trees. The wind impedes progress.';
        } else if(windSpeed < 24.5) {
            beaufort['description'] = 'a "strong gale"';
            beaufort['fact'] = 'Slight structural damage is caused (chimney pots and slates removed).';
        } else if(windSpeed < 28.5) {
            beaufort['description'] = 'a storm';
            beaufort['fact'] = 'Trees are uprooted. There is considerable structural damage.';
        } else if(windSpeed < 32.7) {
            beaufort['description'] = 'a "violent storm"';
            beaufort['fact'] = 'A very rarely experienced event accompanied by widespread damage.';
        } else {
            beaufort['description'] = 'a "hurricane force"';
            beaufort['fact'] = 'Causes devastation.';
        }
        
        return `A ${windSpeed}m/s wind is ${beaufort.description} on the beaufort scale. ${beaufort.fact}`;
    }
    
    //Gets a random extra message to append to each update.
    //  @param {object} parsedWeatherData The weather data Object recieved from OpenWeatherMap
    //  @returns {string} A random extra message to append to each update
    getExtra(parsedWeatherData){
        this.logger.info('Generating extra statement.');
        
        if(!(parsedWeatherData instanceof Object)){
            throw new Error('Parameter parsedWeatherData must be an object');
        }
        
        let messageRoll = Math.random();
        
        if(messageRoll < .01){//joke
            this.logger.info('Generating joke.');
            let jokes = require('./data/jokes.json');
            
            return util.pickRandom(jokes);
        } else if (messageRoll < .1) {//tutorials
            this.logger.info('Generating tutorial.');
            return this.getTutorial();
        } else if (messageRoll < .4) {//celestial event
            this.logger.info('Generating celestial event.');
            let eventRoll = Math.random();
            
            if(eventRoll < .5){
                return this.getLunarPhase();
            } else {
                return this.getSeasonProgress();
            }
        } else if (messageRoll < .7) {//trivia
            this.logger.info('Generating trivia.');
            //beaufort scale
            return this.getBeaufort(parsedWeatherData.list[0].wind.speed.toPrecision(2));
        } else {//random extra stat
            this.logger.info('Generating extra stat.');
            const forecastData = parsedWeatherData.list.slice(0, 3);
            
            let stat = util.pickRandom(['precipitation', 'precipitation', 'precipitation', 'pressure', 'humidity', 'cloudiness']);
            return this.getExtraStat(stat);
        }
    }
    
    //Gets an extended forecast for 3 extra stats not usually presesnt in the main forecast
    //  @param  {string} stat The name of the extra stat to feature.
    //  @param {object} forecastData An array of 3 objects containing weather data
    //  @returns {string} A forecast message displaying the given stat
    getExtraStat(stat, forecastData){
        console.log(forecastData);
        if(stat === 'precipitation'){
            let precipitationStats = forecastData.map((elem) => {
                return {
                    time: util.getCST(parseInt(elem.dt_txt.substr(11, 2))),
                    rain: (typeof elem.rain === 'object') ? elem.rain['3h'] : undefined,
                    snow: (typeof elem.snow === 'object') ? elem.snow['3h'] : undefined
                }
            });
            
            if(precipitationStats.reduce((acc, elem) => acc || elem.rain || elem.snow, 0)){//check if any precipitation is present
                let precipitation = 'Expected Precipitation:\n';
                
                for(let i = 0; i < 3; i++){
                    let pStat = precipitationStats[i],
                        rain = pStat.rain,
                        snow = pStat.snow;
                    
                    if(rain || snow){
                        precipitation += `${pStat.time}:00:`;
                        precipitation += (rain) ? `${rain}mm/h rain` : '';
                        precipitation += (snow) ? `, ${snow}mm/h snow.` : '.';
                        precipitation += '\n';
                    }
                }
                
                return precipitation.substr(0, precipitation.length - 1);
            } else {
                stat = util.pickRandom(['pressure', 'humidity', 'cloudiness']);
            }
        }
        
        switch(stat){
            case 'pressure':
                let pressure = 'Expected Pressure:\n';
            
                forecastData.forEach((elem) => {
                    pressure += `${util.getCST(parseInt(elem.dt_txt.substr(11, 2)))}:00: ${elem.main.grnd_level}hPa\n`;
                });
                
                return pressure.substr(0, pressure.length - 1);
            case 'humidity':
                let humidity = 'Expected Humidity:\n';
            
                forecastData.forEach((elem) => {
                    humidity += `${util.getCST(parseInt(elem.dt_txt.substr(11, 2)))}:00: ${elem.main.humidity}%\n`;
                });
                
                return humidity.substr(0, humidity.length - 1);
            case 'cloudiness':
                let cloudiness = 'Expected Cloud Coverage:\n';
            
                forecastData.forEach((elem) => {
                    cloudiness += `${util.getCST(parseInt(elem.dt_txt.substr(11, 2)))}:00: ${elem.clouds.all}%\n`;
                });
                
                return cloudiness.substr(0, cloudiness.length - 1);
            default:
                throw new Error(`Could not get extra stat "${stat}"`);
        }
    }
    
    //Gets the default forecast message.
    //  @param {object} parsedWeatherData The weather data Object recieved from OpenWeatherMap
    //  @returns {string} A message describing the condition, temperature, and wind for the next 9 hours. Max 142 characters.
    getForecast(parsedWeatherData){
        const forecastData = parsedWeatherData.list.slice(0, 3);
        let defaultForecast = (Math.random() > 0.000228310502) ? 'Forecast' : 'Fourcast';
        
        for(let {dt_txt, main, weather, wind: {deg, speed}} of forecastData){
            let conditions = {
                symbol: weatherStatusCodeMap[weather[0].id].symbol,
                temp: {
                    max: Math.round(main.temp_max),            
                    min: Math.round(main.temp_min)
                },
                time: util.getCST(parseInt(dt_txt.substr(11, 2))),
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
    
    //Get a message describing the current moon phase.
    //  @return {string} A message stating the current phase of the moon.
    getLunarPhase(){
        let nearbyPhases = Object.values(lune.phase_hunt()), now = new Date();
        
        let closestPhase = util.getClosestIndex(now, nearbyPhases, (date1, date2) => date1 - date2),
            phase,
            proximity = util.getDaysBetween(now, nearbyPhases[closestPhase]);
        
        switch(closestPhase){
            case 0:
                if(Math.abs(proximity) < 1){
                    phase = '🌑 New Moon';
                } else if(proximity > 0) {
                    phase = '🌒 Waxing Crescent';
                } else {
                    phase = '🌘 Waning Crescent';
                }
                
                break;
            case 1:
                if(Math.abs(proximity) < 1){
                    phase = '🌓 First Quarter';
                } else if(proximity > 0) {
                    phase = '🌔 Waxing Gibbous';
                } else {
                    phase = '🌒 Waxing Crescent';
                }
            
                break;
            case 2:
                if(Math.abs(proximity) < 1){
                    phase = '🌕 Full Moon';
                } else if(proximity > 0) {
                    phase = '🌖 Waning Gibbous';
                } else {
                    phase = '🌔 Waxing Gibbous';
                }
            
                break;
            case 3:
                if(Math.abs(proximity) < 1){
                    phase = '🌗 Third Quarter';
                } else if(proximity > 0) {
                    phase = '🌘 Waning Crescent';
                } else {
                    phase = '🌖 Waning Gibbous';
                }
                
                break;
            case 4:
                if(Math.abs(proximity) < 1){
                    phase = '🌑 New Moon';
                } else {
                    phase = '🌒 Waxing Crescent';
                }
            
                break;
        }
        
        return `The moon is currently in the ${phase} phase.`;
    }
    
    //Generates a statement stating the days between the last solstice or equinox until now and days until the next solstice or equinox
    //  @param {Date=} A date to test the season progress for.
    //  @return {String} A statement stating the days between the last solstice or equinox until now and days until the next solstice or equinox
    getSeasonProgress(date){
        let now = date ? date : new Date(),
            seasonData = require('./data/seasons.json'),
            currentYear = now.getFullYear(),
            currentYearDates = Object.values(seasonData[currentYear]).map((elem) => new Date(elem)),
            nearestEvent = util.getClosestIndex(now, currentYearDates, (date1, date2) => date1 - date2),
            proximityNearestDate = Math.floor(util.getDaysBetween(now, currentYearDates[nearestEvent])),
            closeEvent = {
                "days": proximityNearestDate
            },
            previousEvent,
            nextEvent;
        
        switch(nearestEvent){
            case 0:
                closeEvent.event = "vernal equinox";
                
                if(proximityNearestDate < 0){
                    closeEvent.days *= -1;
                    
                    previousEvent = closeEvent;
                    nextEvent = {
                        "days": Math.floor(util.getDaysBetween(now, currentYearDates[nearestEvent + 1])),
                        "event": "summer solstice"
                    };
                } else {
                    previousEvent = {
                        "days": Math.floor(util.getDaysBetween(new Date(seasonData[currentYear - 1]['winter_solstice']), now)),
                        "event": "winter_solstice"
                    };
                    nextEvent = closeEvent;
                }
                
                break;
            case 1:
                closeEvent.event = "summer solstice";
                
                if(proximityNearestDate < 0){
                    closeEvent.days *= -1;
                    
                    previousEvent = closeEvent;
                    nextEvent = {
                        "days": Math.floor(util.getDaysBetween(now, currentYearDates[nearestEvent + 1])),
                        "event": "autumnal equinox"
                    };
                } else {
                    previousEvent = {
                        "days": Math.floor(util.getDaysBetween(currentYearDates[nearestEvent - 1], now)),
                        "event": "vernal equinox"
                    };
                    nextEvent = closeEvent;
                }
                
                break;
            case 2:
                closeEvent.event = "autumnal equinox";
                
                if(proximityNearestDate < 0){
                    closeEvent.days *= -1;
                    
                    previousEvent = closeEvent;
                    nextEvent = {
                        "days": Math.floor(util.getDaysBetween(now, currentYearDates[nearestEvent + 1])),
                        "event": "winter equinox"
                    };
                } else {
                    previousEvent = {
                        "days": Math.floor(util.getDaysBetween(currentYearDates[nearestEvent - 1], now)),
                        "event": "summer solstice"
                    };
                    nextEvent = closeEvent;
                }
                
                break;
            case 3:
                closeEvent.event = "winter solstice";
            
                if(proximityNearestDate < 0){
                    let proximityNext = util.getDaysBetween(now, new Date(seasonData[currentYear + 1]['vernal_equinox']));
                    
                    closeEvent.days *= -1;
                    
                    previousEvent = closeEvent;
                    nextEvent = {
                        "days" : Math.floor(proximityNext),
                        "event": "vernal equinox"
                    };
                } else {
                    previousEvent = {
                        "days": Math.floor(util.getDaysBetween(currentYearDates[nearestEvent - 1], now)),
                        "event": "autumnal equinox"
                    };
                    nextEvent = closeEvent;
                }
                
                break;
        }
        
        if(!proximityNearestDate){
            return `Today is the ${previousEvent.event}.`;
        }
        
        return `Today is ${previousEvent.days} days from the ${previousEvent.event} and ${nextEvent.days} days until the ${nextEvent.event}.`;
    }
    
    //Generates a random message explaining some of the messages the bot displays.
    //  @param {number=} id The id of the specified tutorial.
    //  @return {string} If an id is given, the tutorial message with the given id otherwise a random explanation message.
    getTutorial(id){
        let iconDefinitions = require('./data/iconDefinitions.json');
        
        if(!id){
            id = Math.floor(Math.random() * (2 + iconDefinitions.length));
        }
        
        switch(id){
            case 0:
                return 'The beaufort scale is a way of measuring wind speed based on observing things blown by the wind rather than using instruments.';
            case 1:
                return 'The pressure displayed is at ground level. Columbia is 758ft(231m) above sea level.';
            default: //Icon Definitions
                let iconDefinition = iconDefinitions[id - 2];
                return `${iconDefinition.icon} indicates ${iconDefinition.conditions.replace(',', ' or')}`;
        }
    }
    
    //Converts an angle into cardinal direction
    //  @param {number} azimuth A number representing an angle in the range [0, 360)
    //  @return {string} A character representing a cardinal direction or 2 character representing an intercardinal direction
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
    //  @param {function} onDataLoaded(parsedWeatherData): The callback to run on the weather data after it has been loaded and parsed as an Object
    //      @param {object} parsedWeatherData: The weather data. See https://openweathermap.org/forecast5#parameter for details about the structure of the Object.
    //  @param {function} onFailure(errors) The callback to run if there is a problem with loading the data
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