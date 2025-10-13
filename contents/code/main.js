// DEFAULTS VARIABLES
const APPS_BLOCKLIST = readConfig(
  "AppsBlocklist",
  "org.kde.kded6,qt-sudo,org.kde.polkit-kde-authentication-agent-1,org.kde.spectacle,kcm_kwinrules,org.freedesktop.impl.portal.desktop.kde,krunner,plasmashell,org.kde.plasmashell,kwin_wayland,ksmserver-logout-greeter",
).toLowerCase();
const TILES_PRIORITY = readConfig(
  "TilesPriority",
  "Width,Height,Top,Left,Right,Bottom",
).split(",");
const MAXIMIZE_CLOSE = readConfig("MaximizeClose", true);
const MAXIMIZE_OPEN = readConfig("MaximizeOpen", true);
const WINDOWS_ORDER_CLOSE = readConfig("WindowsOrderClose", true);
const DESKTOP_ADD = readConfig("DesktopAdd", true);
const DESKTOP_REMOVE = readConfig("DesktopRemove", true);
const DESKTOP_REMOVE_DELAY = readConfig("DesktopRemoveDelay", 300);
const MODALS_IGNORE = readConfig("ModalsIgnore", true);
const LAYOUT_DEFAULT = readConfig("LayoutDefault", 2);
const LAYOUTS = [
  [{ x: 0, y: 0 }],
  [
    { x: 0, y: 0 },
    { x: 0.5, y: 0 },
  ],
  [
    { x: 0, y: 0 },
    { x: 0, y: 0.5 },
  ],
  [
    {
      x: 0,
      y: 0,
      tiles: [
        { x: 0, y: 0 },
        { x: 0, y: 0.5 },
      ],
    },
    {
      x: 0.5,
      y: 0,
    },
  ],
  [
    { x: 0, y: 0 },
    {
      x: 0.5,
      y: 0,
      tiles: [
        { x: 0, y: 0 },
        { x: 0, y: 0.5 },
      ],
    },
  ],
  [
    {
      x: 0,
      y: 0,
      tiles: [
        { x: 0, y: 0 },
        { x: 0, y: 0.5 },
      ],
    },
    {
      x: 0.5,
      y: 0,
      tiles: [
        { x: 0, y: 0 },
        { x: 0, y: 0.5 },
      ],
    },
  ],
];

//Block apps
function checkBlocklist(windowItem) {
  return (
    windowItem.normalWindow === false ||
    windowItem.resizeable === false ||
    windowItem.maximizable === false ||
    (MODALS_IGNORE === true ? windowItem.transient === true : false) ||
    APPS_BLOCKLIST.includes(windowItem.resourceClass.toLowerCase()) === true
  );
}

//Set tile layout
function setTiles(tileParent, layout) {
  if (layout.length === 1) {
    return true;
  }

  if (layout[0].x === 0 && layout[0].y === 0) {
    layout[0].ref = tileParent;
  }

  for (let index = 1; index < layout.length; index++) {
    const item = layout[index];

    let splitMode = null;

    if (item.x !== 0 && item.y !== 0) {
      splitMode = 0;
    } else if (item.x !== 0) {
      splitMode = 1;
    } else if (item.y !== 0) {
      splitMode = 2;
    }

    if (splitMode !== null) {
      let newTiles = null;

      if (splitMode !== 0) {
        newTiles = layout[index - 1].ref.split(splitMode);
      } else {
        newTiles = layout[index - 1].ref.split(1);
        newTiles[1].split(splitMode);
      }

      layout[index].ref = newTiles[1];

      const newTile = layout[index].ref;

      newTile.relativeGeometry.x = item.x;
      newTile.relativeGeometry.y = item.y;
    }
  }

  for (let x = 0; x < layout.length; x++) {
    if (layout[x].tiles !== undefined) {
      setTiles(layout[x].ref, layout[x].tiles);
    }
  }

  return true;
}

//Prepare for set tile layout
function setLayout(desktop, screen, layout) {
  const tileRoot = workspace.rootTile(screen, desktop);
  tileRoot.tiles.forEach((tile) => tile.remove());
  return setTiles(tileRoot.tiles[0], layout);
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
    for (const priority of TILES_PRIORITY) {
      let comparison = 0;
      switch (priority) {
        case "Width":
          comparison = b.absoluteGeometry.width - a.absoluteGeometry.width;
          break;
        case "Height":
          comparison = b.absoluteGeometry.height - a.absoluteGeometry.height;
          break;
        case "Top":
          comparison = a.absoluteGeometry.y - b.absoluteGeometry.y;
          break;
        case "Right":
          comparison = b.absoluteGeometry.x - a.absoluteGeometry.x;
          break;
        case "Left":
          comparison = a.absoluteGeometry.x - b.absoluteGeometry.x;
          break;
        case "Bottom":
          comparison = b.absoluteGeometry.y - a.absoluteGeometry.y;
          break;
      }
      if (comparison !== 0) {
        return comparison;
      }
    }
    return 0;
  });
}

