const _ = require('lodash')
const configFieldValidator = require('./configFieldValidator.js')
const fs = require('fs')
const readline = require('readline')

const consoleIO = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

const config = {}

const validators = {
  logDir: {
    type: 'string',
    validate: configFieldValidator.validateLogLogDir,
    failValidate: 'Log directory is not a valid path'
  },

  OWMKey: {
    type: 'string',
    validate: configFieldValidator.validateNotEmptyString,
    failValidate: 'OpenWeatherMap key cannot be empty string or exclusively whitespace'
  },
  OWMLocationParam: {
    type: 'integer',
    validate: (num) => { return num === Math.floor(num) && num > 0 && num < 5 },
    failValidate: 'Invalid option. Pick a set of paramters for specifing location. 1,2,3, or 4'
  },
  OWMLocationCityName: {
    type: 'string',
    validate: configFieldValidator.validateOWMCityNameParam,
    failValidate: 'Invalid format. The valid format is CITY_NAME,COUNTRY_CODE. e.g. "New York,US"'
  },
  OWMLocationCityID: {
    type: 'integer',
    validate: (num) => { return num >= 0 },
    failValidate: 'Invalid ID. A list of valid city ids can be downloaded at http://bulk.openweathermap.org/sample/city.list.json.gz'
  },
  OWMLocationLat: {
    type: 'number',
    validate: configFieldValidator.validateCoordinatesLat,
    failValidate: 'Number is outside the range of acceptable latitudes. Latitudes are between -90 and 90 degrees'
  },
  OWMLocationLong: {
    type: 'number',
    validate: configFieldValidator.validateCoordinatesLong,
    failValidate: 'Number is outside the range of acceptable longitudes. Latitudes are between -180 and 180 degrees'
  },
  OWMLocationZip: {
    type: 'string',
    validate: configFieldValidator.validateOWMZipCodeParam,
    failValidate: 'Invalid format. The valid format is ZIP_CODE,COUNTRY_CODE e.g. "12345,US"'
  },

  twitterConsumerKey: {
    type: 'string',
    validate: configFieldValidator.validateNotEmptyString,
    failValidate: "Twitter's consumer key can not be exclusively whitespace"
  },
  twitterConsumerSecret: {
    type: 'string',
    validate: configFieldValidator.validateNotEmptyString,
    failValidate: "Twitter's consumer secret can not be exclusivley whitespace"
  },
  twitterAccessTokenKey: {
    type: 'string',
    validate: configFieldValidator.validateNotEmptyString,
    failValidate: "Twitter's access token key can not be exclusivley whitespace"
  },
  twitterAccessTokenSecret: {
    type: 'string',
    validate: configFieldValidator.validateNotEmptyString,
    failValidate: "Twitter's access token secret can not be exclusivley whitespace"
  }
}

// Takes user input and casts it to the correct type
//  param  {string} input The input to be parsed
//  return {any} The parsed input
//  throws TypeError on failure to parse input
function parseInput (input) {
  const inputLength = input.length

  if (inputLength > 1 && input.charAt(0) === '"' && input.charAt(inputLength - 1) === '"') { // strings
    return input.substr(1, inputLength - 2)
  } else if (/^[0-9]+$/.test(input)) { // integers
    return parseInt(input)
  } else if (input === 'false') { // booleans
    return false
  } else if (input === 'true') {
    return true
  } else if (input === 'null') { // null
    return null
  } else { // floats or error
    const inputAsFloat = parseFloat(input)

    if (isNaN(inputAsFloat)) {
      throw new TypeError(`Could not determine type of ${input}\n\nSupported types are:\n  string(surrounded by double quotes) ""\n  integer -12\n  number -0.2\n  boolean true or false\n  or null`)
    } else {
      return inputAsFloat
    }
  }
}

