let accident_data = null;
let uk_data = null;

let svg_choropleth_map;
let svg_pyramid_bar_chart;

let selectedCounties = [];
let currentAccidentData = null;

// Gets data from dataset
function getData() {
    d3.dsv(";", "data/accidents_mini_with_county.csv", function(d) {
        return {
            Accident_Index: d.Accident_Index,
            Accident_Severity: d.Accident_Severity,
            Age_Band_of_Driver: d.Age_Band_of_Driver,
            county: d.county,
            Date: d.Date,
            Day_of_Week: d.Day_of_Week,
            Latitude: +d.Latitude,
            Light_Conditions: d.Light_Conditions,
            Longitude: +d.Longitude,
            Number_of_Casualties: +d.Number_of_Casualties,
            Number_of_Vehicles: +d.Number_of_Vehicles,
            Road_Surface_Conditions: d.Road_Surface_Conditions,
            Road_Type: d.Road_Type,
            Sex_of_Driver: d.Sex_of_Driver,
            Speed_limit: +d.Speed_limit,
            Time: d.Time,
            Timestamp: new Date(d.Date + ' ' + d.Time),
            Urban_or_Rural_Area: d.Urban_or_Rural_Area,
            Vehicle_Type: d.Vehicle_Type,
            Vehicle_Year: +d.Vehicle_Year,
            Weather_Conditions: d.Weather_Conditions,
            Year: +d.Year,
            make: d.make
        }
    }).then(function(data, error) {
        if (error != null) {
            console.log(error);
        }
        accident_data = data;

        d3.json("data/uk_test.json").then(function(topology) {
            uk_data = topology;

            processData();
        });

    });
}

// Generate choropleth map
function gen_choropleth_map() {
    let width = 300,
        height = 400;

    let projection = d3.geoMercator()
        .center([1.5, 55.2])
        .rotate([4.4, 0])
        .scale(1100)
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

    let zoom = d3.zoom()
        .scaleExtent([1, 50])
        .on('zoom', function(event) {
            // console.log(event.transform)
            let s = event.transform.k, x = event.transform.x, y = event.transform.y;
            event.transform.x = Math.min(width / 2 * (s - 1), Math.max(width / 2 * (1 - s) - 150 * s, x));
            event.transform.y = Math.min(height / 2 * (s - 1) + 230 * s, Math.max(height / 2 * (1 - s) - 230 * s, y));
            g.selectAll('path')
                .attr('transform', event.transform);
            g.selectAll("circle")
                .attr('transform', event.transform);
        });

    svg_choropleth_map.call(zoom);

    let groupedByCounties = d3.rollup(accident_data, v => v.length, d => d.county);
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
            if (!groupedByCounties.has(d.properties.LAD13NM) || groupedByCounties.get(d.properties.LAD13NM) === undefined) {
                return "grey";
            }
            return colorScaleMap(groupedByCounties.get(d.properties.LAD13NM));
        })
        .on("mouseover", function(event,d) {
            div.transition()
                .duration(200)
                .style("opacity", .9);
            div.html(d.properties.LAD13NM + " - Number: " + groupedByCounties.get(d.properties.LAD13NM))
                .style("left", (event.pageX) + "px")
                .style("top", (event.pageY - 28) + "px");
        })
        .on("mouseout", function(event, d) {
            div.transition()
                .duration(500)
                .style("opacity", 0);
        })
        .on("click", function(event, d) {
            console.log(event, d);
        });
}

