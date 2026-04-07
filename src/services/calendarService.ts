/**
 * Adds an event to the user's Google Calendar using the Google Calendar REST API.
 */
export async function addCalendarEvent(
  accessToken: string,
  eventDetails: {
    summary: string;
    description: string;
    startTime: string; // ISO string
    endTime: string; // ISO string
    timeZone?: string;
    attendees?: { email: string }[];
  }
) {
  const timeZone = eventDetails.timeZone || 'Asia/Bangkok';

  const event = {
    summary: eventDetails.summary,
    description: eventDetails.description,
    start: {
      dateTime: eventDetails.startTime,
      timeZone: timeZone,
    },
    end: {
      dateTime: eventDetails.endTime,
      timeZone: timeZone,
    },
    attendees: eventDetails.attendees,
  };

  const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(event),
  });

  if (!response.ok) {
    let errorMessage = 'Unknown error';
    try {
      const errorData = await response.json();
      errorMessage = errorData.error?.message || JSON.stringify(errorData);
    } catch (e) {
      errorMessage = `HTTP Error ${response.status}: ${response.statusText}`;
    }
    throw new Error(`Google Calendar API Error: ${errorMessage}`);
  }

  return response.json();
}
