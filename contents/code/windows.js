// Get all windows from the virtual desktop except the given window
function getWindows(windowMain, desktop, screen, appsBlocklist, modalsIgnore) {
  const windows = [];

  for (const windowItem of workspace.windowList().reverse()) {
    if (
      windowItem !== windowMain &&
      windowItem.output === screen &&
      windowItem.desktops.includes(desktop) === true &&
      checkBlocklist(windowMain, appsBlocklist, modalsIgnore) === false
    ) {
      windows.push(windowItem);
    }
  }

  return windows;
}

// Set window tiles
// mode: 0 => addWindow
// mode: 1 => removeWindow
function setWindowsTiles(
  windowMain,
  desktops,
  screens,
  appsBlocklist,
  modalsIgnore,
  maximize,
  mode,
  windowsOrderClose,
) {
  for (const itemDesktop of desktops) {
    for (const itemScreen of screens) {
      const windowsOther = getWindows(
        windowMain,
        itemDesktop,
        itemScreen,
        appsBlocklist,
        modalsIgnore,
      );

      if (mode === 0) {
        if (windowsOther.length === 0) {
          workspace.currentDesktop = itemDesktop;
          windowMain.desktops = [itemDesktop];

          if (maximize === true) windowNew.setMaximize(true, true);
          return false;
        }
      } else if (mode === 1) {
        if (windowsOther.length === 1 && maximize === true) {
          windowsOther[0].setMaximize(true, true);
          return false;
        }
      }

      if (mode === 1 && windowsOrderClose === false) {
        return false;
      }

      const tilesOrdered = getOrderedTiles(itemDesktop, itemScreen);

      //Set tile if the custom mosaic has space
      if (windowsOther.length + 1 <= tilesOrdered.length) {
        if (mode === 0) {
          workspace.currentDesktop = itemDesktop;
          windowMain.desktops = [itemDesktop];
          windowMain.tile = tilesOrdered[0];
          windowMain.setMaximize(false, false);
        }

        for (let x = 0; x < windowsOther.length; x++) {
          if (mode === 0) {
            windowsOther[x].desktops = [itemDesktop];
            windowsOther[x].tile = tilesOrdered[x + 1];
          } else if (mode === 1) {
            windowsOther[x].tile = tilesOrdered[x];
          }
          windowsOther[x].setMaximize(false, false);
        }
        return false;
      }

      return true;
    }
  }
}
