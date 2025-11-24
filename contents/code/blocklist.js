export function useBlocklist(appsBlocklist, modalsIgnore) {
  // Check if the app is in the blocklist
  function checkBlocklist(windowItem) {
    return (
      windowItem.normalWindow === false ||
      windowItem.resizeable === false ||
      windowItem.maximizable === false ||
      (modalsIgnore === true ? windowItem.transient === true : false) ||
      appsBlocklist
        .toLowerCase()
        .includes(windowItem.resourceClass.toLowerCase()) === true
    );
  }

  return { checkBlocklist };
}
