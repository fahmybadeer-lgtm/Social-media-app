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

function toDateAndTime(isoString: string | null): { date: string; time: string } {
  if (!isoString) {
    const now = new Date()
    // Default to 1 hour from now
    now.setHours(now.getHours() + 1, 0, 0, 0)
    return {
      date: format(now, 'yyyy-MM-dd'),
      time: format(now, 'HH:mm'),
    }
  }
  const d = parseISO(isoString)
  return {
    date: format(d, 'yyyy-MM-dd'),
    time: format(d, 'HH:mm'),
  }
}

function toISO(date: string, time: string): string {
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

export default function ScheduleSelector({
  status,
  scheduledAt,
  onChange,
}: ScheduleSelectorProps) {
  const { date: initDate, time: initTime } = toDateAndTime(scheduledAt)
  const [dateValue, setDateValue] = useState(initDate)
  const [timeValue, setTimeValue] = useState(initTime)

  // Minimum date for the date input (today)
  const todayStr = format(new Date(), 'yyyy-MM-dd')

  // Sync internal state when scheduledAt changes from parent
  useEffect(() => {
    if (scheduledAt) {
      const { date, time } = toDateAndTime(scheduledAt)
      setDateValue(date)
      setTimeValue(time)
    }
  }, [scheduledAt])

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

  const scheduledISO = status === 'scheduled' ? toISO(dateValue, timeValue) : null
  const isValid = scheduledISO ? isFuture(scheduledISO) : true

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-[#E5E5E5]">
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
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A84C] focus-visible:ring-offset-2 focus-visible:ring-offset-black',
            status === 'draft'
              ? 'border-[#C9A84C] bg-[rgba(201,168,76,0.1)]'
              : 'border-[#1A1A1A] bg-[#0D0D0D] hover:border-[#C9A84C]/40 hover:bg-[#111111]',
          ].join(' ')}
        >
          <div
            className={[
              'flex h-8 w-8 items-center justify-center rounded-lg',
              status === 'draft' ? 'bg-[#C9A84C]' : 'bg-[#1A1A1A]',
            ].join(' ')}
          >
            <FileText className="w-4 h-4 text-white" />
          </div>
          <div>
            <p
              className={[
                'text-sm font-semibold',
                status === 'draft' ? 'text-[#C9A84C]' : 'text-[#E5E5E5]',
              ].join(' ')}
            >
              Save as Draft
            </p>
            <p className="mt-0.5 text-xs text-[#A0A0A0]">
              Save and publish later
            </p>
          </div>
          <div
            className={[
              'ml-auto mt-auto w-4 h-4 rounded-full border-2 flex items-center justify-center',
              status === 'draft'
                ? 'border-[#C9A84C] bg-[#C9A84C]'
                : 'border-[#1A1A1A]',
            ].join(' ')}
          >
            {status === 'draft' && (
              <div className="w-2 h-2 rounded-full bg-white" />
            )}
          </div>
        </button>

        {/* Schedule option */}
        <button
          type="button"
          onClick={() => handleStatusChange('scheduled')}
          className={[
            'flex flex-col items-start gap-2 rounded-xl border-2 p-4 text-left transition-all duration-150 cursor-pointer',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A84C] focus-visible:ring-offset-2 focus-visible:ring-offset-black',
            status === 'scheduled'
              ? 'border-[#C9A84C] bg-[rgba(201,168,76,0.1)]'
              : 'border-[#1A1A1A] bg-[#0D0D0D] hover:border-[#C9A84C]/40 hover:bg-[#111111]',
          ].join(' ')}
        >
          <div
            className={[
              'flex h-8 w-8 items-center justify-center rounded-lg',
              status === 'scheduled' ? 'bg-[#C9A84C]' : 'bg-[#1A1A1A]',
            ].join(' ')}
          >
            <Send className="w-4 h-4 text-white" />
          </div>
          <div>
            <p
              className={[
                'text-sm font-semibold',
                status === 'scheduled' ? 'text-[#C9A84C]' : 'text-[#E5E5E5]',
              ].join(' ')}
            >
              Schedule Post
            </p>
            <p className="mt-0.5 text-xs text-[#A0A0A0]">
              Publish at a specific time
            </p>
          </div>
          <div
            className={[
              'ml-auto mt-auto w-4 h-4 rounded-full border-2 flex items-center justify-center',
              status === 'scheduled'
                ? 'border-[#C9A84C] bg-[#C9A84C]'
                : 'border-[#1A1A1A]',
            ].join(' ')}
          >
            {status === 'scheduled' && (
              <div className="w-2 h-2 rounded-full bg-white" />
            )}
          </div>
        </button>
      </div>

      {/* Date + time inputs (shown only when "scheduled") */}
      {status === 'scheduled' && (
        <div className="rounded-xl border border-[#1A1A1A] bg-[#0D0D0D] p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {/* Date */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-medium text-[#A0A0A0]">
                <Calendar className="w-3.5 h-3.5" />
                Date
              </label>
              <input
                type="date"
                value={dateValue}
                min={todayStr}
                onChange={(e) => handleDateChange(e.target.value)}
                className="w-full rounded-lg border border-[#1A1A1A] bg-[#0A0A0A] px-3 py-2 text-sm text-white focus:border-[#C9A84C] focus:outline-none transition-colors [color-scheme:dark]"
              />
            </div>

            {/* Time */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-medium text-[#A0A0A0]">
                <Clock className="w-3.5 h-3.5" />
                Time
              </label>
              <input
                type="time"
                value={timeValue}
                onChange={(e) => handleTimeChange(e.target.value)}
                className="w-full rounded-lg border border-[#1A1A1A] bg-[#0A0A0A] px-3 py-2 text-sm text-white focus:border-[#C9A84C] focus:outline-none transition-colors [color-scheme:dark]"
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
            <div className="flex items-center gap-2 rounded-lg bg-[rgba(201,168,76,0.1)] border border-[#C9A84C]/30 px-3 py-2">
              <Clock className="w-3.5 h-3.5 text-[#C9A84C] flex-shrink-0" />
              <p className="text-xs text-[#C9A84C] font-medium">
                Scheduled for {humanReadable(scheduledISO)}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
