// Check if the window is present in the blacklist
function checkBlocklist(windowItem, appsBlacklist, ignoreModals) {
  return (
    windowItem.normalWindow === false ||
    windowItem.resizeable === false ||
    windowItem.maximizable === false ||
    (ignoreModals === true ? windowItem.transient === true : false) ||
    appsBlacklist.includes(windowItem.resourceClass.toLowerCase()) === true
  );
}
