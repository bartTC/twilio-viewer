/* globals Headers */

import UIkit from 'uikit';
import Icons from 'uikit/dist/js/uikit-icons';
import Vue from 'vue';
import base64 from 'base-64';

// Static fies
UIkit.use(Icons);

import IncomingMessageSoundFile from './incoming.m4r';
import css from 'uikit/dist/css/uikit.min.css';
import html from './index.html';

// Create a `Audio` object with low volume for the incoming
// message sound..
const IncomingMessageAudio = new Audio(IncomingMessageSoundFile);
IncomingMessageAudio.volume = 0.05;

// Poll every 15 seconds
let pollingTimeout = 15 * 1000;


/**
 * Prepares the full API url and Authorization headers for the given API call
 * which can be used in a `fetch()` call. Example:
 *
 *   // Calling the /Accounts.json API view:
 *   const [url, headers] = twilioApi('Accounts', 'abc', 'def');
 *   fetch(url, {headers}).then(response => response.json());
 *
 * @param {string} apiMethod API method to call, e.g. 'Accounts'
 * @param {string} sid Twilio  SID
 * @param {string} token Twilio Secret Token
 * @param {string} format Format to return, e.g. `xml`, `json`. Default: `json`
 */
const twilioBase = 'https://api.twilio.com';

function twilioApi(apiMethod, sid, token, format = 'json') {
  const url = `${twilioBase}/2010-04-01/${apiMethod}.${format}`;
  const headers = new Headers();
  headers.append('Authorization', `Basic ${base64.encode(`${sid}:${token}`)}`);
  return [url, headers];
}


/**
 * Generic function to trigger a UIKit notification message.
 *
 * @param {string} status Status class, e.g. `success`, `error`, `warning` ...
 * @param {string} message Message to show
 * @param {string} icon Icon to show before the message, e.g. `check` or `ban`
 * @param {int} timeout Timeout in milliseconds
 */
function notify(status, message, icon, timeout = 5000) {
  UIkit.notification({
    message: `<span uk-icon="icon: ${icon}"></span> ${message}`,
    status: status,
    pos: 'top-center',
    timeout: timeout
  });
}


/**
 * Initial validation that makes sure all api keys are set
 * otherwise we show a warning.
 */
const vmSettingsWarning = new Vue({
  el: '#settings-warning',
  data: {
    message: `
      Twilio Credentials are not set yet or invalid.
      Please see the settings`,
    show: true
  }
});


/**
 * The Settings Panel Tab that handles all the credentials saving,
 * credentials check and ultimately dictates by `.twilioCredentialsValid`
 * if the messageTable can poll for new SMS objects.
 */
const vmSettingsForm = new Vue({
  el: '#settings-form',
  data: {
    twilioCredentialsValid: false,
    twilioSid: '',
    twilioToken: '',
    saveCredentials: true,
    playSound: false,
    audioVolume: IncomingMessageAudio.volume
  },

  created() {
    // Load twilio credentials from local storage.
    this.twilioSid = localStorage.getItem('twilioSid') || '';
    this.twilioToken = localStorage.getItem('twilioToken') || '';

    // If both sid and token were already set, assume they are
    // correct, since we validate them prior saving in storage.
    this.twilioCredentialsValid = true;
  },

  watch: {
    /**
     * Whenever the global property to indicat valid credentials fails,
     * show or hide the big warning box `vmSettingsWarning`.
     */
    twilioCredentialsValid() {
      vmSettingsWarning.show = !this.twilioCredentialsValid;
    },

    /**
     * Play sound isn't actively handled by this component but play
     * an example sound if turned on again.
     */
    playSound() {
      if (this.playSound) {
        IncomingMessageAudio.play();
      }
    },

    /**
     * Saving credentials simply validates them again. The Validation
     * method makes also sure these values are saved or wiped from the
     * local storage according to this state.
     */
    saveCredentials() {
      this.validateCredentials();
    }
  },

  methods: {
    /**
     * Make sure supplied Twilio API keys are valid and the API returns
     * (useful) data. We do that by calling the generic `/Accounts` API.
     *
     * If `saveCredentials` is active, also save the credentials in the
     * local storage.
     */
    validateCredentials() {
      // Call the basic /Accounts API to check if credentials are valid.
      const [url, headers] = twilioApi('Accounts', this.twilioSid, this.twilioToken);
      fetch(url, {
          headers
        })
        .then(response => response.json())
        .then(data => {
          // Data resonse could be valid JSON but thats also the case
          // in any error. Check if it contains an error.
          if (data.status && data.status !== 200 && data.detail) {
            throw new Error(`${data.status} ${data.detail}`);
          }

          // Store or wipe credentials in local storage.
          if (this.saveCredentials) {
            localStorage.setItem('twilioSid', this.twilioSid);
            localStorage.setItem('twilioToken', this.twilioToken);
          } else {
            localStorage.removeItem('twilioSid');
            localStorage.removeItem('twilioToken');
          }

          // No error means the credentials were OK. Show notification
          // message and hide the global credentials warning box.
          const message =
            this.saveCredentials ? 'Credentials OK and saved in local storage!' :
            'Credentials OK!';
          notify('success', message, 'check');
          this.twilioCredentialsValid = true;

        })
        .catch(error => {
          notify('error', `Credentials invalid! Reason was ${error}`, 'ban', 10000);
          this.twilioCredentialsValid = false;
        });
    }
  }
});

