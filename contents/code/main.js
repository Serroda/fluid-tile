// DEFAULTS VARIABLES
const APPS_BLOCKLIST =
  "org.kde.kded6,qt-sudo,org.kde.polkit-kde-authentication-agent-1,org.kde.spectacle,kcm_kwinrules,org.freedesktop.impl.portal.desktop.kde,krunner,plasmashell,org.kde.plasmashell,kwin_wayland,ksmserver-logout-greeter";
const TILES_PRIORITY = "Width,Height,Top,Left,Right,Bottom";
const MAXIMIZE_CLOSE = true;
const MAXIMIZE_OPEN = true;
const DESKTOP_ADD = true;
const DESKTOP_REMOVE = true;
const DESKTOP_REMOVE_DELAY = 300;
const MODALS_IGNORE = true;
const WINDOWS_ORDER_CLOSE = true;
const LAYOUT_DEFAULT = 2;
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
function checkBlocklist(windowItem, appsBlocklist, ignoreModals) {
  return (
    windowItem.normalWindow === false ||
    windowItem.resizeable === false ||
    windowItem.maximizable === false ||
    (ignoreModals === true ? windowItem.transient === true : false) ||
    appsBlocklist.includes(windowItem.resourceClass.toLowerCase()) === true
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
function orderTiles(tiles, tilesPriority) {
  let tilesOrdered = [];

  for (let tile of tiles) {
    if (tile.tiles.length !== 0) {
      tilesOrdered = tilesOrdered.concat(orderTiles(tile.tiles, tilesPriority));
    } else {
      tilesOrdered.push(tile);
    }
  }

  return tilesOrdered.sort((a, b) => {
    for (const priority of tilesPriority) {
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
function getOrderedTiles(desktop, screen, tilesPriority) {
  const tileRoot = workspace.rootTile(screen, desktop);
  return orderTiles(tileRoot.tiles, tilesPriority.split(","));
}

// Get all windows from the virtual desktop except the given window
function getWindows(windowMain, desktop, screen, appsBlocklist, modalsIgnore) {
  const windows = [];

  for (const windowItem of workspace.windowList().reverse()) {
    if (
      windowItem !== windowMain &&
      windowItem.output === screen &&
      windowItem.desktops.includes(desktop) === true &&
      checkBlocklist(windowItem, appsBlocklist, modalsIgnore) === false
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
  const tilesPriority = readConfig("TilesPriority", TILES_PRIORITY);

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

          if (maximize === true) windowMain.setMaximize(true, true);
          return false;
        }
      } else if (mode === 1) {
        if (windowsOther.length === 1 && maximize === true) {
          windowsOther[0].setMaximize(true, true);
          return false;
        }
      }

      if (mode === 1 && windowsOrderClose === false) {
        return true;
      }

      const tilesOrdered = getOrderedTiles(
        itemDesktop,
        itemScreen,
        tilesPriority,
      );

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
  const appsBlocklist = readConfig(
    "AppsBlocklist",
    APPS_BLOCKLIST,
  ).toLowerCase();

  const modalsIgnore = readConfig("ModalsIgnore", MODALS_IGNORE);

  if (checkBlocklist(windowClosed, appsBlocklist, modalsIgnore) === true) {
    return;
  }

  const maximizeClose = readConfig("CloseMaximize", MAXIMIZE_CLOSE);
  const windowsOrderClose = readConfig(
    "WindowsOrderClose",
    WINDOWS_ORDER_CLOSE,
  );

  const continueProcess = setWindowsTiles(
    windowClosed,
    windowClosed.desktops,
    [windowClosed.output],
    appsBlocklist,
    modalsIgnore,
    maximizeClose,
    1,
    windowsOrderClose,
  );

  if (continueProcess === false) {
    return;
  }

  const desktopRemove = readConfig("DesktopRemove", DESKTOP_REMOVE);

  if (desktopRemove === false) {
    return;
  }

  const desktopRemoveDelay = readConfig(
    "DesktopRemoveDelay",
    DESKTOP_REMOVE_DELAY,
  );

  const desktopsId = windowClosed.desktops.map((d) => d.id);
  const screenId = windowClosed.output.serialNumber;

  //Case: Applications that open a window and, when an action is performed,
  //close the window and open another window (Chrome profile selector).
  //This timer avoid crash wayland
  const timer = new QTimer();
  timer.interval = desktopRemoveDelay;
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
        appsBlocklist,
        modalsIgnore,
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
  const appsBlocklist = readConfig(
    "AppsBlocklist",
    APPS_BLOCKLIST,
  ).toLowerCase();
  const modalsIgnore = readConfig("ModalsIgnore", MODALS_IGNORE);

  if (checkBlocklist(windowNew, appsBlocklist, modalsIgnore) === true) {
    return;
  }

  const maximizeOpen = readConfig("MaximizeOpen", MAXIMIZE_OPEN);
  const desktopAdd = readConfig("DesktopAdd", DESKTOP_ADD);

  const continueProcess = setWindowsTiles(
    windowNew,
    workspace.desktops,
    workspace.screens,
    appsBlocklist,
    modalsIgnore,
    maximizeOpen,
    0,
    false,
  );

  if (desktopAdd === true && continueProcess === true) {
    workspace.createDesktop(workspace.desktops.length, "");
    workspace.currentDesktop =
      workspace.desktops[workspace.desktops.length - 1];
    windowNew.desktops = [workspace.currentDesktop];
    if (maximizeOpen === true) windowNew.setMaximize(true, true);

    const layoutDefault = readConfig("LayoutDefault", LAYOUT_DEFAULT);
    setLayout(
      workspace.currentDesktop,
      workspace.activeScreen,
      LAYOUTS[layoutDefault - 1],
    );
  }
}

workspace.windowAdded.connect(onOpenWindow);
workspace.windowRemoved.connect(onCloseWindow);
