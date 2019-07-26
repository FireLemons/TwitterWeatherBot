'use strict'

/** @fileoverview A collection of functions to check the bot configuration object's leaf nodes for mistakes.
  *   All function params are assumed to be of the correct type*/

module.exports = {
    // Checks whether config.alerts.app.contact is in the form of an email address
    //  @param  {string} contact The given contact information
    //  @return {boolean} True if contact is in the form of an email false otherwise
    validateAlertsAppContact(contact){
        return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(contact)
    },
    
    // Checks whether config.alerts.app.name is an empty string
    //  @param  {string} name The given app name
    //  @return {boolean} True if name is not an empty string false otherwise
    validateAlertsAppName(name){
        return name.trim().length > 0
    },
    
    // Checks whether config.alerts.app.version is an empty string
    //  @param  {string} version The given app version
    //  @return {boolean} True if version is not an empty string false otherwise
    validateAlertsAppVersion(version){
        return version.trim().length > 0
    },
    
    // Checks whether config.alerts.app.website is a url
    //  @param  {string} website The given app website
    //  @return {boolean} True if website is is in the form of a valid url false otherwise
    validateAlertsAppWebsite(website){
        return /(http(s)?:\/\/.)?(www\.)?[-a-zA-Z0-9@:%._+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_+.~#?&//=]*)/.test(website)
    },
    
    // Checks whether config.alerts.filters.path is a valid chain of dot accessors
    //  @param  {string} path The given path
    //  @return {boolean} True if path is a valid chain of dot accessors false otherwise
    validateAlertsFiltersPath(path){
        return /^[_\\$a-zA-Z][_\\$a-zA-Z0-9]*(\.[_\\$a-zA-Z][_\\$a-zA-Z0-9]*)*$/.test(path)
    },
    
    // Checks whether config.alerts.filters.restriction is one of valid restriction options
    //  @param  {string} restriction The given restriction
    //  @return {boolean} True if restriction is one of the valid options false otherwise
    validateAlertsFiltersRestriction(restriction){
        return ['after', 'before', 'contains', 'equals', 'has', 'matches'].indexOf(restriction) > -1
    },
    
    // Checks whether config.alerts.filters.value is a valid value for the given restriction
    //  @param  {string} restriction One of the valid filter restrictions
    //  @param  {string} value The given value
    //  @return {boolean} True if value is a valid value for the restriction false otherwise
    //  @throws {ReferenceError} If value is required and not defined
    //  @throws {TypeError} If value is of the wrong type
    validateAlertsFiltersValue(restriction, value){
        switch(restriction){
            case 'after':
            case 'before':
                if (value === undefined) {
                    throw new ReferenceError('Filter value missing');
                } else if (isNaN(value)) {
                    throw new TypeError('Filter value not a number.');
                } else {
                    return true;
                }
            
                break;
            case 'contains':
            case 'equals':
                if (value === undefined) {
                    throw new ReferenceError('Filter value missing');
                } else if (value instanceof Object) {
                    throw new TypeError('Filter value cannot be an object or array. Object comparison is not supported.');
                } else {
                    return true;
                }
                
                break;
            case 'has':
                return true;
                break;
            case 'matches':
                if (value === undefined) {
                    throw new ReferenceError('Filter value missing');
                } else if (typeof value !== 'string') {
                  throw new TypeError('Filter value must be a string.')
                } else {
                  try {
                    new RegExp(value)
                    return true;
                  } catch (e) {
                    return false;
                  }
                }
                
                break;
        }
    },
    
    // Checks whether config.coordinates.elevation is in the range of acceptable elevations
    //  @param  {number} longitude The given elevation in meters
    //  @return {boolean} true if elevation is between RANGERANGERANGERANGE false otherwise
    validateCoordinatesElevation(elevation){
        /*
         * later
         */
    },
    
    // Checks whether config.coordinates.lat is in the range of acceptable latitudes
    //  @param  {number} latitude The given latitude in degrees
    //  @return {boolean} true if latitude is between RANGERANGERANGERANGE false otherwise
    validateCoordinatesLat(latitude){
        /*
         * later
         */
    },
    
    // Checks whether config.coordinates.long is in the range of acceptable longitudes
    //  @param  {number} longitude The given longitude in degrees
    //  @return {boolean} true if longitude is between RANGERANGERANGERANGE false otherwise
    validateCoordinatesLong(longitude){
        /*
         * later
         */
    },
}