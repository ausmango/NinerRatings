async function queryRMP(name) {
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
        return null;
    }
    return professors[0].node;
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.professorName) {
        queryRMP(request.professorName)
            .then(data => {
                if (data) {
                    sendResponse({success:true, data});
                } else {
                    sendResponse({success: false, error: "Not found"});
                }
            })
            .catch(err => sendResponse({sucess: false, error: err.message}));
        return true;
    }
});
