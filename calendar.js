document.addEventListener('DOMContentLoaded', function () {
    var calendarEl = document.getElementById('calendar');
    generateDayCalendar(calendarEl)
});

function generateDayCalendar() {
    var calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'timeGridDay',
        headerToolbar: {
            left: 'prev, next today',
            center: 'title',
            right: ''
        }, 
        events: []
    });

    calendar.render();

    processStorage(function(events) {
        calendar.addEventSource(events);
    });
}

function processStorage(callback) {
    chrome.storage.local.get("tabFocusEvents", function(result) {
        const tabFocusEvents = result.tabFocusEvents || {};
        const events = [];
        const today = new Date().toISOString().split('T')[0];

        for (const domain in tabFocusEvents) {
            if (tabFocusEvents.hasOwnProperty(domain)) {
                tabFocusEvents[domain].events.forEach(event => {
                    if (event.focusStart && event.focusEnd) {
                        const focusStart = new Date(event.focusStart);
                        const focusEnd = new Date(event.focusEnd);

                        if (event.focusStart.startsWith(today)) {
                            events.push({
                                title: domain,
                                start: event.focusStart, 
                                end: event.focusEnd, 
                                allDay: false
                            });
                        }
                    }
                });
            }
        }
        callback(events);
    });
}