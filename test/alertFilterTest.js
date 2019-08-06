const _ = require('lodash')
const config = require('../config.json')
const expect = require('chai').expect
const weatherTools = require('../weather.js')

const logger = {
  info(message){
    console.log('INFO')
    console.log(message)
  },
  error(error){
    console.log('ERROR')
    console.log(error)
  }
}

let weatherDataHandler

let exampleAlerts1 = require('../test/exampleAlerts1.json'),
    exampleAlerts2 = require('../test/exampleAlerts2.json'),
    exampleAlerts3 = require('../test/exampleAlerts3.json'),
    exampleAlerts4 = require('../test/exampleAlerts4.json');

describe('Alert Filters', function(){
  describe('No filters', function(){
    
    before(function(){
      config.alerts.filters = []
    
      weatherDataHandler = new weatherTools.DataFetcher(config.alerts, config.open_weather_map, logger)
    })
    
    it('should not filter the alerts when there are no filters', function(){
      expect(exampleAlerts1.features).to.deep.equal(weatherDataHandler.filterAlerts(exampleAlerts1.features))
      expect(exampleAlerts2.features).to.deep.equal(weatherDataHandler.filterAlerts(exampleAlerts2.features))
      expect(exampleAlerts3.features).to.deep.equal(weatherDataHandler.filterAlerts(exampleAlerts3.features))
      expect(exampleAlerts4.features).to.deep.equal(weatherDataHandler.filterAlerts(exampleAlerts4.features))
    })
  })
  
  describe('Time Filters', function(){
    let exampleAlerts1Current,
        exampleAlerts2Current,
        exampleAlerts3Current,
        exampleAlerts4Current;
        
    let now;
        
    before(function(){
      // Adjust times on alerts to make them seem like they were recently generated
      exampleAlerts1Current = _.cloneDeep(exampleAlerts1),
      exampleAlerts2Current = _.cloneDeep(exampleAlerts2),
      exampleAlerts3Current = _.cloneDeep(exampleAlerts3),
      exampleAlerts4Current = _.cloneDeep(exampleAlerts4);
        
      now = new Date()
      
      let diff,
          diff1 = now - new Date(exampleAlerts1Current.updated),
          diff2 = now - new Date(exampleAlerts2Current.updated),
          diff3 = now - new Date(exampleAlerts3Current.updated),
          diff4 = now - new Date(exampleAlerts4Current.updated);
        
      let mockAlertTime = (weatherAlert, i) => {
        let properties = weatherAlert.properties
      
        properties.sent = new Date(properties.sent)
        properties.sent.setMilliseconds(properties.sent.getMilliseconds() + diff)
      
        properties.effective = new Date(properties.effective)
        properties.effective.setMilliseconds(properties.effective.getMilliseconds() + diff)
      
        properties.onset = new Date(properties.onset)
        properties.onset.setMilliseconds(properties.onset.getMilliseconds() + diff)
      
        properties.expires = new Date(properties.expires)
        properties.expires.setMilliseconds(properties.expires.getMilliseconds() + diff)
      
        properties.ends = new Date(properties.ends)
        properties.ends.setMilliseconds(properties.ends.getMilliseconds() + diff)
      }
    
      diff = diff1
      exampleAlerts1Current.features.forEach(mockAlertTime)
    
      diff = diff2
      exampleAlerts2Current.features.forEach(mockAlertTime)
    
      diff = diff3
      exampleAlerts3Current.features.forEach(mockAlertTime)
    
      diff = diff4
      exampleAlerts4Current.features.forEach(mockAlertTime)
    })
    
    describe('Filter: after, keep is true, value is 8', function(){
      before(function(){
        config.alerts.filters = [
          {
            "restriction": "after",
            "path": "properties.sent",
            "value": 8,
            "keep": true
          }
        ]
      
        weatherDataHandler = new weatherTools.DataFetcher(config.alerts, config.open_weather_map, logger)
      })
      
      it('should be within 8 hours of the current time', function(){
        weatherDataHandler.filterAlerts(exampleAlerts1Current.features).forEach(function(weatherAlert){
          expect(Math.abs(now - weatherAlert.properties.sent) / (1000 * 60 * 60)).to.be.at.most(8)
        })
      })
        
      it('should be after the current time + 8', function(){
        let nowCorrected = now
        
        nowCorrected.setHours(nowCorrected.getHours() + 8)
          
        weatherDataHandler.filterAlerts(exampleAlerts1Current.features).forEach(function(weatherAlert){
          expect(nowCorrected - weatherAlert.properties.sent).to.be.below(0)
        })
      })
    })
  })
})