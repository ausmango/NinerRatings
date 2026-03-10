const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; //1 week cache size
const CACHE_SIZE = 100;

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
    const fullRMP = `${firstName} ${lastName}`.toLowerCase().trim();
    const search = searchName.toLowerCase().trim();

    if (search === fullRMP) {
        return true;
    }

    const searchLast = search.split(' ').pop();
    const rmpLast = lastName.toLowerCase();
    if (searchLast != rmpLast) {
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
    const cacheKey = `rmp_${name.toLowerCase().trim()}`;

    const stored = await chrome.storage.local.get(cacheKey);
    const cached = stored[cacheKey];

    if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
        console.log('Cache hit:', name, '| data:', cached.data === null ? 'null (not found)' : 'found');
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
                teachers(query: {text: "${name}", schoolID: "U2Nob29sLTEyNTM="}) {
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

    const match = professors.find(edge =>
        namesMatch(name, edge.node.firstName, edge.node.lastName)
    );
    
    if (!match) {
        await chrome.storage.local.set({ [cacheKey]: { data: null, timestamp: Date.now()}});
        return null;
    }
    

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
            .catch(err => sendResponse({sucess: false, error: err.message}));
        return true;
    }
});
