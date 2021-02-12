'use strict'

const lune = require('lune')
const util = require('./util.js')

/** @fileoverview A collection of functions to calculate celstial events and stats. */

// Calculates the axial tilt of the Earth
//  @param  {number} n Time measured in whole days since January 1 2000 12:00:00 UTC
//  @return {number} The axial tilt of the earth at time n in radians
function getAxialTilt (n) {
  return util.toRadians(23.439 - (0.0000004 * n))
}

// Converts a number representing a Julian date into a Date object
//  @param  {number} julianDate The Julian date to be converted
//  @return {Date} A Date representation of julianDate
function getDateFromJulian (julianDate) {
  return new Date((julianDate - 2440587.5) * 86400000)
}

// Converts a date to a Julian date
//  @param  {Date} date The date to be converted into a Julian date
//  @return {number} The number of days since the beginning of the Julian Period in local time
function getJulianDate (date) {
  return (date.getTime() / 86400000) + 2440587.5
}

// Calculates the mean anomaly of the Earth with respect to the Sun
//  @param  {number} n Time measured in whole days since January 1 2000 12:00:00 UTC
//  @return {number} The mean anomaly of the Earth with respect to the Sun in radians
function getMeanAnomaly (n) {
  return util.toRadians(357.5291 + (0.98560028 * n))
}

// Calculates an approximation of when solar noon is in mean solar time
//  @param  {number} longitude The longitude west(west is negative, east is positive) in degrees
//  @param  {number} n Time measured in whole days since January 1 2000 12:00:00 UTC
//  @return {number} The time in days since January 1 2000 12:00:00 UTC until the expected solar noon
function getMeanSolarNoon (longitude, n) {
  return n - (longitude / 360)
}

// Converts a Julian Date to a count of the number of days since January 1 2000 12:00:00 UTC
//  @param  {number} JD a Julian Date
//  @return {number} The number of whole days since January 1 2000 12:00:00 UTC
function getN (JD) {
  return Math.floor(JD - 2451544.9992)
}

// Calculates the declination of the Sun
//  @param  {number} axialTilt The axial tilt of the Earth in radians
//  @param  {number} solarEclipticLongitude The ecliptic longitude of the Sun in radians
//  @return {number} The declination of the Sun in radians
function getSolarDeclination (axialTilt, solarEclipticLongitude) {
  return Math.asin(Math.sin(axialTilt) * Math.sin(solarEclipticLongitude))
}

// Calculates the ecliptic longitude of the Sun
//  @param  {number} solarMeanLongitude The solar mean longitude in radians
//  @param  {number} meanAnomaly The mean anomaly of the Earth with respect to the Sun in radians
//  @return {number} The ecliptic longitude of the Sun in radians
function getSolarEclipticLongitude (solarMeanLongitude, meanAnomaly) {
  return solarMeanLongitude + util.toRadians((1.915 * Math.sin(meanAnomaly)) + (0.020 * Math.sin(2 * meanAnomaly)))
}

// Calculates the hour angle of the Sun
//  @param  {number} latitude The north latitude(north is positive, south is negative) of the observer in degrees
//  @param  {number} solarDeclination The declination of the Sun in radians
//  @return {number} The hour angle of the Sun in radians
function getSolarHourAngle (latitude, solarDeclination) {
  const latitudeRadians = util.toRadians(latitude)

  return Math.acos((Math.sin(util.toRadians(-0.83 /* - (2.076 * Math.sqrt(coordinates.elevation) / 60) */)) - Math.sin(latitudeRadians) * Math.sin(solarDeclination)) / (Math.cos(latitudeRadians) * Math.cos(solarDeclination)))
}

// Calculates the mean longitude of the Sun, corrected for the aberration of light
//  @param  {number} n Time measured in whole days since January 1 2000 12:00:00 UTC
//  @return {number} The mean longitude of the Sun in radians
function getSolarMeanLongitude (n) {
  return util.toRadians(280.46 + (0.9856474 * n))
}

// Calculates the time of solar noon
//  @param  {number} eclipticLongitude The ecliptic longitude of the Sun in radians
//  @param  {number} meanAnomaly The mean anomaly of the Earth with respect to the Sun in radians
//  @param  {number} meanSolarNoon The time in days since January 1 2000 12:00:00 UTC until the solar noon
//  @return {number} The time of solar noon as a Julian date
function getSolarNoon (eclipticLongitude, meanAnomaly, meanSolarNoon) {
  return 2451545 - (0.0069 * Math.sin(2 * eclipticLongitude)) + (0.0053 * Math.sin(meanAnomaly)) + meanSolarNoon
}

