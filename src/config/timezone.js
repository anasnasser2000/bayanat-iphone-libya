function getLibyaDateString(dateObj = new Date()) {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Africa/Tripoli',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(dateObj);
  } catch (err) {
    const d = new Date(dateObj.getTime() + 2 * 60 * 60 * 1000);
    return d.toISOString().split('T')[0];
  }
}

module.exports = {
  getLibyaDateString
};
