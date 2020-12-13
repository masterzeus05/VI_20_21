let accident_data = null;
let uk_data = null;

let map_data = null;
let pyramid_data = null;
let test_data = null;
let unit_data = null;
let other_data = null;

let svg_choropleth_map;
let svg_pyramid_bar_chart = null;

let svg_unit_chart = null;

let selectedCounties = new Set();
let selectedPyramidBars = new Set();
let selectedMinYear, selectedMaxYear;
let selectedRoadOptions = {};
let currentAccidentData = null;
let isDirty = {1: false, 2: false, 3: false, 4: false, 5: false, 6: false, 7: false};

let ageBandsKeys = Object.keys(translations.Age_Band_of_Driver)
    .filter( (k) => k > 3)
    .reverse();
let ageBands = ageBandsKeys.map( k => translations.Age_Band_of_Driver[k]);
let speedLimits = [];

let yearSlider;

let dispatch = d3.dispatch("countyEvent", "pyramidEvent", "unitEvent");

// Car and speed limit signs options
let carNumber = 40;
let carSize = 25;
let carPadding = 7;
let carSpeed = [0.10, 0.11, 0.12, 0.14, 0.16, 0.18];
let speedSignSize = 40;
let speedSignMargin = 2;
let timeBetweenCarTransitions = 15000; // ms
let carScaleSize = 25;
let roadOptionSize = 30;
let roadOptionPadding = 5;

// Choropleth Map Chart Settings
let def_i1 = {
    margin: {
        top: 20,
        right: 20,
        bottom: 32,
        left: 20,
        middle: 24
    },
    legendWidth: 50,
    legendHeight: 100,
    width: 350,
    height: 400,
    center: [1.5, 55.4],
    scale: 1100
}
let recenterMapFunc;

// Pyramid Bar Chart Settings
let def_i2 = {
    margin: {
        top: 20,
        right: 20,
        bottom: 32,
        left: 20,
        middle: 24
    },
    width: 350,
    height: 400
}

// Unit Chart Settings
let def_i7 = {
    margin: {
        top: 120,
        right: 0,
        bottom: 50,
        left: 0
    },
    width: 350,
    height: 800
}

let animateCars;

// MAIN
getData();

// Gets data from dataset
function getData() {
    d3.dsv(";", "data/dataset_2005-2010_zip.csv", function(d) {
        return {
            // Accident_Severity: +d.Accident_Severity,
            age: +d.Age_Band_of_Driver,
            county: d.county,
            // Index: d.Index,
            // Day_of_Week: +d.Day_of_Week,
            // Light_Conditions: +d.Light_Conditions,
            // Number_of_Casualties: +d.Number_of_Casualties,
            // Number_of_Vehicles: +d.Number_of_Vehicles,
            // Road_Surface_Conditions: +d.Road_Surface_Conditions,
            // Road_Type: +d.Road_Type,
            sex: +d.Sex_of_Driver,
            speed_limit: +d.Speed_limit,
            // Time: d.Time,
            // Timestamp: new Date(d.Date + ' ' + d.Time),
            area: +d.Urban_or_Rural_Area,
            // Vehicle_Type: +d.Vehicle_Type,
            // Vehicle_Year: +d.Vehicle_Year,
            // Weather_Conditions: +d.Weather_Conditions,
            year: +d.Year,
            // make: d.make
        }
    }).then(function(data, error) {
        if (error != null) {
            console.log(error);
        }
        test_data = d3.rollup(data, v => v.length,
            d => d.year, d => d.sex, d => d.age, d => d.county)
        test_data = unroll(test_data, ['year','sex','age','county']);

        accident_data = data;
        currentAccidentData = data;
        other_data = data;

        d3.json("data/uk_test.json").then(function(topology) {
            uk_data = topology;

            processData();
        });

    });
}

// After getting data, generate idioms and prepare events
function processData() {
    // Idioms
    gen_choropleth_map();
    gen_pyramid_bar_chart();
    gen_unit_chart();

    // Year slider
    gen_year_slider();

    // Events
    prepareCountyEvent();
    preparePyramidEvent();
    prepareUnitEvent();
    prepareButtons();
}

/**
 * Idioms generators
 */
