import { useBlocklist } from "./blocklist.mjs";
import { useWindows } from "./windows.mjs";
import { useTiles } from "./tiles.mjs";
import { useUI } from "./ui.mjs";

export function useTriggers(workspace, config, rootUI, timerExtendDesktop) {
  const apiBlocklist = useBlocklist(config.appsBlocklist, config.modalsIgnore);
  const apiWindows = useWindows(workspace, config);
  const apiTiles = useTiles(workspace, config);
  const apiUI = useUI(workspace, config, rootUI);

  const state = {
    avoidTileChangedCounter: 0,
    desktopsExtend: [],
    windowsReconnect: [],
  };

  //Trigger when a window is added to the desktop
  function onWindowAdded(windowNew) {
    if (apiBlocklist.checkBlocklist(windowNew) === true) {
      return;
    }

    const result = apiWindows.setWindowsTiles(
      windowNew,
      workspace.desktops,
      workspace.screens,
      0,
    );
    state.windowsReconnect = result.windows;

    console.log("windowAdded", result.counter);
    // state.avoidTileChangedCounter = result.counter;

    if (config.desktopAdd === true && result.continueProcess === true) {
      workspace.createDesktop(workspace.desktops.length, "");
      workspace.currentDesktop =
        workspace.desktops[workspace.desktops.length - 1];
      windowNew.desktops = [workspace.currentDesktop];

      let layout = apiTiles.getDefaultLayouts(config.layoutDefault - 1);

      if (config.layoutCustom !== undefined) {
        layout = config.layoutCustom;
      }

      apiTiles.setLayout(workspace.currentDesktop, layout);
      const tilesOrdered = apiTiles.getTilesFromActualDesktop();

      if (config.maximizeExtend === true) {
        windowNew.setMaximize(true, true);
      } else {
        windowNew.setMaximize(false, false);
        tilesOrdered[0].manage(windowNew);
      }

      apiWindows.updateShadows(windowNew, tilesOrdered[0]);
    }
  }

  //Trigger when a window is remove to the desktop
  function onWindowRemoved(windowClosed) {
    if (apiBlocklist.checkBlocklist(windowClosed) === true) {
      return false;
    }

    const result = apiWindows.setWindowsTiles(
      windowClosed,
      windowClosed.desktops,
      [windowClosed.output],
      1,
    );

    console.log("windowRemoved", result.counter);
    state.windowsReconnect = result.windows;
    // state.avoidTileChangedCounter = result.counter;

    if (result.continueProcess === false) {
      apiWindows.focusWindow();
    }

    return (
      result.continueProcess === true &&
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

  //Set signals to window
  function setSignalsToWindow(windowMain) {
    if (apiBlocklist.checkBlocklist(windowMain) === true) {
      return;
    }

    windowMain._tileChangedFunction = onTileChanged.bind(null, windowMain);
    windowMain.tileChanged.connect(windowMain._tileChangedFunction);

    windowMain.maximizedAboutToChange.connect((mode) => {
      onMaximizeChanged(mode, windowMain);
    });

    windowMain.minimizedChanged.connect(() => {
      onMinimizedChanged(windowMain);
    });

    windowMain.interactiveMoveResizeStarted.connect(apiUI.onUserMoveStart);
    windowMain.interactiveMoveResizeStepped.connect(apiUI.onUserMoveStepped);
    windowMain.interactiveMoveResizeFinished.connect(() => {
      const windowMoved = apiUI.onUserMoveFinished(windowMain);
      if (windowMoved === false) {
        apiWindows.extendWindowsCurrentDesktop(true);
      }
    });
  }

  function connectTileChange(windows) {
    for (const window of windows) {
    }
  }

  function onTimerReconnectTileChangedSignalFinished() {
    for (const window of state.windowsReconnect) {
      window.tileChanged.connect(window._tileChangedFunction);
    }
    state.windowsReconnect = [];
  }

  //When a window tile is changed, exchange windows and extend windows
  function onTileChanged(windowMain, tileNew) {
    //Trigger when a window is maximized but not minimized
    //when a window exchange
    console.log(
      "tile changed",
      windowMain,
      tileNew,
      state.avoidTileChangedCounter,
    );
    if (
      rootUI.tileActived !== -1 ||
      tileNew === null ||
      state.avoidTileChangedCounter > 0
    ) {
      if (state.avoidTileChangedCounter > 0) {
        state.avoidTileChangedCounter -= 1;
      }
      console.log("avoid", state.avoidTileChangedCounter);
      return;
    }

    const windowsOther = apiWindows
      .getWindows(windowMain, workspace.currentDesktop, workspace.activeScreen)
      .filter(
        (w) =>
          w.minimized === false &&
          (w.tile === tileNew || w._shadows.tile === tileNew),
      );

    if (windowsOther.length > 0 && config.windowsExchange === true) {
      state.avoidTileChangedCounter = windowsOther.length;

      apiTiles.exchangeTiles(
        windowsOther,
        windowMain._shadows.tile,
        windowMain._shadows.desktop,
        windowMain._shadows.screen,
      );
    }

    if (
      workspace.currentDesktop !== windowMain._shadows.desktop &&
      state.desktopsExtend.includes(windowMain._shadows.desktop) === false
    ) {
      state.desktopsExtend.push(windowMain._shadows.desktop);
    }

    //Start delay only when you have to exchange in another screen
    if (windowMain._shadows.screen !== workspace.activeScreen) {
      timerExtendDesktop.start();
    } else if (
      apiTiles.getOrderedTiles().length > windowsOther.length + 1 ||
      windowMain._maximized === false
    ) {
      apiWindows.extendWindowsCurrentDesktop(true);
    }

    console.log("update shadow tile changed");
    // Set `tileNew` to `_shadows.tile` when window is maximized for avoid
    // `windowMain.tile === null` and `windowMain._shadows.tile === oldCopyTile`
    // setting `tileNew` we get now `windowMain._shadows.tile === tileNew`

    apiWindows.updateShadows(windowMain, tileNew);
  }

  //When window is not maximized, set a previous tile
  function onMaximizeChanged(mode, windowMain) {
    windowMain._maximized = mode === 3;

    //When a window is maximized window.tile is always null
    console.log("maximize change", windowMain, windowMain._maximized);
    if (
      mode !== 0 ||
      windowMain._shadows === undefined ||
      windowMain.tile !== null
    ) {
      return;
    }

    //If not fullscreen
    if (windowMain.tile !== windowMain._shadows.tile) {
      console.log("maximize manage");
      windowMain._shadows.tile?.manage(windowMain);
    }
  }

  //When a window is minimized, extend windows
  function onMinimizedChanged(windowMain) {
    if (
      windowMain.desktops.includes(workspace.currentDesktop) === false &&
      state.desktopsExtend.includes(workspace.currentDesktop) === false
    ) {
      state.desktopsExtend.push(workspace.currentDesktop);
      return;
    }

    windowMain.setMaximize(false, false);
    apiWindows.extendWindowsCurrentDesktop(true);
  }

  function onTimerRemoveDesktopFinished() {
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

  function onTimerExtendDesktopFinished() {
    apiWindows.extendWindowsCurrentDesktop(true);
  }

  // Focus window when a current desktop is changed
  function onCurrentDesktopChanged() {
    apiUI.resetLayout();
    apiWindows.focusWindow();
    if (state.desktopsExtend.includes(workspace.currentDesktop) === true) {
      apiWindows.extendWindowsCurrentDesktop(true);
      state.desktopsExtend.splice(
        state.desktopsExtend.indexOf(workspace.currentDesktop),
        1,
      );
      state.avoidTileChangedCounter = 1;
    }
  }

  return {
    onWindowAdded,
    onWindowRemoved,
    onTimerRemoveDesktopFinished,
    onTimerExtendDesktopFinished,
    onCurrentDesktopChanged,
    setWindowsSignals,
    setSignalsToWindow,
    onTimerReconnectTileChangedSignalFinished,
  };
}
