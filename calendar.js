var detailCalendarInstance = null;
(function() {
    document.addEventListener('DOMContentLoaded', function() {
        const calendarEl = document.getElementById('calendar');
        const startTime = 8; // Start time in hours (8 AM)
        const endTime = 18; // End time in hours (6 PM)
        const interval = 1; // Interval duration in hours

        // Function to generate time blocks
        function generateTimeBlocks() {
            const timeBlocksContainer = document.createElement('div');
            timeBlocksContainer.classList.add('time-blocks-container');

            for (let hour = startTime; hour < endTime; hour += interval) {
                const timeBlock = document.createElement('div');
                timeBlock.classList.add('hour-block');
                timeBlock.textContent = `${hour}:00 - ${hour + interval}:00`;
                timeBlocksContainer.appendChild(timeBlock);
            }

            calendarEl.appendChild(timeBlocksContainer);
        }

        // Generate and append time blocks
        generateTimeBlocks();

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


            // get the correct time for the calendar
            function getTimeSinceMidnight(date) {
                function pad(num) {
                    return num.toString().padStart(2, '0');
                }
                return pad(date.getHours()) + ':' + pad(date.getMinutes()) + ':' + pad(date.getSeconds());            
            }

            var slotMinTime = getTimeSinceMidnight(event.start);
            var slotMaxTime = getTimeSinceMidnight(event.end);

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
                slotEventOverlap: false,
                slotMinTime: slotMinTime,
                slotMaxTime: slotMaxTime,
                scrollTime: slotMinTime
            });
            detailCalendarInstance.render();

            eventDetailsContainer.dataset.eventId = event.id;
        }
    }

    function getDetailedEventsForTimeBlock(startTime, endTime) {
        const detailedEvents = window.rawEvents || [];
        console.log('startTime:', startTime, 'endTime:', endTime);

        const overlappingEvents = detailedEvents.filter(event => {
            const eventStart = event.start; // Already a Date object
            const eventEnd = event.end;     // Already a Date object
            console.log('eventStart:', eventStart, 'eventEnd:', eventEnd);
            return eventEnd > startTime && eventStart < endTime;
        });

        console.log('overlappingEvents:', overlappingEvents);

        // Calculate new durations to prevent overlap
        const numberOfEvents = overlappingEvents.length;
        const blockDuration = (endTime - startTime) / numberOfEvents;

        console.log('startTime:', startTime.toISOString(), 'endTime:', endTime.toISOString());
        detailedEvents.forEach(event => {
            console.log('Event:', event.title, 'Start:', event.start.toISOString(), 'End:', event.end.toISOString());
        });

        return overlappingEvents.map((event, index) => ({
            title: event.url || event.title,
            start: new Date(startTime.getTime() + index * blockDuration),
            end: new Date(startTime.getTime() + (index + 1) * blockDuration),
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

                            // Only add events with a title or URL
                            if ((event.title || event.url) && eventDate.getTime() === todaysDate.getTime()) {
                                events.push({
                                    title: event.title || domain,  // Use domain if no title is present
                                    start: eventStartDate,         // Store as Date object
                                    end: eventEndDate,             // Store as Date object
                                    allDay: false,
                                    url: event.url || ''           // Include URL if present
                                });
                            }
                        }
                    });
                } else {
                    console.warn(`No events found or not an array for domain: ${domain}`);
                }
            }

            window.rawEvents = events;
            console.log('Filtered events:', events);

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
