const DateTime = luxon.DateTime;

const app = Vue.createApp({
    data() {
        return {
            data: {},

            UNIX_dateFrom: null, 
            UNIX_dateTo: Math.floor( DateTime.now().toSeconds() ),
            ISO_dateFrom: null,
            ISO_dateTo: DateTime.now().toISODate(),

            minTrendLength: 2,
            downwardTrend: false,
            upwardTrend: false,
            highestVolume: false,

            seekIntoFuture: false,
            cheapestFuture: false,
            highestFuture: false,
            currentPrice: null,
        }
    },
    mounted() {
        // from inputin max arvo asetetaan eiliseksi
        document.getElementById('dateFrom').max = DateTime.now().minus({day:1}).toISODate()
        
        // alustetaan from input
        this.renderFromPast('days', 6)
    },
    watch: {
        // kun date inputit muuttuvat..
        ISO_dateFrom: { 
            handler: function(updated)
            {
                if (updated === '') return 
                
                const dateFrom = DateTime.fromISO(updated)
                this.UNIX_dateFrom = Math.floor(dateFrom.toSeconds())

                // jos FROM on suurempi tai sama kuin TO niin muutetaan TO viikkoa eteenpäin 
                if (this.UNIX_dateFrom > this.UNIX_dateTo || this.ISO_dateFrom === this.ISO_dateTo) 
                    this.ISO_dateTo = dateFrom.plus({ day: 6 }).toISODate()
                else
                    this.fetchAPIData(this.UNIX_dateFrom, this.UNIX_dateTo)
            }
        },
        ISO_dateTo: {
            handler: function(updated)
            {
                if (updated == '') return

                const dateTo = DateTime.fromISO(updated)
                this.UNIX_dateTo = Math.floor(dateTo.endOf('day').toSeconds())
                
                // jos TO on tulevaisuudessa niin alustetaan tulevaisuushaku fetchin iterointia varten,
                const endOfToday = DateTime.now().endOf('day').toSeconds()
                if (this.UNIX_dateTo > endOfToday)
                    this.seekIntoFuture = true

                // muuten nollataan tulevaisuuteen viittaavat muuttujat
                else {
                    this.seekIntoFuture = false
                    this.cheapestFuture = false
                    this.highestFuture = false
                }

                // jos TO on pienempi tai sama kuin FROM niin muutetaan FROM viikkoa taaksepäin 
                if (this.UNIX_dateTo < this.UNIX_dateFrom || this.ISO_dateFrom === this.ISO_dateTo) 
                    this.ISO_dateFrom = dateTo.minus({ day: 6 }).toISODate()
                else
                    this.fetchAPIData(this.UNIX_dateFrom, this.UNIX_dateTo)
            }
        },
    },
    computed: {
        // trendit
        upwardStartDate()  {
            return this.toLocaleDate(this.upwardTrend.start.ISODate)
        },
        upwardEndDate() {
            return this.toLocaleDate(this.upwardTrend.end.ISODate)
        },
        downwardStartDate() {
            return this.toLocaleDate(this.downwardTrend.start.ISODate)
        },
        downwardEndDate() {
            return this.toLocaleDate(this.downwardTrend.end.ISODate)
        },

        // voluumit
        highestTradingVolume() {
            return this.toEurCurrency(this.highestVolume.avg_total_volume)
        },
        highestTradingDate() {
            return this.toLocaleDate(this.highestVolume.ISODate)
        },

        // tulevaisuus
        cheapestFuturePrice() {
            let percentOfCurrent = 1 / (this.currentPrice / this.cheapestFuture.avg_price) * 100
            percentOfCurrent = Number.parseFloat(percentOfCurrent).toFixed(2)

            const increaseStr = ' Value has increased, should wait!!'
            const cheapestFutureStr = this.toEurCurrency(this.cheapestFuture.avg_price) + ' (' + percentOfCurrent + ' % of current price)'
            
            if (this.cheapestFuture.avg_price > this.currentPrice)
                return cheapestFutureStr + increaseStr
            else 
                return cheapestFutureStr 

        },
        cheapestFutureDate() {
            return this.toLocaleDate(this.cheapestFuture.ISODate)
        },
        highestFuturePrice() {
            let percentOfCurrent = 1 / (this.currentPrice / this.highestFuture.avg_price) * 100
            percentOfCurrent = Number.parseFloat(percentOfCurrent).toFixed(2)

            const decreaseStr = ' Value has decreased, should sell right away!!'
            const highestFutureStr = this.toEurCurrency(this.highestFuture.avg_price) + ' (' + percentOfCurrent + ' % of current price)'
            
            if (this.highestFuture.avg_price < this.currentPrice)
                return highestFutureStr + decreaseStr
            else 
                return highestFutureStr 
        },
        highestFutureDate() {
            return this.toLocaleDate(this.highestFuture.ISODate)
        },
    },
    methods: {
        fetchAPIData(from, to)
        {
            fetch('https://api.coingecko.com/api/v3/coins/bitcoin/market_chart/range?vs_currency=eur&from='
                + from +'&to='+ to)
                .then( response => response.json() )
                .then( data => this.parseAPIDataByDays(data) )
                .catch( error => console.error('Error:', error) )
        },

        parseAPIDataByDays(data)
        {
            /* 
            {
                "2021-12-10": {
                    "prices": [ ... ],
                    "market_caps": [ ... ],
                    "total_volumes": [ ... ],
                    "avg_price": 42747.451809356535,
                    "avg_total_volume": 25197273534.485718,
                    "avg_market_cap": 807754057235.933,
                    "min_price": 42105.906771004054,
                    "max_price": 44147.05381476453,
                    "ISODate": "2021-12-10"
                }
            }
            */
            
            let parsedDataByDays = {}
            
            // iteroidaan data päiväkohtaiseen muotoon
            Object.keys(data).forEach(key =>
            {
                data[key].forEach(element =>
                {
                    // datan unix timestamp muutetaan ISO aikaan, 2021-10-22
                    const date = DateTime.fromMillis(element[0]).toISODate()

                    // jos päiväkohtaista proppia ei ole, niin luodaan objekti
                    if(!Object.prototype.hasOwnProperty.call(parsedDataByDays, date))
                        parsedDataByDays[date] = { prices:[], market_caps:[], total_volumes:[] }
                    
                    // lisätään price, market_cap, total_volumes 
                    parsedDataByDays[date][key].push(element[1])
                })
            });

            // lisätään apu-proppeja
            Object.keys(parsedDataByDays).forEach(day =>
            {
                parsedDataByDays[day].avg_price = averageValue(parsedDataByDays[day].prices)
                parsedDataByDays[day].avg_total_volume = averageValue(parsedDataByDays[day].total_volumes)
                parsedDataByDays[day].avg_market_cap = averageValue(parsedDataByDays[day].market_caps)
                parsedDataByDays[day].min_price = minValue(parsedDataByDays[day].prices)
                parsedDataByDays[day].max_price = maxValue(parsedDataByDays[day].prices)
                parsedDataByDays[day].ISODate = day
            });

            // asetetaan nykyinen hinta viimesestä arvosta
            this.currentPrice = Object.values(parsedDataByDays).slice(-1)[0].prices.slice(-1)[0]

            // jos inputissa oli tulevaisuus asetettuna niin generoidaan lisädataa nykyiseen
            if (this.seekIntoFuture)
                this.generateFutureData(parsedDataByDays)
            
            // muuten sovelluksen data on haettu data
            else
                this.data = parsedDataByDays

            // etsitään upward ja downward trendit    
            this.findLongestTrends(false)

            // etsitään isoin siirretty päiväkohtainen voluumi
            this.findHighestVolume()
            
            // piirretään canvasiin pystyviivat
            drawSeparators(this.data)
                
            // jos päiviä on yli 90 niin muutetaan data viikko/kuukausi muotoon
            const days = Object.keys(parsedDataByDays).length
            if (days > 90)
                this.parseAPIDataByYMW()
            
            // piirretään arvot canvasiin
            drawLines(this.data)
        },

        parseAPIDataByYMW()
        {
            /*

            päiviä 3kk - 3v
            {
                "2020-W52": {
                    "avg_price": 42747.451809356535,
                    "avg_prices": [ ... ],
                    "avg_total_volume": 25197273534.485718,
                    "avg_total_volumes": [ ... ],
                    "avg_market_cap": 807754057235.933,
                    "avg_market_caps": [ ... ],
                    "min_price": 42105.906771004054,
                    "max_price": 44147.05381476453,
                }
            }

            päiviä yli 3 vuotta
            {
                "2020-12": {
                    "avg_price": 42747.451809356535,
                    "avg_prices": [ ... ],
                    "avg_total_volume": 25197273534.485718,
                    "avg_total_volumes": [ ... ],
                    "avg_market_cap": 807754057235.933,
                    "avg_market_caps": [ ... ],
                    "min_price": 42105.906771004054,
                    "max_price": 44147.05381476453,
                }
            }
            */

            const days = Object.keys(this.data).length
            let parsedDataByYMW = {}

            // iteroidaan data vuosi-viikko- tai vuosi-kuukausi kohtaiseen muotoon
            Object.keys(this.data).forEach(day =>
            {
                let dt = DateTime.fromISO(day)
                let YMW = dt.toISOWeekDate().substring(0, 8) // YYYY-WWW
                
                
                if (days > 366*3) 
                    YMW = dt.toISODate().substring(0, 7) // YYYY-MM

                if (!Object.prototype.hasOwnProperty.call(parsedDataByYMW, YMW))
                    parsedDataByYMW[YMW] = { avg_prices:[], avg_market_caps:[], avg_total_volumes:[],  }

                parsedDataByYMW[YMW].avg_prices.push(this.data[day].avg_price)
                parsedDataByYMW[YMW].avg_total_volumes.push(this.data[day].avg_total_volume)
                parsedDataByYMW[YMW].avg_market_caps.push(this.data[day].avg_market_cap)

                if (this.data[day].future) 
                    parsedDataByYMW[YMW].future = true
            });

            // lisätään apu-proppeja
            Object.keys(parsedDataByYMW).forEach(key =>
            {
                parsedDataByYMW[key].avg_price = averageValue(parsedDataByYMW[key].avg_prices)
                parsedDataByYMW[key].avg_total_volume = averageValue(parsedDataByYMW[key].avg_total_volumes)
                parsedDataByYMW[key].avg_market_cap = averageValue(parsedDataByYMW[key].avg_market_caps)
                parsedDataByYMW[key].min_price = minValue(parsedDataByYMW[key].avg_prices)
                parsedDataByYMW[key].max_price = maxValue(parsedDataByYMW[key].avg_prices)
            });

            this.data = parsedDataByYMW

        },

        generateFutureData(currentData)
        {
            const startOfToday = DateTime.now().startOf('day')
            const startOfTo = DateTime.fromISO(this.ISO_dateTo)
            const days = startOfTo.diff(startOfToday, 'days').days
            for (let i = 1; i <= days; i++)
            {
                const future = startOfToday.plus({ day : i})
                const futureISO = future.toISODate()
                const ydayPrice = Object.values(currentData).slice(-1)[0].avg_price
                // tieteelliset taikaluvut
                const min = 0.95
                const max = 1 / min
                const constellationModifier = ( this.dailyProphesy(future.toSeconds()) * (max - min) + min ) * 0.9992
                const futurePrice = ydayPrice * constellationModifier 

                currentData[futureISO] = 
                {
                    ISODate: futureISO,
                    avg_price: futurePrice,
                    max_price: futurePrice,
                    min_price: futurePrice,
                    avg_total_volume: 0,
                    future: true
                }
            }
            this.data = currentData
            this.findFuturePrices(days)
        },

        findLongestTrends(isDownward)
        {
            const d = Object.values(this.data)
            if (d.length < 3) return false
            const trend = {}
            let trendStart
            let trendLength = 0
            let longestLenght = 0
            
            for (let i = 1; i < d.length; i++)
            {
                if (this.compareDownward(d[i].avg_price, d[i-1].avg_price, isDownward) )
                {
                    if (trendLength === 0)
                    {
                        trendStart = d[i-1]
                    }
                    trendLength++
                    if (trendLength > longestLenght) {
                        longestLenght = trendLength
                        trend.start = trendStart
                        trend.end = d[i]
                        trend.length = longestLenght
                        trend.downward = isDownward
                    }
                }
                else
                {
                    trendLength = 0
                }
            }
            this.setLongestTrend(trend)
            // toistetaan haku 
            if (!isDownward) this.findLongestTrends(true)
        },

        setLongestTrend(trend) {
            if (trend.downward) {
                if (trend.length >= this.minTrendLength) {
                    this.downwardTrend = trend
                } else this.downwardTrend = false
            }
            
            if (!trend.downward) {
                if (trend.length >= this.minTrendLength) {
                    this.upwardTrend = trend
                } else this.upwardTrend = false
            }
        },
        
        findHighestVolume()
        {
            const maxVolume = Object.values(this.data).reduce(function(prev, current) {
                return (prev.avg_total_volume > current.avg_total_volume) ? prev : current
            }, 0)

            this.highestVolume = maxVolume
            
        },

        findFuturePrices(daysIntoFuture)
        {
            const futureData = Object.values(this.data).slice(-daysIntoFuture)
            
            const cheapest = Object.values(futureData).reduce(function(prev, current) {
                return (prev.avg_price < current.avg_price) ? prev : current
            }, 0)

            const highest = Object.values(futureData).reduce(function(prev, current) {
                return (prev.avg_price > current.avg_price) ? prev : current
            }, 0)

            this.cheapestFuture = cheapest
            this.highestFuture = highest
        },

        renderFromPast(unit, amount)
        {
            let time = {}
            time[unit] = amount
            const pastTime = DateTime.now().minus(time)
            this.updateFromDate(pastTime)
        },
        
        updateFromDate(newFromDate)
        {
            this.UNIX_dateFrom = Math.floor(newFromDate.toSeconds())
            this.ISO_dateFrom = newFromDate.toISODate()
        },

        compareDownward(a, b, isDownward)
        {
            return isDownward ? (a < b) : (a > b)
        },

        dailyProphesy(timestamp)
        {
            const elonMuskTwitterFollowers = 447000000
            const jupiterRadius = 69911
            const saturnOrbitalPeriod = 29.4571
            const mercuryOrbitalSpeed = 47.36
            const zodiacSigns = 12
            return  Math.sin( timestamp * 
                        Math.sin( timestamp * jupiterRadius * saturnOrbitalPeriod / (elonMuskTwitterFollowers * mercuryOrbitalSpeed) )
                    / zodiacSigns ) * 0.5 + 0.5
        },

        toLocaleDate(ISODate)
        {
            return DateTime.fromISO(ISODate).toLocaleString()
        },

        toEurCurrency(number)
        {
            return new Intl.NumberFormat('fi-FI', { style: 'currency', currency: 'EUR' }).format(number)
        }
        
        
    }
})

const vm = app.mount('#app')


function averageValue(valuesArray)
{
    return valuesArray.reduce(function(sum, a) { 
        return sum + a },0)/(valuesArray.length||1)
}

function minValue(valuesArray)
{
    return valuesArray.reduce(function(prev, current) {
        return (prev < current) ? prev : current })
}

function maxValue(valuesArray)
{
    return valuesArray.reduce(function(prev, current) {
        return (prev > current) ? prev : current })
}