// Generate choropleth map
function gen_choropleth_map() {
    let width = def_i1.width,
        height = def_i1.height,
        defaultCenter = def_i1.center,
        defaultScale = def_i1.scale;

    let projection = d3.geoMercator()
        .center(defaultCenter)
        .rotate([4.4, 0])
        .scale(defaultScale)
        .translate([width / 2, height / 2]);

    svg_choropleth_map = d3.select("#choropleth_map")
        .append("svg")
        .attr("width", width)
        .attr("height", height);

    let path = d3.geoPath()
        .projection(projection);

    let g = svg_choropleth_map.append("g");

    // Tooltip
    let div = d3.select("body").append("div")
        .attr("class", "tooltip")
        .attr("id", "choropleth_tooltip")
        .style("opacity", 0);

    // Prepare zoom functions
    let zoomed = function(event) {
        let s = event.transform.k, x = event.transform.x, y = event.transform.y;
        event.transform.x = Math.min(width / 2 * (s - 1), Math.max(width / 2 * (1 - s) - 150 * s, x));
        event.transform.y = Math.min(height / 2 * (s - 1) + 230 * s, Math.max(height / 2 * (1 - s) - 230 * s, y));
        g.selectAll('path')
            .attr('transform', event.transform);
        g.selectAll("circle")
            .attr('transform', event.transform);
    };

    let zoom = d3.zoom()
        .scaleExtent([1, 50])
        .on('zoom', zoomed);

    // Have function to recenter map
    recenterMapFunc = function() {
        let minScale = zoom.scaleExtent()[0];

        // Build a new zoom transform (using d3.zoomIdentity as a base)
        let transform = d3.zoomIdentity
            .scale( minScale);

        // Apply the new zoom transform:
        svg_choropleth_map.transition()
            .delay(1000)
            .duration(1000)
            .call(zoom.transform, transform);
    }

    svg_choropleth_map.call(zoom);

    let groupedByCounties = d3.rollup(accident_data, v => v.length,
            d => d.county);
    groupedByCounties.delete('NaN');

    let max = Math.max(...groupedByCounties.values());
    let min = Math.min(...groupedByCounties.values());

    // Gets choropleth color scale
    let colorScaleMap = d3.scaleLinear()
        .domain([0, max])
        .range(['rgba(255, 170, 170, 1)', 'rgba(255, 21, 21, 1)']);

    // Add legend
    let legend_g = svg_choropleth_map
        .append('g')
        .attr('id', 'legend-svg')
        .attr('width', def_i1.legendWidth)
        .attr('height', def_i1.legendHeight)
        .attr('transform', translation(-def_i1.margin.right,def_i1.margin.top));

    let countScale = d3.scaleLinear()
        .domain([0, max])
        .range([0, def_i1.legendHeight])

    //Calculate the variables for the temp gradient
    let numStops = 4;
    let countRange = countScale.domain();
    countRange[2] = countRange[1] - countRange[0];
    let countPoint = [];
    for(let i = 0; i < numStops; i++) {
        countPoint.push(i * countRange[2]/(numStops-1) + countRange[0]);
    }

    //Create the gradient
    legend_g.append("defs")
        .append("linearGradient")
        .attr("id", "legend-map")
        .attr("y1", "0%").attr("x1", "0%")
        .attr("y2", "100%").attr("x2", "0%")
        .selectAll("stop")
        .data(d3.range(numStops))
        .enter()
        .append("stop")
        .attr("offset", function(d,i) {
            return countScale( countPoint[i] )/ def_i1.legendHeight;
        })
        .attr("stop-color", function(d,i) {
            return colorScaleMap( countPoint[i] );
        });

    legend_g.append("rect")
        .attr("id", "legendRect")
        .attr("x", width - def_i1.margin.right*1.5)
        .attr("y", 0)
        .attr("width", 10)
        .attr("height", def_i1.legendHeight)
        .style("fill", "url(#legend-map)");

    //Define legend axis
    let legendAxis = d3.axisRight()
        .ticks(4)
        .tickFormat(d3.format(".0s"))
        .scale(countScale);

    //Set up legend axis
    legend_g.append("g")
        .attr("id", "legend-axis")
        .attr("transform", translation(width - def_i1.margin.right*1.5 + 10, 0))
        .call(legendAxis);


    // Display the map
    // Add counties
    g.selectAll("path")
        .data(uk_data.features)
        .enter().append("path")
        .attr("d", path)
        .attr("fill", function (d) {
            if (!groupedByCounties.has(getCountyId(d)) || groupedByCounties.get(getCountyId(d)) === undefined) {
                return "grey";
            }
            return colorScaleMap(groupedByCounties.get(getCountyId(d)));
        })
        .on("mouseover", function(event,d) {
            div.transition()
                .duration(200)
                .style("opacity", .9);

            let value = groupedByCounties.get(getCountyId(d));
            if (value === undefined) value = "N/A";
            div.html(getCountyName(d) + " - Number: " + value)
                .style("left", (event.pageX) + "px")
                .style("top", (event.pageY - 28) + "px");

            // Check if not selected
            if (!selectedCounties.has(getCountyId(d))) {
                d3.select(event.target)
                    .style("stroke", "black")
                    .style("stroke-width", "0.2");
            }
        })
        .on("mouseout", function(event, d) {
            div.transition()
                .duration(500)
                .style("opacity", 0);

            // Check if not selected
            if (!selectedCounties.has(getCountyId(d))) {
                d3.select(event.target)
                    .style("stroke", "transparent");
            }
        });

}

