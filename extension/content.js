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
