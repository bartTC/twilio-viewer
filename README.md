# Twilio SMS Log Viewer

This little JS app shows you the latest "inbound" SMS of all your [Twilio](https://www.twilio.com/) accounts. I needed it for debugging a project. Twilio itself provides an interface for it too (Phone > Message Log > Incoming), but its a bit clunky.

Originally this was my test project to learn [Vue.js](https://vuejs.org/), [Webpack](https://webpack.js.org/) and get familiar with the [`fetch()`](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API) API of ES6. Total work time was less than a day, Vue.js turned out to be much easier than expected. Webpack is still a black box but I somewhat got it running.

## Installation and Usage

1) Register "API Credentials" in your [Twilio Settings](https://www.twilio.com/console/project/settings). Remember the "Account SID" and "Account Token".

2) Clone or download this project and run:

   ```
   $ cd twilio-viewer/
   $ npm install
   $ npm run server
   ```

3) Open http://127.0.0.1:8080/

Put your Twilio API credentials in the settings panel. Those are optionally
stored in the browsers local storage — *unencrypted* — so take care.

## Screenshot

![](https://d.pr/i/itgC2M.png)
