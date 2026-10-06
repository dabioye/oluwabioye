// Lagos dates for messages and calendar files. Noon avoids timezone edges flipping the day.
const cfg = require('./config');

const at = (iso) => new Date(iso + 'T12:00:00+01:00');
const weekday = () => at(cfg.date).toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'Africa/Lagos' });
const longDate = (iso) => at(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Lagos' });

module.exports = { weekday, longDate };
