'use strict';

const lune = require('lune');
const util = require('./util.js');

module.exports = {
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
    //  @param {Date=} date For testing. A date to get the season progress for.
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
        
        return `Today is ${previousEvent.days} days since the ${previousEvent.event} and ${nextEvent.days} days until the ${nextEvent.event}.`;
    }
}