// Generate pyramid bar chart
function gen_pyramid_bar_chart() {
    // Check if already generated
    if (svg_pyramid_bar_chart !== null) {
        return;
    }

    // Set margins and width and height
    let margin = def_i2.margin;
    let width = def_i2.width,
        height = def_i2.height,
        effectiveWidth = width-margin.left - margin.right,
        effectiveHeight = height - margin.bottom,
        regionWidth = (effectiveWidth)/2 - margin.middle;

    // these are the x-coordinates of the y-axes
    let pointA = regionWidth,
        pointB = effectiveWidth - regionWidth;

    // Get custom dataset
    let groupedByAgeGender = d3.rollup(accident_data, v => v.length, d => d.age, d => d.sex);
    groupedByAgeGender.delete("");

    // Sort map
    groupedByAgeGender = new Map(
        Array.from(groupedByAgeGender)
            .filter( e => e[0] > 3)
            .sort( (a,b) => {
                return (a[0] > b[0]) ? 1 : ((b[0] > a[0]) ? -1 : 0)
            }).reverse()
    );


    // Get max values
    let maxValue = 0;
    groupedByAgeGender.forEach( (i, e) => {
        let tmp = Math.max(...groupedByAgeGender.get(e).values());
        if (tmp > maxValue) maxValue = tmp;
    })

    // Set svg
    svg_pyramid_bar_chart = d3.select("#pyramid_bar_chart")
        .append("svg")
        .attr("width", width)
        .attr("height", height);
    let g = svg_pyramid_bar_chart.append("g")
        .attr("transform", translation(margin.left, margin.top))
        .attr("class", "svg_group");

    // X scales
    let xScale = d3.scaleLinear()
        .domain([0, maxValue])
        .range([0, regionWidth])
        .nice();

    // X axis
    let xAxisLeft = d3.axisBottom()
        .scale(xScale.copy().range([pointA, 0]))
        .ticks(5)
        .tickFormat(d3.format(".2s"));

    let xAxisRight = d3.axisBottom()
        .scale(xScale)
        .ticks(5)
        .tickFormat(d3.format(".2s"));

    // Y scale
    let yScaleData = ageBandsKeys;

    let yScale = d3.scaleBand()
        .domain(yScaleData)
        .range([0, effectiveHeight - margin.bottom])
        .paddingInner(0.2)
        .paddingOuter(0.2);

    // Y axis
    let yAxisLeft = d3.axisRight()
        .scale(yScale)
        .tickSize(4, 0)
        .tickPadding(margin.middle - 4)
        .tickFormat(function(d,i){ return ageBands[i] });

    let yAxisRight = d3.axisLeft()
        .scale(yScale)
        .tickSize(4, 0)
        .tickFormat('');

    // Y axis title
    g.append('text')
        .attr('dy', '.18em' )
        .attr('x', effectiveWidth/2 - margin.left*3/5)
        .text('Age');

    // X axis title
    g.append('text')
        .attr('dy', '.24em' )
        .attr('x', effectiveWidth/2 - margin.left*2.5)
        .attr('y', effectiveHeight)
        .text('Nº of Accidents');

    // Bars groups for each side
    let leftBarGroup = g.append('g')
        .attr('transform', translation(pointA, 0) + ', scale(-1,1)')
        .attr('class', 'left-bar');

    leftBarGroup.append( 'text' )
        .attr( 'transform', translation(regionWidth - margin.left,10) + ', scale(-1,1)')
        .style( 'font', '15px sans-serif' )
        .attr( 'text-anchor', 'start' )
        .html("Male")

    let rightBarGroup = g.append('g')
        .attr('transform', 'translate(' + pointB + ',0)')
        .attr('class', 'right-bar');

    rightBarGroup.append( 'text' )
        .attr( 'transform', translation(regionWidth - 3*margin.right,10))
        .style( 'font', '15px sans-serif' )
        .attr( 'text-anchor', 'start' )
        .html("Female")

    // Add axis
    g.append('g')
        .attr('id', 'yAxisLeft')
        .attr('transform', translation(pointA, 0))
        .call(yAxisLeft)
        .selectAll('text')
        .style('text-anchor', 'middle');

    g.append('g')
        .attr('id', 'yAxisRight')
        .attr('transform', translation(pointB, 0))
        .call(yAxisRight);

    g.append('g')
        .attr('id', 'xAxisLeft')
        .attr('transform', translation(0, effectiveHeight-margin.bottom))
        .call(xAxisLeft);

    g.append('g')
        .attr('id', 'xAxisRight')
        .attr('transform', translation(pointB, effectiveHeight-margin.bottom))
        .call(xAxisRight);

    // Add bars
    leftBarGroup.selectAll('rect')
        .data(groupedByAgeGender)
        .join('rect')
        .attr("class", ".bar.left")
        .attr('x', 0)
        .attr('y', function(d) { return yScale(d[0]); })
        .attr('width', function(d) { return xScale(d[1].get(1)); })
        .attr('height', yScale.bandwidth())
        .on("mouseover", function(event,d) {
            // Check if not selected
            if (!selectedPyramidBars.has(barToString(event,d))) {
                d3.select(event.target)
                    .style("stroke", "black")
                    .style("stroke-width", "0.5");
            }
        })
        .on("mouseout", function(event, d) {
            // Check if not selected
            if (!selectedPyramidBars.has(barToString(event,d))) {
                d3.select(event.target)
                    .style("stroke", "transparent");
            }
        })
        .style("stroke-dasharray", d => (dasharray(xScale(d[1].get(1)), yScale.bandwidth())))
        .attr('fill', '#8ECEFD')
        .append("title")
        .text(d => d[1].get(1));

    leftBarGroup.selectAll('rect').on("click", function(e, d) {
    });

    rightBarGroup.selectAll('rect')
        .data(groupedByAgeGender)
        .join('rect')
        .attr("class", ".bar.right")
        .attr('x', 0)
        .attr('y', function(d) { return yScale(d[0]); })
        .attr('width', function(d) { return xScale(d[1].get(2)); })
        .attr('height', yScale.bandwidth())
        .on("mouseover", function(event,d) {
            // Check if not selected
            if (!selectedPyramidBars.has(barToString(event,d))) {
                d3.select(event.target)
                    .style("stroke", "black")
                    .style("stroke-width", "0.5")
            }
        })
        .on("mouseout", function(event, d) {
            // Check if not selected
            if (!selectedPyramidBars.has(barToString(event,d))) {
                d3.select(event.target)
                    .style("stroke", "transparent");
            }
        })
        .style("stroke-dasharray", d => (dasharray(xScale(d[1].get(2)), yScale.bandwidth())))
        .attr('fill', '#F88B9D')
        .append("title")
        .text(d => d[1].get(2));
}

