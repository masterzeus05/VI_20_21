let accident_data = null;
let uk_data = null;

let map_data = null;
let pyramid_data = null;
let alluvial_data = null;
let calendar_data = null;
let other_data = null;
let default_data = {};
let hasReset = false;

let svg_choropleth_map;
let svg_pyramid_bar_chart = null;
let svg_alluvial_chart = null;

let svg_calendar_heatmap = null;
let svg_radar_chart = null;
let svg_unit_chart = null;

let selectedCounties = new Set();
let selectedPyramidBars = new Set();
let selectedPyramidSex = new Set();
let selectedAlluvialLabels = new Set();
let selected_month_dow = new Set();
let selectedMinYear, selectedMaxYear;
let selectedRoadOptions = {};
let currentAccidentData = null;
let isDirty = {1: false, 2: false, 3: false, 4: false, 5: false, 6: false, 7: false};

let countiesDropdown;

let ageBandsKeys = Object.keys(translations.Age_Band_of_Driver)
    .filter( (k) => k > 3)
    .reverse();
let ageBands = ageBandsKeys.map( k => translations.Age_Band_of_Driver[k]);
let speedLimits = [];

let yearSlider;

let dispatch = d3.dispatch("countyEvent", "pyramidEvent", "unitEvent","pyramidMaleEvent","pyramidFemaleEvent","alluvialEvent", 'heatmapEvent');

let minYearAccidentData;
let maxYearAccidentData;

const ticksDoW = range(7, 1);
const daysOfWeek = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"]

const ticksDays = range(31, 1);

const ticksWeekN = range(54, 1);

const hours = range(13, 0);

const ticksMonth = range(12, 1);
const months = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"]

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

// Alluvial Chart Settings
let def_i3 = {
    margin: {
        top: 12,
        right: 20,
        bottom: 42,
        left: 20,
        middle: 24
    },
    width: 600,
    height: 400
}

// Lines Chart Settings
let def_i4 = {
    margin: {
        top: 40,
        right: 20,
        bottom: 47,
        left: 59,
        middle: 24
    },
    width: 550,
    height: 400
}

// Radar Chart Settings
let def_i5 = {
    padding: 30,
    width: 500,
    height: 500,
    legendWidth: 200,
    legendHeight: 50
}

// Calendar Heatmap Settings
let def_i6 = {
    width: 500,
    height: 300,
    padding: 10,
    levels: 3,
    opacity: 0.1,
    labelFactor: 1.1
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
    height: 800,
    // Car and speed limit signs options
    carNumber: 40,
    carSize: 25,
    carPadding: 7,
    carSpeed: [0.10, 0.11, 0.12, 0.14, 0.16, 0.18],
    speedSignSize: 40,
    speedSignMargin: 2,
    timeBetweenCarTransitions: 15000, // ms
    carScaleSize: 25,
    roadOptionSize: 30,
    roadOptionPadding: 5
}

let animateCars;

// MAIN
getData();

// Gets data from dataset
function getData() {
    d3.dsv(";", "data/dataset_2010s_zip.csv", function(d) {
        return {
            // Accident_Severity: +d.Accident_Severity,
            age: +d.Age_Band_of_Driver,
            county: d.county,
            // Index: d.Index,
            light: +d.Light_Conditions,
            dow: +d.Day_of_Week,
            number_of_casualties: +d.Number_of_Casualties,
            // Number_of_Vehicles: +d.Number_of_Vehicles,
            road_surface: +d.Road_Surface_Conditions,
            // Road_Type: +d.Road_Type,
            sex: +d.Sex_of_Driver,
            speed_limit: +d.Speed_limit,
            time: d.Time,
            date: d.Date,
            area: +d.Urban_or_Rural_Area,
            // Vehicle_Type: +d.Vehicle_Type,
            vehicle_year: +d.Vehicle_Year,
            weather: +d.Weather_Conditions,
            year: +d.Year,
            make: d.make
        }
    }).then(function(data, error) {
        if (error != null) {
            console.log(error);
        }

        accident_data = data;
        currentAccidentData = data;
        other_data = data;

        d3.json("data/uk_topo.json").then(function(topology) {
            let features = topojson.feature(topology, topology.objects.lad).features
            uk_data = features;

            countiesDropdown = features.map( d => {
                return {id: getCountyId(d), name: getCountyName(d) }
            }).sort( (a,b) => a.name.localeCompare(b.name));

            processData();
        });

    });
}

