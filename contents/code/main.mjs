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
    desktopsExtend: [],
  };

  //Trigger when a window is added to the desktop
  function onWindowAdded(windowNew) {
    if (apiBlocklist.checkBlocklist(windowNew) === true) {
      return;
    }

    const continueProcess = apiWindows.setWindowsTilesAdded(windowNew);

    if (config.desktopAdd === true && continueProcess === true) {
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
        windowNew._avoidTileChangedTrigger = false;
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

    const continueProcess = apiWindows.setWindowsTilesRemoved(windowClosed);

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

  //Set signals to window
  function setSignalsToWindow(windowMain) {
    if (apiBlocklist.checkBlocklist(windowMain) === true) {
      return;
    }

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

  //When a window tile is changed, exchange windows and extend windows
  function onWindowdAddedToTile(tileNew, windowMain) {
    //Trigger when a window is maximized but not minimized
    //when a window exchange
    console.log(
      "window added to tile",
      windowMain._avoidTileChangedTrigger,
      windowMain,
      tileNew,
    );

    if (
      rootUI.visible === true ||
      windowMain._avoidTileChangedTrigger === true ||
      windowMain._shadows === undefined
    ) {
      windowMain._avoidTileChangedTrigger =
        windowMain._avoidTileChangedTrigger === true
          ? false
          : windowMain._avoidTileChangedTrigger;

      console.log(
        "avoid",
        rootUI.tileActived,
        windowMain._avoidTileChangedTrigger,
        windowMain._shadows,
      );
      return;
    }

    const windowsOther = apiWindows
      .getWindows(windowMain, workspace.currentDesktop, workspace.activeScreen)
      .filter(
        (w) =>
          w.minimized === false &&
          (w.tile === tileNew || w._shadows?.tile === tileNew),
      );

    if (windowsOther.length > 0 && config.windowsExchange === true) {
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
      timerExtendDesktop.interval = config.windowsExtendTileChangedDelay;
      timerExtendDesktop.start();
    } else if (
      apiTiles.getOrderedTiles().length > windowsOther.length + 1 ||
      windowMain._maximized === false
    ) {
      //Start delay only when you have to exchange in another screen
      timerExtendDesktop.interval = 0;
      timerExtendDesktop.start();
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
    console.log(
      "maximize change",
      windowMain,
      mode,
      windowMain._avoidMaximizeTrigger,
    );

    if (
      windowMain._maximized === true ||
      windowMain._avoidMaximizeTrigger === true ||
      windowMain._shadows === undefined ||
      windowMain.tile !== null
    ) {
      windowMain._avoidMaximizeTrigger =
        windowMain._avoidMaximizeTrigger === true
          ? false
          : windowMain._avoidMaximizeTrigger;
      console.log("avoid", windowMain._avoidMaximizeTrigger);
      return;
    }

    //If not fullscreen
    if (windowMain.tile !== windowMain._shadows.tile) {
      console.log("maximize manage");
      windowMain._avoidTileChangedTrigger = false;
      windowMain._avoidMaximizeExtend = true;
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
    console.log("desktop changed");
    apiUI.resetLayout();
    setTilesSignals();
    apiWindows.focusWindow();

    if (state.desktopsExtend.includes(workspace.currentDesktop) === true) {
      apiWindows.extendWindowsCurrentDesktop(true);
      state.desktopsExtend.splice(
        state.desktopsExtend.indexOf(workspace.currentDesktop),
        1,
      );
    }
  }

  function setTilesSignals() {
    const rootTile = apiTiles.getRootTile();

    if (rootTile === null) {
      return;
    }

    if (rootTile._childTilesSignalConnected !== true) {
      rootTile.childTilesChanged.connect(() => {
        console.log("rootTile change childs");
        onChildTilesChanged();
      });
      rootTile._childTilesSignalConnected = true;
    }

    const tiles = apiTiles.getOrderedTiles(
      workspace.currentDesktop,
      workspace.activeScreen,
    );

    for (const tile of tiles) {
      if (tile._windowAddedSignalConnected !== true && rootTile !== tile) {
        console.log("signal added", tile);
        tile._windowAddedSignalConnected = true;
        tile.windowAdded.connect(onWindowdAddedToTile.bind(null, tile));
        tile.childTilesChanged.connect(() => {
          console.log("tile change childs");
          onChildTilesChanged();
        });
      }
    }
  }

  function onChildTilesChanged() {
    setTilesSignals();
    apiWindows.extendWindowsCurrentDesktop();
  }

  return {
    onWindowAdded,
    onWindowRemoved,
    onTimerRemoveDesktopFinished,
    onTimerExtendDesktopFinished,
    onCurrentDesktopChanged,
    setWindowsSignals,
    setSignalsToWindow,
    setTilesSignals,
  };
}
