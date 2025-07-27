// Basic state handler for the setup wizard and scoreboard UI
export const StateHandler = (function () {
  let state = {};

  return {
    printState: function () {
      console.log("Current state:", state);
    },
    // Get the current state
    getState: function (key) {
      return key ? state[key] : state;
    },

    // Set a value in the state
    setState: function (key, value) {
      state[key] = value;
      $(document).trigger("stateChange", { key, value });
    },

    // Reset the entire state
    resetState: function () {
      state = {};
      $(document).trigger("stateReset");
    },

    // Subscribe to state changes
    onStateChange: function (callback) {
      $(document).on("stateChange", function (event, data) {
        callback(data.key, data.value);
      });
    },

    // Subscribe to state reset
    onStateReset: function (callback) {
      $(document).on("stateReset", function () {
        callback();
      });
    },
  };
})();

// Example usage:
// StateHandler.setState('wizardStep', 1);
// StateHandler.onStateChange((key, value) => console.log(`State changed: ${key} = ${value}`));
// StateHandler.resetState();