// Generate unit chart
function gen_unit_chart() {
    // Check if already generated
    if (svg_unit_chart !== null) {
        return;
    }

    let margin = def_i7.margin;
    let width = def_i7.width,
        height = def_i7.height,
        effectiveWidth = width-margin.left - margin.right,
        effectiveHeight = height - margin.top - margin.bottom;

    unit_data = d3.rollup(accident_data, v => v.length,
        d => d.area, d => d.speed_limit)

    let unrolledData = unroll(unit_data, ['area','speed_limit']);
    unrolledData = unrolledData.filter( d => {
        return d.area !== 3 && d.speed_limit >= 20;
    })
        .sort( (a,b) => {
            if (a.area > b.area) return 1;
            if (a.speed_limit > b.speed_limit) return 1;
            return -1;
        });

    let usedData = unrolledData.filter( d => d.area === 1);

    // Set svg
    svg_unit_chart = d3.select("#unit_chart")
        .append("svg")
        .attr("width", width)
        .attr("height", height);
    let g = svg_unit_chart.append("g")
        .attr("transform", translation(margin.left, margin.top))
        .attr("class", "svg_group");

    // X scales
    speedLimits = [...new Set(unrolledData.map( d => d.speed_limit))];
    let xScale = d3.scaleBand()
        .domain(speedLimits)
        .range([0, effectiveWidth])
        .paddingInner(0.14)
        .paddingOuter(0.14);

    // Add lanes
    g.selectAll('g')
        .data(speedLimits)
        .join('g')
        .attr("class", "unit-road")
        .attr("transform", d => translation(xScale(d), 0))
        .attr('width', xScale.bandwidth())
        .attr('height', effectiveHeight)
        .on('mouseover', (d) => {
            // console.log(d.target)
        })
        .append("svg:image")
        .attr("class", "lane-image")
        .attr("xlink:href", "data/road-urban.svg")
        .attr('width', xScale.bandwidth())
        .attr('height', effectiveHeight)
        .attr('transform', translation(-xScale.bandwidth(), 0) + ", scale(3,1)")
        .attr("preserveAspectRatio", "none")

    let nCars = carNumber;

    // Add cars groups
    g.selectAll('.unit-road')
        .append('g')
        .data(usedData)
        .attr("transform", translation(0, effectiveHeight) + ", scale(1,-1)")
        .attr('class', d => 'car-group-' + d.speed_limit.toString())

    let totalNum = d3.sum(usedData, v => v.value);
    if (totalNum < nCars) nCars = Math.round(totalNum);
    let carMargin = (xScale.bandwidth() - carSize)/8;

    // FIXME: Check if any value is bigger than 0.85 since it goes behind the chart

    let getTranslateCar = (d, position) => {
        let i = d[0], partialNumber = d[1];
        let x = xScale.bandwidth()/2;

        if (i % 2 === 0) x += carMargin;
        else x += 0 - carSize - carMargin;

        let y = Math.floor(i / 2) * (carSize+carPadding) + (carSize * partialNumber + carPadding);
        if (position === "top") { y = effectiveHeight + carSize; }
        else if (position === "bottom") { y = -carSize; }
        return translation(x, y) + ", scale(1,-1)";
    }

    // Add cars
    let speedIndex = 0;
    for (let v of usedData) {
        selectedRoadOptions[v.speed_limit] = "urban";
        let totalNumber = +parseFloat(v.value / totalNum * nCars).toFixed(2);
        let roundNumber = Math.floor(totalNumber);
        let i = 0;

        // Add full cars
        while (i < roundNumber) {
            g.select(".car-group-" + v.speed_limit.toString())
                .append("svg:image")
                .data([[i, 1, speedIndex]])
                .attr('class', 'car')
                .attr("xlink:href", "data/car_2.png")
                .attr('width', carSize)
                .attr('height', carSize)
                .attr('transform', d => getTranslateCar(d, ""))
            i++;
        }

        // Add partial cars
        let partialNumber = Math.round((totalNumber - roundNumber) * 100)/100;
        if (partialNumber < 0.3) {
            speedIndex++;
            continue;
        }
        g.select(".car-group-" + v.speed_limit.toString())
            .append("svg:image")
            .data([[i, partialNumber, speedIndex]])
            .attr('class', 'car')
            .attr("xlink:href", "data/car_2.png")
            .attr('width', carSize)
            .attr('height', carSize)
            .attr('transform', d => getTranslateCar(d, ""))
            .style('clip-path', "inset(0 0 " + ((1-partialNumber)*100).toString() + "% 0)")

        speedIndex++;
    }

    // Add top and bottom rectangles
    svg_unit_chart.append('rect')
        .attr("x", 0)
        .attr("y", 0)
        .attr("height", margin.top)
        .attr("width", effectiveWidth)
        .attr("fill", "white")

    svg_unit_chart.append('rect')
        .attr("x", 0)
        .attr("y", margin.top + effectiveHeight)
        .attr("height", margin.bottom)
        .attr("width", effectiveWidth)
        .attr("fill", "white")

    let topGroup = svg_unit_chart.append('g')
        .attr('class', 'top-bar')

    // Add speed limits
    {
        let signMargin = (xScale.bandwidth() - speedSignSize)/2;
        topGroup.append('g')
            .attr('class', ' speed-signs')
            .selectAll('.speed_signs')
            .data(speedLimits)
            .join('svg:image')
            .attr("class", "speed-sign")
            .attr("transform", d => translation(xScale(d) + signMargin, margin.top - speedSignSize - speedSignMargin))
            .attr('width', speedSignSize)
            .attr('height', speedSignSize)
            .attr("xlink:href", d => "data/speed-signs/" + d + ".svg")
            .attr("preserveAspectRatio", "none")

        svg_unit_chart.selectAll('.speed_signs')
            .append('text')
            .html(d => d)
    }

    // Add urban/rural options
    {
        let optionMargin = (xScale.bandwidth() - roadOptionSize)/2;

        topGroup.append('g')
            .attr('class', ' road-options')
            .selectAll('.road-option')
            .data(speedLimits)
            .join('g')
            .attr("class", "road-option")
            .attr("transform", d => translation(xScale(d), optionMargin));

        topGroup.selectAll('.road-option')
            .append('svg:image')
            .attr("class", "road-urban clickable")
            .attr("id", d => "road-urban-" + d)
            .attr('width', roadOptionSize)
            .attr('height', roadOptionSize)
            .attr("transform", translation(optionMargin, 0))
            .attr("xlink:href", "data/road-option/urban.png")
            .attr("preserveAspectRatio", "none")
            .style("outline", "2px solid black")
            .on('click', (event, d) => {
                // g.selectAll('.car').interrupt();
                dispatch.call("unitEvent", this, {event: event, datum: [d, 'urban']});
            })
            .append('text')
            .html('Urban')

        topGroup.selectAll('.road-option')
            .append('svg:image')
            .attr("class", "road-rural clickable")
            .attr("id", d => "road-rural-" + d)
            .attr('width', roadOptionSize)
            .attr('height', roadOptionSize)
            .attr("transform", translation(optionMargin, roadOptionSize + roadOptionPadding))
            .attr("xlink:href", "data/road-option/rural.png")
            .attr("preserveAspectRatio", "none")
            .style("outline", "1px solid black")
            .on('click', (event, d) => {
                // g.selectAll('.car').interrupt();
                dispatch.call("unitEvent", this, {event: event, datum: [d, 'rural']});
            })
            .append('text')
            .html('Rural')
    }

    // Add movement to cars
    animateCars = () => {
        let rerun = false;
        g.selectAll('.car')
            // Go to top line
            .transition()
            .delay(3000)
            .duration(d => {
                let height = (effectiveHeight + carSize) - ((carSize + carPadding) * Math.floor(d[0]/2) + (carSize * d[1] + carPadding));
                return height / carSpeed[d[2]];
            })
            .ease(d3.easeLinear)
            .attr('transform', d => getTranslateCar(d, "top"))
            .on('interrupt', (d) => {
                // console.log(d);
            })
            // Return to line below
            .transition()
            .duration(1)
            .attr('transform', d => getTranslateCar(d, "bottom"))
            // Return to place
            .transition()
            .delay(1500)
            .duration(1000)
            .ease(d3.easeLinear)
            .duration(d => {
                let height = (carSize + carPadding) * Math.floor(d[0]/2) + (carSize * d[1] + carPadding) + carSize;
                return height / carSpeed[d[2]];
            })
            .attr('transform', d => getTranslateCar(d, ""))
            .on('interrupt', (d) => {
                // console.log(d);
            })
            .on("end", () => {
                if (rerun) return;

                rerun = true;
                setTimeout(animateCars, timeBetweenCarTransitions);
            })
    }

    // Make interval for animation
    new Promise(function () {
        animateCars();
    }).then(r => {});

    // Add legend for car value
    {
        let carValue = totalNum / nCars;
        let g_legend = svg_unit_chart.append("g")
            .attr("transform", translation(0, margin.top + effectiveHeight))
            .attr("class", "legend_group");

        let leftMarginLegend = effectiveWidth / 2 - carScaleSize;

        g_legend.append('svg:image')
            .attr("class", "car_scale")
            .attr("transform", d => translation(leftMarginLegend, margin.bottom / 2 - carScaleSize / 2))
            .attr('width', carScaleSize)
            .attr('height', carScaleSize)
            .attr("xlink:href", "data/car_2.png")

        g_legend.append('text')
            .attr("transform", d => translation(leftMarginLegend + carScaleSize,
                margin.bottom / 2))
            .html(' - ' + d3.format('.2s')(carValue))
    }


    // Y scales
    // let yScale = d3.scaleLinear()
    //     .domain(yScaleData)
    //     .range([0, effectiveHeight - margin.bottom])
    //     .paddingInner(0.2)
    //     .paddingOuter(0.2);

}

