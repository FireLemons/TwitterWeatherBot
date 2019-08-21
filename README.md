# WORK IN PROGRESS
# TwitterWeatherBot

A bot that will tweet the weather every 2 hours and works for most cities in the United States. Other optional tweets like alerts and local weather station retweets are available. Check the [configuration](#configuration) section for more info.

## Getting Started
Api keys from Twitter and OpenWeatherMap are needed.  
+ [Register for an OpenWeatherMap developer account](https://home.openweathermap.org/users/sign_up)
+ [Register for a Twitter developer account](https://developer.twitter.com/en/apply)

This service runs on [Node.js](https://nodejs.org/en/download/).  
After cloning, run `npm install` where `package.json` is which should be the root project directory.  
Configure `config.json` with your location and api keys.  

__❗❗❗Make sure `config.json` is not tracked by git. If `git status` shows your config as `modified`, use `git update-index --assume-unchanged config.json` to untrack it. Having the file tracked may expose your API keys.__

## Included Node Packages  
### Dependencies  
[lune](https://www.npmjs.com/package/lune/v/0.4.0) calculates moon phases.  
[Node Schedule](https://www.npmjs.com/package/node-schedule) like cron.  
[Node Windows](https://www.npmjs.com/package/node-windows)  
[Twitter for Node.js](https://www.npmjs.com/package/twitter)  
[Winston](https://www.npmjs.com/package/winston) a logger.  
  
### Developer Dependencies  
[standard js](https://standardjs.com/) A javascript linter.  
[chai js](https://www.chaijs.com/) A BDD / TDD assertion library.  
[mocha js](https://mochajs.org/) A feature-rich JavaScript test framework.  

## Deployment
Running `node index.js` will start up the bot.  
  
vv Not Yet vv  
Running `node windowsInstall.js` will install the bot as a service so it automatically starts when booting your windows machine.  
^^ Planned Feature ^^  
  
### Configuration  
#### Required Configuration:  
##### Logging  
For now the only configuration for logging is to specify a path to where logs will be stored.
The json below will set the logging diectory to `logs/` relative to `index.js`.  

    "log": {
      "logDir": "logs"
    }
  
##### Open Weather Map  
To specify a location for forecasts, `config.weather.openWeatherMap.location` can contain one of the key value pair combinations below.  
Accptable key value pairs are:  

City Name  
`q: "{city name},{country code}"`  
City ID  
A list of city ids can be [downloaded here](http://bulk.openweathermap.org/sample/city.list.json.gz).  
`id: {city id}`  
Geographic Coordinates  
`lat: {lat}`  
`lon: {lon}`  
Zip Code  
`zip: "{zip code},{country code}"`

`config.weather.openWeatherMap.key` will contain the openWeatherMap api key  
  
Example

    "weather":{
      "openWeatherMap": {
        "location": {
          "id": 4381982
        },
        "key": "YOUR API KEY"
      }
    }

##### Twitter  
All four values of `config.twitter` shown below will be keys generated from your twitter developer account.

    "twitter": {
      "consumer_key": "CONSUMER KEY",
      "consumer_secret": "CONSUMER SECRET",
      "access_token_key": "ACCESS TOKEN KEY",
      "access_token_secret": "ACCESS TOKENM SECRET"
    }

##### Extra Messages  
Extra messages are appended at the end of every forecast tweet. They give additional weather information and are picked at random.  
  
Extra messages require coordiantes to work.  
`config.extra.coordinates.elevation` is the elevation in meters  
`config.extra.coordinates.long` is the longitude west(west is negative, east is positive)  
`config.extra.coordinates.lat` is the north latitude(north is positive, south is negative)  

Example:

    "extra":{
      "coordinates": {
        "elevation": 231,
        "long": -92.3341,
        "lat": 38.9517
      }
      ...
    }
  
The avaialable message types are  
 - __Jokes__ Fetches a random joke from `data/jokes.json`'s "general" array
 - __Tutorial Messages__ Mostly tells what weather conditions forecast icons correspond to.
 - __Moon Phases__ Tells the current phase of the moon
 - __Season Progress__ Tells the number of days between the latest solstice/equinox and the next solstice/equinox
 - __Sunrise and Sunset__ At day tells sunset and sunrise times and day length. At night tells last sunset and next sunrise and night length.
 - __Beaufort__ Descibes the current wind speed using the [Beaufort scale](https://en.wikipedia.org/wiki/Beaufort_scale)
 - __Daily Records__ Tells the hottest temperature, the coldest temperature, or the most precipitation that has ever occoured on the current day of the year.
 - __Cloudiness__ Forecasted %cloudiness for the next 9 hours same as the main forecast
 - __Humidity__ Forecasted %humidity for the next 9 hours same as the main forecast
 - __precipitation__ Forecasted precipitation in mm for the next 9 hours same as the main forecast. If there is no precipitation cloudiness, humidity, or pressuire is displayed instead.
 - __Pressure__ Forecasted pressure in hectopascals for the next 9 hours same as the main forecast.  
 
 

#### Optional Configuration:  
##### Alerts  
Alerts are sent out at midnight, 6:00, noon, and 18:00.  
In order to receive alert data from the national weather service, a header containing a contact email, an app name, an app version number, and either a personal website or an app website must be included with each request. These are specified in `config.weather.alerts.app`  
`weather.alerts.params` will contain get parameters to send to api.weather.gov/alerts in the form of key value pairs. More information about valid get paramters and a request tester can be found [here](https://www.weather.gov/documentation/services-web-api#/default/get_alerts) under the "Specification" tab.
  
Example:

    "weather": {
      "alerts": {
        "disabled": false,
        "app": {
          "contact": "yourEmail@example.com",
          "name": "AppName",
          "version": "0.1",
          "website": "www.yourWebsite.com"
        },
        "params": {
          "active": true,
          "area": "MO",
          "status": "actual"
        }
      }
    }

###### Alert Filters
If the request sends back too many alerts, filters can be applied.  
  
Filters are in the form:  

    {
      "restriction":"FILTER TYPE",
      "path": "PATH TO VALUE",
      "value": "VALUE FOR FILTERING",
      "keep": true
    }

where  
 - restriction is the type of filter
 - path is the path in the alert object to the value to be filtered
 - value will be different depending on the filter type
 - keep is true if all alerts matching the filter are to be kept and false if all alerts not matching the filter are to be kept
  
Available filter types:  
 - after  
 Matches alerts with dates after and excluding the time *t* when alerts are tweeted  
 value is a number of hours to offset *t*  
 - before  
 Matches alerts with dates before and excluding the time *t* when alerts are tweeted  
 value is a number of hours to offset *t*  
 - contains  
 Matches alerts with arrays containing VALUE
 value is an element of an array to be searched for. it must be a primitive value  
 - has  
 Matches alerts where PATH in the object exits  
 value is not needed  
 The has filter is always used first
 - equals  
 Matches alerts with VALUE exactly equal to the value at path  
 value is a primitive value to be compared with using strict equality  
 - matches  
 Matches alerts with strings matching a regular expression  
 value contains a regular expression string  
   
Filters go in an array at config.weather.alerts.filters.  
  
Example:  
Keep all alerts where "Boone;" or "Boone, MO" is used to describe the area and discard all alerts that have been replaced by another alert.  

    "weather": {
      "alerts": {
        ...
        "filters": [
          {
            "restriction": "matches",
            "path": "properties.areaDesc",
            "value": "Boone;|Boone, MO;",
            "keep": true
          },
          {
            "restriction": "has",
            "path": "properties.replacedBy",
            "keep": false
          }
        ]
      }
    }

##### Retweets  

## Contributing
A description with your pull request is fine.
Would be appreciated if it could be deployed as a linux service so it automatically starts on boot. 