//Get tiles from the screen and virtual desktop
function getOrderedTiles(desktop, screen) {
  const tileRoot = workspace.rootTile(screen, desktop);
  return orderTiles(tileRoot.tiles);
}

// Get all windows from the virtual desktop except the given window
function getWindows(windowMain, desktop, screen) {
  const windows = [];

  for (const windowItem of workspace.windowList().reverse()) {
    if (
      windowItem !== windowMain &&
      windowItem.output === screen &&
      windowItem.desktops.includes(desktop) === true &&
      checkBlocklist(windowItem) === false
    ) {
      windows.push(windowItem);
    }
  }

  return windows;
}

// Set window tiles
// mode: 0 => addWindow
// mode: 1 => removeWindow
function setWindowsTiles(windowMain, desktops, screens, maximize, mode) {
  for (const itemDesktop of desktops) {
    for (const itemScreen of screens) {
      const windowsOther = getWindows(windowMain, itemDesktop, itemScreen);
      const tilesOrdered = getOrderedTiles(itemDesktop, itemScreen);

      if (mode === 0) {
        if (windowsOther.length === 0) {
          workspace.currentDesktop = itemDesktop;
          windowMain.desktops = [itemDesktop];

          if (maximize === true) {
            windowMain.setMaximize(true, true);
          } else {
            windowMain.setMaximize(false, false);
            windowMain.tile = tilesOrdered[0];
          }

          return false;
        }
      } else if (mode === 1) {
        if (windowsOther.length === 1 && maximize === true) {
          windowsOther[0].setMaximize(true, true);
          return false;
        }
      }

      if (mode === 1 && WINDOWS_ORDER_CLOSE === false) {
        return true;
      }

      if (mode === 0) {
        //Set tile if the custom mosaic has space
        if (windowsOther.length + 1 <= tilesOrdered.length) {
          workspace.currentDesktop = itemDesktop;
          windowMain.desktops = [itemDesktop];
          windowMain.tile = tilesOrdered[0];
          windowMain.setMaximize(false, false);
          for (let x = 0; x < windowsOther.length; x++) {
            windowsOther[x].desktops = [itemDesktop];
            windowsOther[x].tile = tilesOrdered[x + 1];
            windowsOther[x].setMaximize(false, false);
          }
          return false;
        }
      } else if (mode === 1 && windowsOther.length !== 0) {
        for (let x = 0; x < windowsOther.length; x++) {
          windowsOther[x].tile = tilesOrdered[x];
          windowsOther[x].setMaximize(false, false);
        }
        return false;
      }
    }
  }
  return true;
}

//Delete Virtual Desktop if is empty or maximize the last window
function onCloseWindow(windowClosed) {
  if (checkBlocklist(windowClosed) === true) {
    return;
  }

  const continueProcess = setWindowsTiles(
    windowClosed,
    windowClosed.desktops,
    [windowClosed.output],
    MAXIMIZE_CLOSE,
    1,
  );

  if (continueProcess === false || DESKTOP_REMOVE === false) {
    return;
  }

  const desktopsId = windowClosed.desktops.map((d) => d.id);
  const screenId = windowClosed.output.serialNumber;

  //Case: Applications that open a window and, when an action is performed,
  //close the window and open another window (Chrome profile selector).
  //This timer avoid crash wayland
  const timer = new QTimer();
  timer.interval = DESKTOP_REMOVE_DELAY;
  timer.singleShot = true;
  timer.timeout.connect(function () {
    const screen = workspace.screens.find((s) => s.serialNumber === screenId);
    if (screen === undefined) {
      return;
    }
    for (const desktopItem of workspace.desktops.filter((d) =>
      desktopsId.includes(d.id),
    )) {
      const windowsOtherSpecialCases = getWindows(
        windowClosed,
        desktopItem,
        screen,
      );
      if (windowsOtherSpecialCases.length === 0) {
        workspace.removeDesktop(desktopItem);
      }
    }
  });

  timer.start();
}

//Set tile to the new Window
function onOpenWindow(windowNew) {
  if (checkBlocklist(windowNew) === true) {
    return;
  }

  const continueProcess = setWindowsTiles(
    windowNew,
    workspace.desktops,
    workspace.screens,
    MAXIMIZE_OPEN,
    0,
  );

  if (DESKTOP_ADD === true && continueProcess === true) {
    workspace.createDesktop(workspace.desktops.length, "");
    workspace.currentDesktop =
      workspace.desktops[workspace.desktops.length - 1];
    windowNew.desktops = [workspace.currentDesktop];

    if (MAXIMIZE_OPEN === true) {
      windowNew.setMaximize(true, true);
    }

    setLayout(
      workspace.currentDesktop,
      workspace.activeScreen,
      LAYOUTS[LAYOUT_DEFAULT - 1],
    );

    if (MAXIMIZE_OPEN === false) {
      const tilesOrdered = getOrderedTiles(
        workspace.currentDesktop,
        workspace.activeScreen,
      );

      windowNew.setMaximize(false, false);
      windowNew.tile = tilesOrdered[0];
    }
  }
}

workspace.windowAdded.connect(onOpenWindow);
workspace.windowRemoved.connect(onCloseWindow);