// Generate year slider
function gen_year_slider() {
    let minYear = d3.min(accident_data, d => d.year);
    let maxYear = d3.max(accident_data, d => d.year);

    selectedMaxYear = maxYear;
    selectedMinYear = minYear;

    let width = 1500;
    let height = 75;

    let margin = {
        top: 15,
        bottom: 25,
        left: 40,
        right: 40
    }

    yearSlider = slider_snap(minYear, maxYear, "#year_slider", width, height, margin, function(range) {
        let minYear = range[0];
        let maxYear = range[1];

        if (selectedMinYear === minYear && selectedMaxYear === maxYear) return;

        selectedMinYear = minYear;
        selectedMaxYear = maxYear;

        isDirty = true;

        setTimeout(function(){ updateIdioms(); }, 0)
    });
}

/**
* Events
*/

// Click on county
// FIXME: If clicked on i.e. isles of scilly, pyramid chart bugs out
function prepareCountyEvent() {
    svg_choropleth_map.selectAll("path").on("click", (event, datum) => {
        dispatch.call("countyEvent", this, {event: event, datum: datum});
    });

    dispatch.on("countyEvent", function(args) {
        
        let div = d3.select("body").select("#choropleth_tooltip");
        div.transition()
                    .duration(500)
                    .style("opacity", 0);

        // Get arguments
        let event = args.event, datum = args.datum;
        let id = getCountyId(datum);

        // Check if already selected
        if (selectedCounties.has(id)) {
            // Unselect
            selectedCounties.delete(id);
            Object.keys(isDirty).map(function(key, index) {
                if (key !== "1") isDirty[key] = true;
            });

            // Change stroke to unselected
            d3.select(event.target)
                .style("stroke", "black")
                .style("stroke-width", "0.2");
        }
        else {
            // Select
            selectedCounties.add(id);
            Object.keys(isDirty).map(function(key, index) {
                if (key !== "1") isDirty[key] = true;
            });

            // Change stroke to selected
            d3.select(event.target)
                .style("stroke", "black")
                .style("stroke-width", "0.5");
        }

        // Update all idioms
        setTimeout(function(){ updateIdioms(); }, 0)
    })
}

//Click on pyramid bar
function preparePyramidEvent() {

    svg_pyramid_bar_chart.selectAll("rect").on("click", (event, datum) => {
        dispatch.call("pyramidEvent", this, {event: event, datum: datum});
    });

    dispatch.on("pyramidEvent", function(args) {
        let event = args.event;
        let datum = args.datum;

        let age_band = datum[0];
        let sex;
        if (event.target.className["baseVal"] == ".bar.left"){
            sex = "1";
        }
        else if(event.target.className["baseVal"] == ".bar.right"){
            sex = "2";
        }
        else{
            return;
        }

        selectedBar = age_band + "|" + sex;

        // Check if already selected
        if (selectedPyramidBars.has(selectedBar)) {
            // Unselect
            selectedPyramidBars.delete(selectedBar);
            Object.keys(isDirty).map(function(key, index) {
                if (key !== "2") isDirty[key] = true;
            });

            // Change stroke to unselected
            d3.select(event.target)
                .style("stroke", "black")
                .style("stroke-width", "0.5");
        }
        else {
            // Select
            selectedPyramidBars.add(selectedBar);
            Object.keys(isDirty).map(function(key, index) {
                if (key !== "2") isDirty[key] = true;
            });

            let dasharray = event.target.getAttribute("width") + ",0,"
                            + event.target.getAttribute("height") + ",0,"
                            + event.target.getAttribute("width");

            // Change stroke to selected
            d3.select(event.target)
                .style("stroke", "black")
                .style("stroke-width", "3")
                .style("stroke-dasharray", (dasharray));
        }

        // Update all idioms
        setTimeout(function(){ updateIdioms(); }, 0)
    });
}

