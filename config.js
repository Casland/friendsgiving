// Everything about the party lives here. Edit this file, commit, push: the page updates.
window.FG = {
  // Paste the Apps Script web app URL here (backend/SETUP.md). Empty = preview mode, saved only in your browser.
  // Add ?preview to the page URL to force preview mode for testing (nothing reaches the sheet).
  apiUrl: 'https://script.google.com/macros/s/AKfycbxOuWVNBZzBIZnPdDKSOZSV7ivDeCqxLs6d62gkNl2RgOZc-epQ1-9frZ3-tUaDko1a/exec',

  title: 'Friendsgiving',
  hosts: 'Austin & Lauren McCasland',
  place: 'the McCaslands’',                       // shows as "At the McCaslands’". The site is public: no street address.
  dateLabel: 'Saturday, November 21',
  timeLabel: 'From 3:30 till the pie runs out',
  start: '2026-11-21T15:30:00',                   // local time, used for "Add to calendar"
  end: '2026-11-21T21:00:00',
  blurb: 'Bring a dish and your appetite. We’ll have the turkey, the gravy and drinks.',

  // What the hosts are already making. Shows on the table like everyone else's dishes.
  // Courses: appetizer, main, side, dessert, drinks, other. Pictures come from assets/dishes/map.json.
  hostDishes: [
    { dish: 'The turkey', course: 'main' },
    { dish: 'Gravy (a lot of it)', course: 'side' }
  ],

  showGuestNames: true
};
