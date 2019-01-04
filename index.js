const config = require('./config.json');
const https = require('https');
const fs = require( 'fs' );
const path = require('path');
const schedule = require('node-schedule');
//const stats = require('./stats.json');
const twitter = require('twitter');
const winston = require('winston');

const testData = require('./test/sampleData.json');

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
},
    formatDate = new Intl.DateTimeFormat('en-US', dateFormat).format;

//Makes human readable timestamps
//  @return {String} A timestamp in the form: FULL_MONTH_NAME DAY HH:MM:SS
function getCurrentTimeFormatted(){
    var date = new Date(),
        formattedDate = formatDate(date);
    
    if(formattedDate.length < 22){
        var spaceIndex = formattedDate.indexOf(' ');
        
        formattedDate = formattedDate.substr(0, spaceIndex).padEnd(10) + formattedDate.substr(spaceIndex + 1);
    }
    
    return formattedDate.replace(',', '');
}

//Gets the line number of an Error
//  @param {Error} An Error object
//  @return {Number} The line number where the Error occurred 
function getLineNumber(error){
    var { stack } = error;
    
    for(var firstNewLineIndex = 0; firstNewLineIndex < stack.length && stack[firstNewLineIndex] !== '\n'; firstNewLineIndex++){
    }
  
    for(var secondNewLineIndex = firstNewLineIndex + 1; secondNewLineIndex < stack.length && stack[secondNewLineIndex] !== '\n'; secondNewLineIndex++){
    }
    
    return parseInt(stack.substr(firstNewLineIndex, secondNewLineIndex - firstNewLineIndex).match(/\.js:([\d]+):[\d]+\)$/)[1]);
}

//Create the log directory if it doesn't exist
var {log: {logDir}} = config;

if(!fs.existsSync(logDir)){
    fs.mkdirSync(logDir);
}

//Holds an error message and a line number
class LineNumberError{
    constructor(error){
        if(error instanceof Error){
            this.lineNumber = getLineNumber(error);
            this.message = error.message;
        } else {
            throw new Error('Could not instantiate LineNumberError from non Error object');
        }
    }
}

//Log entry formatter that includes timestamps
const MESSAGE = Symbol.for('message');

//Formats log entries
//  @param {Object} logEntry The log entry to be formatted
const logEntryFormatter = (logEntry) => {
    const timestamp = {
        time: getCurrentTimeFormatted()
    };
    
    let logAsJSON = Object.assign(timestamp, logEntry);
    
    logEntry[MESSAGE] = JSON.stringify(logAsJSON);

    return logEntry;
}

//Init logger 
const logger = winston.createLogger({
    level: 'info',
    format: winston.format(logEntryFormatter)(),
    exceptionHandlers: [
        new winston.transports.Console(),
        new winston.transports.File({
            filename: path.join(logDir, 'error.log'), 
            maxsize: 1000000
        })
    ],
    exitOnError: false, //Needed to save crashes to a file
    transports: [
        new winston.transports.Console({
            level: 'error'
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
});

//Logs errors for some process disruptions
//  @param {String} The name of the signal that triggered the disruption
var disruptHandler = (signal) => {
    logger.error(new LineNumberError(new Error("Weather bot process killed unexpectedly. " + signal)));
    process.exit(1);
}

process.on('SIGINT', disruptHandler);
process.on('SIGHUP', disruptHandler);

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
//  @param {Function} onDataLoaded(parsedWeatherData): The callback to run on the weather data after it has been loaded and parsed as an Object
//      @param {Object} parsedWeatherData: The weather data recieved as an Object. See https://openweathermap.org/forecast5#parameter
//                                         for details about keys and values in the Object.
function loadWeather(onDataLoaded){
    logger.info('Attempt fetch weather data');
    
    https.get(weatherRequestURL, (res) => {
        const { statusCode } = res;
        const contentType = res.headers['content-type'];
        
        let error;
        
        if(statusCode !== 200){
            error = new Error(`Request Failed. Status Code: ${statusCode}`);
        } else if (!/^application\/json/.test(contentType)) {
            error = new Error(`Invalid content-type. Expected application/json but received ${contentType}`);
        }
        
        if (error) {
            logger.error(new LineNumberError(error));
            
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
                    logger.error(new LineNumberError(new Error('Weather data loaded callback parameter "onDataLoaded" not a function.')));
                    logger.error(new LineNumberError(new Error('Type of "onDataLoaded" is ' + typeof onDataLoaded)));
                }
            } catch(e) {
                logger.error(e);
            }
        });
    }).on('error', (e) => {
        logger.error(new LineNumberError(new Error('Failed to load weather data.')));
        logger.error(new LineNumberError(e));
    });
}

