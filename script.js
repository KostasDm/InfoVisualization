d3.csv("pollution_2000_2023.csv").then(function(data){
   
    // Create object datetime and extract year
    data.forEach(d => {
        d.Date = new Date(d.Date);
        d.Year = d.Date.getFullYear();
    });

    // Define colors for each pollutant
    const pollutants = ["O3 1st Max Hour", "CO 1st Max Hour", "SO2 1st Max Hour", "NO2 1st Max Hour"];
    const pollutantColors = { 
        "O3 1st Max Hour":"#2ca02c", 
        "CO 1st Max Hour": "#8B4513", 
        "SO2 1st Max Hour":  "#1f77b4", 
        "NO2 1st Max Hour": "#d62728"
    };

    // populate states dropdown
    const state_select = d3.select("#stateDropdown");
    const states = Array.from(new Set(data.map(d => d.State)));
    console.log("States:", states);

    state_select.selectAll("option")
        .data(states)
        .join("option")
        .text(d => d)
        .attr("value", d => d);

    // update cities dropdown based on selected state
    function update_cities(state){

        const cities = Array.from(new Set(data.filter(d => d.State === state).map(d => d.City)));
        console.log("Selected state:", state, "\nwith cities:", cities);

        const city_selected = d3.select("#cityDropdown");
       
        // clear previous selection
        city_selected.selectAll("option").remove();
        city_selected.selectAll("option")
            .data(cities)
            .join("option")
            .text(d => d)
            .attr("value", d => d);
    }

    update_cities(states[0]);

    // define function to calculate box plot statistics
    function boxPlotStats(values){
        values = values.filter(v => !isNaN(v)).sort(d3.ascending);
        //for debugging
        // console.log("values:", values);
        const q1 = d3.quantile(values,0.25);
        const median = d3.quantile(values,0.5);
        const q3 = d3.quantile(values,0.75);
        const iqr = q3 - q1;
        const min = d3.min(values.filter(v => v >= q1 - 1.5*iqr));
        const max = d3.max(values.filter(v => v <= q3 + 1.5*iqr));
        const outliers = values.filter(v => v < min || v > max);
        return {q1, median, q3, min, max, outliers};
    }
    
    const tooltip = d3.select("#tooltip");

    function update_plots(){
        const state = state_select.node().value;
        const city = d3.select("#cityDropdown").node().value;
        const pollutant = d3.select("#pollutantDropdown").node().value;
        console.log("selected state:", state, "\nselected city:", city, "\nselected pollutant:", pollutant );

        const data_filtered = data.filter(d => d.State===state && d.City===city);
        
        //list to append data for the boxplot
        var allData = [];
        if (pollutant === "All"){
            pollutants.forEach(p => {
                data_filtered.forEach(d => allData.push({Year: d.Year, Pollutant: p, Value: +d[p]}));
            });
        } else {
            data_filtered.forEach(d => allData.push({Year: d.Year, Pollutant: pollutant, Value: +d[pollutant]}));
        }

        const data_map = d3.group(allData, d=>d.Year, d=>d.Pollutant);
        console.log('data mapping:', data_map)
        drawBoxplot(data_map);
    }

    function drawBoxplot(data_map){
        const svg = d3.select("#boxplot");
        //remove previous plot
        svg.selectAll("*").remove();

        const margin = {top: 30, right: 40, bottom: 40, left: 40};
        const width = +svg.attr("width") - margin.left - margin.right;
        const height = +svg.attr("height") - margin.top - margin.bottom;
        const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

        const years = Array.from(data_map.keys()).sort();
        console.log("Years to plot:", years)
        const x = d3.scaleBand().domain(years).range([0, width]).padding(0.2);
        // group pollutants inside each year when to be displayed side by side
        const x2 = d3.scaleBand().domain(pollutants).range([0, x.bandwidth()]).padding(0.2);
        
        // for debuggin x2
        //pollutants.forEach(p => {
        //                   console.log(p, "->", x2(p));
       // });
       
        var allValues = [];
        //append a
        data_map.forEach(m => m.forEach(r => r.forEach(d=>allValues.push(d.Value))));
        const y = d3.scaleLinear().domain([d3.min(allValues), d3.max(allValues)]).nice().range([height,0]);
        console.log(allValues)
        g.append("g").attr("transform",`translate(0,${height})`).call(d3.axisBottom(x));
        g.append("g").call(d3.axisLeft(y));

        g.append("text")
                  .attr("transform", "rotate(-90)")   
                  .attr("y", -30)
                  .attr("x", -height / 2) 
                  .style("text-anchor", "middle")
                  .style("font-size", "13px")
                  .text("1st peak emmision hour"); 

        g.append("text")  
                  .attr("x", width / 2)                         
                  .attr("y", height +35)
                  .style("text-anchor", "middle")
                  .style("font-size", "13px")
                  .text("Year");   

        data_map.forEach((poll_data, year)=>{
            poll_data.forEach((rows, pollutant)=>{
                const values = rows.map(d=>d.Value);
                const stats = boxPlotStats(values);
                const xpos = x(year) + x2(pollutant); // place box on pixel location around xtick based on which pollutant
                console.log(stats);
                // Create box
                g.append("rect")
                    .attr("x", xpos)
                    .attr("y", y(stats.q3)) // y is upper box limit aka q3
                    .attr("width", x2.bandwidth()) // width of x2
                    .attr("height", y(stats.q1)-y(stats.q3))
                    .attr("fill", pollutantColors[pollutant]) // fill with color based on pollutant
                    .attr("opacity",0.5)
                    .on("mouseover",(event)=>{
                        drawHistogram(values, pollutant, year); // if hoover over box, update histogram on bottom and show stats
                        tooltip.style("opacity",1)
                            .html(`
                                <b>${pollutant} - ${year}</b><br>
                                Q1: ${stats.q1}<br>
                                Median: ${stats.median}<br>
                                Q3: ${stats.q3}<br>
                                IQR: ${stats.q3- stats.q1}<br>
                                Min: ${stats.min}<br>
                                Max: ${stats.max}
                            `)
                            .style("left",(event.pageX+10)+"px")
                            .style("top",(event.pageY-20)+"px");
                    })
                    .on("mousemove",(event)=>{
                        tooltip.style("left",(event.pageX+10)+"px")
                               .style("top",(event.pageY-25)+"px");
                    })
                    .on("mouseout",()=>{
                        tooltip.style("opacity",0); // if move mouse away, then hide display
                    });

                // Median line
                g.append("line")
                    .attr("x1", xpos)
                    .attr("x2", xpos + x2.bandwidth())
                    .attr("y1", y(stats.median))
                    .attr("y2", y(stats.median))
                    .attr("stroke","black")
                    .attr("stroke-width",2);

                // Whiskers
                g.append("line")
                    .attr("x1", xpos + x2.bandwidth()/2)
                    .attr("x2", xpos + x2.bandwidth()/2)
                    .attr("y1", y(stats.min))
                    .attr("y2", y(stats.q1))
                    .attr("stroke","black")
                    .attr("stroke-width",1);
                g.append("line")
                    .attr("x1", xpos + x2.bandwidth()/2)
                    .attr("x2", xpos + x2.bandwidth()/2)
                    .attr("y1", y(stats.q3))
                    .attr("y2", y(stats.max))
                    .attr("stroke","black")
                    .attr("stroke-width",1);
            });
        });
    }

    function drawHistogram(values, pollutant, year){
        const svg = d3.select("#histogram");
        // remove previous plot
        svg.selectAll("*").remove();

        const margin = {top: 30, right: 40, bottom: 40, left: 40};
        const width = +svg.attr("width") - margin.left - margin.right;
        const height = +svg.attr("height") - margin.top - margin.bottom;

        const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

        const x = d3.scaleLinear().domain([d3.min(values), d3.max(values)]).nice().range([0,width]);
        // 12 bins to include 2 hours into each bin
        const bins = d3.bin().domain(x.domain()).thresholds(12)(values);
        console.log('Bins:', bins)
        const y = d3.scaleLinear().domain([0, d3.max(bins, d=>d.length)]).range([height,0]);

        const hist_xaxis = g.append("g").attr("transform",`translate(0,${height})`).call(d3.axisBottom(x));
        g.append("text")  
                  .attr("x", width / 2)                         
                  .attr("y", height +35)
                  .style("text-anchor", "middle")
                  .style("font-size", "13px")
                  .text("1st peak emmision hour");     

        const hist_yaxis =g.append("g").call(d3.axisLeft(y));

        g.append("text")
         .attr("transform", "rotate(-90)")   
         .attr("y", -30)
         .attr("x", -height / 2) 
         .style("text-anchor", "middle")
         .style("font-size", "13px")
         .text("Occurence");        

        g.selectAll("rect")
         .data(bins)
         .join("rect")
         .attr("x", d=>x(d.x0)+1)
         .attr("y", d=>y(d.length))
         .attr("width", d=>x(d.x1)-x(d.x0)-1)
         .attr("height", d=>height-y(d.length))
         .attr("fill","blue");

        g.append("text")
         .attr("x", width/2)
         .attr("y", -5)
         .attr("text-anchor","middle")
         .attr("font-size","15px")
         .text(`${pollutant} histogram in ${year}`);
    }

    state_select.on("change", ()=>{
        update_cities(state_select.node().value);
        update_plots();
    });
    d3.select("#cityDropdown").on("change", update_plots);
    d3.select("#pollutantDropdown").on("change", update_plots);

    update_plots();
});