// Generate pyramid bar chart
function gen_pyramid_bar_chart() {
    // Set margins and width and height
    let margin = {
        top: 8,
        right: 20,
        bottom: 32,
        left: 20,
        middle: 24
    };
    let width = 350,
        height = 400,
        effectiveWidth = width-margin.left-margin.right,
        regionWidth = (effectiveWidth)/2 - margin.middle;

    // these are the x-coordinates of the y-axes
    let pointA = regionWidth,
        pointB = effectiveWidth - regionWidth;

    // Set svg
    svg_pyramid_bar_chart = d3.select("#pyramid_bar_chart")
        .append("svg")
        .attr("width", width)
        .attr("height", height);
    let g = svg_pyramid_bar_chart.append("g")
        .attr("transform", translation(margin.left, margin.top));

    // Get custom dataset
    let filteredAccidentData = accident_data.filter(d => {
        return d.Age_Band_of_Driver !== "" && d.Sex_of_Driver !== "Not known";
    })
    let groupedByAgeGender = d3.rollup(filteredAccidentData,
            v => v.length,
            d => d.Age_Band_of_Driver, d => d.Sex_of_Driver
    );
    groupedByAgeGender.delete("11 - 15");
    // groupedByAgeGender.set("06 - 10", groupedByAgeGender.get("6 - 10"));
    groupedByAgeGender.delete("6 - 10");

    console.log(groupedByAgeGender)

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
        .ticks(5);

    let xAxisRight = d3.axisBottom()
        .scale(xScale)
        .ticks(5);

    // Y scale
    let yScaleData = Array.from(groupedByAgeGender.keys()).sort().reverse();

    let yScale = d3.scaleBand()
        .domain(yScaleData)
        .range([0, height - margin.bottom])
        .paddingInner(0.2)
        .paddingOuter(0.2);

    // Y axis
    let yAxisLeft = d3.axisRight()
        .scale(yScale)
        .tickSize(4, 0)
        .tickPadding(margin.middle - 4);

    let yAxisRight = d3.axisLeft()
        .scale(yScale)
        .tickSize(4, 0)
        .tickFormat('');

    // Bars groups for each side
    let leftBarGroup = g.append('g')
        .attr('transform', translation(pointA, 0) + ', scale(-1,1)');

    leftBarGroup.append( 'text' )
        .attr( 'transform', translation(regionWidth - margin.left,10) + ', scale(-1,1)')
        .style( 'font', '15px sans-serif' )
        .attr( 'text-anchor', 'start' )
        .html("Male")

    let rightBarGroup = g.append('g')
        .attr('transform', 'translate(' + pointB + ',0)');

    rightBarGroup.append( 'text' )
        .attr( 'transform', translation(regionWidth - 3*margin.right,10))
        .style( 'font', '15px sans-serif' )
        .attr( 'text-anchor', 'start' )
        .html("Female")

    // Draw bars
    leftBarGroup.selectAll('.bar.left')
        .data(groupedByAgeGender)
        .enter().append('rect')
        .attr('class', 'bar left')
        .attr('x', 0)
        .attr('y', function(d) { return yScale(d[0]); })
        .attr('width', function(d) { return xScale(d[1].get("Male")); })
        .attr('height', yScale.bandwidth())
        .attr('fill', '#8ECEFD')
        .append("title")
        .text(d => d[1].get("Male"));

    rightBarGroup.selectAll('.bar.right')
        .data(groupedByAgeGender)
        .enter().append('rect')
        .attr('class', 'bar right')
        .attr('x', 0)
        .attr('y', function(d) { return yScale(d[0]); })
        .attr('width', function(d) { return xScale(d[1].get("Female")); })
        .attr('height', yScale.bandwidth())
        .attr('fill', '#F88B9D')
        .append("title")
        .text(d => d[1].get("Female"));

    // Draw Axes
    g.append('g')
        .attr('class', 'axis y left')
        .attr('transform', translation(pointA, 0))
        .call(yAxisLeft)
        .selectAll('text')
        .style('text-anchor', 'middle');

    g.append('g')
        .attr('class', 'axis y right')
        .attr('transform', translation(pointB, 0))
        .call(yAxisRight);

    g.append('g')
        .attr('class', 'axis x left')
        .attr('transform', translation(0, height-margin.bottom))
        .call(xAxisLeft);

    g.append('g')
        .attr('class', 'axis x right')
        .attr('transform', translation(pointB, height-margin.bottom))
        .call(xAxisRight);

    // Y axis title
    g.append('text')
        .attr('dy', '.18em' )
        .attr('x', effectiveWidth/2 - margin.left*3/5)
        .text('Age');

    // X axis title
    // g.append('text')
    //     .attr('dy', '.24em' )
    //     .attr('x', effectiveWidth/2 - margin.left*3/5)
    //     .text('Age');
}

// After getting data, generate idioms
function processData() {
    gen_choropleth_map();
    gen_pyramid_bar_chart();
}

// MAIN
getData();

// Helper
function translation(x,y) {
    return 'translate(' + x + ',' + y + ')';
}
