# WORK IN PROGRESS
# ColumbiaMOWeatherTweetBot

Tweets weather forecasts twice daily for Columbia MO. Location can be changed in `config.json` for use in other cities. As a side note, I can't imagine why anyone would want this. Seeing as most people have a weather app on their smartphone that shows the weather on the lock screen. Why would anyone check twitter for the weather?

## Getting Started
You'll need api keys from Twitter and OpenWeatherMap which both come with signing up for a developer account.
+ [Register for an OpenWeatherMap developer account](https://home.openweathermap.org/users/sign_up)
+ [Register for a Twitter developer account](https://developer.twitter.com/en/apply)

If you haven't installed [Node.js](https://nodejs.org/en/download/) already, go ahead and do so.
After cloning the project, run `npm install` where `package.json` is which should be the root project directory.  
Configure `config.json` with your location and api keys.  

__❗❗❗Make sure `config.json` is not tracked by git. If `git status` shows your config as `modified`, use `git update-index --assume-unchanged config.json` to untrack it. Having the file tracked may expose your API keys.__

## Included Node Packages
[lune](https://www.npmjs.com/package/lune/v/0.4.0) calculates moon phases.  
[Node Schedule](https://www.npmjs.com/package/node-schedule) like cron.  
[Node Windows](https://www.npmjs.com/package/node-windows)  
[Twitter for Node.js](https://www.npmjs.com/package/twitter)  
[Winston](https://www.npmjs.com/package/winston) a logger.

## Deployment
Running `node index.js` will start up the bot.  
  
vv Not Yet vv  
Running `node windowsInstall.js` will install the bot as a service so it automatically starts when booting your windows machine.
^^ Planned Feature ^^  
  
## Contributing
A description with your pull request is fine.
Would be appreciated if it could be deployed as a linux service so it automatically starts on boot. 
