import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";

import API from "../../api/axios";
import { all_routes } from "../router/all_routes";
import { eventCountdown, eventUrgency, normalizeListResponse, formatDateTimeLabel } from "./productivityShared";

const UpcomingReminderBanner = ({ compact = false }) => {
  const [events, setEvents] = useState([]);
  const [dismissedIds, setDismissedIds] = useState([]);

  const load = useCallback(async () => {
    try {
      const response = await API.get("/productivity/events/upcoming/");
      setEvents(normalizeListResponse(response.data));
    } catch (error) {
      console.error("Failed to load upcoming reminders", error);
      setEvents([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const visibleEvents = events.filter((event) => !dismissedIds.includes(event.id));
  const nextEvent = visibleEvents[0];

  if (!nextEvent) return null;

  const tone = eventUrgency(nextEvent);
  const target = nextEvent.target_url || all_routes.calendar;

  return (
    <div className={`premium-reminder-banner ${compact ? "compact" : ""} ${tone}`}>
      <div>
        <div className="premium-reminder-kicker">Upcoming reminder</div>
        <h5>{nextEvent.title}</h5>
        <p className="mb-0">
          {eventCountdown(nextEvent.starts_at)} · {formatDateTimeLabel(nextEvent.starts_at)}
          {nextEvent.location ? ` · ${nextEvent.location}` : ""}
        </p>
      </div>
      <div className="premium-reminder-actions">
        <Link to={target} className="btn btn-primary btn-sm">
          Open event
        </Link>
        <button
          type="button"
          className="btn btn-light btn-sm"
          onClick={async () => {
            setDismissedIds((current) => [...current, nextEvent.id]);
            try {
              await API.post(`/productivity/events/${nextEvent.id}/dismiss_banner/`);
            } catch (error) {
              console.error("Failed to dismiss reminder banner", error);
            }
          }}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
};

export default UpcomingReminderBanner;
