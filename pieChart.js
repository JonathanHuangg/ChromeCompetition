document.addEventListener('DOMContentLoaded', function () {
    processStorage(function(domainTimeMap) {
        generatePieChartByUrl(domainTimeMap); // Pass the processed data to generatePieChart
    });
});

function generatePieChartByUrl(domainTimeMap) {
    var ctx = document.getElementById('pieChart').getContext('2d');
    const labels = Object.keys(domainTimeMap);
    const data = Object.values(domainTimeMap);
    var pieChart = new Chart(ctx, {
        type: 'doughnut',
        /*

        THIS SHOULD BE THE MAIN
        data: {
            labels: ['Other', 'Entertainment', 'News', 'Education', 'Productivity'],
            datasets: [{
                label: 'Preset Categories',
                data: [10, 20, 30, 15, 25], // Values for each category
                backgroundColor: [
                    'rgba(255, 99, 132, 0.2)',
                    'rgba(54, 162, 235, 0.2)',
                    'rgba(255, 206, 86, 0.2)',
                    'rgba(75, 192, 192, 0.2)',
                    'rgba(153, 102, 255, 0.2)'
                ],
                borderColor: [
                    'rgba(255, 99, 132, 1)',
                    'rgba(54, 162, 235, 1)',
                    'rgba(255, 206, 86, 1)',
                    'rgba(75, 192, 192, 1)',
                    'rgba(153, 102, 255, 1)'
                ],
                borderWidth: 1
            }]
        },
        */ 
        // PLACEHOLDER
        data: {
            labels: labels,
            datasets: [{
                label: 'Time Spent on Domains (seconds)',
                data: data,
                backgroundColor: [
                    '#FF6384',
                    '#36A2EB',
                    '#FFCE56',
                    '#4BC0C0',
                    '#9966FF',
                    '#FF9F40'
                ], 
                borderColor: [
                    '#FF6384',
                    '#36A2EB',
                    '#FFCE56',
                    '#4BC0C0',
                    '#9966FF',
                    '#FF9F40'
                ],
                borderWidth: 1
            }]
        },

        options: {
            responsive: true,
            cutout: '50%',
            plugins: {
                legend: {
                position: 'top',
                }
            }
        }
    });
}
function processStorage(callback) {
    chrome.storage.local.get("tabFocusEvents", function (result) {
        const tabFocusEvents = result.tabFocusEvents || {};
        const domainTimeMap = {};

        for (const domain in tabFocusEvents) {
            if (tabFocusEvents.hasOwnProperty(domain)) {
                let totalTime = 0;

                tabFocusEvents[domain].events.forEach(event => {
                    if (event.focusEnd && event.focusStart) {
                        const startTime = new Date(event.focusStart);
                        const endTime = new Date(event.focusEnd);
                        const elapsed = (endTime - startTime) / 1000;
                        totalTime += elapsed;
                    }
                });

                domainTimeMap[domain] = totalTime;
            }
        }
        callback(domainTimeMap);
    });
}

/*
function convertToCatagories() {

}
*/