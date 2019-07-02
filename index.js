const config = require('./config.json');
const fs = require( 'fs' );
const path = require('path');
const schedule = require('node-schedule');
//const stats = require('./stats.json');
const twitter = require('twitter');
const weatherManager = require('./weather.js');
const winston = require('winston');
const util = require('./util.js');

const testData = require('./test/sampleData1.json');

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
function getErrorSource(error){
    let { stack } = error;
    
    for(var firstNewLineIndex = 0; firstNewLineIndex < stack.length && stack[firstNewLineIndex] !== '\n'; firstNewLineIndex++){
    }
  
    for(var secondNewLineIndex = firstNewLineIndex + 1; secondNewLineIndex < stack.length && stack[secondNewLineIndex] !== '\n'; secondNewLineIndex++){
    }
    
    let errorSourceData = stack.substr(firstNewLineIndex, secondNewLineIndex - firstNewLineIndex).match(/([\w]+\.js):([\d]+):[\d]+\)$/);
    
    return {
        fileName: errorSourceData[1],
        lineNumber: parseInt(errorSourceData[2])
    };
}

//Create the log directory if it doesn't exist
var {log: {logDir}} = config;

if(!fs.existsSync(logDir)){
    fs.mkdirSync(logDir);
}

const MESSAGE = Symbol.for('message');
const LEVEL = Symbol.for('level');

//Holds an error message and a line number
class TrackedError{
    constructor(error){
        if(error instanceof Error){
            Object.assign(this, error);
            Object.assign(this, getErrorSource(error));
            this.message = error.message;
        } else {
            throw new Error('Could not instantiate LineNumberError from non Error object');
        }
    }
}

//Formats log entries with timestamps and sometimes line numbers
//  @param {Object} logEntry The log entry to be formatted
const logEntryFormatter = (logEntry) => {
    const timestamp = {
        time: getCurrentTimeFormatted()
    };
    
    if(logEntry instanceof Error){
        logEntry = new TrackedError(logEntry);
    }
    
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
    //Starts a delayed process shutdown so the logger has time to write exceptions to files.
    //  @param {Object} err An error describing the reason for shutting down
    exitOnError: function(err){
        function* exitNotifier(){
            yield `Process encountered a fatal error.${(err.code) ? ' Code: ' + err.code : ''} Exiting in...`;
            yield 3;
            yield 2;
            yield 1;
        }
        
        let exitMessage = exitNotifier();
        
        let exitSequence = setInterval(function(){
            let message = exitMessage.next().value;
            
            if(message){
                console.log(message);
            } else {
                process.exit(1);
            }
        }, 1000);
        
        return false;
    },
    transports: [
        new winston.transports.Console({
            level: 'warn'
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
    logger.error(new Error('Weather bot process killed unexpectedly by ' + signal));
    process.exit(1);
}

process.on('SIGINT', disruptHandler);
process.on('SIGHUP', disruptHandler);

/*
 * Init Weather Data Handler
 */

const weatherTools = new weatherManager(logger, config.open_weather_map);

/*
 * Convert weather data into a twitter status
 */

//Get periodic update message
//  @param {Object} parsedWeatherData The weather data Object recieved from OpenWeatherMap
//  @returns {String} A weather update message to be posted to twitter.
function getStatusMessage(parsedWeatherData){
    try{
        let forecast = weatherTools.getForecast(parsedWeatherData);
        logger.info('Created forecast');
        let message = forecast;
        
        if(message.length > 280){
            throw new Error(`Message too long: ${message}`);
        }
        
        return message;
    }catch(e){
        if(/^Cannot read property '.+' of undefined$/.test(e.message)){
            logger.error(new Error(`Weather data Object in unexpected format: ${e.message}`));
        } else {
            let keyPathCheck = /^Member (.+) of object is undefined|NaN|null$/.exec(e.message);
            
            if(keyPathCheck && keyPathCheck.length > 1){
                logger.error(new Error(`Failed to read ${keyPathCheck[1]} from openWeatherMap object. `));
            } else {
                logger.error(e);
            }
        }
    }
}

/*
 *  Schedule forecasts to go out every 2 hours.
 */
var lastUpdate = new Date();

//Turns weather data into a twitter status and tweets it
//  @param {Object} parsedWeatherData The weather data.
const onWeatherLoaded = (parsedWeatherData) => {
    lastUpdate = new Date();
    
    console.log(getStatusMessage(parsedWeatherData));//testData));
}

//var updates = schedule.scheduleJob('0 */2 * * *', function(){
    //Detect if computer fell asleep
    if(new Date() - lastUpdate > 7620000){//7620000ms = 2 hours 7 minutes
        lastUpdate.setHours(lastUpdate.getHours() + 2);
        logger.warn(new Error('Missed scheduled twitter update. Presumably by waking from sleep.'));
    } else {
        let retryTimeout = 0;
        
        //Retries the request up to three times
        //  @param {Error[]} A list of errors describing why the failure occurred
        const onFailLoadWeather = (errors) => {
            logger.error(new Error('Failed to load weather data.'));
            
            if(Array.isArray(errors)){
                if(retryTimeout <= 262144){
                    for(let error of errors){
                        logger.warn(error);
                    }
                    
                    logger.info(`Retrying fetching weather data in ${retryTimeout}ms. Retry ${(retryTimeout / 131072) + 1} of 3`);
                    
                    setTimeout(() => {
                        weatherTools.loadWeather(onWeatherLoaded, onFailLoadWeather);
                    }, retryTimeout);
                    
                    retryTimeout += 131072;
                } else {
                    for(let error of errors){
                        logger.error(error);
                    }
                }
            } else {
                logger.error(new Error(`Expected param 'errors' to be array of Error objects. Got ${typeof errors} instead.`));
            }
        }
        
        weatherTools.loadWeather(onWeatherLoaded, onFailLoadWeather);
    }
//});

logger.info('Bot process started.');