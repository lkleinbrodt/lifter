// expo-notifications always adds the push (aps-environment) entitlement, which the personal
// Apple team's provisioning profile doesn't allow. Lifter only schedules local notifications
// (rest timer), which need no entitlement, so strip it.
// Must be listed BEFORE "expo-notifications" in app.json: mods run in reverse order.
const { withEntitlementsPlist } = require('expo/config-plugins');

module.exports = function withoutPushEntitlement(config) {
  return withEntitlementsPlist(config, (mod) => {
    delete mod.modResults['aps-environment'];
    return mod;
  });
};
