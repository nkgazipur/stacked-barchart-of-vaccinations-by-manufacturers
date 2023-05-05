const vaccinationsUrl =
  "https://raw.githubusercontent.com/owid/covid-19-data/master/public/data/vaccinations/vaccinations-by-manufacturer.csv";

const width = window.innerWidth;
const height = window.innerHeight * 0.7;
const margin = { left: 100, right: 30, top: 60, bottom: 60 };

const barPadding = 0.2;
const legendPadding = 0.3;

const legendHeight = 25;

const colors = [
  "gold",
  "blue",
  "yellow",
  "green",
  "maroon",
  "silver",
  "lime",
  "olive",
  "darkgreen",
  "pink",
  "brown",
  "slateblue",
  "orange",
  "teal",
  "cyan",
];

const spinnerOptions = {
  lines: 13, // The number of lines to draw
  length: 60, // The length of each line
  width: 17, // The line thickness
  radius: 80, // The radius of the inner circle
  scale: 1, // Scales overall size of the spinner
  corners: 1, // Corner roundness (0..1)
  speed: 1, // Rounds per second
  rotate: 0, // The rotation offset
  animation: "spinner-line-fade-quick", // The CSS animation name for the lines
  direction: 1, // 1: clockwise, -1: counterclockwise
  color: "#ffffff", // CSS color or array of colors
  fadeColor: "transparent", // CSS color or array of colors
  top: "50%", // Top position relative to parent
  left: "50%", // Left position relative to parent
  shadow: "0 0 1px transparent", // Box-shadow for the lines
  zIndex: 2000000000, // The z-index (defaults to 2e9)
  className: "spinner", // The CSS class to assign to the spinner
  position: "absolute", // Element positioning
};

