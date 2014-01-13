/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
  * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
const {Request} = require("sdk/request");

const {Cu} = require("chrome");
Cu.import("resource://gre/modules/Task.jsm");
Cu.import("resource://gre/modules/commonjs/sdk/core/promise.js");

function HeadlinerPersonalizationAPI(personalizationUrl) {
  this._personalizationUrl = personalizationUrl;
  this._contentCache = [];
  this._lastConsume = null;
  this._lastConsumeSuccess = null;
  this._nextConsume = null;
  this._consumePromise = null;
}

HeadlinerPersonalizationAPI.prototype = {
  /**
   * Returns article data
   * @param interests Interest object
   * @returns articles returned from API
   */
  getContent: function HPAPI_getContent(interests) {
    return Task.spawn(function HP_getContent_task() {
      if (this._contentCache.length == 0) {
        this._contentCache = yield this.consume(interests);
      }
      throw new Task.Result(this._contentCache);
    });
  },

  /**
   * Calls API endpoint with a given interest object. Makes sure there is only one request going at the same time.
   * @param interests Interest object
   * @returns articles returned from API
   */
  consume: function HPAPI_consume(interests) {
    if (!this._consumePromise) {
      // makes sure there's only one consume task going on at the same time
      this._consumePromise = Task.spawn(function HPAPI_consume_task() {
        let data = null;
        try {
          data = yield this._makeRequest(this._personalizationUrl, interests);
          let now = new Date();
          this._lastConsume = now;
          this._lastConsumeSuccess = now;
          this._consumePromise = null;
        }
        catch (ex) {
          console.error(ex);
          this._lastConsume = new Date();
        }
        throw new Task.Result(data);
      }.bind(this));
    }
    return this._consumePromise;
  },

  /**
   * Make HTTP request to a given url
   *
   * @param serverUrl the API endpoint to call
   * @param interests interest object
   * @returns response body in json format
   */
  _makeRequest: function HPAPI__makeRequest(serverUrl, interests) {
    let deferred = Promise.defer();
    if (Object.keys(interests).length == 0) {
      deferred.reject("won't send, interests empty");
    }
    else {
      let serverRequest = Request({
        url: serverUrl,
        contentType: "application/json; charset=utf8",
        content: JSON.stringify(interests),
        onComplete: function serverRequest_onComplete(response) {
          if (response.status >= 200 && response.status < 300) {
            deferred.resolve(response.json);
          }
          else {
            deferred.reject("HTTP Error " + response.status + " " + response.statusText)
          }
        },
      });
      serverRequest.post();
    }
    return deferred.promise;
  },
}

exports.HeadlinerPersonalizationAPI = HeadlinerPersonalizationAPI;