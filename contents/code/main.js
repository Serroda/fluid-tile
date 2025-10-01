// DEFAULTS
const APPS_BLACKLIST =
  "org.kde.polkit-kde-authentication-agent-1,org.kde.spectacle,kcm_kwinrules,org.freedesktop.impl.portal.desktop.kde,krunner,plasmashell,org.kde.plasmashell,kwin_wayland,ksmserver-logout-greeter";
const CLOSE_MAXIMIZE = true;
const OPEN_MAXIMIZE = true;
const ADD_DESKTOP = true;
const REMOVE_DESKTOP = true;
const IGNORE_MODALS = true;

// Check if the window is present in the blacklist
function checkBlacklist(windowItem) {
  const appsBlacklist = readConfig(
    "AppsBlacklist",
    APPS_BLACKLIST,
  ).toLowerCase();
  const ignoreModals = readConfig("IgnoreModals", IGNORE_MODALS);

  return (
    windowItem.normalWindow === false ||
    windowItem.resizeable === false ||
    windowItem.maximizable === false ||
    (ignoreModals === true ? windowItem.transient === true : false) ||
    appsBlacklist.includes(windowItem.resourceClass.toLowerCase()) === true
  );
}

// Get all windows from the virtual desktop except the given window
function getWindows(windowInteraction, desktop, screen) {
  let windows = [];

  for (const windowItem of workspace.windowList().reverse()) {
    if (
      windowItem.desktops.includes(desktop) &&
      screen === workspace.screenAt({ x: windowItem.x, y: windowItem.y }) &&
      checkBlacklist(windowItem) === false &&
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
    } else if (b.absoluteGeometry.height !== a.absoluteGeometry.height) {
      return b.absoluteGeometry.height - a.absoluteGeometry.height;
    } else {
      return (
        b.absoluteGeometry.x - a.absoluteGeometry.x &&
        b.absoluteGeometry.y - a.absoluteGeometry.y
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
  if (checkBlacklist(windowClosed) === true) {
    return;
  }

  const windowsOther = getWindows(
    windowClosed,
    workspace.currentDesktop,
    workspace.activeScreen,
  );

  const closeMaximize = readConfig("CloseMaximize", CLOSE_MAXIMIZE);

  if (windowsOther.length === 1 && closeMaximize === true) {
    if (checkBlacklist(windowsOther[0]) === false) {
      windowsOther[0].setMaximize(true, true);
    }
    return;
  }

  const removeDesktop = readConfig("RemoveDesktop", REMOVE_DESKTOP);

  if (windowsOther.length === 0 && removeDesktop === true) {
    workspace.removeDesktop(workspace.currentDesktop);
  }
}

//Set tile to the new Window
function setTile(windowNew) {
  if (checkBlacklist(windowNew) === true) {
    return;
  }

  const openMaximize = readConfig("OpenMaximize", OPEN_MAXIMIZE);
  const addDesktop = readConfig("AddDesktop", ADD_DESKTOP);

  for (const itemDesktop of workspace.desktops) {
    for (const itemScreen of workspace.screens) {
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
          if (checkBlacklist(windowsOther[x]) === true) {
            continue;
          }
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
