// Everything about the party lives here. Edit this file, commit, push: the page updates.
window.FG = {
  // Paste the Apps Script web app URL here (backend/SETUP.md). Empty = preview mode, saved only in your browser.
  apiUrl: '',

  title: 'Friendsgiving',
  year: 2026,
  hosts: 'Austin & [wife]',                       // PLACEHOLDER
  dateLabel: 'Saturday, November 21',             // PLACEHOLDER
  timeLabel: '4 pm until the pie runs out',       // PLACEHOLDER
  start: '2026-11-21T16:00:00',                   // local time, used for "Add to calendar"
  end: '2026-11-21T21:00:00',
  // The site is public, so the address is optional. Leave it '' to show "the address is on your invite".
  address: '',
  mapUrl: '',
  blurb: 'Bring a dish, a friend, or just yourself. We’ll have the turkey, the gravy and too many chairs.',

  // What the hosts are already making. Shows on the table like everyone else's dishes.
  hostDishes: [
    { dish: 'The turkey', course: 'main' },
    { dish: 'Gravy (a lot of it)', course: 'side' },
    { dish: 'Stuffing', course: 'side' }
  ],

  // How many of each we'd love. Empty spots show as open plates.
  wants: { appetizer: 2, main: 1, side: 4, dessert: 3, drinks: 2 },

  showGuestNames: true
};
