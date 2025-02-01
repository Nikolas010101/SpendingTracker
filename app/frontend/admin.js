document.getElementById("deleteAll").addEventListener("click", function () {
    if (
        confirm(
            "Are you sure you want to delete all transactions? This action cannot be undone."
        )
    ) {
        fetch("http://127.0.0.1:5000/admin/delete-all", {
            method: "POST",
        })
            .then((response) => response.json())
            .catch((error) => {
                console.error("Error:", error);
            });
    }
});

document
    .getElementById("categorizeTransactions")
    .addEventListener("click", () => {
        fetch("/categorize-transactions", {
            method: "POST",
        });

        const progressInterval = setInterval(() => {
            fetch("/categorize-progress")
                .then((progressResponse) => progressResponse.json())
                .then((progressData) => {
                    if (progressData.total === 0) return;

                    document.getElementById(
                        "loadingBarContainer"
                    ).style.display = "block";
                    const percentage =
                        (progressData.current / progressData.total) * 100;
                    document.getElementById("loadingBar").value = percentage;
                    document.getElementById(
                        "progressText"
                    ).textContent = `${Math.round(percentage)}%`;

                    if (progressData.current === progressData.total) {
                        clearInterval(progressInterval);
                        document.getElementById(
                            "loadingBarContainer"
                        ).style.display = "none";
                    }
                })
                .catch((error) => {
                    console.error("Error fetching progress data:", error);
                    clearInterval(progressInterval);
                });
        }, 1000);
    });
