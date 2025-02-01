document
    .getElementById("uploadForm")
    .addEventListener("submit", function (event) {
        event.preventDefault();

        const fileInput = document.getElementById("fileInput");
        const file = fileInput.files[0];

        if (!file) {
            alert("Please select a file.");
            return;
        }

        const formData = new FormData();
        formData.append("file", file);

        fetch("http://127.0.0.1:5000/upload", {
            method: "POST",
            body: formData,
        }).then((response) => response.text());
    });