// After getting data, generate idioms and prepare events
function processData() {
    // Idioms
    gen_choropleth_map();
    gen_pyramid_bar_chart();
    gen_lines_chart();
    gen_alluvial_chart();

    gen_calendar_heatmap();
    gen_radial_chart();
    gen_unit_chart();
    // Year slider
    gen_year_slider();

    // Events
    prepareCountyEvent();
    preparePyramidEvent();
    prepareAlluvialEvent();
    prepareHeatmapEvent();
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

    default_data[1] = groupedByCounties;

    let max = Math.max(...groupedByCounties.values());

    // Gets choropleth color scale
    let colorScaleMap = d3.scaleLinear()
        .domain([0, max])
        .range(['rgba(255, 170, 170, 1)', 'rgba(255, 21, 21, 1)']);

    // Add dropdown
    let dropdown = d3.select("#choropleth_map").append("select")
        .attr("id", "county-select")
        .attr("multiple", "multiple")
        .style("left", 20 + "px")
        .style("top", (def_i1.margin.top*0.85) + "px");

    dropdown.selectAll("option")
        .data(countiesDropdown)
        .enter()
        .append("option")
        .attr("id", function (d) { return "C" + d.id; })
        .attr("value", function (d) { return d.id; })
        .text(function (d) {
            return d.name; // capitalize 1st letter
        })
        .on("mousedown", (event) => {
            let el = event.target;
            let countyId = el.value;
            let node = svg_choropleth_map.select("#C" + countyId).node();
            dispatch.call("countyEvent", this, {event: {target: node}, datum: { properties: {LAD13CDO: countyId} } });

            if (el.tagName.toLowerCase() === 'option' && el.parentNode.hasAttribute('multiple')) {
                event.preventDefault();

                // Get current scroll
                let scrollTop = el.parentNode.scrollTop;

                setTimeout(() => el.parentNode.scrollTo(0, scrollTop), 0);

                return false;
            }
        });

    // Add legend
    let legend_g = svg_choropleth_map
        .append('g')
        .attr('id', 'legend-svg')
        .attr('width', def_i1.legendWidth)
        .attr('height', def_i1.legendHeight)
        .attr('transform', translation(-def_i1.margin.right,def_i1.margin.top * 1.4));

    legend_g.append("rect")
        .attr('width', def_i1.legendWidth * 0.9)
        .attr('height', def_i1.legendHeight * 1.2)
        .attr("fill", "white")
        .attr("rx", 10)
        .attr("transform", translation(width - def_i1.margin.right*1.7, -10))
        .style("stroke", "black")


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
        .tickFormat(d3.format(".2s"))
        .scale(countScale);

    //Set up legend axis
    legend_g.append("g")
        .attr("id", "legend-axis")
        .attr("transform", translation(width - def_i1.margin.right*1.5 + 10, 0))
        .call(legendAxis);


    // Display the map
    // Add counties
    g.selectAll("path")
        .data(uk_data)
        .enter().append("path")
        .attr("d", path)
        .attr("id", d => "C" + getCountyId(d))
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

    default_data[2] = groupedByAgeGender;

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
        .ticks(4)
        .tickFormat(d3.format(".2s"));

    let xAxisRight = d3.axisBottom()
        .scale(xScale)
        .ticks(4)
        .tickFormat(d3.format(".2s"));

    // Y scale
    let yScale = d3.scaleBand()
        .domain(ageBandsKeys)
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
        .attr('id','maleLabel')
        .attr( 'transform', translation(regionWidth - margin.left,3) + ', scale(-1,1)')
        .style( 'font', '15px sans-serif' )
        .attr( 'text-anchor', 'start' )
        .html("Male")
        .on("mouseover", function(event) {
            // Check if not selected
            if (!selectedPyramidSex.has("1")) {
                d3.select(event.target)
                    .style("font-weight", "bold");
            }
        })
        .on("mouseout", function(event) {
            // Check if not selected
            if (!selectedPyramidSex.has("1")) {
                d3.select(event.target)
                .style("font-weight", "normal");
            }
        })

    let rightBarGroup = g.append('g')
        .attr('transform', 'translate(' + pointB + ',0)')
        .attr('class', 'right-bar');

    rightBarGroup.append( 'text' )
        .attr('id','femaleLabel')
        .attr( 'transform', translation(regionWidth - 3*margin.right,3))
        .style( 'font', '15px sans-serif' )
        .attr( 'text-anchor', 'start' )
        .html("Female")
        .on("mouseover", function(event) {
            // Check if not selected
            if (!selectedPyramidSex.has("2")) {
                d3.select(event.target)
                    .style("font-weight", "bold");
            }
        })
        .on("mouseout", function(event) {
            // Check if not selected
            if (!selectedPyramidSex.has("2")) {
                d3.select(event.target)
                .style("font-weight", "normal");
            }
        })

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

// Generate alluvial chart
function gen_alluvial_chart() {
    let margin = def_i3.margin;
    let width = def_i3.width,
        height = def_i3.height,
        effectiveWidth = width - margin.left - margin.right,
        effectiveHeight = height - margin.bottom - margin.top;

    svg_alluvial_chart = d3.select("#alluvial_chart")
                           .append("svg")
                           .attr("width", width)
                           .attr("height", height);

    let g = svg_alluvial_chart.append("g")
                              .attr("transform", translation(margin.left, margin.top))
                              .attr("class", "svg_group");

    let filteredAccidentData = accident_data.filter(d => {
        return d.road_surface !== "" && !isNaN(d.road_surface) && d.road_surface !== -1
            && d.light !== "" && !isNaN(d.light) && d.light !== -1
            && d.weather !== "" && !isNaN(d.weather) && d.weather !== -1
            && d.weather !== 8 && d.weather !== 9;
    })

    filteredAccidentData = filteredAccidentData.map(function(d){
        return {
            road_surface: translations_for_alluvial.Road_Surface_Conditions[d.road_surface],
            light: translations_for_alluvial.Light_Conditions[d.light],
            weather: translations_for_alluvial.Weather_Conditions[d.weather],
            wind: translations_for_alluvial.Weather_Conditions_wind[d.weather]
        }
    } )

    filteredAccidentData = d3.rollup(filteredAccidentData, v => v.length, d => d.road_surface, d => d.light, d => d.weather, d => d.wind)
    let keys = ['road_surface','light','weather','wind', 'value']
    filteredAccidentData = unroll(filteredAccidentData, keys);

    default_data[3] = filteredAccidentData;

    let graph = dataToGraph(filteredAccidentData,keys.slice(0, -1));
    let sankey = d3.sankey()
               .nodeSort(function(a, b){return a.name.localeCompare(b.name);})
               .linkSort(null)
               .nodeWidth(10)
               .nodePadding(2)
               .extent([[0, 5], [effectiveWidth, effectiveHeight]])
    let color = d3.scaleOrdinal(["#abc4d6", "#b6abd6","#d6abb3", "#d6abd3"]).domain(["Dry","Snow","Wet or damp","Other"])

    const {nodes, links} = sankey({
        nodes: graph.nodes.map(d => Object.assign({}, d)),
        links: graph.links.map(d => Object.assign({}, d))});

    g.append("g")
    .attr('id', 'nodes_rect')
    .selectAll("rect")
    .data(nodes)
    .join("rect")
    .attr("x", d => d.x0)
    .attr("y", d => d.y0)
    .attr("height", d => d.y1 - d.y0)
    .attr("width", d => d.x1 - d.x0)
    .append("title")
    .text(d => `${d.name}\n${d.value.toLocaleString()}`);

    g.append("g")
    .attr('id', 'links_path')
    .attr("fill", "none")
    .selectAll("g")
    .data(links)
    .join("path")
    .attr("d", d3.sankeyLinkHorizontal())
    .attr("stroke", function(d){
        return color(d.names[0])
    })
    .attr("stroke-width", d => d.width)
    .style("mix-blend-mode", "multiply")
    .append("title")
    .text(d => `${d.names.join(" → ")}\n${d.value.toLocaleString()}`);

    g.append("g")
    .attr('id', 'nodes_label')
    .style("font", "15px sans-serif")
    .selectAll("text")
    .data(nodes)
    .join("text")
    .attr("x", d => d.x0 < width / 2 ? d.x1 + 6 : d.x0 - 6)
    .attr("y", d => (d.y1 + d.y0) / 2)
    .attr("dy", "0.35em")
    .attr("text-anchor", d => d.x0 < width / 2 ? "start" : "end")
    .text(function(d){
        return d.name})
    .on("mouseover", function(event,d) {
        // Check if not selected
        if (!selectedAlluvialLabels.has(d.name)) {
            d3.select(event.target)
                .style("font-weight", "bold")
        }
    })
    .on("mouseout", function(event, d) {
        // Check if not selected
        if (!selectedAlluvialLabels.has(d.name)) {
            d3.select(event.target)
                .style("font-weight", "normal");
        }
    })
    // .append("tspan")
    // .attr("fill-opacity", 0.7)
    // .text(d => ` ${d.value.toLocaleString()}`);

    names_in_viz = {"road_surface": "Road Surface",
                    "light": "Light",
                    "weather": "Weather",
                    "wind": "Wind"
                    }

    svg_alluvial_chart.append("text")
    .attr("text-anchor", "begin")
    .attr("x", margin.left)
    .attr("y", height - 20)
    .text(names_in_viz[keys[0]]);

    svg_alluvial_chart.append("text")
    .attr("text-anchor", "middle")
    .attr("x", margin.left + effectiveWidth/3)
    .attr("y", height - 20)
    .text(names_in_viz[keys[1]]);

    svg_alluvial_chart.append("text")
    .attr("text-anchor", "middle")
    .attr("x", margin.left + (effectiveWidth/3)*2)
    .attr("y", height - 20)
    .text(names_in_viz[keys[2]]);

    svg_alluvial_chart.append("text")
    .attr("text-anchor", "end")
    .attr("x", margin.left + (effectiveWidth/3)*3)
    .attr("y", height - 20)
    .text(names_in_viz[keys[3]]);

}

// Generate lines chart
function gen_lines_chart() {
    let key;
// Set margins and width and height
    let margin = def_i4.margin;
    let width = def_i4.width,
        height = def_i4.height,
        effectiveWidth = width-margin.left - margin.right,
        effectiveHeight = height - margin.bottom - margin.top;

    // Get custom dataset
    let filteredAccidentData = accident_data.filter(d => {
        return d.vehicle_year !== "" && d.vehicle_year !== -1
            && d.make !== "" && d.make !== "Not known"
            && d.number_of_casualties !== "" && d.number_of_casualties >= 0;
    })

    default_data[4] = filteredAccidentData;

    worst_makes = (Array.from(
        d3.rollup(filteredAccidentData, v=> d3.sum(v, d=> d.number_of_casualties), d=>d.make))
          .sort(function(a, b){return a[1]-b[1]})
          .reverse()
          .slice(0,5)
        ).map(x => x[0]);

    let groupedByMakeAndYear = d3.group(filteredAccidentData, d => d.make, d => d.vehicle_year);
    let min_Vehicle_Year = d3.min(filteredAccidentData, d => d.vehicle_year);
    let max_Vehicle_Year = d3.max(filteredAccidentData, d => d.vehicle_year);

    let numberOfAccidentsPerYear = d3.rollup(filteredAccidentData, v=> v.length, d=>d.vehicle_year, d=>d.make);

    let yearCasualtiesByMake = new Map()

    let maxY = 0;
    let min_year = 2020;
    let max_year = 0;
    for (let key of worst_makes){ // for each make
        let dict = {};
        let dicts = [];
        for (i = min_Vehicle_Year; i <= max_Vehicle_Year; i++){

            if(groupedByMakeAndYear.get(key).get(i) == null){
                dict.Year = i;
                dict.n = 0;
            }
            else{
                max_year = Math.max(max_year,i)
                min_year = Math.min(min_year,i);
                dict.Year = i;
                dict.n = d3.sum(groupedByMakeAndYear.get(key).get(i), d=>d.number_of_casualties)/
                            numberOfAccidentsPerYear.get(i).get(key);
                maxY = ( dict.n > maxY ) ? dict.n : maxY;
            }
            dicts.push(dict);
            dict = {};
        }
        yearCasualtiesByMake.set(key, dicts);
    }

    min_Vehicle_Year = min_year;
    max_Vehicle_Year = max_year;

    for (key of yearCasualtiesByMake.keys()){
        let updated_values = yearCasualtiesByMake.get(key).filter(d => d.Year >= min_Vehicle_Year && d.Year <= max_Vehicle_Year);
        yearCasualtiesByMake.set(key,updated_values);
    }

    // set the ranges

    var yearsDomain=[];
    for (i = min_Vehicle_Year; i <= max_Vehicle_Year; i++){
        yearsDomain.push(i);  
    }

    var x = d3.scaleLinear()
              .domain([min_Vehicle_Year,max_Vehicle_Year])
              .range([0, effectiveWidth]);

    var y = d3.scaleLinear()
              .domain([0, maxY])
              .range([effectiveHeight, 0]);

    var svg = d3.select("#line_chart")
                .append("svg")
                .attr("width", width)
                .attr("height", height)
                .append("g")
                .attr("transform", translation(margin.left,margin.top));

    var line = d3.line()
                 .x(function(d) { return x(d.year); })
                 .y(function(d) { return y(d.casualties); });

    var color = d3.scaleOrdinal(d3.schemeCategory10)
                  .domain(worst_makes);

    var makes = color.domain().map(function(name) {
        return {
          name: name,
          values: yearCasualtiesByMake.get(name).map(function(d) {
            return {
              year: d.Year,
              casualties: d.n
            };
          })
        };
    });

    svg.append("text")
    .attr("text-anchor", "end")
    .attr("y", -50)
    .attr("x", -50)
    .attr("dy", ".75em")
    .attr("transform", "rotate(-90)")
    .text("Number of casualties per accident");

    svg.append("text")
    .attr("text-anchor", "middle")
    .attr("font-size",20)
    .style("font-weight", "bold")
    .attr("y", -13)
    .attr("x", effectiveWidth/2)
    .text("Makes with more casualties");

    svg.append("text")
    .attr("text-anchor", "end")
    .attr("x", width/2 - 20)
    .attr("y", effectiveHeight+35)
    .text("Year");

    // var make = svg.selectAll(".make")
    // .data(makes)
    // .enter().append("g")
    // .attr("class", "make");

    svg.append("g")
        .attr("id", "makes")
        .selectAll("path")
        .data(makes)
        .join("path")
        .attr("class", "line")
        .attr("d", function(d) {
            return line(d.values);
        })
        .style("stroke", function(d) {
            return color(d.name);
        })
        .on('mouseover', mouseover)
        .on('mousemove', mousemove)
        .on('mouseout', mouseout);

    svg.append("g")
       .attr('id', 'xAxis')
       .attr("transform", translation(0,effectiveHeight))
       .call(d3.axisBottom(x).ticks(10).tickFormat(d3.format("d")) );

    svg.append("g")
       .attr('id', 'yAxis')
       .call(d3.axisLeft(y));

    var focus = svg
    .append('g')
    .append('circle')
    .attr('id', 'focus')
        .style("fill", "none")
        .attr("stroke", "black")
        .attr('r', 2.5)
        .style("opacity", 0)


    var focusText = d3.select("body").append("div")
    .attr("class", "tooltip")
    .attr("id","focus_text")
        .style("opacity", 0)

    var size = 10
    var legend_x = width - margin.right*9
    svg.append('g')
        .attr('id', 'mydots')
        .selectAll("rect")
        .data(worst_makes)
        .join("rect")
        .attr('id', 'dot')
        .attr("x", legend_x)
        .attr("y", function(d,i){ return 5 + i*(size+5)})
        .attr("width", size)
        .attr("height", size)
        .style("fill", function(d){ return color(d)})

    svg.append('g')
        .attr('id', 'mylabels')
        .selectAll("text")
        .data(worst_makes)
        .join("text")
        .attr('id', 'label')
        .attr("x", legend_x + size*1.2)
        .attr("y", function(d,i){ return 5 + i*(size+5) + (size/2)})
        .style("fill", function(d){ return color(d)})
        .text(function(d){ return d})
        .attr("text-anchor", "left")
        .style("alignment-baseline", "middle")

    function mouseover() {
        focus.style("opacity", 1)
        focusText.style("opacity",1)
    }

    function mousemove(event,datum) {
        // recover coordinate we need
        const pointer = d3.pointer(event, this);
        var x0 = x.invert(pointer[0]);
        var selected_year = yearsDomain[d3.bisectCenter(yearsDomain, x0)];
        var yvalue = 0;
        for (var k in datum.values){
            if (datum.values[k].year === selected_year) {
                yvalue = datum.values[k]
                break;
            }
        }
        focus.attr("cx", x(selected_year))
             .attr("cy", y(yvalue.casualties))

        var n = yvalue.casualties.toFixed(2);

        focusText.html(datum.name + ", " + selected_year + " - " + n)
        .style("left", (focus.node().getBoundingClientRect().x) + "px")
        .style("top", (focus.node().getBoundingClientRect().y - 28) + "px");

    }

    function mouseout() {
        focus.style("opacity", 0)
        focusText.style("opacity", 0)
    }
}

//Generate radial chart
function gen_radial_chart() {
    let width = def_i6.width,
        height = def_i6.height,
        padding = def_i6.padding;

    let dataset = d3.group(currentAccidentData, d => d.time.slice(0, 2));
    default_data[5] = dataset;
    let keys = Array.from(dataset.keys());

    dataset = new Map([...dataset.entries()].sort());

    let max = d3.max(keys, d => dataset.get(d).length);

    let datasetO = new Map(dataset);
    let datasetAM = new Map(dataset);
    let datasetPM = new Map(dataset);

    for (let k of datasetAM.keys()) {
        if (!(k >= 6 && k <= 20))
            datasetAM.delete(k);
    }
    for (let k of datasetPM.keys()) {
        if (!(k > 17 || k < 9))
            datasetPM.delete(k);
    }

    let datasetPM1st = new Map(datasetPM);
    let datasetPM2nd = new Map(datasetPM);

    for (let k of datasetPM1st.keys()) {
        if (k < 18)
            datasetPM1st.delete(k);
    }
    for (let k of datasetPM2nd.keys()) {
        if (k > 8)
            datasetPM2nd.delete(k);
    }

    datasetPM = new Map([...datasetPM1st].concat([...datasetPM2nd]));

    dataset = [datasetAM, datasetPM];

    let radius = (height / 2 - padding * 4);

    let rScale = d3.scaleLinear()
        .range([0, radius])
        .domain([0, max]);

    svg_radar_chart = d3.select('#radial_chart')
        .append('svg')
        .attr('width', width)
        .attr('height', height)
        .attr("class", "svg_group");

    let Format = d3.format('.3s');
    let angleSlice = Math.PI / 6;

    let g = svg_radar_chart.append('g')
        .attr('transform', 'translate(' +  (width/2 + padding * 6) + ',' + (height/2) +')');

    let axisGrid = g.append('g')
        .attr('class', 'axisWrapper');

    axisGrid.selectAll('.levels')
        .data(d3.range(1, (def_i6.levels + 1)).reverse())
        .enter()
        .append('circle')
        .attr('class', 'gridCircle')
        .attr('r', d => radius/def_i6.levels * d)
        .style("fill", "#CDCDCD")
        .style("stroke", "#CDCDCD")
        .style("fill-opacity", def_i6.opacity);

    axisGrid.selectAll("#axisLabel")
        .data(d3.range(1,(def_i6.levels+1)).reverse())
        .enter()
        .append("text")
        .attr("id", "axisLabel")
        .attr("x", d => d * radius / def_i6.levels + def_i6.labelFactor)
        .attr("y", 0)
        .attr("dy", "0.4em")
        .style("font-size", "10px")
        .attr("fill", "#737373")
        .text(d =>Format(max * d/def_i6.levels));

    let axis = axisGrid.selectAll(".axis")
        .data(hours)
        .enter()
        .append("g")
        .attr("class", "axis");

    //Append the lines
    axis.append("line")
        .attr("x1", 0)
        .attr("y1", 0)
        .attr("x2", (d,i) => rScale(max * def_i6.labelFactor) * Math.cos(angleSlice*i - Math.PI/2))
        .attr("y2", (d, i) => rScale(max * def_i6.labelFactor) * Math.sin(angleSlice*i - Math.PI/2))
        .attr("class", "line")
        .style("stroke", "white")
        .style("stroke-width", d => (d === 3)?'0px':"2px");

    //Append the labels at each axis
    axis.append("text")
        .attr("class", "legend")
        .style("font-size", "11px")
        .attr("text-anchor", "middle")
        .attr("dy", "0.35em")
        .attr("x", (d, i) => rScale(max * def_i6.labelFactor) * Math.cos(angleSlice*i - Math.PI/2))
        .attr("y", (d, i) => rScale(max * def_i6.labelFactor) * Math.sin(angleSlice*i - Math.PI/2))
        .text(d => (d === 0 || d === 3)?'':d);

    let angles = d3.scaleLinear()
        .domain([0, 12])
        .range([0, 2 * Math.PI]);

    let radarLine = d3.lineRadial()
        .angle((d) => angles(+d[0]))
        .radius(d => rScale(d[1].length))
        .curve(d3.curveCardinalOpen);

    let blobWrapper = g.selectAll(".radarWrapper")
        .data(dataset)
        .enter()
        .append("g")
        .attr("class", "radarWrapper");

    blobWrapper.append("path")
        .attr("id", "radarStroke")
        .attr("d", radarLine)
        .style("stroke-width", 2 + "px")
        .style("stroke", (d, i) => (i===0)? "#af7070" : "#44849a")
        .style("fill", "none");

    blobWrapper.selectAll("#radarCircle")
        .data(datasetO)
        .enter()
        .append("circle")
        .attr("id", "radarCircle")
        .attr("r", 3)
        .attr("cx", (d) => rScale(d[1].length) * Math.cos(angles(+d[0]%12) - Math.PI/2))
        .attr("cy", (d) => rScale(d[1].length) * Math.sin(angles(+d[0]%12) - Math.PI/2))
        .style("fill", (d) => (+d[0] >= 7 && +d[0] <= 19)? "#ac5454" : "#2e657d")
        .style("fill-opacity", 0.8)
        .append('title')
        .text(d => d[1].length);

    let legendG = svg_radar_chart.append('g')
        .attr('class', 'legend');

    legendG.append('circle')
        .attr('cx', 3 * padding)
        .attr('cy', padding)
        .attr('transform', translation(padding, height - 8*padding))
        .attr('r', 7)
        .style('fill', "#ac5454");

    legendG.append('text')
        .attr('x', 6 * padding)
        .attr('y', height - 6.5*padding)
        .style('fill', '#575757')
        .style("font-size", "16px")
        .text('AM');

    legendG.append('circle')
        .attr('cx', 3 * padding)
        .attr('cy', padding)
        .attr('transform', translation(padding, height - 5*padding))
        .attr('r', 7)
        .style('fill', "#2e657d");

    legendG.append('text')
        .attr('x', 6 * padding)
        .attr('y', height - 3.5*padding)
        .style('fill', '#575757')
        .style("font-size", "16px")
        .text('PM');
}

//Generate calendar heatmap
function gen_calendar_heatmap() {
    let width = def_i5.width,
        height = def_i5.height,
        padding = def_i5.padding;

    let dataset = d3.rollup(currentAccidentData, v => v.length, d=> d.year, d=>d.date.slice(5));
    dataset = unroll(dataset, ['year', 'date', 'value']);
    dataset = d3.rollup(dataset, v=>d3.mean(v, v=> v.value), d=> d.date);
    default_data[6] = dataset;

    let min = d3.min(dataset, d => d[1]),
        max = d3.max(dataset, d => d[1]);

    let colors = d3.scaleLinear()
        .domain([min, max])
        .range(["#8ecefd","#f88b9d"]);

    let monthScale = d3.scaleBand()
        .domain(ticksMonth)
        .range([padding, width - padding])

    let xAxis = d3.axisTop()
        .scale(monthScale)
        .tickValues(ticksMonth)
        .tickFormat((d, i) => months[i]);

    let dayScale = d3.scaleBand()
        .domain(ticksDays)
        .range([padding, height - padding * 2]);

    let yAxis = d3.axisLeft()
        .scale(dayScale);

    svg_calendar_heatmap = d3.select("#calendar_heatmap")
        .append("svg")
        .attr("width", width)
        .attr("height", height)
        .attr("class", "svg_group");

    svg_calendar_heatmap.append('filter')
        .attr('id','desaturate')
        .append('feColorMatrix')
        .attr('type','matrix')
        .attr('values',"0.3333 0.3333 0.3333 0 0 0.3333 0.3333 0.3333 0 0 0.3333 0.3333 0.3333 0 0 0 0 0 1 0");

    let g = svg_calendar_heatmap.append("g")
        .attr("class", "svg_group");

    g.append("g")
        .attr("id", "xAxis")
        .call(xAxis)
        .attr("transform", translation(0,padding))
        .selectAll("text")
        .attr("color", "black")
        .attr("font-size", "12")
        .on('mouseover', (e, d) => {
            if(!selected_month_dow.has(d)) {
                d3.select(e.target)
                    .style("font-size", "18");
            }
        })
        .on('mouseout', (e, d) => {
            if(!selected_month_dow.has(d)) {
                d3.select(e.target)
                    .style("font-size", "12");
            }
        });

    g.append("g")
        .attr("id", "yAxis")
        .call(yAxis)
        .attr("transform", translation(padding,0))
        .selectAll("text")
        .attr("color", "black")
        .attr("font-size", "11");

    let rects = g.append("g")
        .attr("class", "rects");

    rects.selectAll("rect")
        .data(dataset)
        .join("rect")
        .attr("class", "rects")
        .attr("width", monthScale.bandwidth())
        .attr("height", dayScale.bandwidth())
        .attr("x", d => monthScale(getMonth(d[0])))
        .attr("y", d => dayScale(getDay(d[0])))
        .attr("fill", d => colors(d[1]))
        .append("title")
        .text(d => d);

    let legend_g = svg_calendar_heatmap
        .append('g')
        .attr('id', 'legend-svg-calendar')
        .attr('width', def_i5.legendWidth)
        .attr('height', def_i5.legendHeight)
        .attr('transform', translation(-padding, height - padding));

    let countScale = d3.scaleLinear()
        .domain([min, max])
        .range([0, def_i5.legendWidth])

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
        .attr("id", "legend-map-calendar")
        .attr("y1", "0%").attr("x1", "0%")
        .attr("y2", "0%").attr("x2", "100%")
        .selectAll("stop")
        .data(d3.range(numStops))
        .enter()
        .append("stop")
        .attr("offset", function(d,i) {
            return countScale( countPoint[i] )/ def_i5.legendWidth;
        })
        .attr("stop-color", function(d,i) {
            return colors( countPoint[i] );
        });

    legend_g.append("rect")
        .attr("id", "legendRectHeatmap")
        .attr("x", width/2 - def_i5.legendWidth/2 + padding)
        .attr("y", 0)
        .attr("width", def_i5.legendWidth)
        .attr("height", 10)
        .style("fill", "url(#legend-map-calendar)");

    //Define legend axis
    let legendAxis = d3.axisTop()
        .ticks(4)
        .tickFormat(d3.format(".0s"))
        .scale(countScale);

    //Set up legend axis
    legend_g.append("g")
        .attr("id", "legend-axis-heatmap")
        .attr("transform", translation(width/2 - def_i5.legendWidth/2 + padding, 0))
        .call(legendAxis);
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

    let unit_data = d3.rollup(accident_data, v => v.length,
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

    default_data[7] = unrolledData;

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
        .append("svg:image")
        .attr("class", "lane-image")
        .attr("xlink:href", "data/road-urban.svg")
        .attr('width', xScale.bandwidth())
        .attr('height', effectiveHeight)
        .attr('transform', translation(-xScale.bandwidth(), 0) + ", scale(3,1)")
        .attr("preserveAspectRatio", "none")

    let nCars = def_i7.carNumber;

    // Add cars groups
    g.selectAll('.unit-road')
        .append('g')
        .data(usedData)
        .attr("transform", translation(0, effectiveHeight) + ", scale(1,-1)")
        .attr('class', d => 'car-group-' + d.speed_limit.toString())

    let totalNum = d3.sum(usedData, v => v.value);
    if (totalNum < nCars) nCars = Math.round(totalNum);
    let carMargin = (xScale.bandwidth() - def_i7.carSize)/8;

    // FIXME: Check if any value is bigger than 0.85 since it goes behind the chart

    let getTranslateCar = (d, position) => {
        let i = d[0], partialNumber = d[1];
        let x = xScale.bandwidth()/2;

        if (i % 2 === 0) x += carMargin;
        else x += 0 - def_i7.carSize - carMargin;

        let y = Math.floor(i / 2) * (def_i7.carSize+def_i7.carPadding) + (def_i7.carSize * partialNumber + def_i7.carPadding);
        if (position === "top") { y = effectiveHeight + def_i7.carSize; }
        else if (position === "bottom") { y = -def_i7.carSize; }
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
                .attr('width', def_i7.carSize)
                .attr('height', def_i7.carSize)
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
            .attr('width', def_i7.carSize)
            .attr('height', def_i7.carSize)
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
        let signMargin = (xScale.bandwidth() - def_i7.speedSignSize)/2;
        topGroup.append('g')
            .attr('class', ' speed-signs')
            .selectAll('.speed_signs')
            .data(speedLimits)
            .join('svg:image')
            .attr("class", "speed-sign")
            .attr("transform", d => translation(xScale(d) + signMargin, margin.top - def_i7.speedSignSize - def_i7.speedSignMargin))
            .attr('width', def_i7.speedSignSize)
            .attr('height', def_i7.speedSignSize)
            .attr("xlink:href", d => "data/speed-signs/" + d + ".svg")
            .attr("preserveAspectRatio", "none")

        svg_unit_chart.selectAll('.speed_signs')
            .append('text')
            .html(d => d)
    }

    // Add urban/rural options
    {
        let optionMargin = (xScale.bandwidth() - def_i7.roadOptionSize)/2;

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
            .attr('width', def_i7.roadOptionSize)
            .attr('height', def_i7.roadOptionSize)
            .attr("transform", translation(optionMargin, 0))
            .attr("xlink:href", "data/road-option/urban.png")
            .attr("preserveAspectRatio", "none")
            .style("outline", "2px solid black")
            .on('click', (event, d) => {
                dispatch.call("unitEvent", this, {event: event, datum: [d, 'urban']});
            })
            .append('title')
            .html('Urban')

        topGroup.selectAll('.road-option')
            .append('svg:image')
            .attr("class", "road-rural clickable")
            .attr("id", d => "road-rural-" + d)
            .attr('width', def_i7.roadOptionSize)
            .attr('height', def_i7.roadOptionSize)
            .attr("transform", translation(optionMargin, def_i7.roadOptionSize + def_i7.roadOptionPadding))
            .attr("xlink:href", "data/road-option/rural.png")
            .attr("preserveAspectRatio", "none")
            .style("outline", "1px solid black")
            .on('click', (event, d) => {
                dispatch.call("unitEvent", this, {event: event, datum: [d, 'rural']});
            })
            .append('title')
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
                let height = (effectiveHeight + def_i7.carSize) - ((def_i7.carSize + def_i7.carPadding) * Math.floor(d[0]/2) + (def_i7.carSize * d[1] + def_i7.carPadding));
                return height / def_i7.carSpeed[d[2]];
            })
            .ease(d3.easeLinear)
            .attr('transform', d => getTranslateCar(d, "top"))
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
                let height = (def_i7.carSize + def_i7.carPadding) * Math.floor(d[0]/2) + (def_i7.carSize * d[1] + def_i7.carPadding) + def_i7.carSize;
                return height / def_i7.carSpeed[d[2]];
            })
            .attr('transform', d => getTranslateCar(d, ""))
            .on("end", () => {
                if (rerun) return;

                rerun = true;
                setTimeout(animateCars, def_i7.timeBetweenCarTransitions);
            })
    }

    // Make interval for animation
    new Promise(function () {
        animateCars();
    }).then(() => {});

    // Add legend for car value
    {
        let carValue = totalNum / nCars;
        let g_legend = svg_unit_chart.append("g")
            .attr("transform", translation(0, margin.top + effectiveHeight))
            .attr("class", "legend_group");

        // Add speed limit with mph
        let leftMarginSign = 20;
        {
            g_legend.append('svg:image')
                .attr("class", "legend_sign")
                .attr("transform", translation(leftMarginSign, margin.bottom / 2 - def_i7.carScaleSize * 0.7))
                .attr('width', def_i7.carScaleSize)
                // .attr('height', def_i7.carScaleSize)
                .attr("xlink:href", "data/speed-signs/20.svg")

            g_legend.append('text')
                .attr("transform", translation(leftMarginSign + def_i7.carScaleSize + 2,
                    margin.bottom / 2 + 3))
                .html('- 20 mph')
        }

        // Add car value
        let leftMarginCar = leftMarginSign + 90;
        {
            g_legend.append('svg:image')
                .attr("class", "car_scale")
                .attr("transform", translation(leftMarginCar, margin.bottom / 2 - def_i7.carScaleSize / 2))
                .attr('width', def_i7.carScaleSize)
                .attr('height', def_i7.carScaleSize)
                .attr("xlink:href", "data/car_2.png")

            g_legend.append('text')
                .attr("class", "legend_car_value")
                .attr("transform", translation(leftMarginCar + def_i7.carScaleSize * 0.9,
                    margin.bottom / 2 + 3))
                .html('- ' + d3.format('.2s')(carValue))
        }

        // Add urban legend
        let leftMarginUrban = leftMarginSign + leftMarginCar + 45;
        {
            g_legend.append('svg:image')
                .attr("class", "car_scale")
                .attr("transform", translation(leftMarginUrban, margin.bottom / 2 - def_i7.carScaleSize * 0.6))
                .attr('width', def_i7.carScaleSize)
                .attr('height', def_i7.carScaleSize)
                .attr("xlink:href", "data/road-option/urban.png")

            g_legend.append('text')
                .attr("class", "legend_car_value")
                .attr("transform", translation(leftMarginUrban + def_i7.carScaleSize * 1,
                    margin.bottom / 2 + 3))
                .html('- Urban')
        }

        // Add rural legend
        let leftMarginRural = leftMarginUrban + 85;
        {
            g_legend.append('svg:image')
                .attr("class", "car_scale")
                .attr("transform", translation(leftMarginRural, margin.bottom / 2 - def_i7.carScaleSize * 0.6))
                .attr('width', def_i7.carScaleSize)
                .attr('height', def_i7.carScaleSize)
                .attr("xlink:href", "data/road-option/rural.png")

            g_legend.append('text')
                .attr("class", "legend_car_value")
                .attr("transform", translation(leftMarginRural + def_i7.carScaleSize,
                    margin.bottom / 2 + 3))
                .html('- Rural')
        }
    }


    // Y scales
    // let yScale = d3.scaleLinear()
    //     .domain(yScaleData)
    //     .range([0, effectiveHeight - margin.bottom])
    //     .paddingInner(0.2)
    //     .paddingOuter(0.2);

    // FIXME: Add legend for mph, urban and rural?
    // FIXME: Add axis to the right?

}

