(function() {
    let showingCategoryChart = true;
    let pieChart;

    document.addEventListener('DOMContentLoaded', function () {
        const switchButton = document.getElementById('switchChartButton');
        if (switchButton) {
            switchButton.addEventListener('click', toggleChart); 
        } else {
            console.error('Element with id "switchChartButton" not found.');
        }

        processStoragePie(function(domainTimeMap) {
            const categoryTimeMap = convertToCategories(domainTimeMap);
            showPieChartContainer();
            generatePieChart(categoryTimeMap, 'Time Spent on Categories', 'Switch To Domains');
        });
    });

    // Dashboard-only: the full-page view hides its chart column until there
    // is data. The popup has no #extra-container and needs nothing here.
    function showPieChartContainer() {
        var extraContainer = document.getElementById('extra-container');
        if (extraContainer) {
            extraContainer.style.display = 'block';
        }
    }

    function toggleChart() {
        processStoragePie(function(domainTimeMap) {
            if (showingCategoryChart) {
                generatePieChart(domainTimeMap, 'Time Spent on Domains', 'Switch To Categories');
            } else {
                const categoryTimeMap = convertToCategories(domainTimeMap);
                generatePieChart(categoryTimeMap, 'Time Spent on Categories', 'Switch To Domains');
            }
            showingCategoryChart = !showingCategoryChart;
        });
    }

    // One distinct color per slice. The old six-color list repeated once
    // the chart had more than six categories, so different categories
    // shared a color.
    const PALETTE = [
        '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40',
        '#2ECC71', '#E74C3C', '#8E44AD', '#1ABC9C', '#F39C12', '#3498DB',
        '#E67E22', '#16A085', '#C0392B',
    ];

    function generatePieChart(dataMap, label, buttonLabel) {
        var ctx = document.getElementById('pieChart').getContext('2d');
        const labels = Object.keys(dataMap);
        const data = Object.values(dataMap);
        const colors = labels.map((_, i) => PALETTE[i % PALETTE.length]);

        if (pieChart instanceof Chart) {
            pieChart.destroy();
        }

        pieChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    label: label,
                    data: data,
                    backgroundColor: colors,
                    borderColor: colors,
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

        // Update the button label
        const switchButton = document.getElementById('switchChartButton');
        if (switchButton) {
            switchButton.textContent = buttonLabel;
        }

        // The dashboard's heading names the current view; the popup has no
        // such heading. It used to say "Domains" while the chart showed
        // categories.
        const chartTitle = document.getElementById('chart-title');
        if (chartTitle) {
            chartTitle.textContent = label;
        }
    }

    // Read the same `dictionary` background.js writes. The old version read
    // a `tabFocusEvents` key nothing ever wrote, so this chart could only
    // ever render empty.
    function processStoragePie(callback) {
        chrome.storage.local.get("dictionary", function (result) {
            const now = Date.now();
            const sessions = Screentime.sessionsFromDictionary(
                result.dictionary || {}, Screentime.todayStartMs(now), now);
            callback(Screentime.totalsByDomain(sessions, now));
        });
    }

    // Categories come from categories.js, which is generated from
    // categorized_websites.csv. The old version carried a second, hardcoded
    // copy of that list inline here; it had drifted from the CSV on 110 rows.
    function convertToCategories(domainTimeMap) {
        return Screentime.totalsByCategory(domainTimeMap, CATEGORY_BY_DOMAIN);
    }
})();
