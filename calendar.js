(function() {
    document.addEventListener('DOMContentLoaded', function() {
        var calendarEl = document.getElementById('calendar');
        processStorage(function(timeBlocks) {
            console.log('Time Blocks:', timeBlocks);
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
                showDetails(info.event);
                var allEvents = document.querySelectorAll('.fc-event');
                allEvents.forEach(function(eventEl) {
                    eventEl.classList.remove('highlighted-event');
                });
                if (document.getElementById('event-details').dataset.eventId === info.event.id) {
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

        calendar.render();
    }

    function showDetails(event) {
        var eventDetailsContainer = document.getElementById('event-details');
        var pieChartCanvas = document.getElementById('pieChart');

        if (eventDetailsContainer.dataset.eventId === event.id && eventDetailsContainer.classList.contains('visible')) {
            eventDetailsContainer.classList.remove('visible');
            pieChartCanvas.classList.remove('shifted');
            eventDetailsContainer.dataset.eventId = '';
        } else {
            // Show or update the event details
            eventDetailsContainer.classList.add('visible');
            pieChartCanvas.classList.add('shifted');
            
            eventDetailsContainer.innerHTML = '';


            var detailCalendarEl = document.createElement('div');
            detailCalendarEl.id = 'event-detail-calendar';
            eventDetailsContainer.appendChild(detailCalendarEl);
            
            var detailedEvents = getDetailedEventsForTimeBlock(event.start, event.end);

            var detailCalendar = new FullCalendar.Calendar(detailCalendarEl, {
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
                allDaySlot: false
            });

            detailCalendar.render();
            eventDetailsContainer.dataset.eventId = event.id;
        }
    }
    function getDetailedEventsForTimeBlock(startTime, endTime) {
        const detailedEvents = window.rawEvents || [];

        const filteredEvents = detailedEvents.filter(event => {
            const eventStart = new Date(event.start);
            const eventEnd = new Date(event.end);
            return eventEnd > startTime && eventStart < endTime;
        });

        return filteredEvents.map(event => ({
            title: event.url || event.title,
            start: event.start,
            end: event.end,
            allDay: false
        }));
    }
    function processStorage(callback) {
        chrome.storage.local.get("tabFocusEvents", function(result) {
            const tabFocusEvents = result.tabFocusEvents || {};
            const events = [];
            const todaysDate = new Date();
            todaysDate.setHours(0, 0, 0, 0); // Normalize today's date

            console.log('tabFocusEvents:', tabFocusEvents);

            for (const domain in tabFocusEvents) {
                if (tabFocusEvents.hasOwnProperty(domain) && Array.isArray(tabFocusEvents[domain].events)) {
                    tabFocusEvents[domain].events.forEach(event => {
                        if (event.focusStart && event.focusEnd) {
                            const eventStartDate = new Date(event.focusStart);
                            const eventEndDate = new Date(event.focusEnd);

                            const eventDate = new Date(eventStartDate);
                            eventDate.setHours(0, 0, 0, 0);

                            if (eventDate.getTime() === todaysDate.getTime()) {
                                events.push({
                                    title: domain,
                                    start: event.focusStart, 
                                    end: event.focusEnd, 
                                    allDay: false,
                                    url: event.url // Include URL
                                });
                            }
                        }
                    });
                } else {
                    console.warn(`No events found or not an array for domain: ${domain}`);
                }
            }
            
            window.rawEvents = events;
            console.log('Raw events:', events);

            if (Array.isArray(events) && events.length > 0) {
                const timeBlocks = generateTimeBlocks(events, todaysDate);
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

            timeBlocks.push({
                title: blockTitle, 
                start: blockStart.toISOString(),
                end: blockEnd.toISOString(),
                allDay: false,
                url: blockUrl
            });
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

