//GET OTHER WINDOWS FROM CURRENT VIRTUAL DESKTOP
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

//GET CUSTOM TILES ORDERED BY SIZE AND LEFT TO RIGHT
function getTiles(tiles) {
  let tilesOrdered = [];

  for (let tile of tiles) {
    if (tile.tiles.length !== 0) {
      const subTiles = getTiles(tile.tiles);
      tilesOrdered = [...tilesOrdered, ...subTiles];
      continue;
    }

    if (tilesOrdered.length === 0) {
      tilesOrdered.push(tile);
      continue;
    }

    let insertPosition = tilesOrdered.length;

    for (let x = 0; x < tilesOrdered.length; x++) {
      if (
        tile.absoluteGeometry.width > tilesOrdered[x].absoluteGeometry.width ||
        (tile.absoluteGeometry.width ===
          tilesOrdered[x].absoluteGeometry.width &&
          tile.absoluteGeometry.x < tilesOrdered[x].absoluteGeometry.x)
      ) {
        if (x < insertPosition) insertPosition = x;
      }
    }

    tilesOrdered.splice(insertPosition, 0, tile);
  }

  return tilesOrdered;
}

function getConfig(screen) {
  const tileManager = workspace.tilingForScreen(screen);
  return getTiles(tileManager.rootTile.tiles);
}

function deleteDesktopWithoutWindows(windowClosed) {
  if (
    windowClosed.normalWindow === false ||
    windowClosed.popupWindow === true
  ) {
    return;
  }

  let confirmDelete = false;

  for (const windowItem of workspace.stackingOrder) {
    if (
      windowItem.desktops.includes(workspace.currentDesktop) &&
      windowItem !== windowClosed
    ) {
      confirmDelete = false;
      break;
    }
    confirmDelete = true;
  }

  if (confirmDelete === true) workspace.removeDesktop(workspace.currentDesktop);
}

function setTile(windowNew) {
  if (windowNew.normalWindow === false || windowNew.popupWindow === true) {
    return;
  }

  const windowsOther = getWindowsFromActualDesktop(windowNew);

  if (windowsOther.length === 0) {
    windowNew.setMaximize(true, true);
    return;
  }

  const tilesOrdered = getConfig(workspace.activeScreen);

  if (windowsOther.length + 1 <= tilesOrdered.length) {
    windowNew.tile = tilesOrdered[0];

    for (let x = 0; x < windowsOther.length; x++) {
      windowsOther[x].tile = tilesOrdered[x + 1];
    }
    return;
  }

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
  setTile(windowNew);
}

workspace.windowAdded.disconnect(setTile);
workspace.windowAdded.connect(setTile);

workspace.windowRemoved.disconnect(deleteDesktopWithoutWindows);
workspace.windowRemoved.connect(deleteDesktopWithoutWindows);
