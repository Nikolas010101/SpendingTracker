document.addEventListener("DOMContentLoaded", function () {
    const colNames = [
        "date",
        "description",
        "source",
        "category",
        "id",
        "value",
    ];
    const orderMap = colNames.reduce((acc, key, index) => {
        acc[key] = index;
        return acc;
    }, {});
    const tableHeader = document.getElementById("tableHeader");
    const tableBody = document.getElementById("tableBody");
    const pagination = document.getElementById("pagination");
    const rowsPerPage = 10;
    let currentPage = 1;
    let data = [];
    let filteredData = [];

    const searchInput = document.createElement("input");
    searchInput.type = "text";
    searchInput.placeholder = "Search...";
    searchInput.addEventListener("input", () => {
        filterData(searchInput.value);
    });
    document.body.insertBefore(searchInput, document.body.firstChild);

    fetch("http://127.0.0.1:5000/data")
        .then((response) => response.json())
        .then((fetchedData) => {
            data = fetchedData.data;
            filteredData = data;
            if (data.length === 0) return;

            const columns = colNames.map((col) => {
                const th = document.createElement("th");
                th.textContent = col;
                return th;
            });
            columns.forEach((th) => {
                tableHeader.appendChild(th);
            });

            renderTable(currentPage);
            renderPagination();
        })
        .catch((error) => {
            console.error("Error fetching data:", error);
        });

    function formatTableValue(value) {
        const cleanValue = value ?? "";
        return Number.isNaN(cleanValue)
            ? cleanValue
            : cleanValue?.toLocaleString("pt-BR", {
                  style: "decimal",
                  minimumFractionDigits: 2,
              });
    }

    function filterData(searchText) {
        searchText = searchText.toLowerCase().trim();
        filteredData = data.filter((row) =>
            Object.values(row).some((value) =>
                formatTableValue(value).toLowerCase().includes(searchText)
            )
        );
        currentPage = 1;
        renderTable(currentPage);
        renderPagination();
    }

    function renderTable(page) {
        tableBody.innerHTML = "";

        const start = (page - 1) * rowsPerPage;
        const end = start + rowsPerPage;
        const pageData = filteredData.slice(start, end);
        if (pageData.length > 0) {
            pageData.forEach((row) => {
                const tr = document.createElement("tr");
                Object.entries(row)
                    .sort((a, b) => orderMap[a[0]] - orderMap[b[0]])
                    .forEach(([key, value]) => {
                        const td = document.createElement("td");
                        td.textContent =
                            key === "id" ? value : formatTableValue(value);
                        tr.appendChild(td);
                    });
                tableBody.appendChild(tr);
            });
        } else {
            const tr = document.createElement("tr");
            const td = document.createElement("td");
            td.colSpan = 100;
            td.textContent = "No matching records found.";
            tr.appendChild(td);
            tableBody.appendChild(tr);
        }
    }

    function renderPagination() {
        pagination.innerHTML = "";
        const totalPages = Math.ceil(filteredData.length / rowsPerPage);
        const maxVisiblePages = 5;

        if (totalPages <= 1) return;

        const prevButton = document.createElement("button");
        prevButton.textContent = "Previous";
        prevButton.disabled = currentPage === 1;
        prevButton.addEventListener("click", () => {
            currentPage--;
            renderTable(currentPage);
            renderPagination();
        });
        pagination.appendChild(prevButton);

        createPageButton(1);

        let startPage = Math.max(2, currentPage - 2);
        let endPage = Math.min(totalPages - 1, currentPage + 2);

        if (currentPage <= maxVisiblePages - 2) {
            startPage = 2;
            endPage = Math.min(totalPages - 1, maxVisiblePages);
        } else if (currentPage >= totalPages - (maxVisiblePages - 2)) {
            startPage = Math.max(2, totalPages - (maxVisiblePages - 1));
            endPage = totalPages - 1;
        }

        if (startPage > 2) {
            pagination.appendChild(document.createTextNode("..."));
        }

        for (let i = startPage; i <= endPage; i++) {
            createPageButton(i);
        }

        if (endPage < totalPages - 1) {
            pagination.appendChild(document.createTextNode("..."));
        }

        if (totalPages > 1 && endPage < totalPages) {
            createPageButton(totalPages);
        }

        const nextButton = document.createElement("button");
        nextButton.textContent = "Next";
        nextButton.disabled = currentPage === totalPages;
        nextButton.addEventListener("click", () => {
            currentPage++;
            renderTable(currentPage);
            renderPagination();
        });
        pagination.appendChild(nextButton);
    }

    function createPageButton(pageNumber) {
        const button = document.createElement("button");
        button.textContent = pageNumber;
        button.disabled = pageNumber === currentPage;
        button.addEventListener("click", () => {
            currentPage = pageNumber;
            renderTable(currentPage);
            renderPagination();
        });
        pagination.appendChild(button);
    }
});
