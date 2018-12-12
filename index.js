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
      formatDate = new Intl.DateTimeFormat('en-US', dateFormat).format
 
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

//Init logger 
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.json(),
    transports: [
        new winston.transports.File({ filename: path.join(logDir, 'error.log'), level: 'error' }),
        new winston.transports.File({ filename: path.join(logDir, 'combined.log') })
    ]
});

logger.log({time: getCurrentTimeFormatted(), level: 'info', message: 'test'});

/*
 * Prepare weather get request URL from config
 */
 
var {open_weather_map: {location}} = config,
    locationParams = '';

for(var paramName in location){
    if (location.hasOwnProperty(paramName)) {
        locationParams += paramName + "=" + location[paramName];
    }
}

const weatherRequestURL = `https://api.openweathermap.org/data/2.5/forecast?${locationParams}&APPID=${config.open_weather_map.key}`;

/*
 * 
 */
/*function loadWeather(onLoad){
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
            console.error(error.message);
            
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
                const parsedData = JSON.parse(rawData);
                console.log(parsedData);
            } catch (e) {
                console.error(e.message);
            }
        });
    }).on('error', (e) => {
        console.error(`Got error: ${e.message}`);
    });
}*/