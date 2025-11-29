d3.csv("pollution_2000_2023.csv").then(function(data){

    // Create Date datetime object
    data.forEach(d => {
        d.Date = new Date(d.Date);
        d.Year = d.Date.getFullYear(); // get year 
    });

    const pollutants = ["O3 1st Max Hour", "CO 1st Max Hour", "SO2 1st Max Hour", "NO2 1st Max Hour"];

    // define colors for each pollutant to be used in the graph
    const pollutantColors = { "O3 1st Max Hour":"#2ca02c", 
                              "CO 1st Max Hour": "#8B4513", 
                              "SO2 1st Max Hour":  "#1f77b4", 
                              "NO2 1st Max Hour": "#d62728"  };


    // fill state dropdown with states
    const states = Array.from(new Set(data.map(d => d.State)));
    const state_select = d3.select("#stateDropdown")
    
    state_select .selectAll("option")
                 .data(states)
                 .join("option")
                 .text(d => d)
                 .attr("value", d => d);

    // fill cities dropdown with cities based on selected state
    // function that filters cities based upon state
    function updateCities(state){
        const cities = Array.from(new Set(data.filter(d => d.State === state).map(d => d.City)));
        const city_select = d3.select("#cityDropdown");
        city_select.selectAll("option").remove();

        city_select.selectAll("option")
            .data(cities)
            .join("option")
            .text(d => d)
            .attr("value", d => d);
    }

    updateCities(states[0]);

    // function for statistics of boxplot
    function boxPlotStats(values) {
        // sort values in ascending order to find the quartiles
        values = values.filter(v => !isNaN(v)).sort(d3.ascending);
        const q1 = d3.quantile(values, 0.25);
        const median = d3.quantile(values, 0.5);
        const q3 = d3.quantile(values, 0.75);
        const iqr = q3 - q1;
        const min = d3.min(values.filter(v => v >= q1 - 1.5 * iqr));
        const max = d3.max(values.filter(v => v <= q3 + 1.5 * iqr));
        const outliers = values.filter(v => v < min || v > max);
        return {q1, median, q3, min, max, outliers};
    }

    // Update chart function
    function update_boxplot(){

        const state = state_select.node().value;
        const city = d3.select("#cityDropdown").node().value;
        const pollutant = d3.select("#pollutantDropdown").node().value;

        const data_filtered = data.filter(d => d.State === state && d.City === city);

        var all_pollutants = [];
        if (pollutant === "All"){
            pollutants.forEach(p => {
                data_filtered.forEach(r => all_pollutants.push({Year: r.Year, Pollutant: p, PeakHour: +r[p]}));
            });
        } else {
            data_filtered.forEach(r => all_pollutants.push({Year: r.Year, Pollutant: pollutant, PeakHour: +r[pollutant]}));
        }

        const nested = d3.group(all_pollutants, d => d.Year, d => d.Pollutant);

        const svg = d3.select("#chart");

        //important for removing existing data from plot and update with the new
        svg.selectAll("*").remove();

        const margin = {top: 40, right: 40, bottom: 50, left: 60};
        const width = +svg.attr("width") - margin.left - margin.right;
        const height = +svg.attr("height") - margin.top - margin.bottom;

        const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

        const years = Array.from(nested.keys());
        const x = d3.scaleBand().domain(years).range([0, width]).padding(0.4);
        const y = d3.scaleLinear().domain([0, 23]).range([height, 0]);
       

        const XAxis = g.append("g")
                       .attr("transform", `translate(0,${height})`)
                       .call(d3.axisBottom(x).tickFormat(d3.format("d")))
                       .selectAll("text")
                       .attr("font-size", "12px") ;

        const YAxis = g.append("g")
                       .call(d3.axisLeft(y).tickFormat(d3.format("d")))
                       .selectAll("text")
                       .attr("font-size", "12px") ;

        // X-axis label
        g.append("text")
              .attr("x", width / 2)
              .attr("y", height + 40)  
              .attr("text-anchor", "middle")
              .attr("font-size", "16px")
              .text("Year");


        g.append("text")
             .attr("transform", "rotate(-90)") 
             .attr("x", -height / 2)
             .attr("y", -40)   
             .attr("text-anchor", "middle")
             .attr("font-size", "16px")
             .text("Peak Hour");


        // values, keys
        nested.forEach((pollutants_box, year) => {
                pollutants_box.forEach((rows, pollutant) => {
                const stats = boxPlotStats(rows.map(r => r.PeakHour));
                const xpos = x(year);

                // Box
                g.append("rect")
                    .attr("x", xpos)
                    .attr("y", y(stats.q3))
                    .attr("width", x.bandwidth())
                    .attr("height", y(stats.q1) - y(stats.q3))
                    .attr("fill", d => pollutantColors[pollutant])
                    .attr("opacity", 0.7)
                    .on("mouseover", function() {
                          d3.select("#tooltip")
                            .style("opacity", 1)
                            .html(`
                                   <b>${pollutant}</b><br>
                                   <b>Year:</b> ${year}<br>
                                   <b>Q1:</b> ${stats.q1.toFixed(2)}<br>
                                   <b>Median:</b> ${stats.median.toFixed(2)}<br>
                                   <b>Q3:</b> ${stats.q3.toFixed(2)}<br>
                                   <b>Min:</b> ${stats.min.toFixed(2)}<br>
                                   <b>Max:</b> ${stats.max.toFixed(2)}
                               `);
                             })
                    .on("mousemove", function(event) {
                          d3.select("#tooltip")
                         .style("left", (event.pageX + 10) + "px")
                         .style("top", (event.pageY - 25) + "px");
                         })
                    .on("mouseout", function() {
                        d3.select("#tooltip").style("opacity", 0);
                      });

                // Hor line for median
                g.append("line")
                    .attr("x1", xpos)
                    .attr("x2", xpos + x.bandwidth())
                    .attr("y1", y(stats.median))
                    .attr("y2", y(stats.median))
                    .attr("stroke", "black")
                    .attr("stroke-width", 3);

                // Lower whisker
                g.append("line")
                    .attr("x1", xpos + x.bandwidth()/2)
                    .attr("x2", xpos + x.bandwidth()/2)
                    .attr("y1", y(stats.min))
                    .attr("y2", y(stats.q1))
                    .attr("stroke", "black");

                // Upper whisker
                g.append("line")
                    .attr("x1", xpos + x.bandwidth()/2)
                    .attr("x2", xpos + x.bandwidth()/2)
                    .attr("y1", y(stats.q3))
                    .attr("y2", y(stats.max))
                    .attr("stroke", "black");

                // Outliers
                stats.outliers.forEach(v => {
                    g.append("circle")
                        .attr("cx", xpos + x.bandwidth()/2)
                        .attr("cy", y(v))
                        .attr("r", 3)
                        .attr("fill", "red");
                });


            });
        
          });

        // Title
        svg.append("text")
            .attr("x", +svg.attr("width")/2)
            .attr("y", 20)
            .attr("text-anchor", "middle")
            .attr("font-size", "18px")
            .text(`Peak emission hours over time – ${city}, ${state}`);
    }

    // Add event listeners - dynamic part 
    state_select.on("change", function(){
        updateCities(this.value);
        update_boxplot();
    });
    d3.select("#cityDropdown").on("change", update_boxplot);
    d3.select("#pollutantDropdown").on("change", update_boxplot);

    update_boxplot();

});
