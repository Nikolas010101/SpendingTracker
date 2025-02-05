document.getElementById("refreshButton").addEventListener("click", function () {
    const startDate = document.getElementById("startDate").value;
    const endDate = document.getElementById("endDate").value;
    const groupBy = document.getElementById("groupBy").value;

    const transactionTypeCheckboxes = document.querySelectorAll(
        'input[name="transactionType"]:checked'
    );
    const transactionTypes = Array.from(transactionTypeCheckboxes).map(
        (cb) => cb.value
    );

    const transactionSourceCheckboxes = document.querySelectorAll(
        'input[name="transactionSource"]:checked'
    );
    const transactionSources = Array.from(transactionSourceCheckboxes).map(
        (cb) => cb.value
    );

    if (!startDate || !endDate) {
        alert("Please select both start and end dates.");
        return;
    }

    fetchData(
        startDate,
        endDate,
        groupBy,
        transactionTypes,
        transactionSources
    );
});

function fetchData(
    startDate,
    endDate,
    groupBy,
    transactionTypes,
    transactionSources
) {
    const url = new URL("/agg_data", window.location.origin);
    const params = new URLSearchParams();
    params.append("start_date", startDate);
    params.append("end_date", endDate);
    params.append("group_by", groupBy);
    transactionTypes.forEach((type) => params.append("transaction_type", type));
    transactionSources.forEach((source) =>
        params.append("transaction_source", source)
    );
    url.search = params;

    fetch(url)
        .then((response) => response.json())
        .then((data) => {
            updateChart(data);
        })
        .catch((error) => {
            console.error("Error fetching data:", error);
        });
}

function updateChart(data) {
    const categories = [...new Set(data.data.map((item) => item.category))];

    const sumTraces = categories.map((category) => {
        const categoryData = data.data.filter(
            (item) => item.category === category
        );

        const categoryDates = categoryData.map((item) => {
            const dateParts = item.date.split("/");
            return new Date(dateParts[2], dateParts[1] - 1, dateParts[0]);
        });
        const categoryAmounts = categoryData.map((item) => item.sum);

        return {
            x: categoryDates,
            y: categoryAmounts,
            type: "bar",
            name: category,
        };
    });

    const countTraces = categories.map((category) => {
        const categoryData = data.data.filter(
            (item) => item.category === category
        );

        const categoryDates = categoryData.map((item) => {
            const dateParts = item.date.split("/");
            return new Date(dateParts[2], dateParts[1] - 1, dateParts[0]);
        });
        const categoryCount = categoryData.map((item) => item.count);

        return {
            x: categoryDates,
            y: categoryCount,
            type: "bar",
            name: category,
        };
    });

    const sumLayout = {
        title: "Transaction Data (Sum)",
        barmode: "group",
        xaxis: { title: "Date" },
        yaxis: { title: "Amount (R$)" },
    };

    const countLayout = {
        title: "Transaction Data (Count)",
        barmode: "group",
        xaxis: { title: "Date" },
        yaxis: { title: "Transaction Count" },
    };

    Plotly.newPlot("sumChart", sumTraces, sumLayout);
    Plotly.newPlot("countChart", countTraces, countLayout);

    const sumPieData = categories.map((category) => {
        const categoryData = data.data.filter(
            (item) => item.category === category
        );
        const totalSum = categoryData.reduce(
            (sum, item) => sum + Math.abs(item.sum),
            0
        );
        return {
            label: category,
            value: totalSum,
        };
    });

    const countPieData = categories.map((category) => {
        const categoryData = data.data.filter(
            (item) => item.category === category
        );
        const totalCount = categoryData.reduce(
            (count, item) => count + item.count,
            0
        );
        return {
            label: category,
            value: totalCount,
        };
    });

    const pieLayout = {
        title: "Total Sum Per Category",
    };

    const countPieLayout = {
        title: "Total Count Per Category",
    };

    Plotly.newPlot(
        "sumPieChart",
        [
            {
                type: "pie",
                labels: sumPieData.map((data) => data.label),
                values: sumPieData.map((data) => data.value),
            },
        ],
        pieLayout
    );

    Plotly.newPlot(
        "countPieChart",
        [
            {
                type: "pie",
                labels: countPieData.map((data) => data.label),
                values: countPieData.map((data) => data.value),
            },
        ],
        countPieLayout
    );
}
