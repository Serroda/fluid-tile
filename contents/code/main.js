// Filter windows
function checkIfNormalWindow(windowItem) {
  return (
    windowItem.normalWindow === true &&
    windowItem.popupWindow === false &&
    windowItem.resourceClass.toLowerCase() !== "plasmashell" &&
    windowItem.resourceClass.toLowerCase() !== "org.kde.plasmashell" &&
    windowItem.resourceClass.toLowerCase() !== "ksmserver-logout-greeter"
  );
}

// Get all windows from the current virtual desktop except the given window
function getWindowsFromActualDesktop(windowNew) {
  let windows = [];

  for (const windowItem of workspace.stackingOrder) {
    if (
      windowItem.desktops.includes(workspace.currentDesktop) &&
      windowItem !== windowNew
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
function getTilesOrdered(screen, desktop) {
  const rootTile = workspace.rootTile(screen, desktop);
  return orderTiles(rootTile.tiles);
}

//Delete Virtual Desktop if is empty or maximize the last window
function onCloseWindow(windowClosed) {
  if (!checkIfNormalWindow(windowClosed)) {
    return;
  }

  const windowsOther = getWindowsFromActualDesktop(windowClosed);

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

  const windowsOther = getWindowsFromActualDesktop(windowNew);

  if (windowsOther.length === 0) {
    windowNew.setMaximize(true, true);
    return;
  }

  const tilesOrdered = getTilesOrdered(
    workspace.activeScreen,
    workspace.currentDesktop,
  );

  //Set tile if the custom mosaic has space
  if (windowsOther.length + 1 <= tilesOrdered.length) {
    windowNew.tile = tilesOrdered[0];

    for (let x = 0; x < windowsOther.length; x++) {
      windowsOther[x].tile = tilesOrdered[x + 1];
    }
    return;
  }

  //Move to the next desktop for check the free space else create a new virtual desktop
  if (
    workspace.currentDesktop ===
    workspace.desktops[workspace.desktops.length - 1]
  ) {
    workspace.createDesktop(workspace.desktops.length, "");
    windowNew.desktops = [workspace.desktops[workspace.desktops.length - 1]];
  } else {
    windowNew.desktops = [
      workspace.desktops[
        workspace.desktops.indexOf(workspace.currentDesktop) + 1
      ],
    ];
  }

  workspace.slotSwitchDesktopRight();
  //Check again if the next desktop has free space
  setTile(windowNew);
}

workspace.windowAdded.connect(setTile);
workspace.windowRemoved.connect(onCloseWindow);
