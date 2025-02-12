document.addEventListener("DOMContentLoaded", () => {
    const proceedButton = document.getElementById("proceed-button");

    if (proceedButton) {
        proceedButton.addEventListener("click", () => {
            window.location.href = "../index.html";
        });
    }
});