module.exports = {
  // Generates a message describing how long the day/night is, the nearest sunrise, and the nearest sunset
  //  @param  {object} coordinates An object containing the latitude and longitude of the observer
  //  @param  {Date=} date The time to get sunrise, sunset, and length data for. The current time if unspecified.
  //  @return {string} If day, the sunrise, sunset, and length of the day otherwise the sunset sunrise, and length of the night
  getDayNight (coordinates, date) {
    date = date || new Date()

    const dayInfo = this.getSunUpDown(coordinates, date)
    let diff
    let sky
    let sunrise
    let sunset

    if (dayInfo.sunrise - date > 0) { // date is before sunrise
      sky = 'night'
      sunrise = util.roundMinutes(dayInfo.sunrise)

      const previousDay = new Date(date)
      previousDay.setDate(previousDay.getDate() - 1)

      sunset = util.roundMinutes(this.getSunUpDown(coordinates, previousDay).sunset)
      diff = sunrise - sunset
    } else if (dayInfo.sunset - date < 0) { // date is after sunset
      sky = 'night'
      sunset = util.roundMinutes(dayInfo.sunset)

      const nextDay = new Date(date)
      nextDay.setDate(nextDay.getDate() + 1)

      sunrise = util.roundMinutes(this.getSunUpDown(coordinates, nextDay).sunrise)
      diff = sunrise - sunset
    } else { // it's day
      sky = 'day'
      sunrise = util.roundMinutes(dayInfo.sunrise)
      sunset = util.roundMinutes(dayInfo.sunset)
      diff = sunset - sunrise
    }

    return (sky === 'day')
      ? `Sunrise was at ${sunrise.toTimeString().substr(0, 5)}. Sunset will be at ${sunset.toTimeString().substr(0, 5)}. Today is ${Math.floor(diff / 3600000)} hours, ${(diff / 60000) % 60} minutes long.`
      : `Sunset was at ${sunset.toTimeString().substr(0, 5)}. Sunrise will be at ${sunrise.toTimeString().substr(0, 5)}. Tonight is ${Math.floor(diff / 3600000)} hours, ${(diff / 60000) % 60} minutes long.`
  },

  // Get a message describing the current moon phase.
  //  @return {string} A message stating the current phase of the moon.
  getLunarPhase () {
    const nearbyPhases = Object.values(lune.phase_hunt()); const now = new Date()

    const closestPhase = util.getClosestIndex(now, nearbyPhases, (date1, date2) => date1 - date2)
    let phase
    const proximity = util.getDaysBetween(nearbyPhases[closestPhase], now)

    switch (closestPhase) {
      case 0:
        if (Math.abs(proximity) < 1) {
          phase = '🌑 New Moon'
        } else if (proximity > 0) {
          phase = '🌒 Waxing Crescent'
        } else {
          phase = '🌘 Waning Crescent'
        }

        break
      case 1:
        if (Math.abs(proximity) < 1) {
          phase = '🌓 First Quarter'
        } else if (proximity > 0) {
          phase = '🌔 Waxing Gibbous'
        } else {
          phase = '🌒 Waxing Crescent'
        }

        break
      case 2:
        if (Math.abs(proximity) < 1) {
          phase = '🌕 Full Moon'
        } else if (proximity > 0) {
          phase = '🌖 Waning Gibbous'
        } else {
          phase = '🌔 Waxing Gibbous'
        }

        break
      case 3:
        if (Math.abs(proximity) < 1) {
          phase = '🌗 Third Quarter'
        } else if (proximity > 0) {
          phase = '🌘 Waning Crescent'
        } else {
          phase = '🌖 Waning Gibbous'
        }

        break
      case 4:
        if (Math.abs(proximity) < 1) {
          phase = '🌑 New Moon'
        } else {
          phase = '🌒 Waxing Crescent'
        }

        break
    }

    return `The moon is currently in the ${phase} phase.`
  },

  // Generates a statement stating the days between the last solstice or equinox until now and days until the next solstice or equinox
  //  @param  {Date=} date For testing. A date to get the season progress for.
  //  @return {String} A statement stating the days between the last solstice or equinox until now and days until the next solstice or equinox
  getSeasonProgress (date) {
    const now = date || new Date()
    const seasonData = require('./data/seasons.json')
    const currentYear = now.getFullYear()
    const currentYearDates = Object.values(seasonData[currentYear]).map((elem) => new Date(elem))
    const nearestEvent = util.getClosestIndex(now, currentYearDates, (date1, date2) => date1 - date2)
    const proximityNearestDate = Math.floor(util.getDaysBetween(now, currentYearDates[nearestEvent]))
    const closeEvent = {
      days: proximityNearestDate
    }
    let previousEvent
    let nextEvent

    switch (nearestEvent) {
      case 0:
        closeEvent.event = 'vernal equinox'

        if (proximityNearestDate < 0) {
          closeEvent.days *= -1

          previousEvent = closeEvent
          nextEvent = {
            days: Math.floor(util.getDaysBetween(now, currentYearDates[nearestEvent + 1])),
            event: 'summer solstice'
          }
        } else {
          previousEvent = {
            days: Math.floor(util.getDaysBetween(new Date(seasonData[currentYear - 1]['winter_solstice']), now)),
            event: 'winter solstice'
          }
          nextEvent = closeEvent
        }

        break
      case 1:
        closeEvent.event = 'summer solstice'

        if (proximityNearestDate < 0) {
          closeEvent.days *= -1

          previousEvent = closeEvent
          nextEvent = {
            days: Math.floor(util.getDaysBetween(now, currentYearDates[nearestEvent + 1])),
            event: 'autumnal equinox'
          }
        } else {
          previousEvent = {
            days: Math.floor(util.getDaysBetween(currentYearDates[nearestEvent - 1], now)),
            event: 'vernal equinox'
          }
          nextEvent = closeEvent
        }

        break
      case 2:
        closeEvent.event = 'autumnal equinox'

        if (proximityNearestDate < 0) {
          closeEvent.days *= -1

          previousEvent = closeEvent
          nextEvent = {
            days: Math.floor(util.getDaysBetween(now, currentYearDates[nearestEvent + 1])),
            event: 'winter equinox'
          }
        } else {
          previousEvent = {
            days: Math.floor(util.getDaysBetween(currentYearDates[nearestEvent - 1], now)),
            event: 'summer solstice'
          }
          nextEvent = closeEvent
        }

        break
      case 3:
        closeEvent.event = 'winter solstice'

        if (proximityNearestDate < 0) {
          const proximityNext = util.getDaysBetween(now, new Date(seasonData[currentYear + 1]['vernal_equinox']))

          closeEvent.days *= -1

          previousEvent = closeEvent
          nextEvent = {
            days: Math.floor(proximityNext),
            event: 'vernal equinox'
          }
        } else {
          previousEvent = {
            days: Math.floor(util.getDaysBetween(currentYearDates[nearestEvent - 1], now)),
            event: 'autumnal equinox'
          }
          nextEvent = closeEvent
        }

        break
    }

    if (!proximityNearestDate) {
      return `Today is the ${previousEvent.event}.`
    }

    return `It has been ${previousEvent.days} days since the ${previousEvent.event} and will be ${nextEvent.days} days until the ${nextEvent.event}.`
  },

  // Generates a statement stating the length of the day or night for the current time and sunrise and sunset times
  // Calculations derived from https://en.wikipedia.org/wiki/Position_of_the_Sun and https://en.wikipedia.org/wiki/Sunrise_equation
  //  @param  {object} coordinates An object containing the latitude and longitude of the observer
  //  @param  {Date=} date A date to get the sunlight data for
  //  @return {object} An object containing 2 Dates: sunrise and sunset
  getSunUpDown (coordinates, date) {
    date = date || new Date()

    const dateCorrection = new Date(date)
    dateCorrection.setHours(date.getHours() + 6)

    const n = getN(getJulianDate(dateCorrection))
    // These equations, from the Astronomical Almanac,[3][4] can be used to calculate the apparent coordinates of the Sun, mean equinox and ecliptic of date, to a precision of about 0°.01 (36″),
    // for dates between 1950 and ((((2050)))).
    const eclipticLongitude = getSolarEclipticLongitude(getSolarMeanLongitude(n), getMeanAnomaly(n))
    const solarDeclination = getSolarDeclination(getAxialTilt(n), eclipticLongitude)
    // These equations probably don't expire
    const meanSolarNoon = getMeanSolarNoon(coordinates.long, n)
    const solarNoon = getSolarNoon(eclipticLongitude, getMeanAnomaly(meanSolarNoon), meanSolarNoon)

    const hourRatio = getSolarHourAngle(coordinates.lat, solarDeclination) / (2 * Math.PI)
    const sunrise = getDateFromJulian(solarNoon - hourRatio)
    const sunset = getDateFromJulian(solarNoon + hourRatio)

    return {
      sunrise: sunrise,
      sunset: sunset
    }
  }
}
