'use strict'

/** @fileoverview A collection of utility functions. */
module.exports = {
  // Gets the element from a sorted list closest to the given element.
  //  @param {object} elem The given object to be compared for similarity against
  //  @param {object[]} list The sorted list to be searched for the most similar element
  //  @param {function} compare The comparison function
  //    @param  {object} elem1 The first element to be compared
  //    @param  {object} elem2 The second element to be compared
  //    @return {number} A negative value if elem1 comes before elem2 otherwise a positive value
  //  @param  {object} lastComparison Only used in recursive calls
  //  @param  {number} offset Only used in recursive calls
  //  @return {object} The index of the most similar element in list to elem
  getClosestIndex (elem, list, compare, lastComparison = { comparison: Infinity, idx: null, offset: 0 }, offset = 0) {
    if (!(list instanceof Array)) {
      throw new TypeError('Param list must be an Array')
    }

    if (!(compare instanceof Function)) {
      throw new TypeError('Param compare must be a Function')
    }

    if (!list.length) {
      throw new RangeError('Cannot find closest element from empty list.')
    }

    const midpoint = Math.floor(list.length / 2)
    const currentComparison = {
      comparison: compare(elem, list[midpoint]),
      idx: midpoint,
      offset: offset
    }

    if (Math.abs(lastComparison.comparison) < Math.abs(currentComparison.comparison)) {
      return lastComparison.idx + lastComparison.offset
    }

    let newList

    if (currentComparison.comparison < 0) {
      newList = list.slice(0, midpoint)
    } else {
      offset += midpoint + 1
      newList = list.slice(midpoint + 1, list.length)
    }

    if (!newList.length) {
      return midpoint + offset - 1
    }

    return this.getClosestIndex(elem, newList, compare, currentComparison, offset)
  },

  // Gets the number of days between 2 dates
  //  @param  {Date} date1 A valid date
  //  @param  {Date} date2 A valid date
  //  @return {number} The number of days between date1 and date2. A negative number if date2 came before date1.
  getDaysBetween (date1, date2) {
    if (!(date1 instanceof Date)) {
      throw new TypeError('First argument not a date')
    }

    if (!(date2 instanceof Date)) {
      throw new TypeError('Second argument not a date')
    }

    return (date2 - date1) / (1000 * 60 * 60 * 24)
  },

  // Gets the value referenced by path in object
  //  @param  {object} object An object
  //  @param  {string} path A string consisting of object keys delimited by periods
  //  @return The value at path if it exists
  //  @throws {ReferenceError} On finding that the path is invalid
  getValue (object, path) {
    if (typeof path !== 'string') {
      throw new TypeError('Param path must be a string')
    }

    if (!(object instanceof Object)) {
      throw new TypeError('Param object must be an object')
    }

    if (!path.length) {
      return object
    }

    let match,
        key,
        node = object
        
    if(match = path.match(/^([_\$a-zA-Z][_\$a-zA-Z0-9]*)/)){// check for key without dot
      key = match[1]
      path = path.substr(key.length)
      
      node = node[key]
      
      if (node === undefined) {
        throw new ReferenceError('Invalid path')
      }
    }
    
    while(path){
      if(match = path.match(/^\.([_\$a-zA-Z][_\$a-zA-Z0-9]*)/)){// dot accessor
        key = match[1]
        path = path.substr(key.length + 1)
      } else if(match = path.match(/^\[['"]((?:[_\$a-zA-Z][_\$a-zA-Z0-9]*|[0-9]+))['"]\]/)){// bracket accessor with key
        key = match[1]
        path = path.substr(key.length + 4)
      } else if(match = path.match(/^\[([0-9]+)\]/)){// array index accessor
        key = match[1]
        path = path.substr(key.length + 2)
      } else {
        throw new SyntaxError(`Could not parse object accessor from:${path}`)
      }
      
      node = node[key]
      
      if (node === undefined) {
        throw new ReferenceError('Invalid path')
      }
    }
    
    return node
  },

  // Generates an object that executes onChange when the values in the object change
  // From https://davidwalsh.name/watch-object-changes
  //  @param  {object} obj The object to be watched for changes
  //  @param  {function} onChange The function to be executed when values inside obj change
  //  @return {Proxy} obj as a Proxy that reacts to change
  getWatchedObject (obj, onChange) {
    if (!(obj instanceof Object)) {
      throw new TypeError('Param obj must be an object.')
    }

    if (!(onChange instanceof Function)) {
      throw new TypeError('Param onChange must be a function.')
    }

    const handler = {
      get (target, property, receiver) {
        try {
          if (!(target[property] instanceof Date)) {
            return new Proxy(target[property], handler)
          } else {
            return target[property]
          }
        } catch (err) {
          return Reflect.get(target, property, receiver)
        }
      },

      defineProperty (target, property, descriptor) {
        const changed = Reflect.defineProperty(target, property, descriptor)

        if (changed) {
          onChange()
        }

        return changed
      },

      deleteProperty (target, property) {
        const changed = Reflect.deleteProperty(target, property)

        if (changed) {
          onChange()
        }

        return changed
      }
    }

    return new Proxy(obj, handler)
  },

  // Picks a random element out of an array
  //  @param  {array} arr An array to pick random elements from
  //  @return {object} The element from arr chosen at random
  pickRandom (arr) {
    if (!(arr instanceof Array)) {
      throw new TypeError('Param arr must be an Array')
    }

    if (!arr.length) {
      throw new Error('Cannot pick random member of empty array')
    }

    return arr[Math.floor(Math.random() * arr.length)]
  },

  // Rounds a date to the nearest minute
  //  @param  {Date} date The date to be rounded
  //  @return {Date} A new Date rounded to the nearest minute of date
  roundMinutes (date) {
    if (!(date instanceof Date)) {
      throw new TypeError('Param date must be a Date object')
    }

    if (Number.isNaN(date.getTime())) {
      throw new RangeError('Param date not a valid Date')
    }

    const dateRounded = new Date(date)

    if (dateRounded.getMilliseconds() > 500) {
      dateRounded.setSeconds(dateRounded.getSeconds() + 1)
    }

    dateRounded.setMilliseconds(0)

    if (dateRounded.getSeconds() > 30) {
      dateRounded.setMinutes(dateRounded.getMinutes() + 1)
    }

    dateRounded.setSeconds(0)

    return dateRounded
  },

  // Converts an angle in degrees to radians
  //  @param  {number} deg The degree representation of an angle
  //  @return {number} The radian representation of deg
  toRadians (deg) {
    return deg * Math.PI / 180
  },

  // Validates that each member of an object isn't null
  //  @param  {object} object The javascript object to be validated
  //  @param  {string} Only used for recursive calls
  //  @throws {Error} An error on discovering a member of an object has value NaN null or undefined
  validateNotNull (object, path) {
    if (!(object instanceof Object)) {
      throw new TypeError('Param "object" must be a javascript Object')
    }

    for (const key in object) {
      const value = object[key]

      if (value instanceof Object) {
        const newPath = (`${path}.${key}`[0] === '.') ? key : `${path}.${key}`
        this.validateNotNull(value, newPath)
      } else if (!value && value !== 0) {
        throw new Error(`Member ${path}.${key} of object is ${value}`)
      }
    }
  }
}
