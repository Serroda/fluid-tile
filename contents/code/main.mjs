import { Blocklist } from "./blocklist.mjs";
import { Shortcuts } from "./shortcuts.mjs";
import { Tiles } from "./tiles.mjs";
import { UI } from "./ui.mjs";
import { Userspace } from "./userspace.mjs";
import { Windows } from "./windows.mjs";

export class Engine {
  constructor(
    workspace,
    config,
    { root, timerExtendDesktop, timerRemoveDesktop },
  ) {
    this.workspace = workspace;
    this.config = config;
    this.rootUI = root;
    this.timerExtendDesktop = timerExtendDesktop;
    this.timerRemoveDesktop = timerRemoveDesktop;
    this.classes = {
      blocklist: new Blocklist(config),
      userspace: new Userspace(workspace),
      tiles: new Tiles(workspace, config),
    };
    this.classes.shortcuts = new Shortcuts(workspace, root, this.classes);
    this.classes.ui = new UI(workspace, config, root, this.classes);
    this.classes.windows = new Windows(workspace, config, this.classes);
    this.state = {
      desktopsExtend: [],
      removeDesktopInfo: {},
    };
  }

  //Trigger when a window is added to the desktop
  onWindowAdded(window) {
    if (this.classes.blocklist.check(window) === true) {
      return;
    }

    const continueProcess = this.classes.windows.setWindowsTilesAdded(window);

    if (this.config.desktopAdd === true && continueProcess === true) {
      this.workspace.createDesktop(this.workspace.desktops.length, "");
      this.workspace.currentDesktop =
        this.workspace.desktops[this.workspace.desktops.length - 1];
      window.desktops = [this.workspace.currentDesktop];

      let layout = this.classes.tiles.getDefaultLayouts(
        this.config.layoutDefault - 1,
      );

      if (this.config.layoutCustom !== undefined) {
        layout = this.config.layoutCustom;
      }

      this.classes.tiles.setLayout(this.workspace.currentDesktop, layout);
      const tilesOrdered = this.classes.tiles.getTilesFromActualDesktop();

      if (this.config.maximizeExtend === true) {
        window.setMaximize(true, true);
      } else {
        window.setMaximize(false, false);
        window._avoidTileChangedTrigger = false;
        tilesOrdered[0].manage(window);
      }

      this.classes.windows.updateShadows(window, tilesOrdered[0]);
    }
  }

  //Trigger when a window is remove to the desktop
  onWindowRemoved(window) {
    if (this.classes.blocklist.check(window) === true) {
      return false;
    }

    const continueProcess = this.classes.windows.setWindowsTilesRemoved(window);

    if (continueProcess === false) {
      this.classes.windows.focusWindow();
      return;
    }

    if (
      continueProcess === true &&
      this.config.desktopRemove === true &&
      this.workspace.desktops.length > 1 &&
      this.workspace.desktops.length > this.config.desktopRemoveMin
    ) {
      this.state.removeDesktopInfo = {
        desktopsId: window.desktops.map((d) => d.id),
        window: window,
      };

      this.timerRemoveDesktop.start();
    }
  }

  //Set signals to all Windows
  setWindowsSignals() {
    for (const windowItem of this.workspace.stackingOrder) {
      this.setSignalsToWindow(windowItem);
    }
  }

  //Set signals to window
  setSignalsToWindow(window) {
    if (this.classes.blocklist.check(window) === true) {
      return;
    }

    window.maximizedAboutToChange.connect((mode) => {
      this.onMaximizeChanged(mode, window);
    });

    window.minimizedChanged.connect(() => {
      this.onMinimizedChanged(window);
    });

    window.interactiveMoveResizeStarted.connect(() => {
      this.classes.ui.onUserMoveStart(window);
    });
    window.interactiveMoveResizeStepped.connect((windowGeometry) => {
      this.classes.ui.onUserMoveStepped(windowGeometry, window);
    });
    window.interactiveMoveResizeFinished.connect(() => {
      const windowMoved = this.classes.ui.onUserMoveFinished(window);
      if (windowMoved === false) {
        this.classes.windows.extendWindowsCurrentDesktop(true);
      }
    });
  }

  //When a window tile is changed, exchange windows and extend windows
  onWindowAddedToTile(tile, window) {
    //Trigger when a window is maximized but not minimized
    //when a window exchange
    console.log(
      "window added to tile",
      window._avoidTileChangedTrigger,
      window,
      tile,
    );

    if (
      this.rootUI.visible === true ||
      window._avoidTileChangedTrigger === true ||
      window._shadows === undefined
    ) {
      window._avoidTileChangedTrigger =
        window._avoidTileChangedTrigger === true
          ? false
          : window._avoidTileChangedTrigger;

      console.log("avoid", window._avoidTileChangedTrigger);

      return;
    }

    const windowsOther = this.classes.windows
      .getWindows(window)
      .filter(
        (w) =>
          w.minimized === false &&
          (w.tile === tile || w._shadows?.tile === tile),
      );

    if (windowsOther.length > 0) {
      this.classes.tiles.exchangeTiles(
        windowsOther,
        window._shadows.tile,
        window._shadows.desktop,
        window._shadows.screen,
      );
    }

    if (
      this.workspace.currentDesktop !== window._shadows.desktop &&
      this.state.desktopsExtend.includes(window._shadows.desktop) === false
    ) {
      this.state.desktopsExtend.push(window._shadows.desktop);
    }

    //Start delay only when you have to exchange in another screen
    if (window._shadows.screen !== this.workspace.activeScreen) {
      this.timerExtendDesktop.interval =
        this.config.windowsExtendTileChangedDelay;
      this.timerExtendDesktop.start();
    } else if (
      this.classes.tiles.getTilesFromActualDesktop().length >
        windowsOther.length + 1 ||
      window._maximized === false
    ) {
      //Start timer without delay, if you dont execute `extendWindows` inside
      //QTimer, `extendWindows` doesnt get the correct position of the windows
      this.timerExtendDesktop.interval = 0;
      this.timerExtendDesktop.start();
    }

    console.log("update shadow tile changed");
    // Set `tileNew` to `_shadows.tile` when window is maximized for avoid
    // `windowMain.tile === null` and `windowMain._shadows.tile === oldCopyTile`
    // setting `tileNew` we get now `windowMain._shadows.tile === tileNew`

    this.classes.windows.updateShadows(window, tile);
  }

