const _ = require('lodash')
const configFieldValidator = require('./configFieldValidator.js')
const fs = require('fs');
const readline = require('readline');

const consoleIO = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

let config = {}

let validators = {
  "logDir": {
    "path": "log.logDir",
    "type": "string",
    "validate": configFieldValidator.validateLogLogDir,
    "failValidate": "Log directory is not a valid path"
  },
  
  "twitterConsumerKey":{
    "path": "twitter.consumer_key",
    "type": "string",
    "validate": configFieldValidator.validateNotEmptyString,
    "failValidate": "Twitter's consumer key can not be exclusivley whitespace"
  },
  "twitterConsumerSecret":{
    "path": "twitter.consumer_secret",
    "type": "string",
    "validate": configFieldValidator.validateNotEmptyString,
    "failValidate": "Twitter's consumer secret can not be exclusivley whitespace"
  },
  "twitterAccessTokenKey":{
    "path": "twitter.access_token_key",
    "type": "string",
    "validate": configFieldValidator.validateNotEmptyString,
    "failValidate": "Twitter's access token key can not be exclusivley whitespace"
  },
  "twitterAccessTokenSecret":{
    "path": "twitter.access_token_secret",
    "type": "string",
    "validate": configFieldValidator.validateNotEmptyString,
    "failValidate": "Twitter's access token secret can not be exclusivley whitespace"
  }
}

// Takes user input and casts it to the correct type
//  param  {string} input The input to be parsed
//  return {any} The parsed input
//  throws TypeError on failure to parse input
function parseInput(input){
  let inputLength = input.length
  
  if(inputLength > 1 && input.charAt(0) === '"' && input.charAt(inputLength - 1) === '"'){// strings
    return input.substr(1, inputLength - 2)
  } else if(/^[0-9]+$/.test(input)){// integers
    return parseInt(input);
  } else if(input === 'false'){// booleans
    return false;
  } else if(input === 'true'){
    return true;
  } else if(input === 'null'){// null
    return null
  } else {//floats or error
    let inputAsFloat = parseFloat(input)
    
    if(isNaN(inputAsFloat)){
      throw new TypeError(`Could not determine type of ${input}\n\nSupported types are:\n  string(surrounded by double quotes) ""\n  integer -12\n  number -0.2\n  boolean true or false\n  or null`)
    } else {
      return inputAsFloat
    }
  }
}

// Takes parsed user input and determines if it's a valid value for a field
//  param  {any} input The input parsed by parseInput to be validated
//  param  {string} type The valid type of the input
//  param  {function} validate A function to validate the input beyond the type check
//  param  {string} failValidate An error message to be displayed when validate(input) fails
//  return {boolean} True if input is valid false otherwise
function validateField(input, type, validate, failValidate){
  if(!(type === '*')){
    switch(type){
      case 'string':
        if(typeof input !== type){
          console.log('ERROR: input must be a string')
          return false
        }
        break;
      case 'integer':
        if(isNaN(input) || Math.floor(input) !== input){
          console.log('ERROR: input must be an integer')
          return false
        }
        break;
      case 'number':
        if(isNaN(input)){
          console.log('ERROR: input must be a number')
          return false
        }
        break;
      case 'boolean':
        if(input !== true && input !== false){
          console.log('ERROR: input must be a boolean')
          return false
        }
        break;
    }
  }
  
  if(!validate(input)){
    console.log(`ERROR: ${failValidate}`)
  }
  
  return true;
}

console.log('\nWelcome to the twitterWeatherBot config generator.\n\nType .exit at any time to abort\n\nSimply fill out the fields with either \n  a string(surrounded by quotes) ""\n  an integer -12\n  any number -0.2\n  a boolean true or false\n  or null(not recommended)\n')
consoleIO.setPrompt('>')
consoleIO.prompt()

consoleIO.on('line', function(line) {
  if (line === ".exit"){
    consoleIO.close();
  } else {
    try{
      let parsedInput = parseInput(line)
      console.log(typeof parsedInput)
    } catch(e) {
      console.log(e.message)
    }
  }

  consoleIO.prompt();
}).on('close',() => {
    process.exit(0);
});