const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; //1 week cache size
const CACHE_SIZE = 100;
const CACHE_VERSION = 'v1';
const REPLACEMENTS = {
};

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

    if (searchLast !== rmpLast) {
        return false;
    }
    
    const searchFirst = search.split(' ')[0];
    const rmpFirst = firstName.toLowerCase();
    console.log('Comparing:', search, '|', fullRMP);


    if (rmpFirst.startsWith(searchFirst) || searchFirst.startsWith(rmpFirst)) {
        return true;
    }
    return false;
}

async function queryRMP(name) {
    const resolvedName = REPLACEMENTS[name] || name;
    const cacheKey = `rmp_${CACHE_VERSION}_${resolvedName.toLowerCase().trim()}`;

    const stored = await chrome.storage.local.get(cacheKey);
    const cached = stored[cacheKey];

    console.log('Looking up cache key:', cacheKey);
    if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
        console.log('Cache hit: ', cacheKey, '| data:', cached.data === null ? 'null' : 'found');
        return cached.data;
    }
    console.log('Cache miss:', cacheKey);
    console.log('Resolved name: ', name, '->', resolvedName);

    const headers = {
    "User-Agent": "Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Mobile Safari/537.36",
    "Content-Type": "application/json",
    "Origin": "https://www.ratemyprofessors.com",
    "Referer": "https://www.ratemyprofessors.com"
    }
    console.log('Resolved name being searched:', resolvedName);
    const response = await fetch("https://www.ratemyprofessors.com/graphql", {
    method: "POST",
    headers: headers,
    body: JSON.stringify({
        query: `
        query {
            newSearch {
                teachers(query: {text: "${resolvedName}", schoolID: "U2Nob29sLTEyNTM="}) {
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
    console.log('RMP results:', professors.map(e => `${e.node.firstName} ${e.node.lastName}`));

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
            .catch(err => sendResponse({sucess: false, error: err.message}));
        return true;
    }
});
