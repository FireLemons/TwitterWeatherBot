const config = require('./config.json');
const https = require('https');
const winston = require('winston');
const schedule = require('node-schedule');
const twitter = require('twitter');
 
/*
 * Prepare weather get request URL from config
 */
 
var location = config.open_weather_map.location,
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
function loadWeather(onLoad){
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
}