// Generate year slider
function gen_year_slider() {
    let minYear = minYearAccidentData = d3.min(accident_data, d => d.year);
    let maxYear = maxYearAccidentData = d3.max(accident_data, d => d.year);

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

        setDirty(true);

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

        // Toggle option selection
        let option = d3.select("option#C" + id).node();
        if (option.hasAttribute('selected')) option.removeAttribute('selected');
        else option.setAttribute('selected', '');

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

            if (selectedPyramidSex.has(sex)){
                if (sex === "1"){
                    svg_pyramid_bar_chart.select(".left-bar")
                                         .select("#maleLabel")
                                         .style("font-weight", "normal");
                }
                else{
                    svg_pyramid_bar_chart.select(".right-bar")
                                         .select("#femaleLabel")
                                         .style("font-weight", "normal");
                }

                selectedPyramidSex.delete(sex);
            }
        }
        else {
            // Select
            selectedPyramidBars.add(selectedBar);
            Object.keys(isDirty).map(function(key, index) {
                if (key !== "2") isDirty[key] = true;
            });

            // Change stroke to selected
            d3.select(event.target)
                .style("stroke", "black")
                .style("stroke-width", "3")
        }

        // Update all idioms
        setTimeout(function(){ updateIdioms(); }, 0)
    });

    svg_pyramid_bar_chart.select(".left-bar").select("#maleLabel").on("click", (event, datum) => {
        dispatch.call("pyramidMaleEvent", this, {event: event, datum: datum});
    });

    dispatch.on("pyramidMaleEvent", function(args) {
        sexLabelEvent("1",args.event);
    });

    svg_pyramid_bar_chart.select(".right-bar").select("#femaleLabel").on("click", (event, datum) => {
        dispatch.call("pyramidFemaleEvent", this, {event: event, datum: datum});
    });

    dispatch.on("pyramidFemaleEvent", function(args) {
        sexLabelEvent("2",args.event);
    });

    function sexLabelEvent(sex, event){

        // Check if already selected
        if (selectedPyramidSex.has(sex)) {

            // Change text to unselected
            d3.select(event.target)
            .style("font-weight", "normal")

            // Unselect
            selectedPyramidSex.delete(sex);
            Object.keys(isDirty).map(function(key, index) {
                if (key !== "2") isDirty[key] = true;
            });

            let bar = (sex=="1")? ".left-bar" : ".right-bar";
            // Change stroke to unselected
            svg_pyramid_bar_chart.select(bar).selectAll("rect")
                .style("stroke", "black")
                .style("stroke-width", "0.5")
                .style("stroke", "transparent")
                .selectAll(function(){
                    let selectedBar = d3.select(this).datum()[0] + "|" + sex;
                    selectedPyramidBars.delete(selectedBar);
                })

        }
        else {

            // Change text to selected
            d3.select(event.target)
            .style("font-weight", "bolder")

            // Select
            selectedPyramidSex.add(sex);
            Object.keys(isDirty).map(function(key, index) {
                if (key !== "2") isDirty[key] = true;
            });

            let bar = (sex=="1")? ".left-bar" : ".right-bar";
            // Change stroke to selected
            svg_pyramid_bar_chart.select(bar).selectAll("rect")
                .style("stroke", "black")
                .style("stroke-width", "3")
                .selectAll(function(){
                    let selectedBar = d3.select(this).datum()[0] + "|" + sex;
                    selectedPyramidBars.add(selectedBar);
                })

        }

        // Update all idioms
        setTimeout(function(){ updateIdioms(); }, 0)
    }
}

