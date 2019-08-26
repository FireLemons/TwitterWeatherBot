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


function validateField(input, type, validate, failValidate){
  let valid = true
  
  if(!(type === '*')){
    switch(type){
      case 'string':
        break;
      case 'integer':
        break;
      case 'number':
        break;
      case 'boolean':
        break;
    }
  }
  
  return valid;
}

console.log('\nWelcome to the twitterWeatherBot config generator.\n\nType .exit at any time to abort\n\nSimply fill out the fields with either \n  a string(surrounded by quotes) ""\n  an integer -12\n  any number -0.2\n  a boolean true or false\n  or null\n')
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