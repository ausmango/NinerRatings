function injectOverview(cell, data) {
    const overview = document.createElement('div');
    overview.className = 'professor-container';
    overview.innerHTML = `
    <a href="https://www.ratemyprofessors.com/professor/${data.legacyId}" target="_blank">
            ${data.firstName} ${data.lastName}
    </a>
    <div class="professor-stats">
        <span>Average Rating: ${data.avgRating}</span>
        <span>Average Difficulty: ${data.avgDifficulty}</span>
        <span>${Math.round(data.wouldTakeAgainPercent)}% would take again</span>
    </div>
    `;
    cell.innerHTML = '';
    cell.appendChild(overview);
}

function injectNotFound(cell, name) {
    const overview = document.createElement('div');
    overview.className = 'professor-container'
    overview.innerHTML = `
    <span class ="professor-name-plain">${name}</span>
    <div class= "professor-stats">
        <span>ERROR: RMP Data Not Found.</span>
    </div>
    `;
    cell.innerHTML = '';
    cell.appendChild(overview);
}

const observer = new MutationObserver(() => {
    const cells = document.querySelectorAll('[xe-field="instructor"]');
    cells.forEach(cell => {
        if (cell.dataset.ninerProcessed) return;
        cell.dataset.ninerProcessed = "true";
        const anchor = cell.querySelector('a.email');
        if (anchor) {
            const name = anchor.textContent.trim();
            anchor.textContent = '...';
            chrome.runtime.sendMessage({ professorName: name }, (response) => {
                if (response && response.success) {
                    injectOverview(cell, response.data);
                } else {
                    injectNotFound(cell, name);
                }
            });
        }
    });
});
observer.observe(document.body, {
    childList: true,
    subtree: true
});