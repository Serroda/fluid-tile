import { useBlocklist } from "./blocklist.mjs";
import { useWindows } from "./windows.mjs";
import { useWorkarea } from "./workarea.mjs";
import { useTiles } from "./tiles.mjs";
import { useUI } from "./ui.mjs";

export function useTriggers(workspace, config, rootUI) {
  const apiBlocklist = useBlocklist(config.appsBlocklist, config.modalsIgnore);
  const apiWindows = useWindows(workspace, config);
  const apiTiles = useTiles(workspace, config);
  const apiWorkarea = useWorkarea(workspace);
  const apiUI = useUI(workspace, config, rootUI);

  const state = {
    windowFocused: {},
    adding: false,
    exchanged: false,
    desktopExtend: null,
  };

  //Trigger when a window is added to the desktop
  function onWindowAdded(windowNew) {
    if (apiBlocklist.checkBlocklist(windowNew) === true) {
      return;
    }

    state.adding = true;

    const continueProcess = apiWindows.setWindowsTiles(
      windowNew,
      workspace.desktops,
      workspace.screens,
      config.maximizeOpen,
      0,
    );

    if (config.desktopAdd === true && continueProcess === true) {
      workspace.createDesktop(workspace.desktops.length, "");
      workspace.currentDesktop =
        workspace.desktops[workspace.desktops.length - 1];
      windowNew.desktops = [workspace.currentDesktop];

      const tilesOrdered = apiTiles.getTilesFromActualDesktop();

      if (config.maximizeOpen === true) {
        windowNew.tilePrevious = tilesOrdered[0];
        windowNew.setMaximize(true, true);
      }

      let layout = apiTiles.getDefaultLayouts(config.layoutDefault - 1);

      if (config.layoutCustom !== undefined) {
        layout = config.layoutCustom;
      }

      apiTiles.setLayout(workspace.currentDesktop, layout);

      if (config.maximizeOpen === false) {
        windowNew.setMaximize(false, false);
        tilesOrdered[0].manage(windowNew);
        windowNew.tilePrevious = tilesOrdered[0];
      }
    }
  }

  //Trigger when a window is remove to the desktop
  function onWindowRemoved(windowClosed) {
    if (apiBlocklist.checkBlocklist(windowClosed) === true) {
      return false;
    }

    const continueProcess = apiWindows.setWindowsTiles(
      windowClosed,
      windowClosed.desktops,
      [windowClosed.output],
      config.maximizeClose,
      1,
    );

    if (continueProcess === false) {
      apiWindows.focusWindow();
    }

    return (
      continueProcess === true &&
      config.desktopRemove === true &&
      workspace.desktops.length > 1 &&
      workspace.desktops.length > config.desktopRemoveMin
    );
  }

  //Set signals to all Windows
  function setWindowsSignals() {
    for (const windowItem of workspace.stackingOrder) {
      setSignalsToWindow(windowItem);
    }
  }

  //Save tile when user focus a window and add signal
  function onUserFocusWindow(windowMain) {
    const tile = apiTiles.getPreviousTile(windowMain);

    if (
      windowMain.active === true &&
      tile !== null &&
      windowMain.signalTileChangedConnected !== true
    ) {
      state.windowFocused.tile = tile;
      state.windowFocused.window = windowMain;
      state.windowFocused.desktop = workspace.currentDesktop;

      windowMain.signalTileChangedConnected = true;
      windowMain.tileChanged.connect(onTileChanged);
    } else {
      windowMain.tileChanged.disconnect(onTileChanged);
      windowMain.signalTileChangedConnected = false;
    }
  }

  //When a window tile is changed, exchange windows and extend windows
  function onTileChanged(tileNew) {
    //Trigger when a window is maximized and minimized
    //when a window exchange
    if (
      state.adding === true ||
      rootUI.tileActived !== -1 ||
      tileNew === null
    ) {
      state.adding = false;
      return;
    }

    const windowsOther = apiWindows
      .getWindows(
        state.windowFocused.window,
        workspace.currentDesktop,
        workspace.activeScreen,
      )
      .filter(
        (window) => window.tile === tileNew || window.tilePrevious === tileNew,
      );

    if (
      tileNew !== null &&
      windowsOther.length !== 0 &&
      config.windowsOrderMove === true
    ) {
      apiTiles.exchangeTiles(
        state.windowFocused.window,
        windowsOther,
        state.windowFocused.tile,
        state.windowFocused.desktop,
      );

      state.windowFocused.tile = state.windowFocused.window.tile;
      state.windowFocused.window.tilePrevious = state.windowFocused.window.tile;
      state.exchanged = true;
    } else {
      state.exchanged = false;
    }

    if (config.windowsExtendMove === true) {
      if (workspace.currentDesktop !== state.windowFocused.desktop) {
        state.desktopExtend = state.windowFocused.desktop;
      }

      for (const screen of workspace.screens) {
        const windows = apiWindows.getWindows(
          undefined,
          workspace.currentDesktop,
          screen,
        );
        apiWindows.extendWindows(
          windows,
          apiWorkarea.getPanelsSize(screen, workspace.currentDesktop),
        );
      }
    }
  }

  //Set signals to window
  function setSignalsToWindow(windowMain) {
    if (apiBlocklist.checkBlocklist(windowMain) === true) {
      return;
    }

    if (config.UIEnable === true) {
      windowMain.interactiveMoveResizeStarted.connect(apiUI.onUserMoveStart);
      windowMain.interactiveMoveResizeStepped.connect(apiUI.onUserMoveStepped);
      windowMain.interactiveMoveResizeFinished.connect(() => {
        apiUI.onUserMoveFinished(windowMain);
      });
    }

    if (config.windowsOrderMove === true || config.windowsExtendMove === true) {
      onUserFocusWindow(windowMain);
      windowMain.activeChanged.connect(() => {
        onUserFocusWindow(windowMain);
      });
    }

    windowMain.maximizedAboutToChange.connect((mode) => {
      onMaximizeChange(mode, windowMain);
    });
  }

  function onMaximizeChange(mode, windowMain) {
    if (mode !== 0) {
      if (windowMain.tilePrevious === undefined && windowMain.tile === null) {
        const tilesOrdered = apiTiles.getTilesFromActualDesktop();
        windowMain.tilePrevious = tilesOrdered[0];
      }
      return;
    }

    //If not fullscreen
    const tilePrevious = apiTiles.getPreviousTile(windowMain);
    //When a window is maximized window.tile is always null
    if (tilePrevious !== null) {
      tilePrevious.manage(windowMain);
    }
  }

  function onTimerFinished() {
    //Case: Applications that open a window and, when an action is performed,
    //close the window and open another window (Chrome profile selector).
    //This timer avoid crash wayland
    const desktopsRemove = [];

    desktopLoop: for (const desktopItem of workspace.desktops.filter((d) =>
      rootUI.removeDesktopInfo.desktopsId.includes(d.id),
    )) {
      for (const screenItem of workspace.screens) {
        const windowsOtherSpecialCases = apiWindows.getWindows(
          rootUI.removeDesktopInfo.windowClosed,
          desktopItem,
          screenItem,
        );

        if (windowsOtherSpecialCases.length !== 0) {
          continue desktopLoop;
        }
      }

      desktopsRemove.push(desktopItem);
    }

    for (const desktop of desktopsRemove) {
      workspace.removeDesktop(desktop);
    }

    rootUI.removeDesktopInfo = {};
    apiWindows.extendWindowsCurrentDesktop();
  }

  // Focus window when a current desktop is changed
  function onCurrentDesktopChanged() {
    apiUI.resetLayout();

    if (
      state.desktopExtend === workspace.currentDesktop &&
      state.exchanged === false
    ) {
      apiWindows.extendWindowsCurrentDesktop();
      state.desktopExtend = null;
    }
  }

  return {
    onWindowAdded,
    onWindowRemoved,
    onTimerFinished,
    onCurrentDesktopChanged,
    setWindowsSignals,
    setSignalsToWindow,
  };
}
