let accident_data = null;
let uk_data = null;

let svg_choropleth_map;

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
    let width = 350,
        height = 500;

    let projection = d3.geoMercator()
        .center([1.5, 55.2])
        .rotate([4.4, 0])
        .scale(1300)
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
        .on("mouseout", function(d) {
            div.transition()
                .duration(500)
                .style("opacity", 0);
        });
}

// After getting data, generate idioms
function processData() {
    gen_choropleth_map();
}

// MAIN
getData();