// Filter windows
function checkIfNormalWindow(windowItem) {
  const appsBlacklist = readConfig(
    "AppsBlacklist",
    "kcm_kwinrules,org.freedesktop.impl.portal.desktop.kde,krunner,plasmashell,org.kde.plasmashell,kwin_wayland,ksmserver-logout-greeter",
  );
  const resourceClass = windowItem.resourceClass.toLowerCase();

  return (
    windowItem.normalWindow === true &&
    windowItem.popupWindow === false &&
    appsBlacklist.split(",").includes(resourceClass) === false
  );
}

// Get all windows from the virtual desktop except the given window
function getWindows(windowInteraction, desktop, screen) {
  let windows = [];

  for (const windowItem of workspace.stackingOrder) {
    if (
      windowItem.desktops.includes(desktop) &&
      screen === workspace.screenAt({ x: windowItem.x, y: windowItem.y }) &&
      windowItem !== windowInteraction
    ) {
      windows.push(windowItem);
    }
  }

  return windows;
}

//Get tiles, ordered by size (width) and from left to right
function orderTiles(tiles) {
  let tilesOrdered = [];

  for (let tile of tiles) {
    if (tile.tiles.length !== 0) {
      tilesOrdered = tilesOrdered.concat(orderTiles(tile.tiles));
    } else {
      tilesOrdered.push(tile);
    }
  }

  return tilesOrdered.sort((a, b) => {
    if (b.absoluteGeometry.width !== a.absoluteGeometry.width) {
      return b.absoluteGeometry.width - a.absoluteGeometry.width;
    } else {
      return (
        a.absoluteGeometry.x - b.absoluteGeometry.x ||
        a.absoluteGeometry.y - b.absoluteGeometry.y
      );
    }
  });
}

//Get tiles from the screen and virtual desktop
function getTilesOrdered(desktop, screen) {
  const rootTile = workspace.rootTile(screen, desktop);
  return orderTiles(rootTile.tiles);
}

//Delete Virtual Desktop if is empty or maximize the last window
function onCloseWindow(windowClosed) {
  if (!checkIfNormalWindow(windowClosed)) {
    return;
  }

  const windowsOther = getWindows(
    windowClosed,
    workspace.currentDesktop,
    workspace.activeScreen,
  );

  const closeMaximize = readConfig("CloseMaximize", true);

  if (windowsOther.length === 1 && closeMaximize === true) {
    windowsOther[0].setMaximize(true, true);
    return;
  }

  const removeDesktop = readConfig("RemoveDesktop", true);

  if (windowsOther.length === 0 && removeDesktop === true) {
    workspace.removeDesktop(workspace.currentDesktop);
  }
}

//Set tile to the new Window
function setTile(windowNew) {
  if (!checkIfNormalWindow(windowNew)) {
    return;
  }

  const openMaximize = readConfig("OpenMaximize", true);
  const addDesktop = readConfig("AddDesktop", true);

  for (let itemDesktop of workspace.desktops) {
    for (let itemScreen of workspace.screens) {
      const windowsOther = getWindows(windowNew, itemDesktop, itemScreen);

      if (windowsOther.length === 0) {
        workspace.currentDesktop = itemDesktop;
        windowNew.desktops = [itemDesktop];
        if (openMaximize === true) windowNew.setMaximize(true, true);
        return;
      }

      const tilesOrdered = getTilesOrdered(itemDesktop, itemScreen);

      //Set tile if the custom mosaic has space
      if (windowsOther.length + 1 <= tilesOrdered.length) {
        workspace.currentDesktop = itemDesktop;
        windowNew.desktops = [itemDesktop];
        windowNew.tile = tilesOrdered[0];
        windowNew.setMaximize(false, false);

        for (let x = 0; x < windowsOther.length; x++) {
          windowsOther[x].desktops = [itemDesktop];
          windowsOther[x].tile = tilesOrdered[x + 1];
          windowsOther[x].setMaximize(false, false);
        }
        return;
      }
    }
  }

  if (addDesktop === true) {
    workspace.createDesktop(workspace.desktops.length, "");
    workspace.currentDesktop =
      workspace.desktops[workspace.desktops.length - 1];
    windowNew.desktops = [workspace.currentDesktop];
    if (openMaximize === true) windowNew.setMaximize(true, true);
  }
}

workspace.windowAdded.connect(setTile);
workspace.windowRemoved.connect(onCloseWindow);