//Click on unit chart
function prepareUnitEvent() {

    dispatch.on("unitEvent", function(args) {
        // Get arguments
        let datum = args.datum;
        let speedLimit = datum[0], option = datum[1];

        // Check if already selected
        if (selectedRoadOptions[speedLimit] === option) {
            // None for now?
        }
        else {
            // Unselect previous value
            let previousOption = selectedRoadOptions[speedLimit];
            svg_unit_chart.select("#road-" + previousOption + "-" + speedLimit)
                .style("outline", "1px solid black")

            // Select new value
            selectedRoadOptions[speedLimit] = option;

            // Change stroke to selected
            svg_unit_chart.select("#road-" + option + "-" + speedLimit)
                .style("outline", "2px solid black")

            isDirty["7"] = true;
        }

        // Update all idioms
        setTimeout(function(){ updateIdioms(); }, 0)
    });
}

// Prepare buttons
function prepareButtons() {
    d3.select("#reset").on("click", function(event) {

        // Reset years
        if (selectedMinYear !== 2010 || selectedMaxYear !== 2019) {
            selectedMinYear = 2010;
            selectedMaxYear = 2019;
            isDirty = true;
        }

        isDirty = isDirty || !(selectedCounties.size === 0 && selectedPyramidBars.size === 0);

        // Unselect counties
        svg_choropleth_map.selectAll("path")
            .filter(d => {
                if (d === null) return false;
                return selectedCounties.has(getCountyId(d));
            })
            .style("stroke", "transparent");
        selectedCounties.clear();

        // Unselect bars
        svg_pyramid_bar_chart.select('.left-bar')
            .selectAll('rect')
            .style("stroke", "transparent");
        svg_pyramid_bar_chart.select('.right-bar')
            .selectAll('rect')
            .style("stroke", "transparent");
        selectedPyramidBars.clear();

        // Update all idioms to reset data
        currentAccidentData = [];

        // Recenter map
        recenterMapFunc();

        // Reset year slider
        yearSlider.reset();

        setTimeout(function(){ updateIdioms(); }, 0)
    })
}

