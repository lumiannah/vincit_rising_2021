const canvas = document.getElementById('currency_data')
canvas.height = 220
canvas.width = canvas.clientWidth
const canvasContext = canvas.getContext('2d')
const sepTextArea = 20

function drawValues(min, max)
{
    canvasContext.font = "bold 16px Courier New"
    canvasContext.fillStyle = "#ccc"
    const minValue = Math.floor(min)
    const maxValue = Math.floor(max)
    const minWidth = canvasContext.measureText(minValue).width
    const maxWidth = canvasContext.measureText(maxValue).width
    canvasContext.fillText(maxValue, canvas.width-maxWidth-5, sepTextArea*2-5)
    canvasContext.fillText(minValue, canvas.width-minWidth-5, canvas.height-sepTextArea)

}

function drawSeparators(data)
{
    canvasContext.clearRect(0, 0, canvas.width, canvas.height)

    const days = Object.keys(data).length-1
    const dayWidth = canvas.width / days
    let relativeX = 0

    function drawSepLine()
    {
        canvasContext.beginPath();
        canvasContext.moveTo(relativeX, 5+sepTextArea);
        canvasContext.lineTo(relativeX, canvas.height-sepTextArea);
        canvasContext.stroke();
    }

    function drawSepText(day, separator, offSetX, offSetY)
    {
        const osX = offSetX ? offSetX : 0
        const osY = offSetY ? offSetY : 0
        const dt = DateTime.fromISO(day)
        
        let sepText
        if (separator === 'day')
            sepText = dt.plus({day:1}).weekdayShort
        if (separator === 'week')
            sepText = 'W' + dt.weekNumber
        if (separator === 'month')
            sepText = dt.monthShort
        if (separator === 'qvartal') {
                sepText = 'Q4'
            if (dt.month < 9) 
                sepText = 'Q3'
            if (dt.month < 6) 
                sepText = 'Q2'
            if (dt.month < 3) 
                sepText = 'Q1' }
        if (separator === 'year')
            sepText = dt.year

        canvasContext.font = "14px Courier New"
        canvasContext.fillStyle = "#999"
        let sepTextW = canvasContext.measureText(sepText).width
        let textX = relativeX - osX
        if (textX >= canvas.width-sepTextW-5) {
            textX = canvas.width - sepTextW

            if (sepTextW > dayWidth * 0.5)
                textX = relativeX
        }
        canvasContext.fillText(sepText, textX, canvas.height - osY)
    }

    for (const day in data)
    {
        const dt = new Date(day)
        canvasContext.lineWidth = 1
        canvasContext.strokeStyle = '#666'

        // year separators
        if (dt.getMonth() === 0 && dt.getDate() === 1 && days > 400) {
            drawSepLine()
            drawSepText(day, 'year')
        }

        // qvartal separators
        if ((dt.getMonth()+1) % 3 === 1 && dt.getDate() === 1 && days < 800) {
            drawSepLine()
            drawSepText(day, 'qvartal', 0, canvas.height-sepTextArea)
        }

        // month separators
        if (dt.getDate() === 1  && days < 190) {
            drawSepLine()
            drawSepText(day, 'month')
        }

        // week separators
        if (dt.getDay() === 0 && days < 40) {
            drawSepLine()
            drawSepText(day, 'week', 0, canvas.height-sepTextArea)
        }

        // day separators
        if (days <= 14) {
            drawSepLine()
            drawSepText(day, 'day')
        }

        relativeX += dayWidth
    }

}


function drawLines(data)
{
    const dataPoints = Object.keys(data).length-1
    const pointWidth = canvas.width / dataPoints
    
    let avgPrices = []
    let minPrices = []
    let maxPrices = []
    
    for (const point in data)
    {
        avgPrices.push(data[point])
        minPrices.push(data[point].min_price)
        maxPrices.push(data[point].max_price)
    }
    
    const minPrice = minValue(minPrices)
    const maxPrice = maxValue(maxPrices)

    const priceDifference = maxPrice - minPrice
    let relativeX = 0
    
    for (let i = 0; i < avgPrices.length-1; i++)
    {
        const currentVal = avgPrices[i].avg_price
        const nextVal = avgPrices[i+1].avg_price
        const currentY = (maxPrice - currentVal) / priceDifference * (canvas.height-sepTextArea*2)
        const nextY = (maxPrice - nextVal) / priceDifference * (canvas.height-sepTextArea*2)
        
        if (nextY < currentY) 
            canvasContext.strokeStyle = '#00ff88'; // value increasing
        else
            canvasContext.strokeStyle = '#ff0000'; // value decreasing
        
        if (avgPrices[i+1].future)  
            canvasContext.strokeStyle = '#e6e20b' // future line color
        
        canvasContext.lineWidth = 4;
        canvasContext.beginPath();
        canvasContext.moveTo(relativeX, currentY+sepTextArea);
        canvasContext.lineTo(relativeX + pointWidth, nextY+sepTextArea);
        canvasContext.stroke(); 
        relativeX += pointWidth
    }

    drawValues(minPrice, maxPrice)
}







