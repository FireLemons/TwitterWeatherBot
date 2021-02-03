# TwitterWeatherBot
My personal twitter weather bot

Basic features:  
+ Tweet a forecast for the near future every 2 hours  
+ Add a random weather fact to the 2 hour forecast  
+ Tweet alerts from the NWS  
+ Retweet all tweets from the local weather station
  
## Configuration  
### Required Configuration:  
#### Logging  
Set the dierctory path where logs will be stored.
Paths are relative to `index.js`.  

    "log": {
      "logDir": "logs"
    }
  
#### Open Weather Map  
To set the forecast area, set `config.weather.openWeatherMap.location` to one of the key value pair combinations below.  

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

set `config.weather.openWeatherMap.key` to your openWeatherMap api key  
  
Example

    "weather":{
      "openWeatherMap": {
        "location": {
          "id": 4381982
        },
        "key": "YOUR API KEY"
      }
    }

#### Twitter  
All four values of `config.twitter` shown below will be keys generated from your twitter developer account.

    "twitter": {
      "consumer_key": "CONSUMER KEY",
      "consumer_secret": "CONSUMER SECRET",
      "access_token_key": "ACCESS TOKEN KEY",
      "access_token_secret": "ACCESS TOKENM SECRET"
    }

### Optional Configuration:  
#### Alerts  
Alerts are sent out at midnight, 6:00, noon, and 18:00.  
In order to receive alert data from the national weather service, a header containing a email to contact you, an app name, an app version, and a website must be included with each request. These are specified in `config.weather.alerts.app`  
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

##### Alert Filters
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

#### Extra Messages  
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
      },
      ...
    }
  
The avaialable message types are  
 - __joke__ Fetches a random joke from `data/jokes.json`'s "general" array
 - __tutorial__ Mostly tells what weather conditions forecast icons correspond to.
 - __lunar__ Tells the current phase of the moon
 - __season__ Tells the number of days between the latest solstice/equinox and the next solstice/equinox
 - __sunrise__ At day tells sunset and sunrise times and day length. At night tells last sunset and next sunrise and night length.
 - __beaufort__ Describes the current wind speed using the [Beaufort scale](https://en.wikipedia.org/wiki/Beaufort_scale)
 - __records__ Tells the hottest temperature, the coldest temperature, or the most precipitation that has ever occoured on the current day of the year.
 - __cloudiness__ Forecasted %cloudiness for the next 9 hours same as the main forecast
 - __humidity__ Forecasted %humidity for the next 9 hours same as the main forecast
 - __precipitation__ Forecasted precipitation in mm for the next 9 hours same as the main forecast. If there is no precipitation cloudiness, humidity, or pressuire is displayed instead.
 - __pressure__ Forecasted pressure in hectopascals for the next 9 hours same as the main forecast.  
  
The probability of each type of message showing up is set by a weight. The probability of a message type showing up is its weight / sum of all weights.  
  
Setting all weights to 0 and having extras enabled causes an error.  
  
Example:  
The sum of all the weights is 100. Jokes have 1/100 chance of showing up. Moon phase messages have a 15/100 chance of showing up.

    "extra":{
      ...
      "probabilities":{
        "joke": 1,
        "tutorial": 9,
        "lunar": 15,
        "season": 5,
        "sunrise": 15,
        "beaufort": 10,
        "records": 0,
        "cloudiness": 10,
        "humidity": 10,
        "precipitation": 15,
        "pressure": 10
      }
    }

Extras can be disabled with:  

    "extra":{
      "disabled": true,
      ...
    }

#### Retweets  
`config.twitter.localStationHandle` cna be set to a local weather station's twitter handle to retweet all their tweets every hour on the 30 minute mark.  
  
Example:  

    "twitter": {
      ...
      "localStationHandle": "NWSStLouis"
    }
