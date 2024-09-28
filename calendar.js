document.addEventListener('DOMContentLoaded', function () {
    var calendarEl = document.getElementById('calendar');
    generateDayCalendar(calendarEl);
});

function generateDayCalendar(calendarEl) {
    processStorage(function(events) {
        console.log('Events to add to calendar:', events);

        var calendar = new FullCalendar.Calendar(calendarEl, {
            plugins: [ 'bootstrap5' ],
            themeSystem: 'bootstrap5',
            initialView: 'timeGridDay',
            initialDate: new Date(),
            headerToolbar: {
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth,timeGridWeek,timeGridDay'
            },
            slotDuration: '01:00:00',
            slotLabelFormat: {
                hour: '2-digit',
                minute: '2-digit',
                omitZeroMinute: false,
                hour12: false
            },
            events: events,
            height: 'auto',
            nowIndicator: true,
            navLinks: true,
            weekends: true,
            editable: false,
            droppable: false,
            eventClick: function(info) {
                // Use Bootstrap Modal for event details
                showModal(info.event);
            },
            dayMaxEvents: true,
            progressiveEventRendering: true,
            views: {
                timeGridDay: {
                    nowIndicator: true
                }
            }
        });

        calendar.render();
    });
}

function showModal(event) {
    // Create a Bootstrap Modal dynamically
    var modalHtml = `
        <div class="modal fade" id="eventModal" tabindex="-1" aria-labelledby="eventModalLabel" aria-hidden="true">
          <div class="modal-dialog">
            <div class="modal-content">
              <div class="modal-header">
                <h5 class="modal-title" id="eventModalLabel">${event.title}</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
              </div>
              <div class="modal-body">
                <p><strong>Start:</strong> ${event.start.toLocaleString()}</p>
                <p><strong>End:</strong> ${event.end ? event.end.toLocaleString() : 'N/A'}</p>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
              </div>
            </div>
          </div>
        </div>
    `;
    // Append modal to body
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    // Show the modal
    var eventModal = new bootstrap.Modal(document.getElementById('eventModal'));
    eventModal.show();
    // Remove modal from DOM after it's closed
    document.getElementById('eventModal').addEventListener('hidden.bs.modal', function () {
        document.getElementById('eventModal').remove();
    });
}

function processStorage(callback) {
    chrome.storage.local.get("tabFocusEvents", function(result) {
        const tabFocusEvents = result.tabFocusEvents || {};
        const events = [];
        const today = new Date().toISOString().split('T')[0];

        console.log('tabFocusEvents:', tabFocusEvents);

        for (const domain in tabFocusEvents) {
            if (tabFocusEvents.hasOwnProperty(domain)) {
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
            }
        }
        console.log('Raw events:', events);
        cleanProcessedStorage(callback, events);
    });
}

function cleanProcessedStorage(callback, events) {
    // Sort events by start time
    events.sort((a, b) => new Date(a.start) - new Date(b.start));

    const cleanedEvents = [];
    let currentEvent = null;

    const TEN_MINUTE = 10 * 60 * 1000; 

    for (const event of events) {
        const startTime = new Date(event.start);
        const endTime = new Date(event.end);
        
        // check if first event
        if (!currentEvent) {
            currentEvent = { ...event };
        } else {
            const currentEnd = new Date(currentEvent.end);
            const timeDifference = startTime - currentEnd; 
            
            // they
            if (timeDifference <= TEN_MINUTE && timeDifference >= 0) {
                if (currentEvent.title === event.title) {
                    currentEvent.end = new Date(Math.max(currentEnd, endTime)).toISOString();                
                } else {
                    cleanedEvents.push({ ...currentEvent });
                    currentEvent = { ...event };
                }
            } else if (startTime > currentEnd) {
                // just push the event and move on
                cleanedEvents.push({ ...currentEvent });
                currentEvent = { ...event };
            }
        }
    }

    if (currentEvent) {
        cleanedEvents.push(currentEvent);
    }

    console.log('Cleaned events:', cleanedEvents);
    callback(cleanedEvents);
}

