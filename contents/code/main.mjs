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
    addedRemoved: false,
  };

  //Trigger when a window is added to the desktop
  function onWindowAdded(windowNew) {
    if (apiBlocklist.checkBlocklist(windowNew) === true) {
      return;
    }

    state.addedRemoved = true;

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
        windowNew.setMaximize(true, true);
        windowNew.tilePrevious = tilesOrdered[0];
      }

      let layout = apiTiles.getDefaultLayouts(config.layoutDefault - 1);

      if (config.layoutCustom !== undefined) {
        layout = config.layoutCustom;
      }

      apiTiles.setLayout(workspace.currentDesktop, layout);

      if (config.maximizeOpen === false) {
        windowNew.setMaximize(false, false);
        tilesOrdered[0].manage(windowNew);
      }
    }

    state.addedRemoved = false;
  }

  //Trigger when a window is remove to the desktop
  function onWindowRemoved(windowClosed) {
    if (apiBlocklist.checkBlocklist(windowClosed) === true) {
      return false;
    }

    state.addedRemoved = true;

    const continueProcess = apiWindows.setWindowsTiles(
      windowClosed,
      windowClosed.desktops,
      [windowClosed.output],
      config.maximizeClose,
      1,
    );

    if (continueProcess === false) {
      state.addedRemoved = false;
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
      windowMain.signalTileChangedConnected = true;
      windowMain.tileChanged.connect(onTileChanged);
    } else {
      windowMain.tileChanged.disconnect(onTileChanged);
      windowMain.signalTileChangedConnected = false;
    }
  }

  //When a window tile is changed, exchange windows and extend windows
  function onTileChanged(tileNew) {
    if (state.addedRemoved === true) {
      return;
    }

    if (
      tileNew !== null &&
      config.windowsOrderMove === true &&
      tileNew?.windows.filter((w) => w !== state.windowFocused.window).length >
        0
    ) {
      apiTiles.exchangeTiles(
        state.windowFocused.window,
        tileNew,
        state.windowFocused.tile,
      );

      state.windowFocused.tile = state.windowFocused.window.tile;
      state.windowFocused.window.tilePrevious = state.windowFocused.window.tile;
    }

    if (config.windowsExtendMove === true) {
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
      return;
    }

    //If not fullscreen
    const tilePrevious = apiTiles.getPreviousTile(windowMain);
    tilePrevious?.manage(windowMain);

    const windows = apiWindows.getWindows(
      windowMain,
      workspace.currentDesktop,
      workspace.activeScreen,
    );

    if (windows.length > 0) {
      apiWindows.extendWindows(
        [windowMain, ...windows],
        apiWorkarea.getPanelsSize(
          workspace.activeScreen,
          workspace.currentDesktop,
        ),
      );
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

    const windows = apiWindows.getWindows(
      undefined,
      workspace.currentDesktop,
      workspace.activeScreen,
    );

    if (
      windows.length !== 0 &&
      (config.windowsExtendClose === true || config.windowsExtendOpen === true)
    ) {
      apiWindows.extendWindows(
        windows,
        apiWorkarea.getPanelsSize(
          workspace.activeScreen,
          workspace.currentDesktop,
        ),
      );
    }

    state.addedRemoved = false;
  }

  // Focus window when a current desktop is changed
  function onCurrentDesktopChanged() {
    apiUI.resetLayout();

    if (state.addedRemoved === false) {
      apiWindows.focusWindow();
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
