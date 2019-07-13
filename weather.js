const celestial = require('./celestial.js');
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
    
    //Generates a statement stating the length of the day or night for the current time and sunrise and sunset times
    //Calculations derived from https://en.wikipedia.org/wiki/Position_of_the_Sun and https://en.wikipedia.org/wiki/Sunrise_equation
    //  @param {Date=} date For testing. A date to get the sunlight data for.
    //  @return {String} A statement stating the amount of sunlight 
    getDaylight(date){
        let now = date ? date : new Date(),
            coordinates = {
                "elevation": 231,
                "long": -92.3341,
                "lat": 38.9517
            },
            julianDate = (now.getTime() / 86400000) + 2440587.5,
            n = Math.floor(julianDate - 2451544.9992),
            //These equations, from the Astronomical Almanac,[3][4] can be used to calculate the apparent coordinates of the Sun, mean equinox and ecliptic of date, to a precision of about 0°.01 (36″), 
            //for dates between 1950 and ((((2050)))).
            sun_mean_longitude = (280.46 + (.9856474 * n)) % 360,
            sun_mean_anomaly = util.toRadians((357.528 + (.9856003 * n)) % 360),
            sun_ecliptic_longitude = sun_mean_longitude + (1.915 * Math.sin(sun_mean_anomaly)) + (.020 * Math.sin(2 * sun_mean_anomaly)),
            sun_obliquity_of_the_ecliptic = util.toRadians(23.439 - (.0000004 * n)),
            sun_declination = Math.asin(Math.sin(sun_obliquity_of_the_ecliptic) * Math.sin(util.toRadians(sun_ecliptic_longitude))),
            
            mean_solar_noon = n - (coordinates.long / 360),
            solar_mean_anomaly = util.toRadians((357.5291 + (.98560028 * mean_solar_noon)) % 360),
            center = (1.9148 * Math.sin(solar_mean_anomaly)) + (.02 * Math.sin(2 * solar_mean_anomaly)) + (.0003 * Math.sin(3 * solar_mean_anomaly)),
            ecliptic_longitude = solar_mean_anomaly + util.toRadians((center + 282.9372) % 360) % (Math.PI * 2),
            solar_noon = 2451545 + mean_solar_noon + (.0053 * Math.sin(solar_mean_anomaly)) - (.0069 * Math.sin(2 * ecliptic_longitude)),
            sun_declination_1 = Math.asin(Math.sin(ecliptic_longitude) * Math.sin(util.toRadians(23.44))),
            
            hour_angle = Math.acos((Math.sin(util.toRadians(-0.83 /*- (2.076 * Math.sqrt(coordinates.elevation) / 60)*/)) - Math.sin(util.toRadians(coordinates.lat)) * Math.sin(sun_declination)) / (Math.cos(util.toRadians(coordinates.lat)) * Math.cos(sun_declination))),
            sunrise = solar_noon - ((hour_angle * 180 / Math.PI) / 360),
            sunset = solar_noon + ((hour_angle * 180 / Math.PI) / 360);
            
        return ;
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
            
            return getJoke(parsedWeatherData.list[0]);
        } else if (messageRoll < .1) {//tutorials
            this.logger.info('Generating tutorial.');
            return this.getTutorial();
        } else if (messageRoll < .4) {//celestial info
            this.logger.info('Generating celestial info.');
            let eventRoll = Math.random();
            
            if(eventRoll < .5){
                return celestial.getLunarPhase();
            } else {
                return celestial.getSeasonProgress();
            }
        } else if (messageRoll < .7) {//trivia
            this.logger.info('Generating trivia.');
            //beaufort scale
            return this.getBeaufort(parsedWeatherData.list[0].wind.speed.toPrecision(2));
        } else {//random extra stat
            this.logger.info('Generating extra stat.');
            const forecastData = parsedWeatherData.list.slice(0, 3);
            
            let stat = util.pickRandom(['precipitation', 'precipitation', 'precipitation', 'pressure', 'humidity', 'cloudiness']);
            return this.getExtraStat(stat, forecastData);
        }
    }
    
    //Gets an extended forecast for 3 extra stats not usually presesnt in the main forecast
    //  @param  {string} stat The name of the extra stat to feature.
    //  @param {object} forecastData An array of 3 objects containing weather data
    //  @returns {string} A forecast message displaying the given stat
    getExtraStat(stat, forecastData){
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
    
    //Gets a joke
    //  @param {object} currentConditions The conditions for the near future
    //  @return {String} A joke.
    getJoke(currentConditions){
        if(!(currentConditions instanceof Object)){
            throw new TypeError('Param currentConditions must be an Object');
        }
        
        let jokes = require('./data/jokes.json'),
            jokePool = jokes.general;
            
        if((currentConditions.main.temp_min + currentConditions.main.temp_max) / 2 >= 30){
            jokePool.concat(jokes.hot);
        }
        
        return util.pickRandom(jokePool);
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