const CACHE_DURATION = 3 * 24 * 60 * 60 * 1000; //3 day cache size
const CACHE_SIZE = 100;
const CACHE_VERSION = 'v2';
const REPLACEMENTS = {
    "Ree Linker": "Jeanne-Marie Linker",
    "Hamid Baradaran Shoraka" : "Hamid Shoraka",
    "Manuel Perez Quinones" : "Manuel Quinones",
    "Maria Guimaraes Biagini" : "Maria Guimaraes",
    "Dave Naylor" : "David Naylor",
    "Jay Wu" : "Jy Wu",
    "Dave Weggel" : "David Weggel",
    "Jeff Raquet" : "Jeffrey Raquet",
    "Terence Fagan" : "Terrence Fagan",
    "Garry Hodgins" : "Martin Hodgins",
    "Kosta Falaggis" : "Konstantinos Falaggis",
    "Jim Conrad" : "James Conrad",
    "Nigel Zheng" : "Naiquan Zheng",
    "Gary Teng" : "Teng Gary",
    "Sam Shue" : "Samuel Shue",
    "Zbyszek Ras" : "Zbigniew Ras",
    "Tom Moyer" : "Thomas Moyer",
    "Chao Wang" : "Wiechao Wang",
    "Carmen Soliz Urrutia" : "Maria Carmen Soliz Urrutia",
    "Jeffrey Leak" : "Jeffery Leak",
    "Katie Hogan" : "Kathleen Hogan",
    "Juan Meneses Naranjo" : "Juan Meneses",
    "Becky Roeder" : "Rebecca Roeder",
    "Pilar Blitvich" : "Maria Pilar Garces-Conejos Blitvich"
}; //manual replacements

async function maintainCacheSize() {
    const allItems = await chrome.storage.local.get(null);
    const entries = Object.entries(allItems)
        .filter(([, value]) => value && value.timestamp)
        .sort(([, a], [, b]) => a.timestamp - b.timestamp);

    if (entries.length >= CACHE_SIZE) {
        const toDelete = entries.slice(0, 50).map(([key]) => key);
        await chrome.storage.local.remove(toDelete);
    }
}

function namesMatch(searchName, firstName, lastName) {
    const normalize = (str) => str.toLowerCase()
    .trim()
    .replace(/[u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    .replace(/\s+/g, ' ');
    const fullRMP = normalize(`${firstName} ${lastName}`);
    const search = normalize(searchName);

    if (search === fullRMP) {
        return true;
    }

    const searchLast = search.split(' ').pop();
    const rmpLast = lastName.toLowerCase();

    if (searchLast !== rmpLast) {
        return false;
    }
    
    const searchFirst = search.split(' ')[0];
    const rmpFirst = firstName.toLowerCase();
    
    if (rmpFirst.startsWith(searchFirst) || searchFirst.startsWith(rmpFirst)) {
        return true;
    }
    return false;
}

async function queryRMP(name) {
    const resolvedName = REPLACEMENTS[name] || name; 
    const queryName = resolvedName.replace(/['\u2018\u2019]/g, '').trim();
    const cacheKey = `rmp_${CACHE_VERSION}_${resolvedName.toLowerCase().trim()}`;

    const stored = await chrome.storage.local.get(cacheKey);
    const cached = stored[cacheKey];

    if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
        return cached.data;
    }

    const headers = {
    "User-Agent": "Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Mobile Safari/537.36",
    "Content-Type": "application/json",
    "Origin": "https://www.ratemyprofessors.com",
    "Referer": "https://www.ratemyprofessors.com"
    }
    const response = await fetch("https://www.ratemyprofessors.com/graphql", {
    method: "POST",
    headers: headers,
    body: JSON.stringify({
        query: `
        query {
            newSearch {
                teachers(query: {text: "${queryName}", schoolID: "U2Nob29sLTEyNTM="}) {
                    edges {
                        node {
                            legacyId
                            firstName
                            lastName
                            avgRating
                            avgDifficulty
                            wouldTakeAgainPercent
                            numRatings
                            department
                            ratings(first: 1) { 
                                edges {
                                    node {
                                        date
                                    }
                                }
                            }   
                        }
                    }
                }
            }
        }
        `
        })
    });

    const data = await response.json();
    const professors = data.data.newSearch.teachers.edges;

    if (!professors.length) {
        await chrome.storage.local.set({ [cacheKey]: {data : null, timestamp: Date.now()}});
        return null;
    }

    const matches = professors.filter(edge => {
        return namesMatch(resolvedName, edge.node.firstName, edge.node.lastName)
    });
    
    if (!matches.length) {
        await chrome.storage.local.set({ [cacheKey]: { data: null, timestamp: Date.now()}});
        return null;
    }
    
    const match = matches.reduce((best, current) =>
        current.node.numRatings > best.node.numRatings ? current : best
    );

    const prof = match.node
    const lastRating = prof.ratings?.edges[0]?.node?.date || null;
    prof.lastRating = lastRating;

    await maintainCacheSize();
    await chrome.storage.local.set({ [cacheKey]: { data: prof, timestamp: Date.now()}});
    
    return prof;
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.professorName) {
        queryRMP(request.professorName)
            .then(data => {
                if (data && data.numRatings > 0) {
                    sendResponse({success:true, data});
                } else {
                    sendResponse({success: false, error: "Not found"});
                }
            })
            .catch(err => sendResponse({success: false, error: err.message}));
        return true;
    }
});