// Takes parsed user input and determines if it's a valid value for a field
//  param  {any} input The input parsed by parseInput to be validated
//  param  {object} validator A validator object in validators[] above
//  return {boolean} True if input is valid false otherwise
function validateField (input, validator) {
  const { type, validate, failValidate } = validator
  if (!(type === '*')) {
    switch (type) {
      case 'string':
        if (typeof input !== 'string') {
          console.log('ERROR: input must be a string')
          return false
        }
        break
      case 'integer':
        if (isNaN(input) || Math.floor(input) !== input) {
          console.log('ERROR: input must be an integer')
          return false
        }
        break
      case 'number':
        if (isNaN(input)) {
          console.log('ERROR: input must be a number')
          return false
        }
        break
      case 'boolean':
        if (input !== true && input !== false) {
          console.log('ERROR: input must be a boolean')
          return false
        }
        break
    }
  }

  if (!validate(input)) {
    console.log(`ERROR: ${failValidate}`)
    return false
  }

  return true
}

let currentField = validators['logDir']

function * generate () {
  console.log('Enter a path to a directory to store logs')
  consoleIO.setPrompt('[string] >')
  consoleIO.prompt()
  _.set(config, 'log.logDir', yield)

  currentField = validators['OWMKey']
  console.log('Enter your openWeatherMap api key')
  consoleIO.setPrompt('[string] >')
  consoleIO.prompt()
  _.set(config, 'weather.openWeatherMap.key', yield)

  currentField = validators['OWMLocationParam']
  console.log('There are 5 ways to specify location for forecasts.')
  console.log('  1. City name & country code\n  2. City ID\n  3. Coordinates\n  4. Zip code & country code')
  consoleIO.setPrompt('[integer] >')
  consoleIO.prompt()

  switch (yield) {
    case 1:// City name
      currentField = validators['OWMLocationCityName']
      console.log('Enter a string in the format CITY_NAME,COUNTRY_CODE')
      consoleIO.setPrompt('[string] >')
      consoleIO.prompt()
      _.set(config, 'weather.openWeatherMap.location.q', yield)

      break
    case 2:// City ID
      currentField = validators['OWMLocationCityID']
      console.log('Enter a city id')
      consoleIO.setPrompt('[integer] >')
      consoleIO.prompt()
      _.set(config, 'weather.openWeatherMap.location.id', yield)

      break
    case 3:// Coordinates
      currentField = validators['OWMLocationLat']
      console.log('Enter the latitude of the area to generate forecasts for')
      consoleIO.setPrompt('[number] >')
      consoleIO.prompt()
      _.set(config, 'weather.openWeatherMap.location.lat', yield)

      currentField = validators['OWMLocationLong']
      console.log('Enter the longitude of the area to generate forecasts for')
      consoleIO.setPrompt('[number] >')
      consoleIO.prompt()
      _.set(config, 'weather.openWeatherMap.location.long', yield)

      break
    case 4:// Zip code
      currentField = validators['OWMLocationZip']
      console.log('Enter a string in the format ZIP_CODE,COUNTRY_CODE')
      consoleIO.setPrompt('[string] >')
      consoleIO.prompt()
      _.set(config, 'weather.openWeatherMap.location.zip', yield)

      break
    default:
      console.log('ERROR: Unsupported option selected')
      process.exit(0)
      break
  }

  console.log(JSON.stringify(config))

  /* consoleIO.question('Yes or No', function(line){
    if(line && /^[Yy]/.test(line.charAt(0))){
      console.log('ya beb')
    } else {
      console.log('na beb')
    }

    consoleIO.close()
  }) */
}

const configGenerator = generate()

console.log('\nWelcome to the twitterWeatherBot config generator.\n')
console.log('Type .exit at any time to abort\n')
console.log('Simply fill out the fields with either')
console.log('  a string(surrounded by quotes) ""\n  an integer -12\n  any number -0.2\n  a boolean true or false\n  or null(not recommended)\n\n')
configGenerator.next()

consoleIO.on('line', function (line) {
  if (line === '.exit') {
    consoleIO.close()
  } else {
    try {
      const parsedInput = parseInput(line)

      if (validateField(parsedInput, currentField)) {
        if (configGenerator.next(parsedInput).done) {
          consoleIO.close()
        }
      } else {
        console.log('Try again\n')
        consoleIO.prompt()
      }
    } catch (e) {
      console.log(e.message)
      console.log('Try again\n')
      consoleIO.prompt()
    }
  }
}).on('close', () => {
  process.exit(0)
})
