const _ = require('lodash')
const config = require('../config.json')
const expect = require('chai').expect
const weatherTools = require('../weather.js')

const logger = {
  info (message) {
    console.log('INFO')
    console.log(message)
  },
  error (error) {
    console.log('ERROR')
    console.log(error)
  }
}

let weatherDataHandler

const exampleAlerts1 = require('../test/exampleAlerts1.json')
const exampleAlerts2 = require('../test/exampleAlerts2.json')
const exampleAlerts3 = require('../test/exampleAlerts3.json')
const exampleAlerts4 = require('../test/exampleAlerts4.json')

describe('Alert Filters', function () {
  describe('No filters', function () {
    before(function () {
      config.alerts.filters = []

      weatherDataHandler = new weatherTools.DataFetcher(config.alerts, config.open_weather_map, logger)
    })

    it('should not filter the alerts when there are no filters', function () {
      expect(exampleAlerts1.features).to.deep.equal(weatherDataHandler.filterAlerts(exampleAlerts1.features))
      expect(exampleAlerts2.features).to.deep.equal(weatherDataHandler.filterAlerts(exampleAlerts2.features))
      expect(exampleAlerts3.features).to.deep.equal(weatherDataHandler.filterAlerts(exampleAlerts3.features))
      expect(exampleAlerts4.features).to.deep.equal(weatherDataHandler.filterAlerts(exampleAlerts4.features))
    })
  })

  describe('Time Filters', function () {
    let exampleAlerts1Current,
      exampleAlerts2Current,
      exampleAlerts3Current,
      exampleAlerts4Current

    let now

    before(function () {
      // Adjust times on alerts to make them seem like they were recently generated
      exampleAlerts1Current = _.cloneDeep(exampleAlerts1),
      exampleAlerts2Current = _.cloneDeep(exampleAlerts2),
      exampleAlerts3Current = _.cloneDeep(exampleAlerts3),
      exampleAlerts4Current = _.cloneDeep(exampleAlerts4)

      now = new Date()

      let diff
      const diff1 = now - new Date(exampleAlerts1Current.updated)
      const diff2 = now - new Date(exampleAlerts2Current.updated)
      const diff3 = now - new Date(exampleAlerts3Current.updated)
      const diff4 = now - new Date(exampleAlerts4Current.updated)

      const mockAlertTime = (weatherAlert, i) => {
        const properties = weatherAlert.properties

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

    describe('Filter: after', function () {
      it('should throw a TypeError when path leads to an invalid date string', function () {
        config.alerts.filters = [
          {
            restriction: 'after',
            path: 'properties.event',
            value: -8,
            keep: false
          }
        ]

        weatherDataHandler = new weatherTools.DataFetcher(config.alerts, config.open_weather_map, logger)

        expect(() => { weatherDataHandler.filterAlerts(exampleAlerts1Current.features) }).to.throw(TypeError)
      })

      it('should keep alerts after the current time + 8hours when keep is true and value is 8', function () {
        config.alerts.filters = [
          {
            restriction: 'after',
            path: 'properties.sent',
            value: 8,
            keep: true
          }
        ]

        weatherDataHandler = new weatherTools.DataFetcher(config.alerts, config.open_weather_map, logger)

        const nowCorrected = new Date(now)
        nowCorrected.setHours(nowCorrected.getHours() + 8)

        weatherDataHandler.filterAlerts(exampleAlerts1Current.features).forEach(function (weatherAlert) {
          expect(nowCorrected - weatherAlert.properties.sent).to.be.below(0)
        })
      })

      it('should keep alerts after the current time - 8hours when keep is true and value is -8', function () {
        config.alerts.filters = [
          {
            restriction: 'after',
            path: 'properties.sent',
            value: -8,
            keep: true
          }
        ]

        weatherDataHandler = new weatherTools.DataFetcher(config.alerts, config.open_weather_map, logger)

        const nowCorrected = new Date(now)
        nowCorrected.setHours(nowCorrected.getHours() - 8)

        weatherDataHandler.filterAlerts(exampleAlerts1Current.features).forEach(function (weatherAlert) {
          expect(nowCorrected - weatherAlert.properties.sent).to.be.below(0)
        })
      })

      it('should keep alerts before or at the current time + 8hours when keep is false and value is 8', function () {
        config.alerts.filters = [
          {
            restriction: 'after',
            path: 'properties.sent',
            value: 8,
            keep: false
          }
        ]

        weatherDataHandler = new weatherTools.DataFetcher(config.alerts, config.open_weather_map, logger)

        const nowCorrected = new Date(now)
        nowCorrected.setHours(nowCorrected.getHours() + 8)

        weatherDataHandler.filterAlerts(exampleAlerts1Current.features).forEach(function (weatherAlert) {
          expect(nowCorrected - weatherAlert.properties.sent).to.be.at.least(0)
        })
      })

      it('should keep alerts before or at the current time - 8hours when keep is false and value is -8', function () {
        config.alerts.filters = [
          {
            restriction: 'after',
            path: 'properties.sent',
            value: -8,
            keep: false
          }
        ]

        weatherDataHandler = new weatherTools.DataFetcher(config.alerts, config.open_weather_map, logger)

        const nowCorrected = new Date(now)
        nowCorrected.setHours(nowCorrected.getHours() - 8)

        weatherDataHandler.filterAlerts(exampleAlerts1Current.features).forEach(function (weatherAlert) {
          expect(nowCorrected - weatherAlert.properties.sent).to.be.at.least(0)
        })
      })

      it('should filter all the alerts when there are a pair of filters where keep is true in one and false in the other and all other properties are the same', function () {
        config.alerts.filters = [
          {
            restriction: 'after',
            path: 'properties.sent',
            value: -8,
            keep: false
          },
          {
            restriction: 'after',
            path: 'properties.sent',
            value: -8,
            keep: true
          }
        ]

        weatherDataHandler = new weatherTools.DataFetcher(config.alerts, config.open_weather_map, logger)

        expect(weatherDataHandler.filterAlerts(exampleAlerts1Current.features)).to.be.empty
      })
    })// End filter: after tests

    describe('Filter: before', function () {
      it('should throw a TypeError when path leads to an invalid date string', function () {
        config.alerts.filters = [
          {
            restriction: 'before',
            path: 'properties.event',
            value: 24,
            keep: false
          }
        ]

        weatherDataHandler = new weatherTools.DataFetcher(config.alerts, config.open_weather_map, logger)

        expect(() => { weatherDataHandler.filterAlerts(exampleAlerts3Current.features) }).to.throw(TypeError)
      })

      it('should keep alerts before the current time - 24hours when keep is true and value is 24', function () {
        config.alerts.filters = [
          {
            restriction: 'before',
            path: 'properties.ends',
            value: 24,
            keep: true
          }
        ]

        weatherDataHandler = new weatherTools.DataFetcher(config.alerts, config.open_weather_map, logger)

        const nowCorrected = new Date(now)
        nowCorrected.setHours(nowCorrected.getHours() + 24)

        weatherDataHandler.filterAlerts(exampleAlerts3Current.features).forEach(function (weatherAlert) {
          expect(nowCorrected - weatherAlert.properties.ends).to.be.above(0)
        })
      })

      it('should keep alerts before the current time - 24hours when keep is true and value is -24', function () {
        config.alerts.filters = [
          {
            restriction: 'before',
            path: 'properties.ends',
            value: -24,
            keep: true
          }
        ]

        weatherDataHandler = new weatherTools.DataFetcher(config.alerts, config.open_weather_map, logger)

        const nowCorrected = new Date(now)
        nowCorrected.setHours(nowCorrected.getHours() - 24)

        weatherDataHandler.filterAlerts(exampleAlerts3Current.features).forEach(function (weatherAlert) {
          expect(nowCorrected - weatherAlert.properties.ends).to.be.above(0)
        })
      })

      it('should keep alerts after or at the current time + 24hours when keep is false and value is 24', function () {
        config.alerts.filters = [
          {
            restriction: 'before',
            path: 'properties.ends',
            value: 24,
            keep: false
          }
        ]

        weatherDataHandler = new weatherTools.DataFetcher(config.alerts, config.open_weather_map, logger)

        const nowCorrected = new Date(now)
        nowCorrected.setHours(nowCorrected.getHours() + 24)

        weatherDataHandler.filterAlerts(exampleAlerts3Current.features).forEach(function (weatherAlert) {
          expect(nowCorrected - weatherAlert.properties.ends).to.be.at.most(0)
        })
      })

      it('should keep alerts after or at the current time - 24hours when keep is false and value is -24', function () {
        config.alerts.filters = [
          {
            restriction: 'before',
            path: 'properties.ends',
            value: -24,
            keep: false
          }
        ]

        weatherDataHandler = new weatherTools.DataFetcher(config.alerts, config.open_weather_map, logger)

        const nowCorrected = new Date(now)
        nowCorrected.setHours(nowCorrected.getHours() - 24)

        weatherDataHandler.filterAlerts(exampleAlerts3Current.features).forEach(function (weatherAlert) {
          expect(nowCorrected - weatherAlert.properties.ends).to.be.at.most(0)
        })
      })

      it('should filter all the alerts when there are a pair of filters where keep is true in one and false in the other and all other properties are the same', function () {
        config.alerts.filters = [
          {
            restriction: 'before',
            path: 'properties.ends',
            value: -24,
            keep: false
          },
          {
            restriction: 'before',
            path: 'properties.ends',
            value: -24,
            keep: true
          }
        ]

        weatherDataHandler = new weatherTools.DataFetcher(config.alerts, config.open_weather_map, logger)

        expect(weatherDataHandler.filterAlerts(exampleAlerts3Current.features)).to.be.empty
      })
    })// End filter: before tests
  })// End time filter tests

  describe('Filter: contains', function () {
    it('should throw a TypeError when path does not lead to an array', function(){
      config.alerts.filters = [
        {
          restriction: 'contains',
          path: 'properties.event',
          value: 'MOZ041',
          keep: true
        }
      ]

      weatherDataHandler = new weatherTools.DataFetcher(config.alerts, config.open_weather_map, logger)

      expect(() => { weatherDataHandler.filterAlerts(exampleAlerts4.features) }).to.throw(TypeError)
    })
    
    it('should keep the only alert where properties.geocode.UGC contains "MOZ041" when keep is true and value is "MOZ041"', function(){
      config.alerts.filters = [
        {
          restriction: 'contains',
          path: 'properties.geocode.UGC',
          value: 'MOZ041',
          keep: true
        }
      ]

      weatherDataHandler = new weatherTools.DataFetcher(config.alerts, config.open_weather_map, logger)
      
      expect(weatherDataHandler.filterAlerts(exampleAlerts4.features)).to.have.lengthOf(1)
      expect(weatherDataHandler.filterAlerts(exampleAlerts4.features)[0].properties.geocode.UGC).to.include('MOZ041')
    })
    
    it('should keep alerts where properties.geocode.UGC does not contain "MOZ041" when keep is false and value is "MOZ041"', function(){
      config.alerts.filters = [
        {
          restriction: 'contains',
          path: 'properties.geocode.UGC',
          value: 'MOZ041',
          keep: false
        }
      ]

      weatherDataHandler = new weatherTools.DataFetcher(config.alerts, config.open_weather_map, logger)
      
      let filteredAlerts = weatherDataHandler.filterAlerts(exampleAlerts4.features)
      
      expect(filteredAlerts).to.have.lengthOf(34)
      
      filteredAlerts.forEach((weatherAlert) => {
        expect(weatherAlert.properties.geocode.UGC).to.not.include('MOZ041')
      })
    })
    
    it('should filter all the alerts when there are a pair of filters where keep is true in one and false in the other and all other properties are the same', function(){
      config.alerts.filters = [
        {
          restriction: 'contains',
          path: 'properties.geocode.UGC',
          value: 'MOZ041',
          keep: false
        },
        {
          restriction: 'contains',
          path: 'properties.geocode.UGC',
          value: 'MOZ041',
          keep: true
        }
      ]

      weatherDataHandler = new weatherTools.DataFetcher(config.alerts, config.open_weather_map, logger)
      
      expect(weatherDataHandler.filterAlerts(exampleAlerts4.features)).to.be.empty
    })
  })// End filter: contains tests
  
  describe('Filter: equals', function () {
    it('should keep alerts where the event is "Winter Weather Advisory" when keep is true and value is "Winter Weather Advisory"', function(){
      config.alerts.filters = [
        {
          restriction: 'equals',
          path: 'properties.event',
          value: 'Winter Weather Advisory',
          keep: true
        }
      ]

      weatherDataHandler = new weatherTools.DataFetcher(config.alerts, config.open_weather_map, logger)
      
      let filteredAlerts = weatherDataHandler.filterAlerts(exampleAlerts1.features)
      
      expect(filteredAlerts).to.have.lengthOf(3)
      
      filteredAlerts.forEach((weatherAlert) => {
        expect(weatherAlert.properties.event).to.equal('Winter Weather Advisory')
      })
    })
    
    it('should keep alerts where the event is not "Winter Weather Advisory" when keep is false and value is "Winter Weather Advisory"', function(){
      config.alerts.filters = [
        {
          restriction: 'equals',
          path: 'properties.event',
          value: 'Winter Weather Advisory',
          keep: false
        }
      ]

      weatherDataHandler = new weatherTools.DataFetcher(config.alerts, config.open_weather_map, logger)
      
      let filteredAlerts = weatherDataHandler.filterAlerts(exampleAlerts1.features)
      
      expect(filteredAlerts).to.have.lengthOf(6)
      
      filteredAlerts.forEach((weatherAlert) => {
        expect(weatherAlert.properties.event).to.not.equal('Winter Weather Advisory')
      })
    })
    
    it('should filter all the alerts when there are a pair of filters where keep is true in one and false in the other and all other properties are the same', function(){
      config.alerts.filters = [
        {
          restriction: 'equals',
          path: 'properties.event',
          value: 'Winter Weather Advisory',
          keep: false
        },
        {
          restriction: 'equals',
          path: 'properties.event',
          value: 'Winter Weather Advisory',
          keep: true
        }
      ]

      weatherDataHandler = new weatherTools.DataFetcher(config.alerts, config.open_weather_map, logger)
      
      expect(weatherDataHandler.filterAlerts(exampleAlerts1.features)).to.be.empty
    })
  })// End filter: equals tests
  
  describe('Filter: has', function () {
    it('should keep alerts where the alert contains properties.replacedBy when path is "properties.replacedBy" and keep is true', function(){
      config.alerts.filters = [
        {
          "restriction": "has",
          "path": "properties.replacedBy",
          "keep": true
        }
      ]
      
      weatherDataHandler = new weatherTools.DataFetcher(config.alerts, config.open_weather_map, logger)
      
      weatherDataHandler.filterAlerts(exampleAlerts2.features).forEach((weatherAlert) => {
        expect(weatherAlert.properties).to.have.property('replacedBy')
      })
    })
    
    it('should keep alerts where the alert does not contain properties.replacedBy when path is "properties.replacedBy" and keep is false', function(){
      config.alerts.filters = [
        {
          "restriction": "has",
          "path": "properties.replacedBy",
          "keep": false
        }
      ]
      
      weatherDataHandler = new weatherTools.DataFetcher(config.alerts, config.open_weather_map, logger)
      
      weatherDataHandler.filterAlerts(exampleAlerts2.features).forEach((weatherAlert) => {
        expect(weatherAlert.properties).to.not.have.all.keys('replacedBy')
      })
    })
    
    it('should be prioritized before other filters', function(){
      config.alerts.filters = [
        {
          "restriction": "matches",
          "path": "properties.parameters.NWSheadline[0]",
          "value": ".*",
          "keep": true
        },
        {
          "restriction": "has",
          "path": "properties.parameters.NWSheadline[0]",
          "keep": true
        },
        {
          "restriction": "contains",
          "path": "properties.parameters.BLOCKCHANNEL",
          "value": "CMAS",
          "keep": true
        },
        {
          "restriction": "has",
          "path": "properties.parameters.BLOCKCHANNEL",
          "keep": true
        }
      ]
      
      weatherDataHandler = new weatherTools.DataFetcher(config.alerts, config.open_weather_map, logger)
      
      let filteredAlerts = [];
      
      expect(() => {
        filteredAlerts = weatherDataHandler.filterAlerts(exampleAlerts2.features)
      }).to.not.throw(ReferenceError)
      
      expect(filteredAlerts).to.not.be.empty    
      
      filteredAlerts.forEach((weatherAlert) => {
        expect(weatherAlert).to.have.nested.property('properties.parameters.NWSheadline')
        expect(weatherAlert.properties.parameters.NWSheadline[0]).to.be.a('string')
        expect(weatherAlert).to.have.nested.property('properties.parameters.BLOCKCHANNEL')
        expect(weatherAlert.properties.parameters.BLOCKCHANNEL).to.include('CMAS')
      })
    })
    
    it('should filter all the alerts when there are a pair of filters where keep is true in one and false in the other and all other properties are the same', function(){
      config.alerts.filters = [
        {
          restriction: 'has',
          path: 'properties.parameters.NWSheadline',
          keep: false
        },
        {
          restriction: 'has',
          path: 'properties.parameters.NWSheadline',
          keep: true
        }
      ]

      weatherDataHandler = new weatherTools.DataFetcher(config.alerts, config.open_weather_map, logger)
      
      expect(weatherDataHandler.filterAlerts(exampleAlerts2.features)).to.be.empty
    })
  })// End filter: has tests
})