//Click on alluvial label
function prepareAlluvialEvent() {

    svg_alluvial_chart.select("g").select("#nodes_label").selectAll("text").on("click", (event, datum) => {
        dispatch.call("alluvialEvent", this, {event: event, datum: datum});
    });

    dispatch.on("alluvialEvent", function(args) {
        let event = args.event;

        let selectedLabel = event.target.innerHTML;

        // Check if already selected
        if (selectedAlluvialLabels.has(selectedLabel)) {
            // Unselect
            selectedAlluvialLabels.delete(selectedLabel);
            Object.keys(isDirty).map(function(key, index) {
                if (key !== "3") isDirty[key] = true;
            });

            // Change stroke to unselected
            d3.select(event.target)
               .style("font-weight", "normal");

        }
        else {
            // Select
            selectedAlluvialLabels.add(selectedLabel);
            Object.keys(isDirty).map(function(key, index) {
                if (key !== "3") isDirty[key] = true;
            });

            // Change stroke to selected
            d3.select(event.target)
            .style("font-weight", "bold");
        }

        // Update all idioms
        setTimeout(function(){ updateIdioms(); }, 0)

        
    });

}

//Click on heatmap
function prepareHeatmapEvent() {
    svg_calendar_heatmap.select('#xAxis')
        .selectAll("text").on('click', (e, d) =>
        dispatch.call('heatmapEvent', this, {event: e, datum: d})
    );

    dispatch.on('heatmapEvent', function(args) {
        let x = args.datum,
            event = args.event;

        if(selected_month_dow.has(x)) {
            selected_month_dow.delete(x);
            Object.keys(isDirty).map(function(key, index) {
                setDirty(true);
            });

            d3.select(event.target)
                .style("font-weight", "normal")
                .style("font-size", "12");
        }
        else {
            selected_month_dow.add(x);
            Object.keys(isDirty).map(function(key, index) {
                setDirty(true);
            });

            d3.select(event.target)
                .style("font-weight", "bold")
                .style("font-size", "17");;
        }

        setTimeout(function(){ updateIdioms(); }, 0);
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
        if (selectedMinYear !== minYearAccidentData || selectedMaxYear !== maxYearAccidentData) {
            selectedMinYear = minYearAccidentData;
            selectedMaxYear = maxYearAccidentData;
            setDirty(true);
        }

        if (!(selectedCounties.size === 0 && selectedPyramidBars.size === 0 && selectedAlluvialLabels.size === 0)) {
            setDirty(true);
        }

        // Scroll to top - county dropdown
        setTimeout(() => d3.select("#county-select").node().scrollTo(0, 0), 100);
        d3.select("#county-select")
            .selectAll("option")
            .filter(d => {
                if (d === null) return false;
                return selectedCounties.has(d.id);
            })
            .node()
            .removeAttribute('selected');

        // Unselect counties
        svg_choropleth_map.selectAll("path")
            .filter(d => {
                if (d === null) return false;
                return selectedCounties.has(getCountyId(d));
            })
            .style("stroke", "transparent");
        selectedCounties.clear();

        // Unselect bars
        if (selectedPyramidBars.size !== 0) {
            setDirty(true);
        }
        svg_pyramid_bar_chart.select('.left-bar')
            .selectAll('rect')
            .style("stroke", "transparent");
        svg_pyramid_bar_chart.select('.right-bar')
            .selectAll('rect')
            .style("stroke", "transparent");
        selectedPyramidBars.clear();
        selectedPyramidSex.clear();
        svg_pyramid_bar_chart.select(".left-bar")
                             .select("#maleLabel")
                             .style("font-weight", "normal");
        svg_pyramid_bar_chart.select(".right-bar")
                             .select("#femaleLabel")
                             .style("font-weight", "normal");

        //Unselect heatmap
        if(selected_month_dow.size !== 0 ) {
            setDirty(true);
        }

        selected_month_dow.clear();

        svg_calendar_heatmap.select('#xAxis')
            .selectAll('text')
            .style("font-weight", "normal")
            .style("font-size","12");


        // Reset selected road options
        if (Object.values(selectedRoadOptions).filter( v => v === "rural").length !== 0) {
            isDirty["7"] = true;
        }

        Object.keys(selectedRoadOptions).map(function(key, index) {
            selectedRoadOptions[key] = "urban";
        });

        // Unselect rural roads
        svg_unit_chart.selectAll(".road-rural")
            .style("outline", "1px solid black")

        // Select urban roads
        svg_unit_chart.selectAll(".road-urban")
            .style("outline", "2px solid black")
        
        // Unselect alluvial labels
        svg_alluvial_chart.select("g").select("#nodes_label").selectAll("text").style("font-weight","normal")
        selectedAlluvialLabels.clear()

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

        let groupedByCounties;
        if (!hasReset) {
            groupedByCounties = d3.rollup(map_data, v => v.length, d => d.county);
            groupedByCounties.delete('NaN');
        } else {
            groupedByCounties = default_data[1];
        }

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

    function update_pyramid_chart() {
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

        let groupedByAgeGender;
        if (!hasReset) {
            groupedByAgeGender = d3.rollup(pyramid_data, v => v.length,
                d => d.age, d => d.sex);

            // Sort map
            groupedByAgeGender = new Map(
                Array.from(groupedByAgeGender)
                    .filter( e => e[0] > 3)
                    .sort( (a,b) => {
                        return (a[0] > b[0]) ? 1 : ((b[0] > a[0]) ? -1 : 0)
                    }).reverse()
            );
        } else {
            groupedByAgeGender = default_data[2];
        }

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
            .attr('y', function(d) { return yScale(d[0]); })
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
            .attr('y', function(d) { return yScale(d[0]); })
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

    function update_alluvial_chart(){
        let margin = def_i3.margin;
        let width = def_i3.width,
            height = def_i3.height,
            effectiveWidth = width - margin.left - margin.right,
            effectiveHeight = height - margin.bottom - margin.top;

        svg_alluvial_chart = d3.select("#alluvial_chart")
            .select("svg")

        let g = svg_alluvial_chart.select("g");

        let filteredAccidentData;
        let keys = ['road_surface','light','weather','wind', 'value']
        if (!hasReset) {
            filteredAccidentData = alluvial_data.filter(d => {
                return d.road_surface !== "" && !isNaN(d.road_surface) && d.road_surface !== -1
                    && d.light !== "" && !isNaN(d.light) && d.light !== -1
                    && d.weather !== "" && !isNaN(d.weather) && d.weather !== -1
                    && d.weather !== 8 && d.weather !== 9;
            })

            filteredAccidentData = filteredAccidentData.map(function(d){
                return {
                    road_surface: translations_for_alluvial.Road_Surface_Conditions[d.road_surface],
                    light: translations_for_alluvial.Light_Conditions[d.light],
                    weather: translations_for_alluvial.Weather_Conditions[d.weather],
                    wind: translations_for_alluvial.Weather_Conditions_wind[d.weather]
                }
            } )

            filteredAccidentData = d3.rollup(filteredAccidentData, v => v.length, d => d.road_surface, d => d.light, d => d.weather, d => d.wind)
            filteredAccidentData = unroll(filteredAccidentData, keys);
        } else {
            filteredAccidentData = default_data[3];
        }

        let graph = dataToGraph(filteredAccidentData,keys.slice(0, -1));
        let sankey = d3.sankey()
            .nodeSort(function(a, b){
                return a.name.localeCompare(b.name);})
            .linkSort(null)
            .nodeWidth(10)
            .nodePadding(2)
            .extent([[0, 5], [effectiveWidth, effectiveHeight]])
        let color = d3.scaleOrdinal(["#abc4d6", "#b6abd6","#d6abb3", "#d6abd3"]).domain(["Dry","Snow","Wet or damp","Other"])
        //["#abc4d6", "#d6abb3"]

        const {nodes, links} = sankey({
            nodes: graph.nodes.map(d => Object.assign({}, d)),
            links: graph.links.map(d => Object.assign({}, d))});

        g.select("#nodes_rect")
            .selectAll("rect")
            .data(nodes)
            .join("rect")
            .transition()
            .delay(1500)
            .duration(1000)
            .attr("x", d => d.x0)
            .attr("y", d => d.y0)
            .attr("height", d => d.y1 - d.y0)
            .attr("width", d => d.x1 - d.x0)
            .select("title")
            .text(d => `${d.name}\n${d.value.toLocaleString()}`);

        g.select("#links_path")
            .attr("fill", "none")
            .selectAll("path")
            .data(links)
            .join("path")
            .transition()
            .delay(1500)
            .duration(1000)
            .attr("d", d3.sankeyLinkHorizontal())
            .attr("stroke", d => color(d.names[0]))
            .attr("stroke-width", d => d.width)
            .style("mix-blend-mode", "multiply")
            .select("title")
            .text(d => `${d.names.join(" → ")}\n${d.value.toLocaleString()}`);

        g.select("#nodes_label")
            .style("font", "15px sans-serif")
            .selectAll("text")
            .data(nodes)
            .join("text")
            .on("mouseover", function(event,d) {
                // Check if not selected
                if (!selectedAlluvialLabels.has(d.name)) {
                    d3.select(event.target)
                        .style("font-weight", "bold")
                }
            })
            .on("mouseout", function(event, d) {
                // Check if not selected
                if (!selectedAlluvialLabels.has(d.name)) {
                    d3.select(event.target)
                        .style("font-weight", "normal");
                }
            })
            .transition()
            .delay(1500)
            .duration(1000)
            .attr("x", d => d.x0 < width / 2 ? d.x1 + 6 : d.x0 - 6)
            .attr("y", d => (d.y1 + d.y0) / 2)
            .attr("dy", "0.35em")
            .attr("text-anchor", d => d.x0 < width / 2 ? "start" : "end")
            .text(d => d.name)
            .style("font-weight", function(d){
                if (selectedAlluvialLabels.has(d.name)) return "bold"
                else return "normal"
            })

    }

    function update_line_chart(){
        // Set margins and width and height
        let margin = def_i4.margin;
        let width = def_i4.width,
            height = def_i4.height,
            effectiveWidth = width-margin.left - margin.right,
            effectiveHeight = height - margin.bottom - margin.top;

        // Get custom dataset
        let filteredAccidentData
        if (!hasReset) {
            filteredAccidentData = other_data.filter(d => {
                return d.vehicle_year !== "" && d.vehicle_year !== -1
                    && d.make !== "" && d.make !== "Not known"
                    && d.number_of_casualties !== "" && d.number_of_casualties >= 0;
            })
        } else {
            filteredAccidentData = default_data[4];
        }

        if (filteredAccidentData.length === 0){
            //FIXME: No data to show
            alert("No data to show on lines chart :(")
            return;
        }

        worst_makes = (Array.from(
                d3.rollup(filteredAccidentData, v=> d3.sum(v, d=> d.number_of_casualties), d=>d.make))
                .sort(function(a, b){return a[1]-b[1]})
                .reverse()
                .slice(0,5)
        ).map(x => x[0]);


        let groupedByMakeAndYear = d3.group(filteredAccidentData, d => d.make, d => d.vehicle_year);
        let min_Vehicle_Year = d3.min(filteredAccidentData, d => d.vehicle_year);
        let max_Vehicle_Year = d3.max(filteredAccidentData, d => d.vehicle_year);

        let numberOfAccidentsPerYear = d3.rollup(filteredAccidentData, v=> v.length, d=>d.vehicle_year, d=>d.make);

        let yearCasualtiesByMake = new Map()

        var maxY = 0;
        var min_year = 2020;
        var max_year = 0;
        for (var key of worst_makes){ // for each make
            let dict = {};
            let dicts = [];
            for (i = min_Vehicle_Year; i <= max_Vehicle_Year; i++){

                if(groupedByMakeAndYear.get(key).get(i) == null){
                    dict.Year = i;
                    dict.n = 0;
                }
                else{
                    max_year = Math.max(max_year,i)
                    min_year = Math.min(min_year,i);
                    dict.Year = i;
                    dict.n = d3.sum(groupedByMakeAndYear.get(key).get(i), d=>d.number_of_casualties)/
                        numberOfAccidentsPerYear.get(i).get(key);
                    maxY = ( dict.n > maxY ) ? dict.n : maxY;
                }
                dicts.push(dict);
                dict = {};
            }
            yearCasualtiesByMake.set(key, dicts);
        }

        min_Vehicle_Year = min_year;
        max_Vehicle_Year = max_year;

        if(min_Vehicle_Year === max_Vehicle_Year){
            //FIXME: No data to show
            alert("No data to show on lines chart :(")
            return;
        }

        for (var key of yearCasualtiesByMake.keys()){
            let updated_values = yearCasualtiesByMake.get(key).filter(d => d.Year >= min_Vehicle_Year && d.Year <= max_Vehicle_Year);
            yearCasualtiesByMake.set(key,updated_values);
        }

        // set the ranges

        var yearsDomain=[];
        for (i = min_Vehicle_Year; i <= max_Vehicle_Year; i++){
            yearsDomain.push(i);
        }

        var x = d3.scaleLinear()
            .domain([min_Vehicle_Year,max_Vehicle_Year])
            .range([0, effectiveWidth]);

        var y = d3.scaleLinear()
            .domain([0, maxY])
            .range([effectiveHeight, 0]);

        var svg = d3.select("#line_chart")
            .select("svg")
            .select("g")

        var line = d3.line()
            .x(function(d) { return x(d.year); })
            .y(function(d) { return y(d.casualties); });

        var color = d3.scaleOrdinal(d3.schemeCategory10)
            .domain(worst_makes);

        var makes = color.domain().map(function(name) {
            return {
                name: name,
                values: yearCasualtiesByMake.get(name).map(function(d) {
                    return {
                        year: d.Year,
                        casualties: d.n
                    };
                })
            };
        });

        svg.select("#makes")
            .selectAll("path")
            .data(makes)
            .join("path")
            .on('mouseover', mouseover)
            .on('mousemove', mousemove)
            .on('mouseout', mouseout)
            .transition()
            .delay(1000)
            .duration(2000)
            .attr("d", function(d) {
                return line(d.values);
            })
            .style("stroke", function(d) {
                return color(d.name);
            })
            .style("fill","none");

        svg.select("#xAxis")
            .transition()
            .delay(1000)
            .duration(2000)
            .call(d3.axisBottom(x).ticks(10).tickFormat(d3.format("d")) );

        svg.select("#yAxis")
            .call(d3.axisLeft(y));

        var focus = svg.select("#focus")

        var focusText = d3.select("#focus_text")

        var size = 10
        var legend_x = width - margin.right*9

        svg.select( '#mydots')
            .selectAll("rect")
            .data(worst_makes)
            .join("rect")
            .attr("x", legend_x)
            .attr("y", function(d,i){ return 5 + i*(size+5)})
            .attr("width", size)
            .attr("height", size)
            .style("fill", function(d){ return color(d)})

        svg.select('#mylabels')
            .selectAll("text")
            .data(worst_makes)
            .join("text")
            .attr("x", legend_x + size*1.2)
            .attr("y", function(d,i){ return 5 + i*(size+5) + (size/2)})
            .style("fill", function(d){ return color(d)})
            .text(function(d){ return d})
            .attr("text-anchor", "left")
            .style("alignment-baseline", "middle")
        
        function mouseover() {
            focus.style("opacity", 1)
            focusText.style("opacity",1)
        }

        function mousemove(event,datum) {
            // recover coordinate we need
            const pointer = d3.pointer(event, this);
            var x0 = x.invert(pointer[0]);
            var selected_year = yearsDomain[d3.bisectCenter(yearsDomain, x0)];
            var yvalue = 0;
            for (var k in datum.values){
                if (datum.values[k].year === selected_year) {
                    yvalue = datum.values[k]
                    break;
                }
            }
            focus.attr("cx", x(selected_year))
                .attr("cy", y(yvalue.casualties))

            var n = yvalue.casualties.toFixed(2);

            focusText.html(datum.name + ", " + selected_year + " - " + n)
                .style("left", (focus.node().getBoundingClientRect().x) + "px")
                .style("top", (focus.node().getBoundingClientRect().y - 28) + "px");
        }

        function mouseout() {
            focus.style("opacity", 0)
            focusText.style("opacity", 0)
        }
    }

    function update_radar_chart() {
        let width = def_i6.width,
            height = def_i6.height,
            padding = def_i6.padding;

        let dataset;
        if (!hasReset) {
            dataset = d3.group(other_data, d => d.time.slice(0, 2));
        } else {
            dataset = default_data[5];
        }

        for(let i = 0; i<24; i++) {
            let formattedNumber = ('0' + i).slice(-2);
            if(!dataset.has(formattedNumber)) {
                dataset.set(formattedNumber, new Array(0));
            }
        }

        let keys = Array.from(dataset.keys());

        dataset = new Map([...dataset.entries()].sort());

        let max = d3.max(keys, d => dataset.get(d).length);

        let datasetO = new Map(dataset);
        let datasetAM = new Map(dataset);
        let datasetPM = new Map(dataset);

        for (let k of datasetAM.keys()) {
            if (!(k >= 6 && k <= 20))
                datasetAM.delete(k);
        }
        for (let k of datasetPM.keys()) {
            if (!(k > 17 || k < 9))
                datasetPM.delete(k);
        }

        let datasetPM1st = new Map(datasetPM);
        let datasetPM2nd = new Map(datasetPM);

        for (let k of datasetPM1st.keys()) {
            if (k < 18)
                datasetPM1st.delete(k);
        }
        for (let k of datasetPM2nd.keys()) {
            if (k > 8)
                datasetPM2nd.delete(k);
        }

        datasetPM = new Map([...datasetPM1st].concat([...datasetPM2nd]));

        dataset = [datasetAM, datasetPM];

        let radius = (height / 2 - padding * 4);

        let rScale = d3.scaleLinear()
            .range([0, radius])
            .domain([0, max]);

        let Format = d3.format('.3s');
        let angleSlice = Math.PI / 6;

        d3.selectAll("#axisLabel")
            .data(d3.range(1,(def_i6.levels+1)).reverse())
            .join('text')
            .transition()
            .delay(300)
            .duration(1000)
            .attr("x", d => d * radius / def_i6.levels + def_i6.labelFactor)
            .attr("y", 0)
            .attr("dy", "0.4em")
            .style("font-size", "10px")
            .attr("fill", "#737373")
            .text(d =>Format(max * d/def_i6.levels));

        let angles = d3.scaleLinear()
            .domain([0, 12])
            .range([0, 2 * Math.PI]);

        let radarLine = d3.lineRadial()
            .angle((d) => angles(+d[0]))
            .radius(d => rScale(d[1].length))
            .curve(d3.curveCardinalOpen);

        d3.selectAll("#radarStroke")
            .data(dataset)
            .join('path')
            .attr("d", radarLine)
            .style("stroke-width", 2 + "px")
            .style("stroke", (d, i) => (i===0)? "#af7070" : "#44849a")
            .style("fill", "none");

        d3.selectAll("#radarCircle")
            .data(datasetO)
            .join('circle')
            .attr("r", 3)
            .attr("cx", (d) => rScale(d[1].length) * Math.cos(angles(+d[0]%12) - Math.PI/2))
            .attr("cy", (d) => rScale(d[1].length) * Math.sin(angles(+d[0]%12) - Math.PI/2))
            .style("fill", (d) => (+d[0] >= 7 && +d[0] <= 19)? "#ac5454" : "#2e657d")
            .style("fill-opacity", 0.8)
            .select('title')
            .text(d => d[1].length);
    }

    function update_calendar_heatmap() {
        function updateHeatmapLegend(min, max, colors) {
            let countScale = d3.scaleLinear()
                .domain([min, max])
                .range([0, def_i5.legendWidth])

            //Calculate the variables for the temp gradient
            let numStops = 4;

            let countRange = countScale.domain();
            countRange[2] = countRange[1] - countRange[0];
            let countPoint = [];
            for(let i = 0; i < numStops; i++) {
                countPoint.push(i * countRange[2]/(numStops-1) + countRange[0]);
            }

            d3.select("#legend-map-calendar")
                .attr("y1", "0%").attr("x1", "0%")
                .attr("y2", "0%").attr("x2", "100%")
                .selectAll("stop")
                .data(d3.range(numStops))
                .enter()
                .join("stop")
                .attr("offset", function(d,i) {
                    return countScale( countPoint[i] )/ def_i5.legendWidth;
                })
                .attr("stop-color", function(d,i) {
                    return colors( countPoint[i] );
                });

            d3.select("#legendRectHeatmap")
                .style("fill", "url(#legend-map-calendar)");

            //Define legend axis
            let legendAxis = d3.axisTop()
                .ticks(4)
                .tickFormat(d3.format("0.2s"))
                .scale(countScale);

            //Set up legend axis
            d3.select("#legend-axis-heatmap")
                .transition()
                .delay(1000)
                .duration(1000)
                .call(legendAxis);
        }

        let width = def_i5.width,
            height = def_i5.height,
            padding = def_i5.padding;

        let x_scale = null,
            y_scale = null,
            y_domain,
            x_function = null,
            y_function = null,
            values,
            format_function = null,
            dataset,
            min,
            max,
            valueOf = null,
            title = null;

        let years = new Array(0);

        calendar_data.forEach(d => {
            if(!years.includes(d.year)) {
                years.push(d.year);
            }
        });

        if (isOneYear(years)) {
            dataset = d3.rollup(calendar_data, v => v.length, d=>d.date, d=> d.dow);
            dataset = unroll(dataset, ['date', 'dow', 'value']);
            global = dataset;
            x_scale = d3.scaleBand()
                .domain(ticksDoW)
                .range([padding, width - padding]);

            y_scale = d3.scaleBand()
                .domain(ticksWeekN)
                .range([padding, height - padding * 2]);

            y_domain = y_scale.domain().filter((d,i) => !(i%5));

            x_function = d => d.dow;
            y_function = d => getWeekNumber(d.date);

            values = ticksDoW;
            format_function = (i) => daysOfWeek[i];

            min = d3.min(dataset, d => d.value);
            max = d3.max(dataset, d => d.value);

            valueOf = d => d.value;
            title = d => d.date.slice(5) + ', ' + d.value;
        }
        else {
            if (!hasReset) {
                dataset = d3.rollup(calendar_data, v => v.length, d=> d.year, d=>d.date.slice(5));
                dataset = unroll(dataset, ['year', 'date', 'value']);
                dataset = d3.rollup(dataset, v=>d3.mean(v, v=> v.value), d=> d.date);
            } else {
                dataset = default_data[6];
            }

            x_scale = d3.scaleBand()
                .domain(ticksMonth)
                .range([padding, width - padding])

            y_scale = d3.scaleBand()
                .domain(ticksDays)
                .range([padding, height - padding * 2]);

            y_domain = y_scale.domain();

            x_function = d => getMonth(d[0]);
            y_function = d => getDay(d[0]);

            values = ticksMonth;
            format_function = i => months[i];

            min = d3.min(dataset, d => d[1]);
            max = d3.max(dataset, d => d[1]);

            valueOf = d => d[1];
            title = d => d;
        }

        let colors = d3.scaleLinear()
            .domain([min, max])
            .range(["#8ecefd","#f88b9d"]);

        let xAxis = d3.axisTop()
            .scale(x_scale)
            .tickValues(values)
            .tickFormat((d, i) => format_function(i));

        let yAxis = d3.axisLeft()
            .scale(y_scale)
            .tickValues(y_domain);

        svg_calendar_heatmap.select(".rects")
            .selectAll("rect")
            .data(dataset)
            .join("rect")
            .attr("class", ".rects")
            .attr("width", x_scale.bandwidth())
            .attr("height", y_scale.bandwidth())
            .transition()
            .delay(300)
            .duration(1000)
            .attr("x", d => x_scale(x_function(d)))
            .attr("y", d => y_scale(y_function(d)))
            .attr("fill", d => colors(valueOf(d)))
            .style('filter', d => {
                if(selected_month_dow.size === 0) {
                    return '';
                }
                return selected_month_dow.has(+x_function(d))?'':'url(#desaturate)'
            })
            .select("title")
            .text(d => title(d));

        svg_calendar_heatmap.select("#xAxis")
            .call(xAxis);

        svg_calendar_heatmap.select("#yAxis")
            .call(yAxis);

        svg_calendar_heatmap.selectAll("text")
            .attr("color", "black")
            .attr("font-size", "12")
            .on('mouseover', (e, d) => {
                if(!selected_month_dow.has(d)) {
                    d3.select(e.target)
                        .style("font-size", "18");
                }
            })
            .on('mouseout', (e, d) => {
                if(!selected_month_dow.has(d)) {
                    d3.select(e.target)
                        .style("font-size", "12");
                }
            });

        updateHeatmapLegend(min, max, colors);
    }

    function update_unit_chart() {
        // Get sizes
        let margin = def_i7.margin;
        let width = def_i7.width,
            height = def_i7.height,
            effectiveWidth = width-margin.left - margin.right,
            effectiveHeight = height - margin.top - margin.bottom;

        let unrolledData;
        if (!hasReset) {
            let rolledData = d3.rollup(other_data, v => v.length,
                d => d.area, d => d.speed_limit);

            unrolledData = unroll(rolledData, ['area','speed_limit']);
            unrolledData = unrolledData.filter( d => {
                return d.area !== 3 && d.speed_limit >= 20;
            })
                .sort( (a,b) => {
                    if (a.speed_limit > b.speed_limit) return 1;
                    return -1;
                });
        } else {
            unrolledData = default_data[7];
        }

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

        // Get car values
        let nCars = def_i7.carNumber;
        let totalNum = d3.sum(usedData, v => v.value);
        if (totalNum < nCars) nCars = Math.round(totalNum);
        let carMargin = (xScale.bandwidth() - def_i7.carSize)/8;

        let getTranslateCar = (d, position) => {
            let i = d[0], partialNumber = d[1];
            let x = xScale.bandwidth()/2;

            if (i % 2 === 0) x += carMargin;
            else x += 0 - def_i7.carSize - carMargin;

            let y = Math.floor(i / 2) * (def_i7.carSize+def_i7.carPadding) + (def_i7.carSize * partialNumber + def_i7.carPadding);
            if (position === "top") { y = effectiveHeight + def_i7.carSize; }
            else if (position === "bottom") { y = -def_i7.carSize; }
            return translation(x, y) + ", scale(1,-1)";
        }

        // Stop current transition and mark them as to remove
        g.selectAll(".car").interrupt()
            .attr("class", "car-remove");

        // Move cars to below and remove them
        g.selectAll(".car-remove")
            .transition()
            .delay(1000)
            .duration(500)
            .attr('transform', d => getTranslateCar(d, "bottom"))
            .transition()
            .remove();

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
                    .attr('width', def_i7.carSize)
                    .attr('height', def_i7.carSize)
                    .attr('transform', d => getTranslateCar(d, "bottom"))
                    .transition()
                    .delay(2000)
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
                .attr('width', def_i7.carSize)
                .attr('height', def_i7.carSize)
                .style('clip-path', "inset(0 0 " + ((1-partialNumber)*100).toString() + "% 0)")
                .attr('transform', d => getTranslateCar(d, "bottom"))
                .transition()
                .delay(2000)
                .attr('transform', d => getTranslateCar(d, ""))

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

            g_legend.select('.legend_car_value')
                .html('- ' + d3.format('.2s')(carValue))
        }
    }

    let count = 0;
    let maxCount = 7;

    function updateDirty() {
        if (count !== maxCount) return;
        setDirty(false);
        hasReset = false;
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
            if (isDirty["2"])  update_pyramid_chart();
            resolve();
        }).then( r => {
            count++;
            updateDirty();
        });

        new Promise(function(resolve, reject) {
            if (isDirty["3"])  update_alluvial_chart();
            resolve();
        }).then( r => {
            count++;
            updateDirty();
        });

        new Promise(function(resolve, reject) {
            if (isDirty["4"])  update_line_chart();
            resolve();
        }).then( r => {
            count++;
            updateDirty();
        });

        new Promise(function(resolve, reject) {
            if (isDirty["5"])  update_radar_chart();
            resolve();
        }).then( r => {
            count++;
            updateDirty();
        });

        new Promise(function(resolve, reject) {
            if (isDirty["6"])  update_calendar_heatmap();
            resolve();
        }).then( r => {
            count++;
            updateDirty();
        });

        new Promise(function(resolve, reject) {
            if (isDirty["7"])  update_unit_chart();
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
    if (currentAccidentData.length === 0 || areFiltersEmpty()) {
        currentAccidentData = accident_data;
        map_data = currentAccidentData;
        pyramid_data = currentAccidentData;
        calendar_data = currentAccidentData;
        alluvial_data = currentAccidentData;
        other_data = currentAccidentData;
        hasReset = true;
        return;
    }

    let pyramidFilters = filtersPyramidBar();
    let alluvialFilters = filtersAlluvialLabel();

    // 0 - Filter by year
    currentAccidentData = accident_data.filter( d => d.year >= selectedMinYear && d.year <= selectedMaxYear);

    // 1 - Filter by county
    let raw_data = currentAccidentData; // Not filtered by county
    let f1_data = currentAccidentData.filter( d => selectedCounties.size === 0 || selectedCounties.has(d.county));

    // 2/3 - Filter by pyramid sex and age
    let f123_data = f1_data.filter( d => {
        let sex = (pyramidFilters.sex_filter.size === 0) || pyramidFilters.sex_filter.has(d.sex);
        let age = (pyramidFilters.age_filter.size === 0) || pyramidFilters.age_filter.has(d.age);
        return sex && age;
    });
    let f23_data = raw_data.filter( d => {
        let sex = (pyramidFilters.sex_filter.size === 0) || pyramidFilters.sex_filter.has(d.sex);
        let age = (pyramidFilters.age_filter.size === 0) || pyramidFilters.age_filter.has(d.age);
        return sex && age;
    });

    // 4 - Filter by alluvial data
    let f1234_data = f123_data.filter( d => {
        let f4 = ((alluvialFilters.road_filter.size === 0) || alluvialFilters.road_filter.has(d.road_surface))
            && ((alluvialFilters.light_filter.size === 0) || alluvialFilters.light_filter.has(d.light))
            && ((alluvialFilters.weather_filter.size === 0) || alluvialFilters.weather_filter.has(d.weather));

        return f4;
    });
    let f14_data = f1_data.filter( d => {
        let f4 = ((alluvialFilters.road_filter.size === 0) || alluvialFilters.road_filter.has(d.road_surface))
            && ((alluvialFilters.light_filter.size === 0) || alluvialFilters.light_filter.has(d.light))
            && ((alluvialFilters.weather_filter.size === 0) || alluvialFilters.weather_filter.has(d.weather));

        return f4;
    });
    let f234_data = f23_data.filter( d => {
        let f4 = ((alluvialFilters.road_filter.size === 0) || alluvialFilters.road_filter.has(d.road_surface))
            && ((alluvialFilters.light_filter.size === 0) || alluvialFilters.light_filter.has(d.light))
            && ((alluvialFilters.weather_filter.size === 0) || alluvialFilters.weather_filter.has(d.weather));

        return f4;
    });

    // 5 - Filter by calendar
    let f12345_data = f1234_data.filter( d => {
        let f5 = (selected_month_dow.size === 0) ||
            (yearRange() > 1 ? selected_month_dow.has(+d.date.slice(5, 7)): selected_month_dow.has(d.dow));

        return f5;
    });
    let f1235_data = f123_data.filter( d => {
        let f5 = (selected_month_dow.size === 0) ||
            (yearRange() > 1 ? selected_month_dow.has(+d.date.slice(5, 7)): selected_month_dow.has(d.dow));

        return f5;
    });
    let f145_data = f14_data.filter( d => {
        let f5 = (selected_month_dow.size === 0) ||
            (yearRange() > 1 ? selected_month_dow.has(+d.date.slice(5, 7)): selected_month_dow.has(d.dow));

        return f5;
    });
    let f2345_data = f234_data.filter( d => {
        let f5 = (selected_month_dow.size === 0) ||
            (yearRange() > 1 ? selected_month_dow.has(+d.date.slice(5, 7)): selected_month_dow.has(d.dow));

        return f5;
    });

    // I1 --> 0, 2, 3, 4, 5
    // I2 --> 0, 1, 4, 5
    // I3 --> 0, 1, 2, 3, 5
    // I4 --> 0, 1, 2, 3, 4, 5
    // I5 --> 0, 1, 2, 3, 4, 5
    // I6 --> 0, 1, 2, 3, 4
    // I7 --> 0, 1, 2, 3, 4, 5

    map_data = f2345_data;
    pyramid_data = f145_data;
    alluvial_data = f1235_data;
    calendar_data = f1234_data;
    other_data = f12345_data;
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

function filtersAlluvialLabel(){
    let array = Array.from(selectedAlluvialLabels);

    let lightFilters = new Set();
    let roadFilters = new Set();
    let weatherFilters = new Set();

    var alluvial_filters_map = {
        'Daylight' : [lightFilters, [1]],
        'Darkness' : [lightFilters, [4,5,6,7]],
        'Dry' : [roadFilters, [1]],
        'Wet or damp' : [roadFilters, [2]],
        'Snow' : [roadFilters, [3]],
        'Other' : [roadFilters, [4,5,6,7]],
        'Fine' : [weatherFilters, [1,4]],
        'Raining' : [weatherFilters, [2,5]],
        'Snowing' : [weatherFilters, [3,6]],
        'Fog or mist' : [weatherFilters, [7]],
        'No high winds' : [weatherFilters, [1,2,3]],
        'High winds' : [weatherFilters, [4,5,6]],
    }

    for(let i = 0 ; i < array.length ; i++){
        alluvial_filters_map[array[i]][1].forEach(item => alluvial_filters_map[array[i]][0].add(item))
    }

    return {light_filter: lightFilters, road_filter: roadFilters, weather_filter: weatherFilters};
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

function getWeekNumber(arg) {
    let date = new Date(arg);
    let yearStart = new Date(Date.UTC(date.getUTCFullYear(),0,1));
    let firstWeekDay = yearStart.getUTCDay();
    let diff = (date - yearStart) / 86400000;

    return Math.ceil((diff + firstWeekDay + 1) / 7);
}

function isOneYear(keys) {
    if (keys == null) {
        return false;
    }

    let currentYear = keys[0];
    let different = keys.some(function (k) {
        if(k !== currentYear) {
            return true;
        }
    });

    return !different;
}

function getYear(arg) {
    let d = new Date(arg);
    return d.getUTCFullYear();
}

function getMonth(arg) {
    return parseInt(arg.slice(0,3));
}

function getDay(arg) {
    return parseInt(arg.slice(3));
}

function yearRange() {
    return selectedMaxYear - selectedMinYear;
}

function setDirty(value) {
    Object.keys(isDirty).map(function(key, index) {
        isDirty[key] = value;
    });
}

function range(size, startAt = 0) {
    return [...Array(size).keys()].map(i => i + startAt);
}

function areFiltersEmpty() {
    return selectedCounties.size === 0 && selectedPyramidBars.size === 0 &&
        selectedAlluvialLabels.size === 0 && selected_month_dow.size === 0 &&
        selectedMinYear === minYearAccidentData && selectedMaxYear === maxYearAccidentData;
}

function dataToGraph(data,keys) {
    let index = -1;
    const nodes = [];
    const nodeByKey = new Map;
    const indexByKey = new Map;
    const links = [];

    for (const k of keys) {
      for (const d of data) {
        const key = JSON.stringify([k, d[k]]);
        if (nodeByKey.has(key)) continue;
        const node = {name: d[k]};
        nodes.push(node);
        nodeByKey.set(key, node);
        indexByKey.set(key, ++index);
      }
    }

    for (let i = 1; i < keys.length; ++i) {
      const a = keys[i - 1];
      const b = keys[i];
      const prefix = keys.slice(0, i + 1);
      const linkByKey = new Map;
      for (const d of data) {
        const names = prefix.map(k => d[k]);
        const key = JSON.stringify(names);
        const value = d.value || 1;
        let link = linkByKey.get(key);
        if (link) { link.value += value; continue; }
        link = {
          source: indexByKey.get(JSON.stringify([a, d[a]])),
          target: indexByKey.get(JSON.stringify([b, d[b]])),
          names,
          value
        };
        links.push(link);
        linkByKey.set(key, link);
      }


    }

    return {nodes,links};
}