/*
 * Convert weather data into a twitter status
 */

//Shortened descriptions and symbols for weather condition codes
//See https://openweathermap.org/weather-conditions for full code information
const weatherStatusCodeMap = require('./statusCodeMap.json');

//Get periodic update message
//  @param {Object} parsedWeatherData The weather data Object recieved from OpenWeatherMap
//  @returns {String} A weather update message to be posted to twitter.
function getStatusMessage(parsedWeatherData){
    try{
        let forecast = getForecast(parsedWeatherData);
        logger.info("Created forecast");
        return forecast;
    }catch(e){
        if(/^Cannot read property '.+' of undefined$/.test(e.message)){
            logger.error(new LineNumberError(new Error(`Weather data Object in unexpected format: ${e.message}`)));
        } else {
            let keyPath = /^Member (.+) of object is undefined|NaN|null$/.exec(e.message)[1];

            if(keyPath){
                logger.error(new LineNumberError(new Error(`Failed to collect ${keyPath} from openWeatherMap object. `)));
            } else {
                logger.error(new LineNumberError(e));
            }
        }
    }
}

//Gets the default forecast message. 
//  @param {Object} parsedWeatherData The weather data Object recieved from OpenWeatherMap
//  @returns {String} A message describing the condition, temperature, and wind for the next 9 hours. Max 142 characters.
function getForecast(parsedWeatherData){

    const forecastData = parsedWeatherData.list.slice(0, 3);
    var defaultForecast = (Math.random() > 0.000228310502) ? 'Forecast' : 'Fourcast';
    
    for(let {dt_txt, main, weather, wind: {deg, speed}} of forecastData){
        let conditions = {
            symbol: weatherStatusCodeMap[weather[0].id].symbol,
            temp: {
                max: Math.round(main.temp_max),            
                min: Math.round(main.temp_min)
            },
            time: getCST(dt_txt.substr(11, 2)),
            wind: {
                direction: getWindDirectionAsCardinal(deg),
                speed: speed.toPrecision(2)
            }
        };
        
        validateNotNull(conditions);
        
        defaultForecast += '\n';
        defaultForecast += `${conditions.time}:00:${conditions.symbol}, [${conditions.temp.min},${conditions.temp.max}]°C, 💨 ${conditions.wind.speed} m/s ${conditions.wind.direction}`;
    }
    
    defaultForecast += '\n\n';
    
    return defaultForecast;
}

//Validates that each member of an object isn't null
//  @param {Object} object The javascript object to be validated
//  @param {String} path The key path up to object. Used for recursive calls. Initially ''
//  @throws {Error} An error on discovering a member of an object has value NaN null or undefined.
function validateNotNull(object, path){
    for(let key in object){
        const value = object[key];
        
        if(typeof value === 'object'){
            let newPath = (`${path}.${key}`[0] === '.') ? key : `${path}.${key}`;
            validateNotNull(value, newPath);
        } else if(value === undefined || value === null || value === NaN){
            throw new Error(`Member ${path}.${key} of object is ${value}`);
        }
    }
}

//Converts an angle into cardinal direction
//  @param {Number} azimuth A number representing an angle in the range [0, 360)
//  @return {String} A character representing a cardinal direction or 2 character representing an intercardinal direction
function getWindDirectionAsCardinal(azimuth){
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

//Converts UTC hours into CST hours
//  @param {String} UTC A 2 digit number representing hours at UTC time
//  @return {String} A 2 digit number representing the input UTC hours converted to central time
function getCST(UTC){
    let offsetHour = parseInt(UTC) - 6;
    let CST = offsetHour >= 0 ? offsetHour : offsetHour + 24;
    
    return ('0' + CST).substr(-2);
}

/*
 *  Schedule forecasts to go out every 2 hours.
 */
var lastUpdate = new Date();
 
var updates = schedule.scheduleJob('0 */2 * * *', function(){
    //Detect if computer fell asleep
    if(new Date() - lastUpdate > 7620000){//7620000ms = 2 hours 7 minutes
        lastUpdate.setHours(lastUpdate.getHours() + 2);
        logger.warn(new LineNumberError(new Error('Missed scheduled twitter update. Presumably by waking from sleep.')));
    } else {
        lastUpdate = new Date();
        
        loadWeather((parsedWeatherData) => {
            console.log(getStatusMessage(parsedWeatherData));//testData));
        });
    }
});

logger.info('Bot process started.');