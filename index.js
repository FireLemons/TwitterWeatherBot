const config = require('./config.json');
const https = require('https');
const fs = require( 'fs' );
const path = require('path');
const schedule = require('node-schedule');
const twitter = require('twitter');
const winston = require('winston');

//const testData = require('./test/sampleData.json');

/*
 * Set up logging
 */

//Function to make readable timestamps
const dateFormat = {
    month: 'long',
    day: '2-digit',
    hour12: false,
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric'
},
      formatDate = new Intl.DateTimeFormat('en-US', dateFormat).format;

function getCurrentTimeFormatted(){
    var date = new Date(),
        formattedDate = formatDate(date);
    
    if(formattedDate.length < 22){
        var spaceIndex = formattedDate.indexOf(' ');
        
        formattedDate = formattedDate.substr(0, spaceIndex).padEnd(10) + formattedDate.substr(spaceIndex + 1);
    }
    
    return formattedDate.replace(',', '');
}

//Create the log directory if it doesn't exist
var {log: {logDir}} = config;

if(!fs.existsSync(logDir)){
    fs.mkdirSync(logDir);
}

//Log entry formatter that includes timestamps
const MESSAGE = Symbol.for('message');
const timestampFormatter = (logEntry) => {
    const base = {
        time: getCurrentTimeFormatted()
    };
    const logAsJSON = Object.assign(base, logEntry);
    
    logEntry[MESSAGE] = JSON.stringify(logAsJSON);

    return logEntry;
}

//Init logger 
const logger = winston.createLogger({
    level: 'info',
    format: winston.format(timestampFormatter)(),
    exceptionHandlers: [
        new winston.transports.File({ 
            filename: path.join(logDir, 'error.log') 
        })
    ],
    transports: [
        new winston.transports.File({
            filename: path.join(logDir, 'error.log'), level: 'error'
        }),
        new winston.transports.File({
            filename: path.join(logDir, 'combined.log')
        })
    ]
});

/*
 * Get Weather Data
 */

//Prepare weather get request URL from config 
var {open_weather_map: {location}} = config,
    locationParams = '';

for(var paramName in location){
    if (location.hasOwnProperty(paramName)) {
        locationParams += paramName + "=" + location[paramName];
    }
}

const weatherRequestURL = `https://api.openweathermap.org/data/2.5/forecast?${locationParams}&units=metric&APPID=${config.open_weather_map.key}`;

//Sends the get request for weather data.
//  param function onDataLoaded(parsedWeatherData): The callback to run on the weather data after it has been loaded and parsed as an Object
//      param parsedWeatherData: The weather data recieved as an Object. See https://openweathermap.org/forecast5#parameter
//                               for details about keys and values in the Object.
function loadWeather(onDataLoaded){
    logger.info('Attempt fetch weather data');
    
    https.get(weatherRequestURL, (res) => {
        const { statusCode } = res;
        const contentType = res.headers['content-type'];
        
        let error;
        
        if(statusCode !== 200){
            error = new Error('Request Failed.\n' + `Status Code: ${statusCode}`);
        } else if (!/^application\/json/.test(contentType)) {
            error = new Error('Invalid content-type.\n' + `Expected application/json but received ${contentType}`);
        }
        
        if (error) {
            logger.error(error.message);
            
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
                    logger.error('Weather data loaded callback parameter "onDataLoaded" not a function.');
                    logger.error('Type of "onDataLoaded" is ' + typeof onDataLoaded);
                }
            } catch(e) {
                logger.error(e.message);
            }
        });
    }).on('error', (e) => {
        logger.error('Failed to load weather data.');
        logger.error(`${e.message}`);
    });
}

/*
 * Convert weather data into a twitter status
 */

//Shortened descriptions and symbols for weather condition codes
//See https://openweathermap.org/weather-conditions for full code information
const weatherStatusCodeMap = require('./statusCodeMap.json');

//Get periodic update message
//  param parsedWeatherData The weather data Object recieved from OpenWeatherMap
//  returns A weather update message to be posted to twitter.
function getStatusMessage(parsedWeatherData){
    try{
        return getDefaultForecast(parsedWeatherData);
    }catch(e){
        if(/^Cannot read property '.+' of undefined$/.test(e.message)){
            logger.error(`Weather data Object in unexpected format: ${e.message}`);
        }
    }
}

//Get the default forecast message. 
//  param parsedWeatherData The weather data Object recieved from OpenWeatherMap
//  returns A message describing the condition, temperature, and wind for the next 9 hours. Max 142 characters.
function getDefaultForecast(parsedWeatherData){

    const forecastData = parsedWeatherData.list.slice(0, 3);
    var defaultForecast = (Math.random() > 0.000228310502) ? 'Forecast' : 'Fourcast';
    
    for(let {dt_txt, main, weather, wind: {deg, speed}} of forecastData){
        let conditions = {
            symbol: weatherStatusCodeMap[weather[0].id].symbol,
            temp: {
                max: Math.round(main.temp_max),            
                min: Math.round(main.temp_min)
            },
            time: dt_txt.substr(11, 5),
            wind: {
                direction: getWindDirectionAsCardinal(deg),
                speed: speed.toPrecision(2)
            }
        };
        
        defaultForecast += '\n';
        defaultForecast += `${conditions.time}: ${conditions.symbol}, [${conditions.temp.min},${conditions.temp.max}]°C, 💨 ${conditions.wind.speed} m/s ${conditions.wind.direction}`;
    }
    
    defaultForecast += '\n\n';
    
    return defaultForecast;
}

function getWindDirectionAsCardinal(azimuth){
    switch(Math.round(azimuth / 45)){
        case 0:
            return 'N';
        case 1:
            return 'NE';
        case 2:
            return 'E';
        case 3:
            return 'SE';
        case 4:
            return 'S';
        case 5:
            return 'SW';
        case 6:
            return 'W';
        case 7:
            return 'NW';
    }
}
loadWeather((parsedWeatherData) => {
    console.log(getStatusMessage(testData));
});