function wrap(text) {
  text.each(function () {
    var text = d3.select(this);
    var words = text
      .text()
      .split(/\s|\&|\//)
      .reverse();
    var lineHeight = 20;
    var width = parseFloat(text.attr("width"));
    var y = parseFloat(text.attr("y"));
    var x = parseFloat(text.attr("x"));
    var anchor = text.attr("text-anchor");
    console.log(words);

    var tspan = text
      .text(null)
      .append("tspan")
      .attr("x", x)
      .attr("y", y)
      .attr("text-anchor", anchor);
    var lineNumber = 0;
    var line = [];
    var word = words.pop();

    while (word) {
      line.push(word);
      tspan.text(line.join(" "));
      if (tspan.node().getComputedTextLength() > width) {
        lineNumber += 1;
        line.pop();
        tspan.text(line.join(" "));
        line = [word];
        tspan = text
          .append("tspan")
          .attr("x", x)
          .attr("y", y + lineNumber * lineHeight)
          .attr("text-anchor", anchor)
          .text(word);
      }
      word = words.pop();
    }
  });
}

const drawChart = (data, svg, colorScale, binScale) => {
  const stackKeys = Array.from(new Set(data.map((d) => d["vaccine"])).values());

  stackKeys.forEach((d) => {
    const dataByVaccine = data
      .filter((k) => k["vaccine"] === d)
      .sort((a, b) => a.date - b.date)
      .map((t, i, arr) => {
        if (i === 0) {
          t.current_value = t["total_vaccinations"];
        } else {
          const diff =
            t["total_vaccinations"] - arr[i - 1]["total_vaccinations"];
          t.current_value = diff < 0 ? 0 : diff;
        }
        return t;
      });
  });

  const binnedData = d3
    .bin()
    .value((d) => d.date)
    .thresholds(binScale)(data);

  const processedData = binnedData.map((d) => {
    d.month = d3.timeFormat("%b-%Y")(d.x0);

    stackKeys.forEach((vacc) => {
      d[vacc] = 0;
      for (let i = 0; i < d.length; i++) {
        if (d[i]["vaccine"] === vacc) {
          d[vacc] = d[vacc] + d[i]["current_value"];
        }
      }
    });
    return d;
  });

  const stackedData = d3
    .stack()
    .keys(stackKeys)
    .order(d3.stackOrderNone)
    .offset(d3.stackOffsetDiverging)(processedData);

  const xScale = d3
    .scaleBand()
    .domain(processedData.map((d) => d.month))
    .range([margin.left, width - margin.right])
    .paddingInner(barPadding);

  const yScale = d3
    .scaleLinear()
    .domain(d3.extent(stackedData.flat(2)))
    .range([height - margin.bottom, margin.top]);

  const xAxis = d3.axisBottom(xScale).tickSizeOuter(0);

  const yAxis = d3.axisLeft(yScale).ticks(height / 60);

  svg
    .selectAll(".y-axis")
    .data([null])
    .join("g")
    .attr("class", "y-axis")
    .attr("transform", `translate(${margin.left}, 0)`)
    .call(yAxis)
    .call((g) => g.select(".domain").remove())
    .call((g) =>
      g
        .selectAll(".tick line")
        .clone()
        .attr("x2", width - margin.left - margin.right)
        .attr("stroke-opacity", 0.3)
    )
    .call((g) =>
      g
        .selectAll(".y-label")
        .data([null])
        .join("text")
        .attr("class", "y-label")
        .attr("x", -20)
        .attr("y", margin.top)
        .attr("fill", "black")
        .attr("text-anchor", "start")
        .text("↑ Vaccinations")
    );

  svg
    .selectAll(".x-axis")
    .data([null])
    .join("g")
    .attr("class", "x-axis")
    .attr("transform", `translate(0, ${height - margin.bottom})`)
    .call(xAxis);

  const barGroup = svg
    .selectAll(".bar-group")
    .data([null])
    .join("g")
    .attr("class", "bar-group");

  const tooltip = d3.select("#tooltip");

  const mouseMoved = (event, d) => {
    const vacc = d3.select(event.currentTarget.parentNode).datum().key;
    const vaccMonth = d.data.month;
    const vaccValue = d.data[vacc];

    const tooltipTitle = `<div>Vaccine: ${vacc}</div><div>Month: ${vaccMonth}</div><div>Month Total: ${d3.format(
      ","
    )(vaccValue)}</div>`;

    tooltip
      .style("visibility", "visible")
      .style(
        "transform",
        `translate(calc(-50% + ${event.pageX}px), calc(-225% + ${event.pageY}px))`
      )
      .html(tooltipTitle);
  };

  const mouseLeft = () => {
    tooltip.style("visibility", "hidden");
  };

  barGroup
    .selectAll("g")
    .data(stackedData)
    .join("g")
    .attr("fill", (d) => colorScale(d.key))
    .selectAll("rect")
    .data((d) => d)
    .join("rect")
    .attr("x", (t) => xScale(t.data.month))
    .attr("y", ([y1, y2]) => Math.min(yScale(y1), yScale(y2)))
    .attr("height", ([y1, y2]) => Math.abs(yScale(y1) - yScale(y2)))
    .attr("width", xScale.bandwidth())
    .on("mouseenter mousemove", mouseMoved)
    .on("mouseleave", mouseLeft);
};

const dataParse = (d) => {
  d.date = d3.timeParse("%Y-%m-%d")(d.date);
  d["total_vaccinations"] = +d["total_vaccinations"];
  return d;
};

const main = async () => {
  const spinnerTarget = document.getElementById("spinner");
  const spinner = new Spinner(spinnerOptions).spin(spinnerTarget);
  const vaccinationsData = await d3.csv(vaccinationsUrl, dataParse);
  spinner.stop();

  const locationList = [...new Set(vaccinationsData.map((d) => d.location))];

  const vaccines = Array.from(
    new Set(vaccinationsData.map((d) => d["vaccine"])).values()
  );
  const colorScale = d3.scaleOrdinal().domain(vaccines).range(colors);

  const legendScale = d3
    .scaleBand()
    .domain(colorScale.domain())
    .range([margin.left, width - margin.right])
    .padding(legendPadding);

  const binScale = d3
    .scaleTime()
    .domain(d3.extent(vaccinationsData, (d) => d.date))
    .ticks(d3.timeMonth);

  const svg = d3
    .select("#main-chart")
    .append("svg")
    .attr("width", width)
    .attr("height", height)
    .call(responsivefy);

  const legendGroup = svg.append("g");

  legendGroup
    .selectAll("rect")
    .data(legendScale.domain())
    .join("rect")
    .attr("x", (d) => legendScale(d))
    .attr("y", 10)
    .attr("width", legendScale.bandwidth() / 2)
    .attr("height", legendHeight)
    .attr("fill", (d) => colorScale(d));

  legendGroup
    .selectAll("text")
    .data(legendScale.domain())
    .join("text")
    .attr("x", (d) => legendScale(d) + legendScale.bandwidth() / 2 + 5)
    .attr("y", -5)
    .attr("width", 10)
    .attr("text-anchor", "center")
    .attr("dy", "0.5em")
    .text((d) => d)
    .call(wrap);

  jSuites.dropdown(document.getElementById("location"), {
    data: locationList,
    value: "Japan",
    autocomplete: true,
    width: "280px",
    onload: () => {
      drawChart(
        vaccinationsData.filter((t) => t.location === "Japan"),
        svg,
        colorScale,
        binScale
      );
    },
    onchange: (d) => {
      drawChart(
        vaccinationsData.filter((t) => t.location === d.value),
        svg,
        colorScale,
        binScale
      );
    },
  });
};

function responsivefy(svg) {
  const container = d3.select(svg.node().parentNode);
  const width = parseInt(svg.style("width"), 10);
  const height = parseInt(svg.style("height"), 10);
  const aspectRatio = width / height;

  svg
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("preserveAspectRatio", "xMinYMid")
    .call(resize);

  d3.select(window).on("resize." + container.attr("id"), resize);

  function resize() {
    const targetWidth = parseInt(container.style("width"));
    svg.attr("width", targetWidth);
    svg.attr("height", Math.round(targetWidth / aspectRatio));
  }
}

main();
