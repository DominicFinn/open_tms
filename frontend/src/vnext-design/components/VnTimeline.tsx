import React from 'react';

interface TimelineEvent {
  time: string;
  title: string;
  desc?: string;
  location?: string;
  dot?: 'success' | 'warning' | 'error' | 'info' | 'primary';
}

interface VnTimelineProps {
  events: TimelineEvent[];
}

export function VnTimeline({ events }: VnTimelineProps) {
  return (
    <div className="vn-timeline">
      {events.map((event, i) => (
        <div className="vn-timeline-item" key={i}>
          <div className={`vn-timeline-dot ${event.dot || 'primary'}`} />
          <div className="vn-timeline-time">{event.time}</div>
          <div className="vn-timeline-title">{event.title}</div>
          {event.desc && <div className="vn-timeline-desc">{event.desc}</div>}
          {event.location && (
            <div className="vn-timeline-location">
              <span className="material-icons">place</span>
              {event.location}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
