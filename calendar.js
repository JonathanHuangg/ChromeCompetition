var detailCalendarInstance = null;
(function() {
    document.addEventListener('DOMContentLoaded', function() {
        var calendarEl = document.getElementById('calendar');
        processStorage(function(timeBlocks) {
            generateDayCalendar(calendarEl, timeBlocks);
        });
    });  

    function generateDayCalendar(calendarEl, calendarEvents) {
        if (!Array.isArray(calendarEvents)) {
            console.error("calendarEvents is not an array", calendarEvents);
            return;
        }
        var calendar = new FullCalendar.Calendar(calendarEl, {
            themeSystem: 'bootstrap5',
            initialView: 'timeGridDay',
            initialDate: new Date(),
            headerToolbar: {
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth,timeGridWeek,timeGridDay'
            },
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
                info.jsEvent.preventDefault();
                var eventDetailsContainer = document.getElementById('event-details');
                var wasVisible = eventDetailsContainer.classList.contains('visible');
                var currentEventId = eventDetailsContainer.dataset.eventId;

                showDetails(info.event);
                var isVisible = eventDetailsContainer.classList.contains('visible');
                var allEvents = document.querySelectorAll('.fc-event');
                allEvents.forEach(function(eventEl) {
                    eventEl.classList.remove('highlighted-event');
                });
                if (isVisible && eventDetailsContainer.dataset.eventId === info.event.id) {
                    info.el.classList.add('highlighted-event');
                }
            },
            dayMaxEvents: true,
            views: {
                timeGridDay: {
                    nowIndicator: true
                }
            }
        });
        const hourBlocks = calendarEl.querySelectorAll('.hour-block');
        hourBlocks.forEach(block => {
            block.addEventListener('click', function() {
                // Logic to handle the click event
                const secondTable = document.getElementById('second-table');
                if (secondTable) {
                    secondTable.classList.add('scrollable');
                }
            });
        });

        calendar.render();
    }

    function showDetails(event) {
        var eventDetailsContainer = document.getElementById('event-details');
        var pieChartCanvas = document.getElementById('pieChart');
    
        if (eventDetailsContainer.dataset.eventId === event.id && eventDetailsContainer.classList.contains('visible')) {
            // Hide the event details
            eventDetailsContainer.classList.remove('visible');
            pieChartCanvas.classList.remove('shifted');
            eventDetailsContainer.dataset.eventId = '';
            
            // Destroy the existing detail calendar
            if (detailCalendarInstance) {
                detailCalendarInstance.destroy();
                detailCalendarInstance = null;
            }
        } else {
            // Show or update the event details
            eventDetailsContainer.classList.add('visible');
            pieChartCanvas.classList.add('shifted');
    
            // Clear previous content
            eventDetailsContainer.innerHTML = '';
    
            // Destroy the existing detail calendar if any
            if (detailCalendarInstance) {
                detailCalendarInstance.destroy();
                detailCalendarInstance = null;
            }
    
            // Create a div for the detailed calendar
            var detailCalendarEl = document.createElement('div');
            detailCalendarEl.id = 'event-detail-calendar';
            eventDetailsContainer.appendChild(detailCalendarEl);
    
            // Create events for the detailed calendar
            var detailedEvents = getDetailedEventsForTimeBlock(event.start, event.end);
    
            // Initialize a new calendar for the detailed view
            detailCalendarInstance = new FullCalendar.Calendar(detailCalendarEl, {
                initialView: 'timeGrid',
                initialDate: event.start,
                headerToolbar: false,
                events: detailedEvents,
                height: 'auto',
                contentHeight: 'auto',
                slotDuration: '00:05:00',
                slotLabelInterval: '00:05:00',
                slotLabelFormat: {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false
                },
                editable: false,
                allDaySlot: false,
                eventOverlap: false,
                slotEventOverlap: false
            });
            detailCalendarInstance.render();
    
            eventDetailsContainer.dataset.eventId = event.id;
        }
    }    
    function getDetailedEventsForTimeBlock(startTime, endTime) {
        const detailedEvents = window.rawEvents || [];

        const overlappingEvents = detailedEvents.filter(event => {
            const eventStart = event.start; // Already a Date object
            const eventEnd = event.end;     // Already a Date object
            return eventEnd > startTime && eventStart < endTime;
        });


        // Calculate new durations to prevent overlap
        const numberOfEvents = overlappingEvents.length;
        const blockDuration = (endTime - startTime) / numberOfEvents;
        

        return overlappingEvents.map((event, index) => ({
            title: event.url || event.title,
            start: new Date(startTime.getTime() + index * blockDuration),
            end: new Date(startTime.getTime() + (index + 1) * blockDuration),
            allDay: false
        }));
    }
    
    // Read the same `dictionary` background.js writes. The old version read
    // a `tabFocusEvents` key nothing ever wrote, so the calendar could only
    // ever render empty. A session still open ends at now, so a tab left
    // open renders up to the current time instead of vanishing.
    function processStorage(callback) {
        chrome.storage.local.get("dictionary", function (result) {
            const now = Date.now();
            const sessions = Screentime.sessionsFromDictionary(
                result.dictionary || {}, Screentime.todayStartMs(now), now);
            const events = sessions.map((session) => ({
                title: session.domain,
                start: new Date(session.start),
                end: new Date(session.end === null ? now : session.end),
                allDay: false,
                url: session.url,
            }));

            window.rawEvents = events;

            if (events.length > 0) {
                const timeBlocks = generateTimeBlocks(events, new Date(Screentime.todayStartMs(now)));
                callback(timeBlocks);
            } else {
                console.warn("No valid events found for today.");
                callback([]);
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
            let blockUrl = '';
    
            if (overlappingEvents.length === 1) {
                blockTitle = overlappingEvents[0].title;
                blockUrl = overlappingEvents[0].url;
            } else if (overlappingEvents.length > 1) {
                const titleCounts = {};
                const urlCounts = {};
    
                overlappingEvents.forEach(event => {
                    titleCounts[event.title] = (titleCounts[event.title] || 0) + 1;
                    if (event.url) {
                        urlCounts[event.url] = (urlCounts[event.url] || 0) + 1;
                    }
                });
    
                const mostCommonTitle = Object.keys(titleCounts).reduce((a, b) => {
                    return titleCounts[a] > titleCounts[b] ? a : b;
                });
    
                const mostCommonUrl = Object.keys(urlCounts).reduce((a, b) => {
                    return urlCounts[a] > urlCounts[b] ? a : b;
                }, '');
    
                blockTitle = mostCommonTitle;
                blockUrl = mostCommonUrl;
            }
    
            // Only add the time block if it contains a URL
            if (blockUrl) {
                timeBlocks.push({
                    title: blockTitle, 
                    start: blockStart, 
                    end: blockEnd,
                    allDay: false,
                    url: blockUrl
                });
            }
        }
    
        return timeBlocks;
    }

    function getMostCommonUrl(events) {
        const urlCounts = {};

        events.forEach(event => {
            if (event.url) {
                urlCounts[event.url] = (urlCounts[event.url] || 0) + 1;
            }
        });

        if (Object.keys(urlCounts).length > 0) {
            return Object.keys(urlCounts).reduce((a, b) => {
                return urlCounts[a] > urlCounts[b] ? a : b;
            });
        } else {
            return '';
        }
    }
})();

