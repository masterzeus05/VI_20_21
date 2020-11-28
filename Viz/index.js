let accident_data = null;
let uk_data = null;

let map_data = null;
let pyramid_data = null;
let test_data = null;

let svg_choropleth_map;
let svg_pyramid_bar_chart = null;


let selectedCounties = new Set();
let selectedPyramidBars = new Set();
let selectedMinYear, selectedMaxYear;
let currentAccidentData = null;
let isDirty = false;

let ageBandsKeys = Object.keys(translations.Age_Band_of_Driver)
    .filter( (k) => k > 3)
    .reverse();
let ageBands = ageBandsKeys.map( k => translations.Age_Band_of_Driver[k]);

let yearSlider;

let dispatch = d3.dispatch("countyEvent", "pyramidEvent");

// Choropleth Map Chart Settings
let def_i1 = {
    margin: {
        top: 20,
        right: 20,
        bottom: 32,
        left: 20,
        middle: 24
    },
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

// MAIN
getData();

// Gets data from dataset
function getData() {
    d3.dsv(";", "data/Accidents_with_county_union_zip2.csv", function(d) {
        return {
            // Accident_Severity: +d.Accident_Severity,
            Age_Band_of_Driver: +d.Age_Band_of_Driver,
            county: d.county,
            // Index: d.Index,
            // Day_of_Week: +d.Day_of_Week,
            // Light_Conditions: +d.Light_Conditions,
            // Number_of_Casualties: +d.Number_of_Casualties,
            // Number_of_Vehicles: +d.Number_of_Vehicles,
            // Road_Surface_Conditions: +d.Road_Surface_Conditions,
            // Road_Type: +d.Road_Type,
            Sex_of_Driver: +d.Sex_of_Driver,
            // Speed_limit: +d.Speed_limit,
            // Time: d.Time,
            // Timestamp: new Date(d.Date + ' ' + d.Time),
            // Urban_or_Rural_Area: +d.Urban_or_Rural_Area,
            // Vehicle_Type: +d.Vehicle_Type,
            // Vehicle_Year: +d.Vehicle_Year,
            // Weather_Conditions: +d.Weather_Conditions,
            Year: +d.Year,
            // make: d.make
        }
    }).then(function(data, error) {
        if (error != null) {
            console.log(error);
        }
        test_data = d3.rollup(data, v => v.length,
            d => d.Year, d => d.Sex_of_Driver, d => d.Age_Band_of_Driver, d => d.county)
        test_data = unroll(test_data, ['year','sex','age','county']);

        accident_data = test_data;
        currentAccidentData = test_data;

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

    // Year slider
    gen_year_slider();

    // Events
    prepareCountyEvent();
    preparePyramidEvent();
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
            .delay(300)
            .duration(1000)
            .call(zoom.transform, transform);
    }

    svg_choropleth_map.call(zoom);

    let groupedByCounties = d3.rollup(accident_data, v => d3.sum(v , d => d.value), d => d.county);
    groupedByCounties.delete('NaN');

    let max = Math.max(...groupedByCounties.values());
    let min = Math.min(...groupedByCounties.values());

    // Gets choropleth color scale
    let colorScaleMap = d3.scaleLinear()
        .domain([min, max])
        .range(['rgba(255, 170, 170, 1)', 'rgba(255, 21, 21, 1)']);


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
            div.html(getCountyName(d) + " - Number: " + groupedByCounties.get(getCountyId(d)))
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
    let groupedByAgeGender = d3.rollup(accident_data, v => d3.sum(v , d => d.value), d => d.age, d => d.sex);
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
        .tickFormat(d3.format(".0s"));

    let xAxisRight = d3.axisBottom()
        .scale(xScale)
        .ticks(5)
        .tickFormat(d3.format(".0s"));

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
                    .style("stroke-width", "0.5")
                    .style("stroke-dasharray", (dasharray(xScale(d[1].get(1)), yScale.bandwidth())))
            }
        })
        .on("mouseout", function(event, d) {
            // Check if not selected
            if (!selectedPyramidBars.has(barToString(event,d))) {
                d3.select(event.target)
                    .style("stroke", "transparent");
            }
        })
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
        .attr('fill', '#F88B9D')
        .append("title")
        .text(d => d[1].get(2));
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

        updateIdioms();
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
            isDirty = true;

            // Update all idioms
            updateIdioms();

            // Change stroke to unselected
            d3.select(event.target)
                .style("stroke", "black")
                .style("stroke-width", "0.2");
        }
        else {
            // Select
            selectedCounties.add(id);
            isDirty = true;

            // Update all idioms
            updateIdioms();

            // Change stroke to selected
            d3.select(event.target)
                .style("stroke", "black")
                .style("stroke-width", "0.5");
        }
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
            isDirty = true;

            // Update all idioms
            updateIdioms();

            // Change stroke to unselected
            d3.select(event.target)
                .style("stroke", "black")
                .style("stroke-width", "0.5");
        }
        else {
            // Select
            selectedPyramidBars.add(selectedBar);
            isDirty = true;

            let dasharray = event.target.getAttribute("width") + ",0,"
                            + event.target.getAttribute("height") + ",0,"
                            + event.target.getAttribute("width");

            // Update all idioms
            updateIdioms();

            // Change stroke to selected
            d3.select(event.target)
                .style("stroke", "black")
                .style("stroke-width", "3")
                .style("stroke-dasharray", (dasharray));
        }

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
        updateIdioms();

        // Recenter map
        recenterMapFunc();

        // Reset year slider
        yearSlider.reset();
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

        let groupedByAgeGender = d3.rollup(pyramid_data, v => d3.sum(v , d => d.value), d => d.age, d => d.sex);

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
            .tickFormat(d3.format(".0s"));

        let xAxisRight = d3.axisBottom()
            .scale(xScale)
            .ticks(4)
            .tickFormat(d3.format(".0s"));

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
            .style("stroke-dasharray" , function(d) { 
                let bar_string = d[0] + "|1";
                if (selectedPyramidBars.has(bar_string)){
                    return (dasharray(xScale(d[1].get(1)), yScale.bandwidth()))
                }
                else{
                    return "none";
                }  
            })
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
            .style("stroke-dasharray" , function(d) { 
                let bar_string = d[0] + "|2";
                if (selectedPyramidBars.has(bar_string)){
                    return (dasharray(xScale(d[1].get(2)), yScale.bandwidth()))
                }
                else{
                    return "none";
                }  
            })
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

        let groupedByCounties = d3.rollup(map_data, v => d3.sum(v , d => d.value), d => d.county);
        groupedByCounties.delete('NaN');

        let max = Math.max(...groupedByCounties.values());
        let min = Math.min(...groupedByCounties.values());

        // Gets choropleth color scale
        let colorScaleMap = d3.scaleLinear()
            .domain([min, max])
            .range(['rgba(255, 170, 170, 1)', 'rgba(255, 21, 21, 1)']);

        let div = d3.select("body").select("#choropleth_tooltip");

        // Display the map
        // Add counties
        g.selectAll("path")
            .data(uk_data.features)
            .join("path")
            .on("mouseover", function(event,d) {
                div.transition()
                    .duration(200)
                    .style("opacity", .9);
                div.html(getCountyName(d) + " - Number: " + groupedByCounties.get(getCountyId(d)))
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

    if (!isDirty) {
        return;
    }

    getFilteredData();

    updatePyramidBarChart();
    update_choropleth_map();
}

// Update data according to filters
function getFilteredData() {

    // Check if filters reset
    if (currentAccidentData.length === 0) {
        isDirty = false;
        currentAccidentData = accident_data;
        map_data = currentAccidentData;
        pyramid_data = currentAccidentData;
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