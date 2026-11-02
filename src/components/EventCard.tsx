
import React from 'react';
import { MapPin, Clock, Plus, ArrowRight } from 'lucide-react';
import { Event } from '../../types';
import { calendarFileName, calendarFileUrl } from '../utils/calendar';
import { Link } from 'react-router-dom';

interface EventCardProps {
  event: Event;
}

const EventCard: React.FC<EventCardProps> = ({ event }) => {
  const calendarUrl = calendarFileUrl(event);

  return (
    <div className="group relative flex h-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md hover:border-slate-300">
      {/* Image Header */}
      <div className="relative aspect-[16/10] shrink-0 overflow-hidden bg-slate-100">
        <div className="absolute top-3 left-3 z-10 rounded-full bg-white px-2.5 py-0.5 text-xs font-medium text-slate-700 shadow-sm">
          {event.category}
        </div>
        <img
          src={event.imageUrl}
          alt={event.title}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
        />
      </div>

      {/* Date Badge */}
      <div className="absolute top-3 right-3 z-10 min-w-[56px] rounded-lg bg-white px-2 py-1.5 text-center shadow-sm">
        <span className="block text-xs font-medium uppercase text-slate-500">{event.date.toLocaleString('default', { month: 'short' })}</span>
        <span className="block font-display text-xl font-bold leading-none text-brand-600">{event.date.getDate()}</span>
      </div>

      {/* Content */}
      <div className="flex flex-grow flex-col p-5">
        <Link to={`/events/${event.id}`}>
            <h3 className="mb-2 line-clamp-1 font-display text-lg font-semibold text-slate-900 transition-colors group-hover:text-brand-600">
            {event.title}
            </h3>
        </Link>

        <div className="mb-4 flex flex-col space-y-2">
          <div className="flex items-center text-sm text-slate-500">
            <Clock className="mr-2 h-4 w-4 shrink-0 text-brand-500" aria-hidden="true" />
            {event.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
          <div className="flex items-center text-sm text-slate-500">
            <MapPin className="mr-2 h-4 w-4 shrink-0 text-brand-500" aria-hidden="true" />
            <span className="truncate">{event.location}</span>
          </div>
        </div>

        <p className="mb-6 line-clamp-3 flex-grow text-sm leading-relaxed text-slate-600">
          {event.description}
        </p>

        <div className="mt-auto flex gap-2">
             <a
            href={calendarUrl}
            download={calendarFileName(event)}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-900"
            >
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span className="hidden md:inline">Add to Cal</span><span className="md:hidden">Cal</span>
            </a>
            <Link
            to={`/events/${event.id}`}
            className="group/btn inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-brand-600 px-3 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700"
            >
            Details <ArrowRight className="h-4 w-4 transition-transform group-hover/btn:translate-x-0.5" aria-hidden="true" />
            </Link>
        </div>
      </div>
    </div>
  );
};

export default EventCard;
