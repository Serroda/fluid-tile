// Filter windows
function checkIfNormalWindow(windowItem) {
  return (
    windowItem.normalWindow === true &&
    windowItem.popupWindow === false &&
    windowItem.resourceClass.toLowerCase() !== "plasmashell" &&
    windowItem.resourceClass.toLowerCase() !== "org.kde.plasmashell" &&
    windowItem.resourceClass.toLowerCase() !== "kwin_wayland" &&
    windowItem.resourceClass.toLowerCase() !== "ksmserver-logout-greeter"
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

  if (windowsOther.length === 1) {
    windowsOther[0].setMaximize(true, true);
    return;
  }

  if (windowsOther.length === 0) {
    workspace.removeDesktop(workspace.currentDesktop);
  }
}

//Set tile to the new Window
function setTile(windowNew) {
  if (!checkIfNormalWindow(windowNew)) {
    return;
  }

  const startPositionDesktop = workspace.desktops.indexOf(
    workspace.currentDesktop,
  );
  const startPositionScreen = workspace.screens.indexOf(workspace.activeScreen);
  let loopFlapDesktop = true;
  let loopFlapScreen = true;

  for (
    let d = startPositionDesktop;
    d !== startPositionDesktop || loopFlapDesktop;
    d++
  ) {
    loopFlapDesktop = false;

    for (
      let s = startPositionScreen;
      s !== startPositionScreen || loopFlapScreen;
      s++
    ) {
      loopFlapScreen = false;
      const windowsOther = getWindows(
        windowNew,
        workspace.desktops[d],
        workspace.screens[s],
      );

      if (windowsOther.length === 0) {
        windowNew.setMaximize(true, true);
        return;
      }

      const tilesOrdered = getTilesOrdered(
        workspace.desktops[d],
        workspace.screens[s],
      );

      //Set tile if the custom mosaic has space
      if (windowsOther.length + 1 <= tilesOrdered.length) {
        windowNew.tile = tilesOrdered[0];

        for (let x = 0; x < windowsOther.length; x++) {
          windowsOther[x].tile = tilesOrdered[x + 1];
        }
        return;
      }

      if (s === workspace.screens.length) s = 0;
    }
    workspace.currentDesktop = workspace.desktops[d];
    windowNew.desktops = [workspace.currentDesktop];
    if (d === workspace.desktops.length) d = 0;
  }

  workspace.createDesktop(workspace.desktops.length, "");
  windowNew.setMaximize(true, true);
}

workspace.windowAdded.connect(setTile);
workspace.windowRemoved.connect(onCloseWindow);