/**
 * The SMS table which loads data from Twilio.
 */
const vmMessageTable = new Vue({
  el: '#message-table',
  data: {
    showSpinner: false,
    messageList: [] // sid	date_created	date_updated	date_sent
    // account_sid	to	from	messaging_service_sid	body
  },

  /**
   * If the settings were OK, fetch right away.
   */
  created() {
    if (vmSettingsForm.twilioCredentialsValid) {
      this.fetchMessages();
    }
  },

  methods: {

    /**
     * Reformat US Phone number. `+12304427501` becomes `+1 (230) 442-7501`
     *
     * @param {string} num
     */
    formatNum(num) {
      // US Phone number formatting
      if (num.length === 12 && num.startsWith('+1')) {
        return `+1 (${num.slice(2,5)}) ${num.slice(5,8)}-${num.slice(8,12)}`;
      }
      return num;
    },

    fetchMessagesError() {
      vmSettingsWarning.show = true;
      vmSettingsWarning.message = `Unable to fetch the messages API.
        Check credentials.`;
      this.showSpinner = false;
    },

    /**
     * Fetch latest SMS list from all accounts from Twilio.
     * We have to do two+ calls here, first the /Accounts API which gives us a
     * list of all active accounts, and each account has a 'messages' API
     * URL we call to retrieve the messages of each individual account.
     */
    fetchMessages() {
      this.showSpinner = true;

      // New message list to retrieve and filter from the API
      const [url, headers] = twilioApi(
        'Accounts', vmSettingsForm.twilioSid, vmSettingsForm.twilioToken);

      // Fetch the /Accounts API which returns a list of all accounts.
      fetch(url, {
          headers
        })
        .then(accountResponse => accountResponse.json())
        .then(accountData => {

          // Then, for each account in the account list, fetch the `messages`
          // API call to retrieve a list of message objects.

          const messagePromises = accountData.accounts.map(acc =>
            fetch(`${twilioBase}${acc.subresource_uris.messages}`, {
              headers
            })
            .then(messageResponse => messageResponse.json()));

          // Wait until all messages are retrieved, then filter only those
          // SMS which are 'inbound' and flatten them all into one list.
          Promise
            .all(messagePromises)
            .then(messagesObjects => {
              // We have an array with arrays of messages. Filter those
              // out which are inboud.
              this.messageList = [];
              messagesObjects.map(messageData =>
                messageData.messages.filter(m => {
                  if (m.direction === 'inbound') {
                    this.messageList.push(m);
                  }
                })
              );
              this.showSpinner = false;

              // Play success sound
              if (vmSettingsForm.playSound) {
                IncomingMessageAudio.play();
              }
            })
            .catch(error => {
              this.fetchMessagesError('Unable to fetch "Messages" API!');
              console.log('messagrs error', error);
            });

        })
        .catch(error => {
          this.fetchMessagesError('Unable to fetch "Accounts" API!');
          console.log('accounts error', error);
        });
    }
  }
});