  //When window is not maximized, set a previous tile
  onMaximizeChanged(mode, window) {
    window._maximized = mode === 3;

    //When a window is maximized window.tile is always null
    console.log("maximize change", window, mode, window._avoidMaximizeTrigger);

    if (
      this.rootUI.visible === true ||
      window._maximized === true ||
      window._avoidMaximizeTrigger === true ||
      window._shadows === undefined ||
      window.tile !== null
    ) {
      window._avoidMaximizeTrigger =
        window._avoidMaximizeTrigger === true
          ? false
          : window._avoidMaximizeTrigger;
      console.log("avoid", window._avoidMaximizeTrigger);
      return;
    }

    //If not fullscreen
    if (window.tile !== window._shadows.tile) {
      console.log("maximize manage");
      window._avoidTileChangedTrigger = false;
      window._avoidMaximizeExtend = true;
      window._shadows.tile?.manage(window);
    }
  }

  //When a window is minimized, extend windows
  onMinimizedChanged(window) {
    if (
      window.desktops.includes(this.workspace.currentDesktop) === false &&
      this.state.desktopsExtend.includes(this.workspace.currentDesktop) ===
        false
    ) {
      this.state.desktopsExtend.push(this.workspace.currentDesktop);
      return;
    }

    window.setMaximize(false, false);
    this.classes.windows.extendWindowsCurrentDesktop(true);
  }

  onTimerRemoveDesktopFinished() {
    //Case: Applications that open a window and, when an action is performed,
    //close the window and open another window (Chrome profile selector).
    //This timer avoid crash wayland
    const desktopsRemove = [];

    desktopLoop: for (const desktopItem of this.workspace.desktops.filter((d) =>
      this.state.removeDesktopInfo.desktopsId.includes(d.id),
    )) {
      for (const screenItem of this.workspace.screens) {
        const windowsOtherSpecialCases = this.classes.windows.getWindows(
          this.state.removeDesktopInfo.window,
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
      this.workspace.removeDesktop(desktop);
    }

    this.state.removeDesktopInfo = {};
    this.classes.windows.extendWindowsCurrentDesktop();
  }

  //Extend windows when timer finish
  onTimerExtendDesktopFinished() {
    this.classes.windows.extendWindowsCurrentDesktop(true);
  }

  // Focus window when a current desktop is changed
  onCurrentDesktopChanged() {
    console.log("desktop changed");
    this.classes.ui.resetLayout();
    this.setTilesSignals();
    this.classes.windows.focusWindow();

    if (
      this.state.desktopsExtend.includes(this.workspace.currentDesktop) === true
    ) {
      this.classes.windows.extendWindowsCurrentDesktop(true);
      this.state.desktopsExtend.splice(
        this.state.desktopsExtend.indexOf(this.workspace.currentDesktop),
        1,
      );
    }
  }

  //Set signal to tiles
  setTilesSignals() {
    const rootTile = this.classes.tiles.getRootTile();

    if (rootTile === null) {
      return;
    }

    if (rootTile._childTilesSignalFunction !== undefined) {
      rootTile.childTilesChanged.disconnect(rootTile._childTilesSignalFunction);
    } else {
      rootTile._childTilesSignalFunction = this.onChildTilesChanged.bind(this);
    }

    rootTile.childTilesChanged.connect(
      rootTile._childTilesSignalFunction.bind(this),
    );

    const tiles = this.classes.tiles.getTilesFromActualDesktop();

    for (const tile of tiles) {
      if (tile._signalsFunctions !== undefined) {
        tile.childTilesChanged.disconnect(tile._signalsFunctions.childTiles);
        tile.windowAdded.disconnect(tile._signalsFunctions.windowAdded);
      } else {
        tile._signalsFunctions = {
          childTiles: this.onChildTilesChanged.bind(this),
          windowAdded: this.onWindowAddedToTile.bind(this, tile),
        };
      }

      console.log("signal added", tile);
      tile.childTilesChanged.connect(tile._signalsFunctions.childTiles);
      tile.windowAdded.connect(tile._signalsFunctions.windowAdded);
    }
  }

  onChildTilesChanged() {
    this.setTilesSignals();
    this.classes.windows.extendWindowsCurrentDesktop();
  }
}
