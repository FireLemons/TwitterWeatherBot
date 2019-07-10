/** @fileoverview A collection of utility functions. */
module.exports = {
    //Converts UTC hours into CST hours
    //  @param {number} UTC A number representing hours at UTC time
    //  @return {string} A 2 digit number representing the input UTC hours converted to central time
    getCST(UTC){
        if(isNaN(parseFloat(UTC)) || !isFinite(UTC)){
            throw new TypeError('Param UTC must be a number');
        }
        
        if(0 > UTC || UTC > 23){
            throw new RangeError('UTC must be between 0 and 23');
        }
        
        let offsetHour = Math.floor(UTC) - 6,
            CST = offsetHour >= 0 ? offsetHour : offsetHour + 24;
        
        return ('0' + CST).substr(-2);
    },
    
    //Gets the element from a sorted list closest to the given element. 
    //  @param {object} elem The given object to be compared for similarity against
    //  @param {object[]} list The sorted list to be searched for the most similar element
    //  @param {function} compare The comparison function
    //    @param {object} elem1 The first element to be compared
    //    @param {object} elem2 The second element to be compared
    //    @return {number} A negative value if elem1 comes before elem2 otherwise a positive value
    //  @param {object} lastComparison Only used in recursive calls
    //  @param {number} offset Only used in recursive calls
    //  @return {object} The index of the most similar element in list to elem
    getClosestIndex(elem, list, compare, lastComparison = {"comparison": Infinity, "idx": null, "offset": 0}, offset = 0){
        if(!(list instanceof Array)){
            throw new TypeError('Param list must be an Array');
        }
        
        if(!(compare instanceof Function)){
            throw new TypeError('Param compare must be a Function');
        }
        
        if(!list.length){
            throw new RangeError('Cannot find closest element from empty list.');
        }
        
        let midpoint = Math.floor(list.length / 2),
            currentComparison = {
                "comparison": compare(elem, list[midpoint]),
                "idx": midpoint,
                "offset": offset
            };
        
        if(Math.abs(lastComparison.comparison) < Math.abs(currentComparison.comparison)){
            return lastComparison.idx + lastComparison.offset;
        }
        
        let newList;
        
        if(currentComparison.comparison < 0){
            newList = list.slice(0, midpoint);
        } else {
            offset += midpoint + 1;
            newList = list.slice(midpoint + 1, list.length);
        }
        
        if(!newList.length){
            return midpoint + offset - 1;
        }
        
        return this.getClosestIndex(elem, newList, compare, currentComparison, offset);
    },
    
    //Gets the number of days between 2 dates
    //  @param {Date} date1 A valid date
    //  @param {Date} date2 A valid date
    //  @return {number} The number of days between date1 and date2. A negative number if date2 came before date1.
    getDaysBetween(date1, date2){
        if(!(date1 instanceof Date)){
            throw new TypeError('First argument not a date');
        }
        
        if(!(date2 instanceof Date)){
            throw new TypeError('Second argument not a date');
        }
        
        return (date2 - date1) / (1000 * 60 * 60 * 24);
    },
    
    //Generates an object that executes onChange when the values in the object change
    //From https://davidwalsh.name/watch-object-changes
    //  @param {object} obj The object to be watched for changes
    //  @param {function} onChange The function to be executed when values inside obj change
    //  @return {Proxy} obj as a Proxy that reacts to change
    getWatchedObject(obj, onChange){
        if(!(obj instanceof Object)){
            throw new TypeError('Param obj must be an object.');
        }
        
        if(!(onChange instanceof Function)){
            throw new TypeError('Param onChange must be a function.');
        }
        
        const handler = {
            get(target, property, receiver) {
                try {
                    return new Proxy(target[property], handler);
                } catch (err) {
                    return Reflect.get(target, property, receiver);
                }
            },
            defineProperty(target, property, descriptor) {
                onChange();
                return Reflect.defineProperty(target, property, descriptor);
            },
            deleteProperty(target, property) {
                onChange();
                return Reflect.deleteProperty(target, property);
            }
        };
        
        return new Proxy(obj, handler);
    },
    
    //Picks a random element out of an array
    //  @param {array} arr An array to pick random elements from
    //  @return {object} The element from arr chosen at random
    pickRandom(arr){
        if(!(arr instanceof Array)){
            throw new TypeError('Param arr must be an Array');
        }
        
        if(!arr.length){
            throw new Error('Cannot pick random member of empty array');
        }
        
        return arr[Math.floor(Math.random() * arr.length)];
    },
    
    //Validates that each member of an object isn't null
    //  @param {object} object The javascript object to be validated
    //  @param {string} Only used for recursive calls
    //  @throws {Error} An error on discovering a member of an object has value NaN null or undefined
    validateNotNull(object, path){
        if(!(object instanceof Object)){
            throw new TypeError('Param "object" must be a javascript Object');
        }
        
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