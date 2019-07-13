'use strict';

const lune = require('lune');
const util = require('./util.js');

/** @fileoverview A collection of functions to calculate celstial events and stats. */
module.exports = {
    //Generates a statement stating the length of the day or night for the current time and sunrise and sunset times
    //Calculations derived from https://en.wikipedia.org/wiki/Position_of_the_Sun and https://en.wikipedia.org/wiki/Sunrise_equation
    //  @param  {Date=} date For testing. A date to get the sunlight data for.
    //  @return {String} A statement stating the amount of sunlight 
    getDaylight(date){
        date = date ? date : new Date();
        
        let dateCorrection = date;
        dateCorrection.setHours(date.getHours() + 6);
        
        let coordinates = {
                "elevation": 231,
                "long": -92.3341,
                "lat": 38.9517
            },
            solarPosition = this.solarPosition,
            n = solarPosition.getN(solarPosition.getJulianDate(dateCorrection)),
            //These equations, from the Astronomical Almanac,[3][4] can be used to calculate the apparent coordinates of the Sun, mean equinox and ecliptic of date, to a precision of about 0°.01 (36″), 
            //for dates between 1950 and ((((2050)))).
            sun_declination = solarPosition.getSolarDeclination(solarPosition.getAxialTilt(n), solarPosition.getSolarEclipticLongitude(solarPosition.getSolarMeanLongitude(n), solarPosition.getMeanAnomaly(n))),
            
            mean_solar_noon = n - (coordinates.long / 360),
            solar_mean_anomaly = util.toRadians((357.5291 + (.98560028 * mean_solar_noon)) % 360),
            center = (1.9148 * Math.sin(solar_mean_anomaly)) + (.02 * Math.sin(2 * solar_mean_anomaly)) + (.0003 * Math.sin(3 * solar_mean_anomaly)),
            ecliptic_longitude = solar_mean_anomaly + util.toRadians((center + 282.9372) % 360) % (Math.PI * 2),
            solar_noon = 2451545 + mean_solar_noon + (.0053 * Math.sin(solar_mean_anomaly)) - (.0069 * Math.sin(2 * ecliptic_longitude)),
            
            hour_angle = Math.acos((Math.sin(util.toRadians(-0.83 /*- (2.076 * Math.sqrt(coordinates.elevation) / 60)*/)) - Math.sin(util.toRadians(coordinates.lat)) * Math.sin(sun_declination)) / (Math.cos(util.toRadians(coordinates.lat)) * Math.cos(sun_declination))),
            sunrise = solar_noon - ((hour_angle * 180 / Math.PI) / 360),
            sunset = solar_noon + ((hour_angle * 180 / Math.PI) / 360);
            
        return solarPosition.getDateFromJulian(sunrise);
    },
    
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
    },
    
    //Generates a statement stating the days between the last solstice or equinox until now and days until the next solstice or equinox
    //  @param  {Date=} date For testing. A date to get the season progress for.
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
        
        return `It has been ${previousEvent.days} days since the ${previousEvent.event} and will be ${nextEvent.days} days until the ${nextEvent.event}.`;
    },
    
    solarPosition:{
        //Gets the axial tilt of the Earth 
        //  @param  {number} n The number of whole days since January 1 2000 12:00:00 UTC
        //  @return {number} The axial tilt of the earth at time n in radians
        getAxialTilt(n){
            return util.toRadians(23.439 - (.0000004 * n));
        },
        
        //Converts a number representing a julian date into a Date object
        //  @param  {number} julianDate The julian date to be converted
        //  @return {Date} A Date representation of julianDate
        getDateFromJulian(julianDate){
            return new Date((julianDate - 2440587.5) * 86400000);
        },
        
        //Converts a date to a julian date
        //  @param  {Date} date The date to be converted into a julian date
        //  @return {number} The number of days since the beginning of the Julian Period in local time
        getJulianDate(date){
            return (date.getTime() / 86400000) + 2440587.5
        },
        
        //Gets the mean anomaly of the Earth with respect to the Sun
        //  @param  {number} n The number of whole days since January 1 2000 12:00:00 UTC
        //  @return {number} The mean anomaly of the Earth with respect to the Sun in radians
        getMeanAnomaly(n){
            return util.toRadians(357.528 + (.9856003 * n));
        },
        
        //Converts a Julian Date to a count of the number of days since January 1 2000 12:00:00 UTC
        //  @param  {number} JD a Julian Date
        //  @return {number} The number of whole days since January 1 2000 12:00:00 UTC
        getN(JD){
            return Math.floor(JD - 2451544.9992);
        },
        
        //Gets the ecliptic longitude of the Sun
        //  @param  {number} solarMeanLongitude The solar mean longitude in radians
        //  @param  {number} meanAnomaly The mean anomaly of the Earth with respect to the Sun in radians
        //  @return {number} The ecliptic longitude of the Sun in radians
        getSolarEclipticLongitude(solarMeanLongitude, meanAnomaly){
            return solarMeanLongitude + util.toRadians((1.915 * Math.sin(meanAnomaly)) + (.020 * Math.sin(2 * meanAnomaly)));
        },
        
        //Gets mean longitude of the Sun, corrected for the aberration of light
        //  @param  {number} n The number of whole days since January 1 2000 12:00:00 UTC
        //  @return {number} The mean longitude of the Sun in radians
        getSolarMeanLongitude(n){
            return util.toRadians(280.46 + (.9856474 * n));
        },
        
        //Gets the declination of the Sun
        //  @param  {number} axialTilt The axial tilt of the Earth in radians
        //  @param  {number} solarEclipticLongitude The ecliptic longitude of the Sun in radians
        //  @return {number} The declination of the Sun
        getSolarDeclination(axialTilt, solarEclipticLongitude){
            return Math.asin(Math.sin(axialTilt) * Math.sin(solarEclipticLongitude));
        }
    }
}