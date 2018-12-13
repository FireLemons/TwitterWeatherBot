const config = require('./config.json');
const https = require('https');
const fs = require( 'fs' );
const path = require('path');
const schedule = require('node-schedule');
const twitter = require('twitter');
const winston = require('winston');

/*
 * Set up logging
 */

//Function to make readable timestamps
const dateFormat = {month: 'long', day: '2-digit', hour12: false, hour: 'numeric', minute: 'numeric', second: 'numeric'},
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
    transports: [
        new winston.transports.File({ filename: path.join(logDir, 'error.log'), level: 'error' }),
        new winston.transports.File({ filename: path.join(logDir, 'combined.log') })
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

const weatherRequestURL = `https://api.openweathermap.org/data/2.5/forecast?${locationParams}&APPID=${config.open_weather_map.key}`;

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
            } catch (e) {
                logger.error(e.message);
            }
        });
    }).on('error', (e) => {
        logger.error(`Got error: ${e.message}`);
    });
}

loadWeather(function(parsedWeatherData){
    console.log(parsedWeatherData);
});