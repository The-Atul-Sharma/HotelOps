import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

export const APP_TIMEZONE = 'Asia/Kolkata';

dayjs.tz.setDefault(APP_TIMEZONE);

export function appNow() {
  return dayjs().tz(APP_TIMEZONE);
}

export function appDay(date?: string | Date | null) {
  if (date == null || date === '') return appNow();
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return dayjs.tz(date, APP_TIMEZONE);
  }
  return dayjs(date).tz(APP_TIMEZONE);
}

export function appToday(): string {
  return appNow().format('YYYY-MM-DD');
}

export default dayjs;
