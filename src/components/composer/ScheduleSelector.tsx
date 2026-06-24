'use client'

import { useState, useEffect } from 'react'
import { Calendar, Clock, FileText, Send } from 'lucide-react'
import { format, parseISO, isAfter } from 'date-fns'
import type { PostStatus } from '@/types'

interface ScheduleSelectorProps {
  status: PostStatus
  scheduledAt: string | null
  onChange: (status: PostStatus, scheduledAt: string | null) => void
}

// Convert local date + time strings to UTC ISO string
function toISO(date: string, time: string): string {
  // new Date('YYYY-MM-DDTHH:mm:00') is treated as LOCAL time by browsers
  return new Date(`${date}T${time}:00`).toISOString()
}

function humanReadable(isoString: string): string {
  try {
    return format(parseISO(isoString), "EEEE, MMMM d 'at' h:mm a")
  } catch {
    return ''
  }
}

function isFuture(isoString: string): boolean {
  try {
    return isAfter(parseISO(isoString), new Date())
  } catch {
    return false
  }
}

// Get local date/time strings, always runs in the browser
function getDefaultDateTime(): { date: string; time: string } {
  const now = new Date()
  now.setHours(now.getHours() + 1, 0, 0, 0)
  return {
    date: format(now, 'yyyy-MM-dd'),
    time: format(now, 'HH:mm'),
  }
}

export default function ScheduleSelector({
  status,
  scheduledAt,
  onChange,
}: ScheduleSelectorProps) {
  // Initialize empty — will be set client-side in useEffect to avoid timezone mismatch
  const [dateValue, setDateValue] = useState('')
  const [timeValue, setTimeValue] = useState('')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    if (scheduledAt) {
      // Parse the stored UTC ISO and display in local time
      const d = new Date(scheduledAt)
      setDateValue(format(d, 'yyyy-MM-dd'))
      setTimeValue(format(d, 'HH:mm'))
    } else {
      const { date, time } = getDefaultDateTime()
      setDateValue(date)
      setTimeValue(time)
      // Inform parent of the default scheduled time
      if (status === 'scheduled') {
        onChange('scheduled', toISO(date, time))
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Minimum date for the date input (today in local time)
  const todayStr = mounted ? format(new Date(), 'yyyy-MM-dd') : ''

  function handleStatusChange(newStatus: PostStatus) {
    if (newStatus === 'draft') {
      onChange('draft', null)
    } else {
      const iso = toISO(dateValue, timeValue)
      onChange('scheduled', iso)
    }
  }

  function handleDateChange(newDate: string) {
    setDateValue(newDate)
    if (status === 'scheduled') {
      onChange('scheduled', toISO(newDate, timeValue))
    }
  }

  function handleTimeChange(newTime: string) {
    setTimeValue(newTime)
    if (status === 'scheduled') {
      onChange('scheduled', toISO(dateValue, newTime))
    }
  }

  const scheduledISO = status === 'scheduled' && dateValue && timeValue
    ? toISO(dateValue, timeValue)
    : null
  const isValid = scheduledISO ? isFuture(scheduledISO) : true

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-300">
        Publish Schedule
      </label>

      {/* Option cards */}
      <div className="grid grid-cols-2 gap-3">
        {/* Draft option */}
        <button
          type="button"
          onClick={() => handleStatusChange('draft')}
          className={[
            'flex flex-col items-start gap-2 rounded-xl border-2 p-4 text-left transition-all duration-150 cursor-pointer',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-950',
            status === 'draft'
              ? 'border-indigo-500 bg-indigo-600/10'
              : 'border-gray-700 bg-gray-800/40 hover:border-gray-600 hover:bg-gray-800/70',
          ].join(' ')}
        >
          <div className={['flex h-8 w-8 items-center justify-center rounded-lg', status === 'draft' ? 'bg-indigo-600' : 'bg-gray-700'].join(' ')}>
            <FileText className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className={['text-sm font-semibold', status === 'draft' ? 'text-indigo-300' : 'text-gray-200'].join(' ')}>Save as Draft</p>
            <p className="mt-0.5 text-xs text-gray-500">Save and publish later</p>
          </div>
          <div className={['ml-auto mt-auto w-4 h-4 rounded-full border-2 flex items-center justify-center', status === 'draft' ? 'border-indigo-500 bg-indigo-500' : 'border-gray-600'].join(' ')}>
            {status === 'draft' && <div className="w-2 h-2 rounded-full bg-white" />}
          </div>
        </button>

        {/* Schedule option */}
        <button
          type="button"
          onClick={() => handleStatusChange('scheduled')}
          className={[
            'flex flex-col items-start gap-2 rounded-xl border-2 p-4 text-left transition-all duration-150 cursor-pointer',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-950',
            status === 'scheduled'
              ? 'border-indigo-500 bg-indigo-600/10'
              : 'border-gray-700 bg-gray-800/40 hover:border-gray-600 hover:bg-gray-800/70',
          ].join(' ')}
        >
          <div className={['flex h-8 w-8 items-center justify-center rounded-lg', status === 'scheduled' ? 'bg-indigo-600' : 'bg-gray-700'].join(' ')}>
            <Send className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className={['text-sm font-semibold', status === 'scheduled' ? 'text-indigo-300' : 'text-gray-200'].join(' ')}>Schedule Post</p>
            <p className="mt-0.5 text-xs text-gray-500">Publish at a specific time</p>
          </div>
          <div className={['ml-auto mt-auto w-4 h-4 rounded-full border-2 flex items-center justify-center', status === 'scheduled' ? 'border-indigo-500 bg-indigo-500' : 'border-gray-600'].join(' ')}>
            {status === 'scheduled' && <div className="w-2 h-2 rounded-full bg-white" />}
          </div>
        </button>
      </div>

      {/* Date + time inputs (shown only when "scheduled") */}
      {status === 'scheduled' && mounted && (
        <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {/* Date */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-medium text-gray-400">
                <Calendar className="w-3.5 h-3.5" />
                Date
              </label>
              <input
                type="date"
                value={dateValue}
                min={todayStr}
                onChange={(e) => handleDateChange(e.target.value)}
                className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none transition-colors [color-scheme:dark]"
              />
            </div>

            {/* Time */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-medium text-gray-400">
                <Clock className="w-3.5 h-3.5" />
                Time
              </label>
              <input
                type="time"
                value={timeValue}
                onChange={(e) => handleTimeChange(e.target.value)}
                className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none transition-colors [color-scheme:dark]"
              />
            </div>
          </div>

          {/* Validation error */}
          {!isValid && (
            <p className="flex items-center gap-1.5 text-xs text-red-400">
              <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm-.75 3.75a.75.75 0 011.5 0v3.5a.75.75 0 01-1.5 0v-3.5zm.75 7a1 1 0 110-2 1 1 0 010 2z" />
              </svg>
              Scheduled time must be in the future
            </p>
          )}

          {/* Human-readable summary */}
          {isValid && scheduledISO && (
            <div className="flex items-center gap-2 rounded-lg bg-indigo-600/10 border border-indigo-500/30 px-3 py-2">
              <Clock className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
              <p className="text-xs text-indigo-300 font-medium">
                Scheduled for {humanReadable(scheduledISO)}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
