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

  })// End filter: contains tests
})
