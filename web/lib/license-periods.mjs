export const cairoDay = () => new Intl.DateTimeFormat('en-CA', {timeZone:'Africa/Cairo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const day = value => Date.parse(value + 'T00:00:00Z') / 86400000;
// Match inclusive PostgreSQL dateranges, including adjacent renewals and legacy unknown starts.
export function licenseCovers(licenses, assetId, start, end) {
  if (!start || !end || end < start || !Number.isFinite(day(start)) || !Number.isFinite(day(end))) return false;
  let cursor=day(start);
  const ranges=licenses.filter(l=>l.asset_id===assetId && l.status!=='revoked').map(l=>({start:l.valid_from?day(l.valid_from):-Infinity,end:day(l.expires_on)})).sort((a,b)=>a.start-b.start);
  for(const range of ranges) { if(range.end<cursor)continue; if(range.start>cursor)return false; cursor=Math.max(cursor,range.end+1);if(cursor>day(end))return true; }
  return false;
}
