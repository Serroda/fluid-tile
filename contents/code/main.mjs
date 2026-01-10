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
    adding: false,
    removing: false,
    exchanged: false,
    desktopsExtend: [],
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

      let layout = apiTiles.getDefaultLayouts(config.layoutDefault - 1);

      if (config.layoutCustom !== undefined) {
        layout = config.layoutCustom;
      }

      apiTiles.setLayout(workspace.currentDesktop, layout);

      const tilesOrdered = apiTiles.getTilesFromActualDesktop();

      if (config.maximizeOpen === true) {
        windowNew.setMaximize(true, true);
      } else {
        windowNew.setMaximize(false, false);
        tilesOrdered[0].manage(windowNew);
      }

      apiWindows.updateShadows(windowNew);
    }

    if (config.windowsExtendOpen === true) {
      state.adding = false;
    }
  }

  //Trigger when a window is remove to the desktop
  function onWindowRemoved(windowClosed) {
    if (apiBlocklist.checkBlocklist(windowClosed) === true) {
      return false;
    }

    state.removing = true;

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

    //Avoid execute extendWindows when tile is changed
    if (config.windowsExtendClose === false) {
      state.removing = false;
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

    if (config.UIEnable === true) {
      windowMain.interactiveMoveResizeStarted.connect(apiUI.onUserMoveStart);
      windowMain.interactiveMoveResizeStepped.connect(apiUI.onUserMoveStepped);
      windowMain.interactiveMoveResizeFinished.connect(() => {
        const windowMoved = apiUI.onUserMoveFinished(windowMain);
        if (config.windowsExtendResize === true && windowMoved === false) {
          apiWindows.extendWindowsCurrentDesktop(true);
        }
      });
    }

    windowMain._tileChangedFunction = onTileChanged.bind(null, windowMain);
    windowMain.tileChanged.connect(windowMain._tileChangedFunction);

    windowMain.maximizedAboutToChange.connect((mode) => {
      onMaximizeChange(mode, windowMain);
    });

    if (config.windowsExtendMinimize === true) {
      windowMain.minimizedChanged.connect(() => {
        onMinimizedChange(windowMain);
      });
    }
  }

  //When a window tile is changed, exchange windows and extend windows
  function onTileChanged(windowMain, tileNew) {
    //Trigger when a window is maximized but not minimized
    //when a window exchange
    if (
      state.adding === true ||
      state.removing === true ||
      rootUI.tileActived !== -1 ||
      tileNew === null
    ) {
      state.adding = false;
      state.removing = false;
      return;
    }

    if (tileNew.windows.length > 1 && config.windowsOrderMove === true) {
      const windowsOther = tileNew.window.filter((w) => w !== windowMain);

      //Disconnect windows target tile
      for (const windowTile of windowsOther) {
        windowTile.tileChanged.disconnect(windowTile._tileChangedFunction);
      }

      apiTiles.exchangeTiles(
        windowsOther,
        windowMain._shadows.tile,
        windowMain._shadows.desktops[0],
        windowMain._shadows.screen,
      );

      //Connect again windows target tile
      for (const windowTile of windowsOther) {
        windowTile.tileChanged.connect(windowTile._tileChangedFunction);
      }

      state.exchanged = true;
    } else {
      state.exchanged = false;
    }

    if (config.windowsExtendMove === true) {
      if (
        workspace.currentDesktop !== windowMain._shadows.desktops[0] &&
        state.desktopsExtend.includes(windowMain._shadows.desktops[0]) === false
      ) {
        state.desktopsExtend.push(windowMain._shadows.desktops[0]);
      }

      //Start delay only when you have to exchange in another screen
      if (windowMain._shadows.screen !== workspace.activeScreen) {
        timerExtendDesktop.start();
      } else {
        apiWindows.extendWindowsCurrentDesktop(true);
      }
    }

    apiWindows.updateShadows(windowMain);
  }

  //When window is not maximized, set a previous tile
  function onMaximizeChange(mode, windowMain) {
    if (windowMain.shadow === undefined && windowMain.tile === null) {
      const tilesOrdered = apiTiles.getTilesFromActualDesktop();
      apiWindows.updateShadows(windowMain, tilesOrdered[0]);
    }

    if (mode !== 0) {
      return;
    }

    //If not fullscreen
    const tileShadow = apiTiles.getShadowTile(windowMain);
    if (tileShadow !== null && tileShadow !== undefined) {
      //When a window is maximized window.tile is always null
      tileShadow.manage(windowMain);
    }
  }

  //When a window is minimized, extend windows
  function onMinimizedChange(windowMain) {
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

    if (config.windowsExtendClose === true) {
      apiWindows.extendWindowsCurrentDesktop();
    }
  }

  // Focus window when a current desktop is changed
  function onCurrentDesktopChanged() {
    apiUI.resetLayout();
    apiWindows.focusWindow();

    if (
      state.desktopsExtend.includes(workspace.currentDesktop) === true &&
      ((config.windowsExtendMove === true && state.exchanged === false) ||
        config.windowsExtendMinimize === true)
    ) {
      apiWindows.extendWindowsCurrentDesktop(true);
      state.desktopsExtend.splice(
        state.desktopsExtend.indexOf(workspace.currentDesktop),
        1,
      );
    }
  }

  function onTimerExtendDesktopFinished() {
    apiWindows.extendWindowsCurrentDesktop(true);
  }

  return {
    onWindowAdded,
    onWindowRemoved,
    onTimerRemoveDesktopFinished,
    onTimerExtendDesktopFinished,
    onCurrentDesktopChanged,
    setWindowsSignals,
    setSignalsToWindow,
  };
}
