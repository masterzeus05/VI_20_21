slider_snap = function(min, max, containerSelector, givenW, givenH, margin, callback) {

    let range = [min, max + 1];

    // set width and height of svg
    let w = givenW;
    let h = givenH;
    // let margin = {
    //     top: 130,
    //     bottom: 135,
    //     left: 40,
    //     right: 40
    // }

    // dimensions of slider bar
    let width = w - margin.left - margin.right;
    let height = h - margin.top - margin.bottom;

    // create x scale
    let x = d3.scaleLinear()
        .domain(range)  // data space
        .range([0, width]);  // display space

    let minWidth = Math.abs(x(max-1) - x(max));

    // create svg and translated g
    // let svg = d3.select(DOM.svg(w,h))
    let svg = d3.select(containerSelector)
        .append("svg")
        .attr("width", w)
        .attr("height", h);
    const g = svg.append('g').attr('transform', `translate(${margin.left}, ${margin.top})`)

    // draw background lines
    g.append('g').selectAll('line')
        .data(d3.range(range[0], range[1]+1))
        .enter()
        .append('line')
        .attr('x1', d => x(d)).attr('x2', d => x(d))
        .attr('y1', 0).attr('y2', height)
        .style('stroke', '#ccc')

    // labels
    let labelL = g.append('text')
        .attr('id', 'labelleft')
        .attr('x', 0)
        .attr('y', height + 5)
        .text(range[0])

    let labelR = g.append('text')
        .attr('id', 'labelright')
        .attr('x', 0)
        .attr('y', height + 5)
        .text(range[1])

    let getRange = function() {
        let domain = d3.brushSelection(gBrush.node());
        if (domain === null) {
            domain = lastUsableBrush;
        }
        let range = domain.map(d => Math.round(x.invert(d)));
        range[1] = range[1] - 1;
        return range;
    }

    let lastUsableBrush = [0,0];

    // define brush
    let brush = d3.brushX()
        .extent([[0,0], [width, height]])
        .on('brush', function(event) {
            let s = event.selection;
            if (s[0] === s[1]) {
                s[1] = s[1] + 1;
                lastUsableBrush = s;
            }
            // update and move labels
            labelL.attr('x', s[0])
                .text(Math.round(x.invert(s[0])))
            labelR.attr('x', s[1])
                .text(Math.round(x.invert(s[1])) - 1)
            // move brush handles
            handle.attr("display", null).attr("transform", function(d, i) { return "translate(" + [ s[i], - height / 4] + ")"; });
            // update view
            // if the view should only be updated after brushing is over,
            // move these two lines into the on('end') part below
            svg.node().value = s.map(d => Math.round(x.invert(d)));
            svg.node().dispatchEvent(new CustomEvent("input"));
        })
        .on('end', function(event) {
            if (!event.sourceEvent) return;
            let s = event.selection;
            if (s === null) s = lastUsableBrush;

            if (s[1] - s[0] < minWidth) {
                s[1] = s[0] + minWidth;

                if (s[1] > x(max)) {
                    s[1] = s[1] - minWidth;
                    s[0] = s[0] - minWidth;
                }
            }

            let d0 = s.map(x.invert);
            let d1 = d0.map(Math.round)

            d3.select(this).transition().call(event.target.move, d1.map(x))

            callback(getRange());
        })

    // append brush to g
    let gBrush = g.append("g")
        .attr("class", "brush")
        .call(brush)

    // add brush handles (from https://bl.ocks.org/Fil/2d43867ba1f36a05459c7113c7f6f98a)
    let brushResizePath = function(d) {
        let e = +(d.type === "e"),
            x = e ? 1 : -1,
            y = height / 2;
        return "M" + (.5 * x) + "," + y + "A6,6 0 0 " + e + " " + (6.5 * x) + "," + (y + 6) + "V" + (2 * y - 6) +
            "A6,6 0 0 " + e + " " + (.5 * x) + "," + (2 * y) + "Z" + "M" + (2.5 * x) + "," + (y + 8) + "V" + (2 * y - 8) +
            "M" + (4.5 * x) + "," + (y + 8) + "V" + (2 * y - 8);
    }

    let handle = gBrush.selectAll(".handle--custom")
        .data([{type: "w"}, {type: "e"}])
        .enter().append("path")
        .attr("class", "handle--custom")
        .attr("stroke", "#000")
        .attr("fill", '#eee')
        .attr("cursor", "ew-resize")
        .attr("d", brushResizePath);

    // override default behaviour - clicking outside of the selected area
    // will select a small piece there rather than deselecting everything
    // https://bl.ocks.org/mbostock/6498000
    gBrush.selectAll(".overlay")
        .each(function(d) { d.type = "selection"; })
        .on("mousedown touchstart", brushcentered)

    function brushcentered(e) {
        let dx = minWidth, // Use a fixed width when recentering.
            cx = d3.pointer(e, gBrush.node())[0],
            x0 = cx - dx/2,
            x1 = cx + dx/2;

        let val = x1 > width ? [width - dx, width] : x0 < 0 ? [0, dx] : [x0, x1];
        d3.select(this.parentNode).call(brush.move, val);
    }

    // select entire range
    gBrush.call(brush.move, range.map(x))
}