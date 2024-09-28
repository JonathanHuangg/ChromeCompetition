document.addEventListener('DOMContentLoaded', function() {
    var calendarEl = document.getElementById('calendar');

    processStorage(function(timeBlocks) {
        console.log('Time Blocks:', timeBlocks);

        generateDayCalendar(calendarEl, timeBlocks);
    });
});  

function generateDayCalendar(calendarEl, calendarEvents) {
    // Check if calendarEvents is an array and log if not.
    if (!Array.isArray(calendarEvents)) {
        console.error("calendarEvents is not an array", calendarEvents);
        return;
    }

    // Ensure all events have start and end times in correct format.
    for (let i = 0; i < calendarEvents.length; i++) {
        const event = calendarEvents[i];
        if (!event.start || !event.end) {
            console.error("Event missing start or end time", event);
            return; // Do not proceed with invalid data.
        }
    }

    // Initialize the calendar
    var calendar = new FullCalendar.Calendar(calendarEl, {
        themeSystem: 'bootstrap5',
        initialView: 'timeGridDay',
        initialDate: new Date(),
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay'
        },
        minTime: '00:00:00',
        maxTime: '24:00:00',
        slotDuration: '00:30:00',
        slotLabelFormat: {
            hour: '2-digit',
            minute: '2-digit',
            omitZeroMinute: false,
            hour12: false
        },
        events: calendarEvents,
        height: 'auto',
        nowIndicator: true,
        navLinks: true,
        weekends: true,
        editable: false,
        droppable: false,
        eventClick: function(info) {
            showDetails(info.event);
        },
        dayMaxEvents: true,
        views: {
            timeGridDay: {
                nowIndicator: true
            }
        }
    });

    calendar.render();
}


function showDetails(event) {
    var extraContainer = document.getElementById('extra-container');

    document.getElementById('event-title').textContent = "Title: " + event.title;
    document.getElementById('event-start').textContent = "Start: " + event.start.toLocaleString();
    document.getElementById('event-end').textContent = "End: " + (event.end ? event.end.toLocaleString() : 'N/A');

    extraContainer.style.display = 'block';
}

function processStorage(callback) {
    chrome.storage.local.get("tabFocusEvents", function(result) {
        const tabFocusEvents = result.tabFocusEvents || {};
        const events = [];
        const todaysDate = new Date();
        const today = todaysDate.toISOString().split('T')[0];

        console.log('tabFocusEvents:', tabFocusEvents);

        for (const domain in tabFocusEvents) {
            // Check if the domain has events and the events array is defined
            if (tabFocusEvents.hasOwnProperty(domain) && Array.isArray(tabFocusEvents[domain].events)) {
                tabFocusEvents[domain].events.forEach(event => {
                    console.log('Event focusStart:', event.focusStart);
                    if (event.focusStart && event.focusEnd) {
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
            } else {
                console.warn(`No events found or not an array for domain: ${domain}`);
            }
        }

        console.log('Raw events:', events);

        // Check if events is actually an array and not empty before passing to callback
        if (Array.isArray(events) && events.length > 0) {
            const timeBlocks = generateTimeBlocks(events, todaysDate);
            callback(timeBlocks);
        } else {
            console.warn("No valid events found for today.");
            callback([]); // Pass an empty array to callback if no events are found
        }
    });
}

function generateTimeBlocks(events, date) {
    const timeBlocks = [];
    const startOfDay = new Date(date);  
    startOfDay.setHours(0, 0, 0, 0);

    for (let i = 0; i < 48; i++) {
        const blockStart = new Date(startOfDay.getTime() + i * 30 * 60 * 1000);
        const blockEnd = new Date(blockStart.getTime() + 30 * 60 * 1000);

        let overlappingEvents = events.filter(event => {
            const eventStart = new Date(event.start);
            const eventEnd = new Date(event.end);
            return eventEnd > blockStart && eventStart < blockEnd;
        });

        let blockTitle = '';

        if (overlappingEvents.length === 1) {
            blockTitle = overlappingEvents[0].title;
        } else if (overlappingEvents.length > 1) {
            const titleCounts = {};

            overlappingEvents.forEach(event => {
                titleCounts[event.title] = (titleCounts[event.title] || 0) + 1;
            });

            const mostCommonTitle = Object.keys(titleCounts).reduce((a, b) => {
                return titleCounts[a] > titleCounts[b] ? a : b;
            });

            blockTitle = mostCommonTitle;
        }

        timeBlocks.push({
            title: blockTitle, 
            start: blockStart.toISOString(),
            end: blockEnd.toISOString(),
            allDay: false
        });
    }

    return timeBlocks;
}
