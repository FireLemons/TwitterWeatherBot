'use strict'

/** @fileoverview A collection of functions to check the bot configuration object's leaf nodes for mistakes.
  *   All function params are assumed to be of the correct type */

module.exports = {
  // Checks whether config.alerts.app.contact is in the form of an email address
  //  @param  {string} contact The given contact information
  //  @return {boolean} True if contact is in the form of an email false otherwise
  validateAlertsAppContact (contact) {
    return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(contact)
  },

  // Checks whether config.alerts.app.website is a url
  //  @param  {string} website The given app website
  //  @return {boolean} True if website is is in the form of a valid url false otherwise
  validateAlertsAppWebsite (website) {
    return /(http(s)?:\/\/.)?(www\.)?[-a-zA-Z0-9@:%._+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_+.~#?&//=]*)/.test(website)
  },
  
  // Checks whether config.alerts.app.keep is a boolean
  //  @param  {any} keep The given keep parameter
  //  @return {boolean} True keep is a boolean false otherwise
  validateAlertsFiltersKeep (keep) {
    return keep === false || keep === true;
  },

  // Checks whether config.alerts.filters.path is a valid chain of dot accessors
  //  @param  {string} path The given path
  //  @return {boolean} True if path is a valid chain of dot accessors false otherwise
  validateAlertsFiltersPath (path) {
    return /^[_\\$a-zA-Z][_\\$a-zA-Z0-9]*(\.[_\\$a-zA-Z][_\\$a-zA-Z0-9]*)*$/.test(path)
  },

  // Checks whether config.alerts.filters.restriction is one of valid restriction options
  //  @param  {string} restriction The given restriction
  //  @return {boolean} True if restriction is one of the valid options false otherwise
  validateAlertsFiltersRestriction (restriction) {
    return ['after', 'before', 'contains', 'equals', 'has', 'matches'].indexOf(restriction) > -1
  },

  // Checks whether config.alerts.filters.value is a valid value for the given restriction
  //  @param  {string} restriction One of the valid filter restrictions
  //  @param  {string} value The given value
  //  @return {boolean} True if value is a valid value for the restriction false otherwise
  //  @throws {ReferenceError} If value is required and not defined
  //  @throws {TypeError} If value is of the wrong type
  validateAlertsFiltersValue (restriction, value) {
    switch (restriction) {
      case 'after':
      case 'before':
        if (value === undefined) {
          throw new ReferenceError('Filter value missing')
        } else if (isNaN(value)) {
          throw new TypeError('Filter value not a number.')
        } else {
          return true
        }
      case 'contains':
      case 'equals':
        if (value === undefined) {
          throw new ReferenceError('Filter value missing')
        } else if (value instanceof Object) {
          throw new TypeError('Filter value cannot be an object or array. Object comparison is not supported.')
        } else {
          return true
        }
      case 'has':
        return true
      case 'matches':
        if (value === undefined) {
          throw new ReferenceError('Filter value missing')
        } else if (typeof value !== 'string') {
          throw new TypeError('Filter value must be a string.')
        } else {
          try {
            new RegExp(value)
            return true
          } catch (e) {
            return false
          }
        }
    }
  },

  // Checks whether config.coordinates.elevation is in the range of acceptable elevations
  //  @param  {number} longitude The given elevation in meters
  //  @return {boolean} true if elevation is between -413 and 8848 false otherwise
  validateCoordinatesElevation (elevation) {
    return elevation >= -413 && elevation <= 8848
  },

  // Checks whether config.coordinates.lat is in the range of acceptable latitudes
  //  @param  {number} latitude The given latitude in degrees
  //  @return {boolean} true if latitude is between -90 and 90 false otherwise
  validateCoordinatesLat (latitude) {
    return latitude >= -90 && latitude <= 90
  },

  // Checks whether config.coordinates.long is in the range of acceptable longitudes
  //  @param  {number} longitude The given longitude in degrees
  //  @return {boolean} true if longitude is between -180 and 180 false otherwise
  validateCoordinatesLong (longitude) {
    return longitude >= -180 && longitude <= 180
  },

  // Checks whether config.log.logDir is a valid file path
  //  @param  {string} logDir The given directory path
  //  @return {boolean} true if logDir is a valid path false otherwise
  validateLogLogDir (logDir) {
    return /^(?:[\w]:[\\/]+|\.|\.\.){0,1}[\w_\-\s.]+(?:[\\/]+[a-z_\-\s0-9.]+)*$/.test(logDir)
  },
  
  // Checks whether a string contains non white space characters
  //  @param  {string} str The string to be checked
  //  @return {boolean} True if str has length and isn't exclusively white space false otherwise
  validateNotEmptyString(str){
    return str.trim().length > 0
  },
  
  // Checks whether a string is in the form {city name},{country code}
  //  param  {string} str The string to be checked
  //  return {boolean} True if str is in the form {city name},{country code} false otherwise
  validateOWMCityNameParam(str){
    return /^.+,[a-zA-Z]{2}$/.test(str)
  },
  
  // Checks whether a string is in the form {zip code},{country code}
  //  param  {string} str The string to be checked
  //  return {boolean} True if str is in the form {zip code},{country code} false otherwise
  validateOWMZipCodeParam(str){
    return /^[0-9]{5},[a-zA-Z]{2}$/.test(str)
  },
  
  // Checks whether a number is an integer
  //  @param  {number} num The number to be checked
  //  @return {boolean} True if num is an integer false otherwise
  validateInteger(num){
    return num === Math.floor(num)
  },
  
  // Checks whether a value is a number
  //  @param  {number} probability The value to be checked
  //  @return {number} 1 if probability is a number, 0 if probability is undefined, -1 otherwise
  validateProbability(probability){
    if(probability === undefined){
      return 0
    } else if(isNaN(probability)){
      return -1
    } else {
      return 1
    }
  }
}
