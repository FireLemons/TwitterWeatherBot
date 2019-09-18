const _ = require('lodash')
const configFieldValidator = require('./configFieldValidator.js')
const fs = require('fs')
const readline = require('readline')
const weatherTools = require('../weather.js')

const consoleIO = readline.createInterface({
  input: process.stdin,
  output: process.stdout,

  completer: function (line) {
    const completions = ['.exit', 'false', 'null', 'true']
    const matchingCompletions = completions.filter((c) => c.startsWith(line))

    return [matchingCompletions, line]
  }
})

const config = {}

const fields = {
  logDir: {
    type: 'string',
    prompt: 'Enter a path to a directory to store logs(relative to index.js)',
    validate: configFieldValidator.validateLogLogDir,
    failValidate: 'Not a valid path'
  },

  OWMKey: {
    type: 'string',
    prompt: 'openweathermap api key:',
    validate: configFieldValidator.validateNotEmptyString,
    failValidate: 'The api key cannot be empty or exclusively whitespace'
  },
  OWMLocationParam: {
    type: 'integer',
    prompt: 'There are 5 ways to specify location for forecasts.\n  1. City name & country code\n  2. City ID(Recommended)\n  3. Coordinates\n  4. Zip code & country code',
    validate: (num) => { return num === Math.floor(num) && num > 0 && num < 5 },
    failValidate: 'Invalid option. Pick a set of paramters for specifing location. 1,2,3, or 4'
  },
  OWMLocationCityName: {
    type: 'string',
    prompt: 'Enter CITY_NAME,COUNTRY_CODE following that exact format',
    validate: configFieldValidator.validateOWMCityNameParam,
    failValidate: 'Invalid format. The valid format is CITY_NAME,COUNTRY_CODE. e.g. "New York,US"'
  },
  OWMLocationCityID: {
    type: 'integer',
    prompt: 'Enter a city id. A city\'s id can be found by searching for the city on openweathermap.org and copying it from the url.\nFor example London\'s url is https://openweathermap.org/city/2643743. Its id is 2643743',
    validate: (num) => { return num >= 0 },
    failValidate: 'Invalid ID. City IDs must be positive.'
  },
  OWMLocationLat: {
    type: 'number',
    prompt: 'Latitude:',
    validate: configFieldValidator.validateCoordinatesLat,
    failValidate: 'Out of range. Latitudes are between -90 and 90 degrees'
  },
  OWMLocationLong: {
    type: 'number',
    prompt: 'Longitude:',
    validate: configFieldValidator.validateCoordinatesLong,
    failValidate: 'Out of range. Longitudes are between -180 and 180 degrees'
  },
  OWMLocationZip: {
    type: 'string',
    prompt: 'Enter ZIP_CODE,COUNTRY_CODE following that exact format',
    validate: configFieldValidator.validateOWMZipCodeParam,
    failValidate: 'Invalid format. The valid format is ZIP_CODE,COUNTRY_CODE e.g. "12345,US"'
  },

  twitterConsumerKey: {
    type: 'string',
    prompt: 'Twitter consumer key:',
    validate: configFieldValidator.validateNotEmptyString,
    failValidate: 'The consumer key can not be empty or only whitespace'
  },
  twitterConsumerSecret: {
    type: 'string',
    prompt: 'Twitter consumer secret:',
    validate: configFieldValidator.validateNotEmptyString,
    failValidate: 'The consumer secret can not be empty or only whitespace'
  },
  twitterAccessTokenKey: {
    type: 'string',
    prompt: 'Twitter access token key:',
    validate: configFieldValidator.validateNotEmptyString,
    failValidate: 'The access token key can not be empty or only whitespace'
  },
  twitterAccessTokenSecret: {
    type: 'string',
    prompt: 'Twitter access token secret:',
    validate: configFieldValidator.validateNotEmptyString,
    failValidate: 'The access token secret can not be empty or only whitespace'
  },

  extraEnable: {
    type: 'boolean',
    prompt: 'Enable extra statements?\nExtra statements are appended to regular forecast tweets and include information like humidity and the phase of the moon',
    validate: () => true,
    failValidate: ''
  },
  extraCoordElevation: {
    type: 'number',
    prompt: 'Elevation in meters:',
    validate: configFieldValidator.validateCoordinatesElevation,
    failValidate: 'Out of range. Valid points of elevation are between -413m and 8848m'
  },
  extraJokeChance: {
    type: 'integer',
    prompt: 'Weight for jokes(low weight recommended):',
    validate: (num) => configFieldValidator.validateProbability(num) > 0,
    failValidate: 'The weight must be positive'
  },
  extraTutorialChance: {
    type: 'integer',
    prompt: 'Tutorial messages show what the forecast icons mean.\nWeight for tutorials(low weight recommended):',
    validate: (num) => configFieldValidator.validateProbability(num) > 0,
    failValidate: 'The weight must be positive'
  },
  extraLunarChance: {
    type: 'integer',
    prompt: 'Weight for moon phase:',
    validate: (num) => configFieldValidator.validateProbability(num) > 0,
    failValidate: 'The weight must be positive'
  },
  extraSeasonChance: {
    type: 'integer',
    prompt: 'Season progress shows days since the last equinox/solstice and days until the next equinox/solstice\nWeight for season progress:',
    validate: (num) => configFieldValidator.validateProbability(num) > 0,
    failValidate: 'The weight must be positive'
  },
  extraSunriseChance: {
    type: 'integer',
    prompt: 'Weight for sunrise/sunset:',
    validate: (num) => configFieldValidator.validateProbability(num) > 0,
    failValidate: 'The weight must be positive'
  },
  extraBeaufortChance: {
    type: 'integer',
    prompt: 'The Beaufort scale describes the current wind intensity empirically.\nWeight for beaufort:',
    validate: (num) => configFieldValidator.validateProbability(num) > 0,
    failValidate: 'The weight must be positive'
  },
  extraCloudinessChance: {
    type: 'integer',
    prompt: 'Weight for cloudiness:',
    validate: (num) => configFieldValidator.validateProbability(num) > 0,
    failValidate: 'The weight must be positive'
  },
  extraHumidityChance: {
    type: 'integer',
    prompt: 'Weight for humidity:',
    validate: (num) => configFieldValidator.validateProbability(num) > 0,
    failValidate: 'The weight must be positive'
  },
  extraPrecipitationChance: {
    type: 'integer',
    prompt: 'Weight for precipitation:',
    validate: (num) => configFieldValidator.validateProbability(num) > 0,
    failValidate: 'The weight must be positive'
  },
  extraPressureChance: {
    type: 'integer',
    prompt: 'Weight for pressure:',
    validate: (num) => configFieldValidator.validateProbability(num) > 0,
    failValidate: 'The weight must be positive'
  },

  alertsEnable: {
    type: 'boolean',
    prompt: 'Enable weather alerts?\nWeather alerts are supported only for the Unites States at the moment',
    validate: () => true,
    failValidate: ''
  },
  alertsAppContact: {
    type: 'string',
    prompt: 'Email:',
    validate: configFieldValidator.validateAlertsAppContact,
    failValidate: 'Invalid email'
  },
  alertsAppName: {
    type: 'string',
    prompt: 'App Name:',
    validate: configFieldValidator.validateNotEmptyString,
    failValidate: 'App name can not be empty or only whitespace'
  },
  alertsAppVersion: {
    type: 'string',
    prompt: 'App Version:',
    validate: configFieldValidator.validateNotEmptyString,
    failValidate: 'App version can not be empty or only whitespace'
  },
  alertsAppWebsite: {
    type: 'string',
    prompt: 'App Website(any website is fine but try to keep it relevant):',
    validate: configFieldValidator.validateAlertsAppWebsite,
    failValidate: 'Invalid url'
  },

  alertsParamKey: {
    type: 'string',
    prompt: 'Key(Enter "" to stop entering parameters):',
    validate: (key) => {// Verify there's at least 1 parameter
      if(!key){
        let params = _.get(config, 'weather.alerts.params')
        return params && Object.keys(params).length
      }
      
      return true;
    },
    failValidate: 'Requesting alerts won\'t work without at least 1 parameter'
  },
  alertsParamValue: {
    type: 'any',
    prompt: 'Value:',
    validate: () => true,
    failValidate: ''
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
//  param  {object} validator A validator object in fields[] above
//  return {boolean} True if input is valid false otherwise
function validateField (input, validator) {
  const { type, validate, failValidate } = validator
  if (!(type === 'any')) {
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

let currentField

// Prompts the user to enter a field value for the config
//  param  {string} field The key to the object related to the field in fields[]
function promptField (field) {
  currentField = fields[field]
  console.log(`\n${currentField.prompt}`)
  consoleIO.setPrompt(`[${currentField.type}] >`)
  consoleIO.prompt()
}

function * generate () {
  promptField('logDir')
  _.set(config, 'log.logDir', yield)

  promptField('OWMKey')
  _.set(config, 'weather.openWeatherMap.key', yield)

  promptField('OWMLocationParam')
  currentField = fields['OWMLocationParam']

  switch (yield) {
    case 1:// City name
      promptField('OWMLocationCityName')
      _.set(config, 'weather.openWeatherMap.location.q', yield)

      break
    case 2:// City ID
      promptField('OWMLocationCityID')
      _.set(config, 'weather.openWeatherMap.location.id', yield)

      break
    case 3:// Coordinates
      promptField('OWMLocationLat')
      _.set(config, 'weather.openWeatherMap.location.lat', yield)

      promptField('OWMLocationLong')
      _.set(config, 'weather.openWeatherMap.location.long', yield)

      break
    case 4:// Zip code
      promptField('OWMLocationZip')
      _.set(config, 'weather.openWeatherMap.location.zip', yield)

      break
    default:
      console.log('ERROR: Unsupported option selected')
      process.exit(0)
      break
  }

  promptField('twitterConsumerKey')
  _.set(config, 'twitter.consumer_key', yield)

  promptField('twitterConsumerSecret')
  _.set(config, 'twitter.consumer_secret', yield)

  promptField('twitterAccessTokenKey')
  _.set(config, 'twitter.access_token_key', yield)

  promptField('twitterAccessTokenSecret')
  _.set(config, 'twitter.access_token_secret', yield)

  // Configure extras
  promptField('extraEnable')
  _.set(config, 'extra.disabled', !(yield))

  if (!config.extra.disabled) {
    console.log('\nAvailable extras are: jokes, tutorials, moon phase, season progress, sunrise/sunset, beaufort, cloudiness, humidity, precipitation, and pressure\n')
    console.log('The probability of each type of extra showing up is set by a weight. The probability of a type of extra showing up is its weight / sum of all weights.')
    console.log('Setting all weights to 0 causes an error.\n')

    promptField('extraJokeChance')
    _.set(config, 'extra.probabilities.joke', yield)

    promptField('extraTutorialChance')
    _.set(config, 'extra.probabilities.tutorial', yield)

    promptField('extraLunarChance')
    _.set(config, 'extra.probabilities.lunar', yield)

    promptField('extraSeasonChance')
    _.set(config, 'extra.probabilities.season', yield)

    promptField('extraSunriseChance')
    _.set(config, 'extra.probabilities.sunrise', yield)

    promptField('extraBeaufortChance')
    _.set(config, 'extra.probabilities.beaufort', yield)

    promptField('extraCloudinessChance')
    _.set(config, 'extra.probabilities.cloudiness', yield)

    promptField('extraHumidityChance')
    _.set(config, 'extra.probabilities.humidity', yield)

    promptField('extraPrecipitationChance')
    _.set(config, 'extra.probabilities.precipitation', yield)

    promptField('extraPressureChance')
    _.set(config, 'extra.probabilities.pressure', yield)

    console.log('Some extras need coordinates to work like sunrise/sunset. Attempting to fetch coordinates from openweathermap...')
    const w = new weatherTools.DataFetcher(config.weather, { error: () => {}, info: () => {} })

    consoleIO.pause()// Disable user input while async request is running
    w.getForecastPromise().then((forecastData) => {
      console.log(`${JSON.stringify(forecastData.city.coord)} are the correct coordinates?`)
      currentField.type = 'boolean'
      consoleIO.setPrompt('boolean>')
      consoleIO.prompt()
    }).catch((error) => {
      console.log('Failed to fetch coordinates from openWeatherMap. This may indicate the openWeatherMap api key or forecast location were filled out incorrectly.')
      console.log(error)

      console.log('\nYou can still enter the coordinates manually')
      if (configGenerator.next(false).done) {
        consoleIO.close()
      }
    }).finally(() => {
      consoleIO.resume()
    })

    if (!(yield)) {
      promptField('OWMLocationLat')
      _.set(config, 'weather.openWeatherMap.location.lat', yield)

      promptField('OWMLocationLong')
      _.set(config, 'weather.openWeatherMap.location.long', yield)
    }

    promptField('extraCoordElevation')
    _.set(config, 'extra.coordinates.elevation', yield)
  }// End configuring extras

  // Configure alerts
  promptField('alertsEnable')
  _.set(config, 'weather.alerts.disabled', !(yield))

  if (!config.weather.alerts.disabled) {
    console.log('To fetch alert data, the National Weather Service requires a header containing: an app name, an app version, a website, and an email address they can contact')

    promptField('alertsAppName')
    _.set(config, 'weather.alerts.app.name', yield)

    promptField('alertsAppVersion')
    _.set(config, 'weather.alerts.app.version', yield)

    promptField('alertsAppWebsite')
    _.set(config, 'weather.alerts.app.website', yield)

    promptField('alertsAppContact')
    _.set(config, 'weather.alerts.app.contact', yield)

    console.log('Enter get request parameters for api.weather.gov/alerts in the form of key value pairs\n')
    console.log('For example api.weather.gov/alerts?area=MO has key "area" and value "MO"\n')
    console.log('Not sure what parameters to enter?')
    console.log('Requests with various parameters can be tested at https://www.weather.gov/documentation/services-web-api#/default/get_alerts under the "Specification" tab')

    let key
    let value

    do {
      promptField('alertsParamKey')
      key = yield

      if (!key) {
        break
      }

      promptField('alertsParamValue')
      value = yield

      _.set(config, `weather.alerts.params.${key}`, value)
    } while (key.length)
  }

  console.log(JSON.stringify(config))
}

const configGenerator = generate()

console.log('\nWelcome to the twitterWeatherBot config generator.\n')
console.log('Type .exit at any time to abort\n')
console.log('Simply fill out the fields with either')
console.log('  a string(surrounded by quotes) ""\n  an integer -12\n  any number -0.2\n  a boolean true or false\n  or null(not recommended)\n')
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
