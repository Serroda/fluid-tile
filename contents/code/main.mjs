import { useBlocklist } from "./blocklist.mjs";
import { useWindows } from "./windows.mjs";
import { useTiles } from "./tiles.mjs";
import { useUI } from "./ui.mjs";

export function useTriggers(workspace, config, rootUI) {
  const apiBlocklist = useBlocklist(config.appsBlocklist, config.modalsIgnore);
  const apiWindows = useWindows(workspace, config);
  const apiTiles = useTiles(workspace, config);
  const apiUI = useUI(workspace, config, rootUI);

  const state = {
    windowFocused: {},
    adding: false,
    removing: false,
    exchanged: false,
    resized: false,
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

      windowNew.tilePrevious = tilesOrdered[0];
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

    state.removing = false;

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

    if (config.windowsExtendMinimize === true) {
      windowMain.minimizedChanged.connect(() => {
        onMinimizedChange(windowMain);
      });
    }
  }

  //When a window is resized with the cursor
  function onResizeCursorChanged() {
    if (state.resized === true) {
      apiWindows.extendWindowsCurrentDesktop();
      state.resized = false;
    } else {
      state.resized = true;
    }
  }

  //Save tile when user focus a window and add signal
  function onUserFocusWindow(windowMain) {
    const tile = apiTiles.getPreviousTile(windowMain);

    if (
      windowMain.active === true &&
      tile !== null &&
      windowMain.signalsAdditionalConnected !== true
    ) {
      state.windowFocused.tile = tile;
      state.windowFocused.window = windowMain;
      state.windowFocused.desktop = workspace.currentDesktop;
      state.windowFocused.screen = workspace.activeScreen;

      windowMain.signalsAdditionalConnected = true;
      windowMain.tileChanged.connect(onTileChanged);

      if (config.windowsExtendResize === true) {
        windowMain.moveResizedChanged.connect(onResizeCursorChanged);
      }
    } else {
      windowMain.tileChanged.disconnect(onTileChanged);
      if (config.windowsExtendResize === true) {
        windowMain.moveResizedChanged.disconnect(onResizeCursorChanged);
      }
      windowMain.signalsAdditionalConnected = false;
    }
  }

  //When a window tile is changed, exchange windows and extend windows
  function onTileChanged(tileNew) {
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
        windowsOther,
        state.windowFocused.tile,
        state.windowFocused.desktop,
        state.windowFocused.screen,
      );

      state.exchanged = true;
    } else {
      state.exchanged = false;
    }

    state.windowFocused.tile = state.windowFocused.window.tile;
    state.windowFocused.window.tilePrevious = state.windowFocused.window.tile;
    state.windowFocused.desktop = state.windowFocused.window.desktops[0];
    state.windowFocused.screen = state.windowFocused.window.output;

    if (config.windowsExtendMove === true) {
      if (
        workspace.currentDesktop !== state.windowFocused.desktop &&
        state.desktopsExtend.includes(state.windowFocused.desktop) === false
      ) {
        state.desktopsExtend.push(state.windowFocused.desktop);
      }

      apiWindows.extendWindowsCurrentDesktop(true);
    }
  }

  //When window is not maximized, set a previous tile
  function onMaximizeChange(mode, windowMain) {
    if (windowMain.tilePrevious === undefined && windowMain.tile === null) {
      const tilesOrdered = apiTiles.getTilesFromActualDesktop();
      windowMain.tilePrevious = tilesOrdered[0];
    }

    if (mode !== 0) {
      return;
    }

    //If not fullscreen
    const tilePrevious = apiTiles.getPreviousTile(windowMain);
    if (tilePrevious !== null && tilePrevious !== undefined) {
      //When a window is maximized window.tile is always null
      tilePrevious.manage(windowMain);
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

  return {
    onWindowAdded,
    onWindowRemoved,
    onTimerRemoveDesktopFinished,
    onCurrentDesktopChanged,
    setWindowsSignals,
    setSignalsToWindow,
  };
}