// Update all idioms
function updateIdioms() {

    function updatePyramidBarChart() {
        // Set margins and width and height
        let margin = def_i2.margin;
        let width = def_i2.width,
            height = def_i2.height,
            effectiveWidth = width-margin.left - margin.right,
            effectiveHeight = height - margin.bottom,
            regionWidth = (effectiveWidth)/2 - margin.middle;

        // these are the x-coordinates of the y-axes
        let pointA = regionWidth,
            pointB = effectiveWidth - regionWidth;

        let groupedByAgeGender = d3.rollup(pyramid_data, v => v.length,
                d => d.age, d => d.sex);

        // Sort map
        groupedByAgeGender = new Map(
            Array.from(groupedByAgeGender)
                .filter( e => e[0] > 3)
                .sort( (a,b) => {
                    return (a[0] > b[0]) ? 1 : ((b[0] > a[0]) ? -1 : 0)
                }).reverse()
        );

        // Get max values
        let maxValue = 0;
        groupedByAgeGender.forEach( (i, e) => {
            let tmp = Math.max(...groupedByAgeGender.get(e).values());
            if (tmp > maxValue) maxValue = tmp;
        })

        // X scales
        let xScale = d3.scaleLinear()
            .domain([0, maxValue])
            .range([0, regionWidth])
            .nice();

        // X axis
        let xAxisLeft = d3.axisBottom()
            .scale(xScale.copy().range([pointA, 0]))
            .ticks(4)
            .tickFormat(d3.format(".2s"));

        let xAxisRight = d3.axisBottom()
            .scale(xScale)
            .ticks(4)
            .tickFormat(d3.format(".2s"));

        // Y scale
        let yScaleData = ageBands;

        let yScale = d3.scaleBand()
            .domain(yScaleData)
            .range([0, effectiveHeight - margin.bottom])
            .paddingInner(0.2)
            .paddingOuter(0.2);

        // Y axis
        let yAxisLeft = d3.axisRight()
            .scale(yScale)
            .tickSize(4, 0)
            .tickPadding(margin.middle - 4)
            .tickFormat(function(d,i){ return ageBands[i] })

        let yAxisRight = d3.axisLeft()
            .scale(yScale)
            .tickSize(4, 0)
            .tickFormat('');

        svg_pyramid_bar_chart.select('.left-bar')
            .selectAll('rect')
            .data(groupedByAgeGender)
            .join('rect')
            .attr("class", ".bar.left")
            .attr('x', 0)
            .attr('height', yScale.bandwidth())
            .attr('fill', '#8ECEFD')
            .transition()
            .delay(function(d,i){
                let index = yScaleData.indexOf(d[0]);
                return 1000 + (index * 200);
            })
            .duration(1000)
            .attr('width', function(d) { return xScale(d[1].get(1)); })
            .style("stroke-dasharray" , d => dasharray(xScale(d[1].get(1)), yScale.bandwidth()))
            .select("title")
            .text(d => d[1].get(1));

        svg_pyramid_bar_chart.select('.right-bar')
            .selectAll('rect')
            .data(groupedByAgeGender)
            .join('rect')
            .attr("class", ".bar.right")
            .attr('x', 0)
            .attr('height', yScale.bandwidth())
            .attr('fill', '#F88B9D')
            .transition()
            .delay(function(d,i) {
                let index = yScaleData.indexOf(d[0]);
                return 1000 + (index * 200);
            })
            .duration(1000)
            .attr('width', function(d) { return xScale(d[1].get(2)); })
            .style("stroke-dasharray" , d => dasharray(xScale(d[1].get(2)), yScale.bandwidth()))
            .select("title")
            .text(d => d[1].get(2));


        // Draw Axes
        svg_pyramid_bar_chart.select("#yAxisLeft")
            .call(yAxisLeft)
            .selectAll('text')
            .style('text-anchor', 'middle');

        svg_pyramid_bar_chart.select("#yAxisRight")
            .call(yAxisRight);

        svg_pyramid_bar_chart.select("#xAxisLeft")
            .transition()
            .delay(1000)
            .duration(2000)
            .call(xAxisLeft);

        svg_pyramid_bar_chart.select("#xAxisRight")
            .transition()
            .delay(1000)
            .duration(2000)
            .call(xAxisRight);
    }

    function update_choropleth_map() {
        let width = def_i1.width,
            height = def_i1.height,
            defaultCenter = def_i1.center,
            defaultScale = def_i1.scale;

        let projection = d3.geoMercator()
            .center(defaultCenter)
            .rotate([4.4, 0])
            .scale(defaultScale)
            .translate([width / 2, height / 2]);

        let path = d3.geoPath()
            .projection(projection);

        let g = svg_choropleth_map.select("g");

        let groupedByCounties = d3.rollup(map_data, v => v.length, d => d.county);
        groupedByCounties.delete('NaN');

        let max = Math.max(...groupedByCounties.values());
        let min = Math.min(...groupedByCounties.values());

        // Gets choropleth color scale
        let colorScaleMap = d3.scaleLinear()
            .domain([0, max])
            .range(['rgba(255, 170, 170, 1)', 'rgba(255, 21, 21, 1)']);

        let div = d3.select("body").select("#choropleth_tooltip");

        // Update legend
        let countScale = d3.scaleLinear()
            .domain([0, max])
            .range([0, def_i1.legendHeight])

        //Calculate the variables for the temp gradient
        let numStops = 4;
        let countRange = countScale.domain();
        countRange[2] = countRange[1] - countRange[0];
        let countPoint = [];
        for(let i = 0; i < numStops; i++) {
            countPoint.push(i * countRange[2]/(numStops-1) + countRange[0]);
        }

        //Create the gradient
        d3.select("#legend-map")
            .attr("y1", "0%").attr("x1", "0%")
            .attr("y2", "100%").attr("x2", "0%")
            .selectAll("stop")
            .data(d3.range(numStops))
            .enter()
            .join("stop")
            .attr("offset", function(d,i) {
                return countScale( countPoint[i] )/ def_i1.legendHeight;
            })
            .attr("stop-color", function(d,i) {
                return colorScaleMap( countPoint[i] );
            });

        d3.select("#legendRect")
            .style("fill", "url(#legend-map)");

        //Define legend axis
        let legendAxis = d3.axisRight()
            .ticks(4)
            .tickFormat(d3.format("0.2s"))
            .scale(countScale);

        //Set up legend axis
        d3.select("#legend-axis")
            .transition()
            .delay(1000)
            .duration(1000)
            .call(legendAxis);

        // Display the map
        // Add counties
        g.selectAll("path")
            .on("mouseover", function(event,d) {
                div.transition()
                    .duration(200)
                    .style("opacity", .9);

                let value = groupedByCounties.get(getCountyId(d));
                if (value === undefined) value = "N/A";
                div.html(getCountyName(d) + " - Number: " + value)
                    .style("left", (event.pageX) + "px")
                    .style("top", (event.pageY - 28) + "px");

                // Check if not selected
                if (!selectedCounties.has(getCountyId(d))) {
                    d3.select(event.target)
                        .style("stroke", "black")
                        .style("stroke-width", "0.2");
                }
            })
            .on("mouseout", function(event, d) {
                div.transition()
                    .duration(500)
                    .style("opacity", 0);

                // Check if not selected
                if (!selectedCounties.has(getCountyId(d))) {
                    d3.select(event.target)
                        .style("stroke", "transparent");
                }
            })
            .transition()
            .delay(300)
            .duration(1000)
            .attr("d", path)
            .attr("fill", function (d) {
                if (!groupedByCounties.has(getCountyId(d)) || groupedByCounties.get(getCountyId(d)) === undefined) {
                    return "grey";
                }
                return colorScaleMap(groupedByCounties.get(getCountyId(d)));
            });

    }

    function updateUnitChart() {
        // Get sizes
        let margin = def_i7.margin;
        let width = def_i7.width,
            height = def_i7.height,
            effectiveWidth = width-margin.left - margin.right,
            effectiveHeight = height - margin.top - margin.bottom;

        unit_data = d3.rollup(currentAccidentData, v => v.length,
            d => d.area, d => d.speed_limit);

        let unrolledData = unroll(unit_data, ['area','speed_limit']);
        unrolledData = unrolledData.filter( d => {
            return d.area !== 3 && d.speed_limit >= 20;
        })
            .sort( (a,b) => {
                if (a.speed_limit > b.speed_limit) return 1;
                return -1;
            });

        let usedData = unrolledData.filter( (d,i) => {
            let selected = selectedRoadOptions[d.speed_limit];
            let current = translations.Urban_or_Rural_Area[d.area].toLowerCase();
            return selected === current;
        });

        let xScale = d3.scaleBand()
            .domain(speedLimits)
            .range([0, effectiveWidth])
            .paddingInner(0.14)
            .paddingOuter(0.14);

        let g = svg_unit_chart.select(".svg_group");

        // Modify lanes
        g.selectAll('.lane-image')
            .data(speedLimits)
            .join('.lane-image')
            .attr("xlink:href", d => "data/road-" + selectedRoadOptions[d] + ".svg")

        // FIXME: stop transition but don't just remove the cars, transition them
        // Stop current transition
        g.selectAll(".car").interrupt();

        // Delete all cars
        g.selectAll(".car").remove();

        // Get car values
        let nCars = carNumber;
        let totalNum = d3.sum(usedData, v => v.value);
        if (totalNum < nCars) nCars = Math.round(totalNum);
        let carMargin = (xScale.bandwidth() - carSize)/8;

        let getTranslateCar = (d, position) => {
            let i = d[0], partialNumber = d[1];
            let x = xScale.bandwidth()/2;

            if (i % 2 === 0) x += carMargin;
            else x += 0 - carSize - carMargin;

            let y = Math.floor(i / 2) * (carSize+carPadding) + (carSize * partialNumber + carPadding);
            if (position === "top") { y = effectiveHeight + carSize; }
            else if (position === "bottom") { y = -carSize; }
            return translation(x, y) + ", scale(1,-1)";
        }

        // Add cars
        let speedIndex = 0;
        for (let v of usedData) {
            let totalNumber = +parseFloat(v.value / totalNum * nCars).toFixed(2);
            let roundNumber = Math.floor(totalNumber);
            let i = 0;

            // Add full cars
            while (i < roundNumber) {
                g.select(".car-group-" + v.speed_limit.toString())
                    .append("svg:image")
                    .data([[i, 1, speedIndex]])
                    .attr('class', 'car')
                    .attr("xlink:href", "data/car_2.png")
                    .attr('width', carSize)
                    .attr('height', carSize)
                    .attr('transform', d => getTranslateCar(d, ""))
                i++;
            }

            // Add partial cars
            let partialNumber = Math.round((totalNumber - roundNumber) * 100)/100;
            if (partialNumber < 0.3) {
                speedIndex++;
                continue;
            }
            g.select(".car-group-" + v.speed_limit.toString())
                .append("svg:image")
                .data([[i, partialNumber, speedIndex]])
                .attr('class', 'car')
                .attr("xlink:href", "data/car_2.png")
                .attr('width', carSize)
                .attr('height', carSize)
                .attr('transform', d => getTranslateCar(d, ""))
                .style('clip-path', "inset(0 0 " + ((1-partialNumber)*100).toString() + "% 0)")

            speedIndex++;
        }

        // Make interval for animation
        new Promise(function () {
            animateCars();
        }).then(r => {});

        // Update legend for car value
        {
            let carValue = totalNum / nCars;
            let g_legend = svg_unit_chart.select(".legend_group");

            g_legend.select('text')
                .html(' - ' + d3.format('.2s')(carValue))
        }
    }

    let count = 0;
    let maxCount = 3;

    function updateDirty() {
        if (count !== maxCount) return;
        Object.keys(isDirty).map(function(key, index) {
            isDirty[key] = false;
        });
    }

    new Promise(function(resolve, reject) {
        getFilteredData();
        resolve();
    }).then(function(val) {
        new Promise(function(resolve, reject) {
            if (isDirty["1"])  update_choropleth_map();
            resolve();
        }).then( r => {
            count++;
            updateDirty();
        });

        new Promise(function(resolve, reject) {
            if (isDirty["2"])  updatePyramidBarChart();
            resolve();
        }).then( r => {
            count++;
            updateDirty();
        });

        new Promise(function(resolve, reject) {
            if (isDirty["7"])  updateUnitChart();
            resolve();
        }).then( r => {
            count++;
            updateDirty();
        });
    });
}

