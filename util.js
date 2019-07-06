/** @fileoverview A collection of utility functions. */
module.exports = {
    //Converts UTC hours into CST hours
    //  @param {String} UTC A 2 digit number representing hours at UTC time
    //  @return {String} A 2 digit number representing the input UTC hours converted to central time
    getCST: function(UTC){
        let offsetHour = parseInt(UTC) - 6;
        let CST = offsetHour >= 0 ? offsetHour : offsetHour + 24;
        
        return ('0' + CST).substr(-2);
    },
    
    //Picks a random element out of an array
    //  @param {Array} arr An array to pick random elements from
    //  @return {Object} The element from arr chosen at random
    pickRandom(arr){
        if(arr.length === 0){
            throw new Error('Cannot pick random member of empty array');
        }
        
        return arr[Math.floor(Math.random() * arr.length)];
    },
    
    //Validates that each member of an object isn't null
    //  @param {Object} object The javascript object to be validated
    //  @param {String} path The key path up to object. Used for recursive calls. Initially ''
    //  @throws {Error} An error on discovering a member of an object has value NaN null or undefined.
    validateNotNull: function(object, path){
        for(let key in object){
            const value = object[key];
            
            if(typeof value === 'object'){
                let newPath = (`${path}.${key}`[0] === '.') ? key : `${path}.${key}`;
                this.validateNotNull(value, newPath);
            } else if(value === undefined || value === null || value === NaN){
                throw new Error(`Member ${path}.${key} of object is ${value}`);
            }
        }
    }
}