// Update data according to filters
function getFilteredData() {

    // Check if filters reset
    if (currentAccidentData.length === 0) {
        isDirty = false;
        currentAccidentData = accident_data;
        map_data = currentAccidentData;
        pyramid_data = currentAccidentData;
        other_data = currentAccidentData;
        return;
    }

    let pyramidFilters = filtersPyramidBar();

    currentAccidentData = accident_data.filter( d => {
        let f1 = d.year >= selectedMinYear && d.year <= selectedMaxYear;

        return f1;
    });

    map_data = currentAccidentData.filter( d => {
        let f3 =  (pyramidFilters.sex_filter.size === 0) || pyramidFilters.sex_filter.has(d.sex);

        let f4 =  (pyramidFilters.age_filter.size === 0) || pyramidFilters.age_filter.has(d.age);

        return f3 && f4;
    });

    pyramid_data = currentAccidentData.filter(d => {
        let f2 = selectedCounties.size === 0 || selectedCounties.has(d.county);

        return f2;
    })

    other_data = accident_data.filter( d => {
        let f1 = d.year >= selectedMinYear && d.year <= selectedMaxYear;
        let f2 = selectedCounties.size === 0 || selectedCounties.has(d.county);
        let f3 = (pyramidFilters.sex_filter.size === 0) || pyramidFilters.sex_filter.has(d.sex);
        let f4 = (pyramidFilters.age_filter.size === 0) || pyramidFilters.age_filter.has(d.age);

        return f1 && f2 && f3 && f4;
    })
}

/**
 * Helpers
 */
function translation(x,y) {
    return 'translate(' + x + ',' + y + ')';
}

function getCountyName(feature) {
    return feature.properties.LAD13NM;
}

function getCountyId(feature) {
    return feature.properties.LAD13CDO;
}

function dasharray(w,h){
    return w + ",0," + h + ",0," + w;
}

function filtersPyramidBar(){
    let array = Array.from(selectedPyramidBars);

    let sexFilters = new Set();
    let ageFilters = new Set();

    for(let i = 0 ; i < array.length ; i++){
        let age_sex = array[i].split("|");
        sexFilters.add(parseInt(age_sex[1]));
        ageFilters.add(parseInt(age_sex[0]));
    }

    return {sex_filter: sexFilters, age_filter: ageFilters};
}

function unroll(rollup, keys, label = "value", p = {}) {
    return Array.from(rollup, ([key, value]) =>
        value instanceof Map
            ? unroll(value, keys.slice(1), label, Object.assign({}, { ...p, [keys[0]]: key } ))
            : Object.assign({}, { ...p, [keys[0]]: key, [label] : value })
    ).flat();
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function barToString(event,datum){
    let age_band = datum[0];
    let sex;
    if (event.target.className["baseVal"] == ".bar.left"){
        sex = "1";
    }
    else if(event.target.className["baseVal"] == ".bar.right"){
        sex = "2";
    }
    else{
        return;
    }

    return age_band + "|" + sex;
}